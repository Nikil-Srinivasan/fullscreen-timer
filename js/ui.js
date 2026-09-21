/* ---------------------------------------------------------------------------
   ui.js — everything that writes to the DOM.

   Keeping the "reflect state on screen" code in one place means main.js can
   stay a description of behaviour rather than a pile of element lookups.
--------------------------------------------------------------------------- */

import { PRESET_MINUTES } from './state.js';
import { splitDuration } from './format.js';
import { effectiveTheme, labelFor } from './theme.js';

const $ = (id) => document.getElementById(id);

export const el = {
  app: $('app'),

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
  live: $('live'),

  controls: $('controls'),
  btnStart: $('btn-start'),
  startIcon: $('start-icon-path'),
  startLabel: $('start-label'),
  btnReset: $('btn-reset'),
  btnHide: $('btn-hide'),
  hideIcon: $('hide-icon-path'),
  hideLabel: $('hide-label'),
  btnTheme: $('btn-theme'),
  themeIcon: $('theme-icon-path'),
  themeLabel: $('theme-label'),
  btnSound: $('btn-sound'),
  soundWave: $('sound-icon-wave'),
  soundLabel: $('sound-label'),
  btnFullscreen: $('btn-fullscreen'),
  fsIcon: $('fs-icon-path'),
  fsLabel: $('fs-label'),
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
  optRepeat: $('opt-repeat'),
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

  eye: 'M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  eyeOff:
    'M3.4 2 2 3.4l3.3 3.3C3.9 7.9 2.9 9.4 2.3 10.6a2 2 0 0 0 0 1.8C3.8 15.4 7.4 19 12 19c1.6 0 3.1-.4 4.4-1.1L20.6 22 22 20.6zm8.6 14a4 4 0 0 1-3.8-5.2l1.7 1.7A2 2 0 0 0 12 14.5zm9.7-3.6c-1.2-2.3-3.6-5.2-6.9-6.3l3.1 3.1c.7.6 1.3 1.3 1.7 2-.4.7-.9 1.4-1.6 2l1.4 1.4c.9-.8 1.6-1.6 2.2-2.4a2 2 0 0 0 .1-1.8z',

  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-1-5h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12 12l1.4-1.4 2.1 2.1-1.4 1.4zm2.2-13.4l1.4 1.4-2.1 2.1-1.4-1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1z',
  moon: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',

  wave: 'M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
  cross: 'M20.3 8.9 18.9 7.5 17 9.4l-1.9-1.9-1.4 1.4 1.9 1.9-1.9 1.9 1.4 1.4 1.9-1.9 1.9 1.9 1.4-1.4-1.9-1.9z',

  expand: 'M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM6 15v3h3v2H4v-5zm12 0h2v5h-5v-2h3z',
  contract: 'M9 4h2v5H6V7h3zm4 0h2v3h3v2h-5zm0 11h5v2h-3v3h-2zM6 15h5v5H9v-3H6z',
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

export function setHideUI(hide) {
  const on = hide !== 'off';
  el.hideIcon.setAttribute('d', on ? ICON.eyeOff : ICON.eye);
  el.hideLabel.textContent = on ? `${hide} min` : 'Visible';
  el.btnHide.setAttribute('aria-pressed', on ? 'true' : 'false');
  syncSegmented('[data-hide]', 'hide', hide);
}

export function setThemeUI(theme) {
  el.themeIcon.setAttribute('d', effectiveTheme(theme) === 'dark' ? ICON.moon : ICON.sun);
  el.themeLabel.textContent = labelFor(theme);
  syncSegmented('[data-theme-opt]', 'themeOpt', theme);
}

export function setSoundUI(enabled) {
  el.soundWave.setAttribute('d', enabled ? ICON.wave : ICON.cross);
  el.soundLabel.textContent = enabled ? 'Sound' : 'Muted';
  el.btnSound.setAttribute('aria-pressed', enabled ? 'false' : 'true');
}

export function setFullscreenUI(active) {
  el.fsIcon.setAttribute('d', active ? ICON.contract : ICON.expand);
  el.fsLabel.textContent = active ? 'Exit' : 'Fullscreen';
  el.btnFullscreen.setAttribute('aria-pressed', active ? 'true' : 'false');
}

export function setBlank(blank) {
  el.app.dataset.blank = blank ? 'true' : 'false';
  el.pulse.hidden = !blank;
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
  el.optRepeat.checked = settings.repeat;
  el.optRepeat.disabled = !settings.sound;
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
