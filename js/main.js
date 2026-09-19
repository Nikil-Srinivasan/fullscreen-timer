/* ---------------------------------------------------------------------------
   main.js — wiring.

   Everything mechanical lives in the other modules; this file describes what
   the app actually does when you press things.
--------------------------------------------------------------------------- */

import * as store from './state.js';
import { MAX_DURATION_MS, PRESET_MINUTES } from './state.js';
import { createClock } from './clock.js';
import { createDigits, createRing } from './display.js';
import { createHideController } from './hide-mode.js';
import { createSound } from './sound.js';
import { bindKeyboard } from './keyboard.js';
import * as ui from './ui.js';
import { el } from './ui.js';
import { applyTheme, nextTheme, onSystemThemeChange } from './theme.js';
import {
  exitPseudoFullscreen,
  isFullscreen,
  onFullscreenChange,
  reacquireWakeLock,
  releaseWakeLock,
  requestWakeLock,
  toggleFullscreen,
} from './screen.js';
import { describeDuration, formatClock, formatTime, joinDuration } from './format.js';

const IDLE_MS = 3_000;

/** The title as authored in the HTML, restored whenever the clock is idle. */
const DOCUMENT_TITLE = document.title;

let settings = store.load();
let zeroReached = false;

const clock = createClock(onTick);
const digits = createDigits({ svg: el.digits, text: el.digitsText });
const ring = createRing({ svg: el.ring, track: el.ringTrack, progress: el.ringProgress });
const hide = createHideController();
const sound = createSound();

/* --- The tick ----------------------------------------------------------- */

function onTick(elapsedMs, running) {
  const countdown = settings.mode === 'countdown';

  let displayMs;
  let displaySeconds;
  let fraction;
  let tone = 'normal';

  if (countdown) {
    const remaining = settings.durationMs - elapsedMs;

    if (remaining <= 0 && !zeroReached) {
      zeroReached = true;
      handleZero();
    } else if (remaining > 0 && zeroReached) {
      zeroReached = false; // time was added back on
    }

    // Without overtime the clock simply stops on zero.
    if (remaining <= 0 && !settings.overtime && running) {
      clock.pause();
      return;
    }

    displayMs = settings.overtime ? remaining : Math.max(0, remaining);
    displaySeconds = Math.ceil(Math.max(0, remaining) / 1000);
    fraction = settings.durationMs > 0
      ? Math.max(0, Math.min(1, remaining / settings.durationMs))
      : 0;

    if (settings.durationMs > 0) {
      if (remaining <= settings.dangerMs) tone = 'danger';
      else if (remaining <= settings.warnMs) tone = 'warn';
    }
  } else {
    displayMs = elapsedMs;
    displaySeconds = Math.floor(elapsedMs / 1000);
    fraction = (elapsedMs % 60_000) / 60_000; // one sweep per minute
  }

  const text = formatTime(displayMs, countdown);
  digits.render(text);
  ring.setFraction(fraction);
  ui.setTone(tone);

  const { blank } = hide.update({
    hideMinutes: settings.hide === 'off' ? 0 : Number(settings.hide),
    displaySeconds,
    running,
    revealMs: settings.revealMs,
  });
  ui.setBlank(blank);

  // Prefix the tab title while running, but put the real one back when idle —
  // overwriting it with a short label would throw away the page title that
  // search results and bookmarks use.
  const title = running ? `${text} · Fullscreen Timer` : DOCUMENT_TITLE;
  if (title !== document.title) document.title = title;
}

function handleZero() {
  if (settings.sound) sound.alarm({ repeat: settings.repeat });
  if (navigator.vibrate) {
    try {
      navigator.vibrate([180, 90, 180]);
    } catch {
      /* not every device means it */
    }
  }
  hide.peek(Math.max(settings.revealMs, 3_000)); // a hidden timer must show zero
  ui.announce('Time is up');
}

/* --- Actions ------------------------------------------------------------ */

function syncWakeLock() {
  if (clock.running && settings.wake) requestWakeLock();
  else releaseWakeLock();
}

