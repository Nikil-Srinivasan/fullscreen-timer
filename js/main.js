/* ---------------------------------------------------------------------------
   main.js — wiring.

   Everything mechanical lives in the other modules; this file describes what
   the app actually does when you press things.
--------------------------------------------------------------------------- */

import * as store from './state.js';
import { DANGER_FRACTION, MAX_DURATION_MS, MIN_DURATION_MS, PRESET_MINUTES, WARN_FRACTION } from './state.js';
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
import { formatClock, formatTime, joinDuration, splitDisplay, spokenTime } from './format.js';

const IDLE_MS = 3_000;

/** How long the "Time's up" state lingers before settling to the reset 0:00. */
const FINISH_MS = 6_000;

/** The title as authored in the HTML, restored whenever the clock is idle. */
const DOCUMENT_TITLE = document.title;

/** What one wheel notch or arrow-key press changes, in whichever unit is selected. */
const UNIT_STEP_MS = { hours: 3_600_000, minutes: 60_000, seconds: 1_000 };

let settings = store.load();
let zeroReached = false;
let finishTimer = 0;
let selectedUnit = 'seconds'; // which digit group the wheel and arrow keys adjust
// Whether that selection should actually be highlighted. Separate from
// selectedUnit itself so pressing Start can forget the highlight for the
// rest of this run — without one, pausing (by hand or by the countdown
// auto-stopping at zero) would resurrect whatever was clicked before Start.
let selectionVisible = false;

const clock = createClock(onTick);
const digits = createDigits({
  svg: el.digits,
  text: el.digitsText,
  hours: el.digitHours,
  hourSep: el.digitHourSep,
  minutes: el.digitMinutes,
  seconds: el.digitSeconds,
});
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
    const rawRemaining = settings.durationMs - elapsedMs;
    const remaining = Math.max(0, rawRemaining);

    // Only a live countdown can "reach" zero. Both checks require `running`:
    // editing the length while paused can easily make durationMs dip to or
    // below the (frozen) elapsed time for a moment — e.g. shortening a
    // countdown you paused partway through — and that must never be read as
    // a finish. A zero-length countdown (fresh off Reset, or before anything
    // is dialled in) is "nothing configured" rather than "just finished"
    // either way, which the durationMs > 0 guard covers on its own.
    if (rawRemaining <= 0 && !zeroReached && settings.durationMs > 0 && running) {
      zeroReached = true;
      handleZero();
    } else if (rawRemaining > 0 && zeroReached) {
      zeroReached = false; // time was added back on
    }

    // The countdown always stops itself at zero — never counts negative. It
    // does more than pause: it resets to zero exactly like the Reset button,
    // the same instant it finishes. That guarantees there is no leftover
    // elapsed time sitting behind the scenes that a later edit could collide
    // with and misread as "reached zero" again (see the guard above).
    if (rawRemaining <= 0 && running) {
      finishCountdown();
      return;
    }

    displayMs = remaining;
    displaySeconds = Math.ceil(remaining / 1000);

    // Thresholds as a fraction of the *original* length, not a fixed number
    // of seconds, so a 3 hour exam and a 3 minute round both start warning at
    // "60% left" rather than at the same absolute mark. A zero-length
    // countdown has no fraction of anything to be low on, so it stays the
    // neutral tone. The colour itself is gated on `running` too — dialling a
    // short length in while paused is not a warning, it is just what you
    // asked for; amber/red only mean something once the clock is live.
    if (settings.durationMs > 0) {
      const remainingFraction = remaining / settings.durationMs;
      fraction = Math.max(0, Math.min(1, remainingFraction));
      if (running) {
        if (remainingFraction <= DANGER_FRACTION) tone = 'danger';
        else if (remainingFraction <= WARN_FRACTION) tone = 'warn';
      }
    } else {
      fraction = 0;
    }
  } else {
    displayMs = elapsedMs;
    displaySeconds = Math.floor(elapsedMs / 1000);
    fraction = (elapsedMs % 60_000) / 60_000; // one sweep per minute
  }

  digits.render(splitDisplay(displayMs, countdown));
  ring.setFraction(fraction);
  ui.setTone(tone);

  const { blank } = hide.update({
    hideMinutes: settings.hide === 'off' ? 0 : Number(settings.hide),
    displaySeconds,
    running,
    revealMs: settings.revealMs,
  });
  ui.setBlank(blank);
  syncSpokenTime(displayMs, countdown, running, tone, blank, displaySeconds);

  // Prefix the tab title while running, but put the real one back when idle —
  // overwriting it with a short label would throw away the page title that
  // search results and bookmarks use.
  const title = running ? `${formatTime(displayMs, countdown)} · Fullscreen Timer` : DOCUMENT_TITLE;
  if (title !== document.title) document.title = title;
}

