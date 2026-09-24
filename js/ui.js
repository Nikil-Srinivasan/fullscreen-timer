/* ---------------------------------------------------------------------------
   ui.js — everything that writes to the DOM.

   Keeping the "reflect state on screen" code in one place means main.js can
   stay a description of behaviour rather than a pile of element lookups.
--------------------------------------------------------------------------- */

import { PRESET_MINUTES } from './state.js';
import { splitDuration } from './format.js';

const $ = (id) => document.getElementById(id);

export const el = {
  app: $('app'),
  topbar: $('topbar'),

  ring: $('ring'),
  ringTrack: $('ring-track'),
  ringProgress: $('ring-progress'),

  clockBadge: $('clock-badge'),

  stage: $('stage'),
  stageHit: $('stage-hit'),
  digits: $('digits'),
  digitsText: $('digits-text'),
  digitHours: $('digit-hours'),
  digitHourSep: $('digit-hoursep'),
  digitMinutes: $('digit-minutes'),
  digitSeconds: $('digit-seconds'),
  pulse: $('pulse'),
  finish: $('finish'),
  digitsInput: $('digits-input'),
  live: $('live'),

  controls: $('controls'),
  btnStart: $('btn-start'),
  startIcon: $('start-icon-path'),
  startLabel: $('start-label'),
  btnReset: $('btn-reset'),
  btnFullscreen: $('btn-fullscreen'),
  fsIcon: $('fs-icon-path'),
  btnSettings: $('btn-settings'),
  btnHelp: $('btn-help'),

  settings: $('settings'),
  settingsClose: $('settings-close'),
  groupDuration: $('group-duration'),
  inHours: $('in-hours'),
  inMinutes: $('in-minutes'),
  inSeconds: $('in-seconds'),
  presets: $('presets'),
  inReveal: $('in-reveal'),
  revealValue: $('reveal-value'),
  optSound: $('opt-sound'),
  optRing: $('opt-ring'),
  optWake: $('opt-wake'),
  optClock: $('opt-clock'),

  help: $('help'),
  helpClose: $('help-close'),
  toast: $('toast'),
  scrim: $('scrim'),
};

/* --- Icon paths --------------------------------------------------------- */

const ICON = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',

  // Four short diagonal arrows, one per corner — rendered with .icon--stroke
  // (fill:none; stroke instead), which makes each one's direction just a
  // line-to plus two wing lines at the arrowhead end, unambiguous to read
  // back off the coordinates: expand's arrowheads sit at the outer corners
  // (pointing away from centre), contract's sit at the inner points
  // (pointing toward it), with the same four corners either way.
  expand: 'M9 9 4 4M4 8V4H8M15 9 20 4M20 8V4H16M9 15 4 20M4 16V20H8M15 15 20 20M20 16V20H16',
  contract: 'M4 4 9 9M9 5V9H5M20 4 15 9M15 5V9H19M4 20 9 15M9 19V15H5M20 20 15 15M15 19V15H19',
};

/* --- Reflecting state --------------------------------------------------- */

export function setStartButton(running) {
  el.startIcon.setAttribute('d', running ? ICON.pause : ICON.play);
  el.startLabel.textContent = running ? 'Pause' : 'Start';
  el.btnStart.title = running ? 'Pause (Space)' : 'Start (Space)';
  el.app.dataset.running = running ? 'true' : 'false';
}

/** Nothing to run a zero-length countdown from — leaves the Start/Pause label alone. */
export function setStartEnabled(enabled) {
  el.btnStart.disabled = !enabled;
}

export function setModeUI(mode) {
  const countdown = mode === 'countdown';
  el.groupDuration.hidden = !countdown;
  // The segmented mode toggle in the controls bar shows the mode you're IN,
  // not the one you'd switch to — that's the whole point of it over the old
  // single button, which named the other mode and left people guessing.
  syncSegmented('[data-mode]', 'mode', mode);
}

/** Hide/theme/sound no longer have their own toolbar buttons — they're set
    from Settings only now — but still drive the Settings panel's own
    segmented controls, which this keeps in sync exactly as before. */