const actions = {
  toggleStart() {
    sound.unlock();
    sound.stop();

    // Pressing start on an expired countdown starts it again from the top.
    if (!clock.running && settings.mode === 'countdown' && clock.elapsed >= settings.durationMs) {
      clock.reset();
      hide.reset();
      zeroReached = false;
    }

    clock.toggle();
    ui.setStartButton(clock.running);
    syncWakeLock();
    ui.announce(clock.running ? 'Started' : 'Paused');
  },

  reset() {
    sound.stop();
    clock.reset();
    hide.reset();
    zeroReached = false;
    ui.setStartButton(false);
    syncWakeLock();
    ui.announce('Reset');
  },

  toggleMode() {
    const mode = settings.mode === 'countdown' ? 'stopwatch' : 'countdown';
    sound.stop();
    clock.reset();
    hide.reset();
    zeroReached = false;
    store.set({ mode });
    ui.setStartButton(false);
    syncWakeLock();
  },

  setMode(mode) {
    if (mode === settings.mode) return;
    actions.toggleMode();
  },

  cycleHide() {
    const order = ['off', '1', '5'];
    const next = order[(order.indexOf(settings.hide) + 1) % order.length];
    store.set({ hide: next });
    hide.reset();
    ui.toast(next === 'off' ? 'Timer visible' : `Hidden · flashes every ${next} min`);
  },

  cycleTheme() {
    store.set({ theme: nextTheme(settings.theme) });
  },

  toggleSound() {
    const on = !settings.sound;
    store.set({ sound: on });
    if (!on) sound.stop();
    ui.toast(on ? 'Alarm on' : 'Alarm muted');
  },

  toggleFullscreen() {
    toggleFullscreen().then((active) => {
      ui.setFullscreenUI(active);
      markActive();
    });
  },

  /** Arrow keys: add or remove countdown time, live if it is running. */
  adjust(deltaMs) {
    if (settings.mode !== 'countdown') {
      ui.toast('Switch to countdown to set a length');
      return;
    }
    const next = Math.min(MAX_DURATION_MS, Math.max(0, settings.durationMs + deltaMs));
    if (next === settings.durationMs) return;
    store.set({ durationMs: next });
    ui.toast(describeDuration(next));
  },

  preset(index) {
    const minutes = PRESET_MINUTES[index];
    if (minutes === undefined) return;
    actions.setDuration(minutes * 60_000);
  },

  setDuration(ms) {
    const patch = { durationMs: ms };
    if (settings.mode !== 'countdown') patch.mode = 'countdown';
    store.set(patch);
    if (!clock.running) {
      clock.reset();
      hide.reset();
      zeroReached = false;
    }
  },

  openSettings() {
    ui.toggleSheet(el.settings);
    markActive();
  },

  openHelp() {
    ui.toggleSheet(el.help);
    markActive();
  },

  escape() {
    if (ui.anySheetOpen()) {
      ui.closeSheets();
      return;
    }
    exitPseudoFullscreen();
    ui.setFullscreenUI(isFullscreen());
  },

  /** Any unbound key is read as "let me see the time". */
  unboundKey() {
    if (el.app.dataset.blank === 'true') {
      hide.peek(settings.revealMs);
      clock.emit();
    }
  },
};

/* --- Settings changes --------------------------------------------------- */

store.subscribe((next, changed) => {
  settings = next;

  applyTheme(settings.theme);
  ui.setModeUI(settings.mode, settings.durationMs);
  ui.setHideUI(settings.hide);
  ui.setThemeUI(settings.theme);
  ui.setSoundUI(settings.sound);
  ui.setRingVisible(settings.ring);
  ui.syncPanel(settings);
  updateClockBadge();

  if (changed.includes('wake')) syncWakeLock();
  if (changed.includes('hide')) hide.reset();

  scheduleHashUpdate();
  clock.emit();
});

/* Keep the address bar in step, so the page can always be bookmarked as-is.
   replaceState avoids filling the back button with every slider nudge. */
let hashTimer = 0;
function scheduleHashUpdate() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try {
      history.replaceState(null, '', store.shareUrl());
    } catch {
      /* file:// and some embeds disallow it */
    }
  }, 600);
}

/* --- Idle chrome -------------------------------------------------------- */

let idleTimer = 0;

function markActive() {
  ui.setIdle(false);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (isFullscreen() && !ui.anySheetOpen()) ui.setIdle(true);
  }, IDLE_MS);
}

['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
  window.addEventListener(type, markActive, { passive: true });
});

/* --- Time of day -------------------------------------------------------- */

function updateClockBadge() {
  ui.setClockBadge(settings.showClock ? formatClock() : '');
}

setInterval(updateClockBadge, 15_000);

/* --- DOM events --------------------------------------------------------- */

el.btnStart.addEventListener('click', actions.toggleStart);
el.btnReset.addEventListener('click', actions.reset);
el.btnMode.addEventListener('click', actions.toggleMode);
el.btnHide.addEventListener('click', actions.cycleHide);
el.btnTheme.addEventListener('click', actions.cycleTheme);
el.btnSound.addEventListener('click', actions.toggleSound);
el.btnFullscreen.addEventListener('click', actions.toggleFullscreen);
el.btnSettings.addEventListener('click', actions.openSettings);
el.btnHelp.addEventListener('click', actions.openHelp);
el.settingsClose.addEventListener('click', ui.closeSheets);
el.helpClose.addEventListener('click', ui.closeSheets);
el.scrim.addEventListener('click', ui.closeSheets);

el.stageHit.addEventListener('click', () => {
  sound.unlock();
  // While the screen is blank, a tap is a peek — not a start or a stop.
  if (el.app.dataset.blank === 'true') {
    hide.peek(settings.revealMs);
    clock.emit();
    return;
  }
  actions.toggleStart();
});