let lastLabel = '';
let lastSpokenTone = 'normal';
let lastSpokenMinute = -1;

/** Screen readers get the time as the digits SVG's label (read on demand, so
    updated every change — it is not announced), plus a polite announcement
    once a minute and whenever the amber/red tone kicks in, so colour is never
    the only signal. A blanked (hidden) timer stays hidden from them too. */
function syncSpokenTime(displayMs, countdown, running, tone, blank, displaySeconds) {
  const label = blank ? 'Timer hidden' : `Timer, ${spokenTime(displayMs, countdown)}`;
  if (label !== lastLabel) {
    lastLabel = label;
    el.digits.setAttribute('aria-label', label);
  }

  if (!running) {
    lastSpokenTone = 'normal';
    lastSpokenMinute = -1;
    return;
  }
  if (blank) return;

  const minute = Math.floor(displaySeconds / 60);
  if (tone !== lastSpokenTone) {
    lastSpokenTone = tone;
    if (tone !== 'normal') {
      ui.announce(`${tone === 'danger' ? 'Almost out of time' : 'Warning'}, ${spokenTime(displayMs, countdown)} left`);
      lastSpokenMinute = minute;
      return;
    }
  }
  if (displaySeconds % 60 === 0 && minute !== lastSpokenMinute && displaySeconds > 0) {
    lastSpokenMinute = minute;
    ui.announce(spokenTime(displayMs, countdown));
  }
}

/** Drop the "Time's up" state — anything the user does next takes over. */
function endFinish() {
  clearTimeout(finishTimer);
  ui.setFinished(false);
}

function handleZero() {
  ui.setFinished(true);
  clearTimeout(finishTimer);
  finishTimer = setTimeout(endFinish, FINISH_MS);
  if (settings.sound) sound.alarm();
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

/** The highlight only makes sense where a click could actually change something:
    countdown mode, paused, and only for a unit clicked since the clock last started. */
function syncSelectedUnit() {
  const show = settings.mode === 'countdown' && !clock.running && selectionVisible;
  ui.setSelectedUnit(show ? selectedUnit : null);
}

/** Nothing to run a zero-length countdown from — keep Start disabled until one is dialled in. */
function syncStartEnabled() {
  ui.setStartEnabled(!(settings.mode === 'countdown' && settings.durationMs === 0));
}

/** Stop the clock and clear run state, without touching what's configured to run next —
    used where a reset is incidental (switching mode, loading a shared link), not requested. */
function resetClock() {
  clock.reset();
  hide.reset();
  zeroReached = false;
  ui.setStartButton(false);
  syncWakeLock();
  syncSelectedUnit();
}

/** A countdown reaching zero behaves exactly like pressing Reset — clock and
    length both back to zero — not just a pause. See onTick for why. */
function finishCountdown() {
  resetClock();
  if (settings.durationMs !== 0) store.set({ durationMs: 0 });
}

const actions = {
  toggleStart() {
    endFinish();
    // Disabled in the DOM, but Space bypasses that — refuse the same way.
    if (settings.mode === 'countdown' && settings.durationMs === 0) return;

    sound.unlock();

    const wasRunning = clock.running;
    clock.toggle();

    // Starting (not pausing): forget which digit was selected, so this run
    // — however it ends, by hand or by reaching zero — does not resurrect a
    // highlight from before Start was pressed.
    if (!wasRunning && clock.running) selectionVisible = false;

    ui.setStartButton(clock.running);
    syncWakeLock();
    syncSelectedUnit();
    ui.announce(clock.running ? 'Started' : 'Paused');
  },

  /** The Reset button/key: clears the clock, and — like a stopwatch clearing to
      zero — clears a countdown's length back to zero too, ready to dial in fresh. */
  reset() {
    endFinish();
    resetClock();
    if (settings.mode === 'countdown' && settings.durationMs !== 0) {
      store.set({ durationMs: 0 });
    }
    ui.announce('Reset');
  },

  toggleMode() {
    endFinish();
    const mode = settings.mode === 'countdown' ? 'stopwatch' : 'countdown';
    resetClock();
    store.set({ mode });
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
    ui.toast(on ? 'Alarm on' : 'Alarm muted');
  },

  toggleFullscreen() {
    toggleFullscreen().then((active) => {
      ui.setFullscreenUI(active);
      markActive();
    });
  },

  /** Add or remove countdown time. Only while paused — a running countdown is not editable. */
  adjust(deltaMs) {
    if (settings.mode !== 'countdown') {
      ui.toast('Switch to timer to set a length');
      return;
    }
    if (clock.running) return;
    const next = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, settings.durationMs + deltaMs));
    if (next === settings.durationMs) return;
    store.set({ durationMs: next });
  },

  /** Click an hour/minute/second digit: choose what the wheel and arrows change.
      Only while paused — nothing is editable while the countdown is running. */
  selectUnit(unit) {
    if (!(unit in UNIT_STEP_MS) || clock.running) return;
    if (settings.mode !== 'countdown') {
      ui.toast('Switch to timer to set a length');
      return;
    }
    selectedUnit = unit;
    selectionVisible = true;
    syncSelectedUnit();
    ui.announce(`Adjusting ${unit}`);
  },

  /** Wheel notches or arrow-key presses: `steps` units of whichever is selected. */
  adjustBySelected(steps) {
    actions.adjust(steps * UNIT_STEP_MS[selectedUnit]);
  },

  preset(index) {
    const minutes = PRESET_MINUTES[index];
    if (minutes === undefined) return;
    actions.setDuration(minutes * 60_000);
  },

  /** Presets and the duration fields: only while paused, same as adjust(). */
  setDuration(ms) {
    if (clock.running) return;
    endFinish();
    const patch = { durationMs: ms };
    if (settings.mode !== 'countdown') patch.mode = 'countdown';
    store.set(patch);
    clock.reset();
    hide.reset();
    zeroReached = false;
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
  ui.setModeUI(settings.mode);
  ui.setHideUI(settings.hide);
  ui.setThemeUI(settings.theme);
  ui.setRingVisible(settings.ring);
  ui.syncPanel(settings);
  updateClockBadge();
  syncSelectedUnit();
  syncStartEnabled();

  if (changed.includes('wake')) syncWakeLock();
  if (changed.includes('hide')) hide.reset();

  clock.emit();
});

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