export function setHideUI(hide) {
  syncSegmented('[data-hide]', 'hide', hide);
}

export function setThemeUI(theme) {
  syncSegmented('[data-theme-opt]', 'themeOpt', theme);
}

export function setFullscreenUI(active) {
  el.fsIcon.setAttribute('d', active ? ICON.contract : ICON.expand);
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  el.btnFullscreen.title = `${label} (F)`;
  el.btnFullscreen.setAttribute('aria-label', label);
  el.btnFullscreen.setAttribute('aria-pressed', active ? 'true' : 'false');
}

export function setBlank(blank) {
  el.app.dataset.blank = blank ? 'true' : 'false';
  el.pulse.hidden = !blank;
}

export function setFinished(finished) {
  el.app.dataset.finished = finished ? 'true' : 'false';
  el.finish.hidden = !finished;
}

export function setTone(tone) {
  el.app.dataset.tone = tone;
}

export function setRingVisible(visible) {
  el.app.dataset.ring = visible ? 'on' : 'off';
}

export function setIdle(idle) {
  el.app.dataset.idle = idle ? 'true' : 'false';
}

export function setClockBadge(text) {
  el.clockBadge.hidden = !text;
  el.clockBadge.textContent = text || '';
}

const SEGMENTS = { hours: el.digitHours, minutes: el.digitMinutes, seconds: el.digitSeconds };

/** Highlight whichever digit group the wheel and arrow keys currently adjust. */
export function setSelectedUnit(unit) {
  // Swipe is live exactly when a unit is highlighted (see .digits touch-action).
  el.app.dataset.editing = unit ? 'true' : 'false';
  Object.entries(SEGMENTS).forEach(([name, node]) => {
    node.classList.toggle('digits__seg--selected', name === unit);
  });
}

export function announce(text) {
  el.live.textContent = text;
}

/* --- Segmented controls ------------------------------------------------- */

function syncSegmented(selector, datasetKey, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.setAttribute('aria-checked', node.dataset[datasetKey] === String(value) ? 'true' : 'false');
  });
}

/* --- Presets ------------------------------------------------------------ */

export function buildPresets(onPick) {
  el.presets.innerHTML = '';
  PRESET_MINUTES.forEach((minutes, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = `${minutes} min`;
    chip.dataset.minutes = String(minutes);
    chip.title = `Preset ${index + 1}`;
    chip.addEventListener('click', () => onPick(minutes * 60_000));
    el.presets.appendChild(chip);
  });
}

function syncPresets(durationMs) {
  el.presets.querySelectorAll('.chip').forEach((chip) => {
    const active = Number(chip.dataset.minutes) * 60_000 === durationMs;
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

/* --- Settings panel ----------------------------------------------------- */

/** Push settings into the panel. Skips the field being typed in. */
export function syncPanel(settings) {
  const active = document.activeElement;
  const write = (node, value) => {
    if (node !== active) node.value = String(value);
  };

  const { hours, minutes, seconds } = splitDuration(settings.durationMs);
  write(el.inHours, hours);
  write(el.inMinutes, minutes);
  write(el.inSeconds, seconds);
  syncPresets(settings.durationMs);

  write(el.inReveal, Math.round(settings.revealMs / 1000));
  el.revealValue.textContent = String(Math.round(settings.revealMs / 1000));

  el.optSound.checked = settings.sound;
  el.optRing.checked = settings.ring;
  el.optWake.checked = settings.wake;
  el.optClock.checked = settings.showClock;
}

/* --- Sheets and toast --------------------------------------------------- */

export function openSheet(node) {
  closeSheets();
  node.hidden = false;
  el.scrim.hidden = false;
  const focusable = node.querySelector('button, input, select');
  if (focusable) focusable.focus({ preventScroll: true });
}

export function closeSheets() {
  el.settings.hidden = true;
  el.help.hidden = true;
  el.scrim.hidden = true;
}

export function anySheetOpen() {
  return !el.settings.hidden || !el.help.hidden;
}

export function toggleSheet(node) {
  if (node.hidden) openSheet(node);
  else closeSheets();
}

let toastTimer = 0;

export function toast(message, ms = 2_000) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, ms);
}