/* Scrolling over the timer nudges it, the same as the up and down arrows.
   Deltas are accumulated so a trackpad's stream of tiny events steps once
   rather than a hundred times, and normalised because browsers report wheel
   distance in pixels, lines or pages depending on the device. */
const WHEEL_STEP = 50;
let wheelAccumulated = 0;

el.stage.addEventListener(
  'wheel',
  (event) => {
    if (settings.mode !== 'countdown') return;
    event.preventDefault();

    // Holding shift turns a vertical wheel into a horizontal one.
    const raw = event.deltaY || event.deltaX;
    const pixels = event.deltaMode === 1 ? raw * 16 : event.deltaMode === 2 ? raw * 100 : raw;

    wheelAccumulated += pixels;
    const steps = Math.trunc(wheelAccumulated / WHEEL_STEP);
    if (!steps) return;
    wheelAccumulated -= steps * WHEEL_STEP;

    // Scrolling up adds time, matching ArrowUp.
    actions.adjust(-steps * (event.shiftKey ? 60_000 : 10_000));
  },
  { passive: false },
);

document.querySelectorAll('[data-mode]').forEach((node) => {
  node.addEventListener('click', () => actions.setMode(node.dataset.mode));
});

document.querySelectorAll('[data-hide]').forEach((node) => {
  node.addEventListener('click', () => {
    store.set({ hide: node.dataset.hide });
    hide.reset();
  });
});

document.querySelectorAll('[data-theme-opt]').forEach((node) => {
  node.addEventListener('click', () => store.set({ theme: node.dataset.themeOpt }));
});

/* Duration fields */
function readDurationFields() {
  const value = joinDuration({
    hours: Number(el.inHours.value) || 0,
    minutes: Number(el.inMinutes.value) || 0,
    seconds: Number(el.inSeconds.value) || 0,
  });
  actions.setDuration(Math.min(MAX_DURATION_MS, Math.max(0, value)));
}

[el.inHours, el.inMinutes, el.inSeconds].forEach((input) => {
  input.addEventListener('input', readDurationFields);
  input.addEventListener('blur', () => ui.syncPanel(settings));
});

ui.buildPresets((ms) => actions.setDuration(ms));

el.inReveal.addEventListener('input', () => {
  store.set({ revealMs: Number(el.inReveal.value) * 1000 });
});

el.inWarn.addEventListener('input', () => {
  store.set({ warnMs: Number(el.inWarn.value) * 1000 });
});

el.inDanger.addEventListener('input', () => {
  store.set({ dangerMs: Number(el.inDanger.value) * 1000 });
});

el.optSound.addEventListener('change', () => store.set({ sound: el.optSound.checked }));
el.optRepeat.addEventListener('change', () => store.set({ repeat: el.optRepeat.checked }));
el.optRing.addEventListener('change', () => store.set({ ring: el.optRing.checked }));
el.optOvertime.addEventListener('change', () => store.set({ overtime: el.optOvertime.checked }));
el.optWake.addEventListener('change', () => store.set({ wake: el.optWake.checked }));
el.optClock.addEventListener('change', () => store.set({ showClock: el.optClock.checked }));

document.getElementById('btn-share').addEventListener('click', async () => {
  const url = store.shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    ui.toast('Link copied');
  } catch {
    // Clipboard needs a secure context and permission; the URL bar already
    // holds the same link, so point at that instead of failing silently.
    ui.toast('Copy the address bar — it holds this setup', 3_500);
  }
});

document.getElementById('btn-defaults').addEventListener('click', () => {
  store.reset();
  actions.reset();
  ui.toast('Defaults restored');
});

/* --- Browser events ----------------------------------------------------- */

onFullscreenChange((active) => {
  ui.setFullscreenUI(active);
  if (!active) ui.setIdle(false);
  ring.layout();
});

onSystemThemeChange(() => {
  if (settings.theme === 'auto') ui.setThemeUI(settings.theme);
});

/* Someone pasted a shared link into this tab. Our own replaceState does not
   fire this event, so anything arriving here came from outside. */
window.addEventListener('hashchange', () => {
  store.reload();
  actions.reset();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  clock.emit();
  reacquireWakeLock();
});

window.addEventListener('pagehide', () => {
  releaseWakeLock();
  sound.stop();
});

bindKeyboard(actions);

/* --- Start ------------------------------------------------------------- */

applyTheme(settings.theme);
ui.setModeUI(settings.mode, settings.durationMs);
ui.setHideUI(settings.hide);
ui.setThemeUI(settings.theme);
ui.setSoundUI(settings.sound);
ui.setRingVisible(settings.ring);
ui.setFullscreenUI(isFullscreen());
ui.setStartButton(false);
ui.setBlank(false);
ui.setTone('normal');
ui.syncPanel(settings);
updateClockBadge();
markActive();
clock.emit();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  });
}