// A mouse or touch click leaves a button focused, and keyboard.js
// deliberately defers to a focused button on Space/Enter (so Tab-then-Space
// still activates it) — without this, clicking any button with the mouse
// (Reset, Hide, Theme, ...) would silently hijack every later press of the
// Space bar into re-clicking that button instead of toggling Start/Pause.
// event.detail is 0 for a keyboard- or script-triggered click and a
// nonzero click count for a real pointer click, which is exactly the
// distinction needed: blur after a mouse/touch click, but leave focus alone
// for someone who tabbed to a button on purpose and pressed Space or Enter.
document.addEventListener('click', (event) => {
  if (event.detail === 0) return;
  const button = event.target instanceof HTMLElement && event.target.closest('button');
  if (button) button.blur();
});

el.btnStart.addEventListener('click', actions.toggleStart);
el.btnReset.addEventListener('click', actions.reset);
el.btnFullscreen.addEventListener('click', actions.toggleFullscreen);
el.btnSettings.addEventListener('click', actions.openSettings);
el.btnHelp.addEventListener('click', actions.openHelp);
el.settingsClose.addEventListener('click', ui.closeSheets);
el.helpClose.addEventListener('click', ui.closeSheets);
el.scrim.addEventListener('click', ui.closeSheets);

// Only reachable while the screen is blank (layout.css turns off pointer
// events on it otherwise, letting clicks fall through to the digits below).
// A tap there is purely a peek — never a start, pause, or edit.
el.stageHit.addEventListener('click', () => {
  sound.unlock();
  hide.peek(settings.revealMs);
  clock.emit();
});

// Clicking a digit group chooses what the wheel and arrow keys change. The
// click itself never starts, pauses, or resets anything — that is what the
// Start button and Space are for.
el.digits.addEventListener('click', (event) => {
  const segment = event.target.closest('[data-unit]');
  if (!segment) return;
  sound.unlock();
  actions.selectUnit(segment.dataset.unit);
});

/* Scrolling over the timer nudges the selected unit (hours, minutes, or
   seconds — see actions.selectUnit), the same as the arrow keys. Deltas are
   accumulated so a trackpad's stream of tiny events steps once rather than a
   hundred times, and normalised because browsers report wheel distance in
   pixels, lines or pages depending on the device. A mouse wheel notch reports
   a deltaY of about 100px, so that is one step of one unit. */
const WHEEL_STEP = 100;
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
    actions.adjustBySelected(-steps);
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
  actions.setDuration(Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, value)));
}

[el.inHours, el.inMinutes, el.inSeconds].forEach((input) => {
  input.addEventListener('input', readDurationFields);
  input.addEventListener('blur', () => ui.syncPanel(settings));
});

ui.buildPresets((ms) => actions.setDuration(ms));

el.inReveal.addEventListener('input', () => {
  store.set({ revealMs: Number(el.inReveal.value) * 1000 });
});

el.optSound.addEventListener('change', () => store.set({ sound: el.optSound.checked }));
el.optRing.addEventListener('change', () => store.set({ ring: el.optRing.checked }));
el.optWake.addEventListener('change', () => store.set({ wake: el.optWake.checked }));
el.optClock.addEventListener('change', () => store.set({ showClock: el.optClock.checked }));

