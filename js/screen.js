/* ---------------------------------------------------------------------------
   screen.js — fullscreen, and keeping the display awake.

   Both are best-effort: every browser disagrees about them and several reject
   the promises for reasons we cannot do anything about (iOS has no Fullscreen
   API for ordinary elements; Safari has no Wake Lock). Nothing in here is
   allowed to throw into the console, so every call is caught.
--------------------------------------------------------------------------- */

const root = document.documentElement;

/* --- Fullscreen --------------------------------------------------------- */

export const fullscreenSupported = Boolean(
  root.requestFullscreen || root.webkitRequestFullscreen,
);

export function isFullscreen() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      root.classList.contains('pseudo-fs'),
  );
}

function enter() {
  if (root.requestFullscreen) return root.requestFullscreen({ navigationUI: 'hide' });
  if (root.webkitRequestFullscreen) return Promise.resolve(root.webkitRequestFullscreen());
  return Promise.reject(new Error('unsupported'));
}

function leave() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return Promise.resolve(document.webkitExitFullscreen());
  return Promise.reject(new Error('unsupported'));
}

/**
 * Toggle fullscreen, falling back to a CSS overlay where the API is missing
 * (iOS Safari). Resolves to the resulting state.
 */
export function toggleFullscreen() {
  const wasFullscreen = isFullscreen();

  if (!fullscreenSupported) {
    root.classList.toggle('pseudo-fs', !wasFullscreen);
    return Promise.resolve(!wasFullscreen);
  }

  const action = wasFullscreen ? leave() : enter();
  return Promise.resolve(action)
    .then(() => isFullscreen())
    .catch(() => {
      // Denied (no user gesture, kiosk policy, iframe without allowfullscreen).
      root.classList.toggle('pseudo-fs', !wasFullscreen);
      return isFullscreen();
    });
}

export function onFullscreenChange(fn) {
  const handler = () => fn(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
}

/** Esc leaves our pseudo-fullscreen; the real one handles itself. */
export function exitPseudoFullscreen() {
  if (!root.classList.contains('pseudo-fs')) return false;
  root.classList.remove('pseudo-fs');
  return true;
}

/* --- Wake lock ---------------------------------------------------------- */

export const wakeLockSupported = 'wakeLock' in navigator;

let sentinel = null;
let wanted = false;

export async function requestWakeLock() {
  wanted = true;
  if (!wakeLockSupported || sentinel || document.hidden) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null; // low battery, unsupported, or a policy said no
  }
}

export async function releaseWakeLock() {
  wanted = false;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* already gone */
  }
  sentinel = null;
}

/** The lock is dropped whenever the tab hides, so take it again on return. */
export function reacquireWakeLock() {
  if (wanted && !document.hidden) requestWakeLock();
}
