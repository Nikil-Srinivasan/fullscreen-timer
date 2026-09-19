/* ---------------------------------------------------------------------------
   state.js — one settings object, with persistence.

   Precedence on load: URL hash  >  localStorage  >  defaults.
   The hash wins so a shared link always opens the timer it describes, even on
   a machine that has its own saved preferences.
--------------------------------------------------------------------------- */

const STORAGE_KEY = 'fullscreen-timer/v1';

export const PRESET_MINUTES = [1, 3, 5, 10, 15, 20, 30, 45, 60];

export const MAX_DURATION_MS = 99 * 3600_000 + 59 * 60_000 + 59_000; // 99:59:59

export const DEFAULTS = Object.freeze({
  mode: 'countdown',   // 'countdown' | 'stopwatch'
  durationMs: 5 * 60_000,
  theme: 'auto',       // 'auto' | 'light' | 'dark'
  hide: 'off',         // 'off' | '1' | '5'  (reveal interval in minutes)
  revealMs: 5_000,     // how long the flash lasts
  warnMs: 120_000,     // amber below this much remaining
  dangerMs: 30_000,    // red below this much remaining
  sound: true,
  repeat: false,       // keep beeping after zero
  ring: true,
  overtime: true,      // keep counting past zero
  wake: true,          // screen wake lock while running
  showClock: false,    // time of day in the corner
});

const state = { ...DEFAULTS };
const listeners = new Set();

/* --- helpers ------------------------------------------------------------ */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const bool = (value, fallback) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
};

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Coerce anything into a valid settings object. Unknown keys are dropped. */
function sanitise(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;

  out.mode = oneOf(raw.mode, ['countdown', 'stopwatch'], DEFAULTS.mode);
  out.theme = oneOf(raw.theme, ['auto', 'light', 'dark'], DEFAULTS.theme);
  out.hide = oneOf(String(raw.hide), ['off', '1', '5'], DEFAULTS.hide);

  out.durationMs = clamp(
    Math.round(num(raw.durationMs, DEFAULTS.durationMs) / 1000) * 1000,
    0,
    MAX_DURATION_MS,
  );
  out.revealMs = clamp(Math.round(num(raw.revealMs, DEFAULTS.revealMs)), 1_000, 30_000);
  out.warnMs = clamp(Math.round(num(raw.warnMs, DEFAULTS.warnMs)), 0, 3_600_000);
  out.dangerMs = clamp(Math.round(num(raw.dangerMs, DEFAULTS.dangerMs)), 0, 3_600_000);

  out.sound = bool(raw.sound, DEFAULTS.sound);
  out.repeat = bool(raw.repeat, DEFAULTS.repeat);
  out.ring = bool(raw.ring, DEFAULTS.ring);
  out.overtime = bool(raw.overtime, DEFAULTS.overtime);
  out.wake = bool(raw.wake, DEFAULTS.wake);
  out.showClock = bool(raw.showClock, DEFAULTS.showClock);

  return out;
}

/* --- storage ------------------------------------------------------------ */

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private mode, disabled storage, corrupt JSON — all fine
  }
}

function writeStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* not worth bothering the user about */
  }
}

/* --- URL hash ----------------------------------------------------------- */

/** Short keys keep the shareable link readable. */
function readHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return null;

  const p = new URLSearchParams(hash);
  if (![...p.keys()].length) return null;

  const raw = {};
  if (p.has('m')) raw.mode = p.get('m') === 'sw' ? 'stopwatch' : 'countdown';
  if (p.has('d')) raw.durationMs = num(p.get('d'), 0) * 1000;
  if (p.has('t')) raw.theme = p.get('t');
  if (p.has('h')) raw.hide = p.get('h');
  if (p.has('r')) raw.revealMs = num(p.get('r'), 5) * 1000;
  if (p.has('w')) raw.warnMs = num(p.get('w'), 120) * 1000;
  if (p.has('g')) raw.dangerMs = num(p.get('g'), 30) * 1000;
  if (p.has('s')) raw.sound = p.get('s');
  if (p.has('rp')) raw.repeat = p.get('rp');
  if (p.has('rg')) raw.ring = p.get('rg');
  if (p.has('ot')) raw.overtime = p.get('ot');
  if (p.has('wk')) raw.wake = p.get('wk');
  if (p.has('ck')) raw.showClock = p.get('ck');

  // Merge over stored settings rather than over defaults, so a partial link
  // (just "#d=600") only changes what it actually names.
  return raw;
}

/** The full link for the current setup. */
export function shareUrl() {
  const p = new URLSearchParams();
  p.set('m', state.mode === 'stopwatch' ? 'sw' : 'cd');
  p.set('d', String(Math.round(state.durationMs / 1000)));
  p.set('t', state.theme);
  p.set('h', state.hide);
  p.set('r', String(Math.round(state.revealMs / 1000)));
  p.set('w', String(Math.round(state.warnMs / 1000)));
  p.set('g', String(Math.round(state.dangerMs / 1000)));
  p.set('s', state.sound ? '1' : '0');
  p.set('rp', state.repeat ? '1' : '0');
  p.set('rg', state.ring ? '1' : '0');
  p.set('ot', state.overtime ? '1' : '0');
  p.set('wk', state.wake ? '1' : '0');
  p.set('ck', state.showClock ? '1' : '0');
  return `${location.origin}${location.pathname}#${p.toString()}`;
}

/* --- public API --------------------------------------------------------- */

export function load() {
  const stored = readStorage();
  const fromHash = readHash();
  Object.assign(state, sanitise({ ...DEFAULTS, ...stored, ...fromHash }));
  return get();
}

/**
 * Re-read the hash, for when someone pastes a shared link into a tab that is
 * already open. Without this the address changes and nothing else does.
 */
export function reload() {
  const before = get();
  Object.assign(state, sanitise({ ...DEFAULTS, ...readStorage(), ...readHash() }));

  const changed = Object.keys(state).filter((k) => state[k] !== before[k]);
  if (!changed.length) return get();

  writeStorage();
  const snapshot = get();
  listeners.forEach((fn) => fn(snapshot, changed));
  return snapshot;
}

export function get() {
  return { ...state };
}

/** Patch one or more fields. Values are re-validated; listeners fire once. */
export function set(patch) {
  const next = sanitise({ ...state, ...patch });
  const changed = Object.keys(next).filter((k) => next[k] !== state[k]);
  if (!changed.length) return get();

  Object.assign(state, next);
  writeStorage();
  const snapshot = get();
  listeners.forEach((fn) => fn(snapshot, changed));
  return snapshot;
}

export function reset() {
  return set({ ...DEFAULTS });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