document.getElementById('btn-share').addEventListener('click', async () => {
  const url = store.shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    ui.toast('Link copied');
  } catch {
    // Clipboard needs a secure context and permission, and the address bar
    // no longer doubles as a fallback copy source (it deliberately stays put
    // instead of rewriting itself on every change), so there is nothing left
    // to point at but trying again.
    ui.toast('Could not copy — check clipboard permissions and try again', 3_500);
  }
});

document.getElementById('btn-defaults').addEventListener('click', () => {
  store.reset();
  endFinish();
  resetClock();
  ui.toast('Defaults restored');
});

/* --- Centring and alignment -----------------------------------------------
   Start and Reset read as a matched pair, but "Start"/"Pause" and "Reset"
   are different-width text at the same padding, so a shared CSS min-width
   only makes them equal where that floor is the binding constraint (wide
   screens) — on narrower ones, whichever label is actually wider wins and
   the two drift apart again. Measuring and pinning both to the wider one's
   rendered width is exact at every size, not just above some breakpoint. */
function matchWidths(nodes) {
  nodes.forEach((node) => {
    node.style.width = '';
  });
  const width = Math.max(...nodes.map((node) => node.getBoundingClientRect().width));
  nodes.forEach((node) => {
    node.style.width = `${width}px`;
  });
  return width;
}

/* The mode toggle above Start/Reset sizes itself off its own content and
   padding — nothing ties the two rows together. Matching its width to the
   now-equalised Start/Reset row is what makes the two read as one aligned
   block, centred on the same line, instead of two independently-sized rows
   that happen to share a midpoint. */
function alignModeToggle() {
  matchWidths([el.btnStart, el.btnReset]);
  const modeToggle = document.querySelector('.segmented--mode');
  modeToggle.style.width = '';
  const width = document.querySelector('.controls__center').getBoundingClientRect().width;
  if (width > 0) modeToggle.style.width = `${width}px`;
}

/* The stage's "1fr" row is the leftover space between the topbar above and
   the controls below — its centre only equals the *viewport's* true centre
   when those two reserve equal height. They never do (the topbar is a
   couple of icons; the bottom carries the whole toolbar), so the digits
   would otherwise sit visibly off-centre, and drift by a different amount
   on every screen and every orientation. Padding out whichever side is
   currently shorter to match the other keeps the middle row — and so the
   digits centred inside it — pinned to the exact centre no matter how tall
   either side ends up being. */
function centerStage() {
  el.topbar.style.marginBottom = '';
  const topH = el.topbar.getBoundingClientRect().height;
  const bottomH = el.controls.getBoundingClientRect().height;
  const diff = bottomH - topH;
  if (diff > 0) el.topbar.style.marginBottom = `${diff}px`;
}

function layoutChrome() {
  alignModeToggle();
  centerStage();
}

let layoutChromeTimer = 0;
function scheduleLayoutChrome() {
  clearTimeout(layoutChromeTimer);
  layoutChromeTimer = setTimeout(layoutChrome, 120);
}

window.addEventListener('resize', scheduleLayoutChrome);

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
  endFinish();
  resetClock();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  clock.emit();
  reacquireWakeLock();
});

window.addEventListener('pagehide', () => {
  releaseWakeLock();
});

bindKeyboard(actions);

/* --- Start ------------------------------------------------------------- */

// index.html/layout.css hide .app (visibility, not display, so it stays
// measurable) until data-ready="true" lands here. That is what stops the
// static markup's defaults — 5:00, "Countdown", "Auto" — from painting
// before this block corrects them to whatever was saved. The try/finally
// guarantees the reveal still happens even if something above throws, so a
// bug here never leaves the page permanently blank.
//
// Waiting for document.fonts.ready first (capped, so a slow or failed font
// load can never hold the reveal hostage) means the digits render in their
// real font — self-hosted Inconsolata, see tokens.css — from the very first
// visible frame, instead of painting in a fallback font and visibly
// resizing when the real one swaps in a moment later.
(async () => {
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  await Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 300))]).catch(() => {});

  try {
    applyTheme(settings.theme);
    ui.setModeUI(settings.mode);
    ui.setHideUI(settings.hide);
    ui.setThemeUI(settings.theme);
    ui.setRingVisible(settings.ring);
    ui.setFullscreenUI(isFullscreen());
    ui.setStartButton(false);
    ui.setBlank(false);
    ui.setTone('normal');
    ui.syncPanel(settings);
    syncSelectedUnit();
    syncStartEnabled();
    updateClockBadge();
    markActive();
    // Runs while .app is still hidden (visibility, not display, keeps it
    // measurable) so the mode toggle is already aligned and the digits
    // already centred for the very first visible frame, instead of
    // shifting into place just after reveal.
    layoutChrome();
    clock.emit();
  } finally {
    document.documentElement.dataset.ready = 'true';
  }
})();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  });
}
