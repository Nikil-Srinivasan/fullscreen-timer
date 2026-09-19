/* ---------------------------------------------------------------------------
   theme.js — auto / light / dark.

   "auto" simply leaves the decision to the CSS media query; the attribute only
   has to be present so an explicit choice can override it.
--------------------------------------------------------------------------- */

const ORDER = ['auto', 'light', 'dark'];

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function nextTheme(theme) {
  const i = ORDER.indexOf(theme);
  return ORDER[(i + 1) % ORDER.length];
}

export function labelFor(theme) {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

/** What the user actually sees right now: 'light' or 'dark'. */
export function effectiveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return darkQuery.matches ? 'dark' : 'light';
}

/** Notify when the system preference flips while we are on "auto". */
export function onSystemThemeChange(fn) {
  const handler = () => fn(darkQuery.matches ? 'dark' : 'light');
  if (typeof darkQuery.addEventListener === 'function') {
    darkQuery.addEventListener('change', handler);
  } else if (typeof darkQuery.addListener === 'function') {
    darkQuery.addListener(handler); // older Safari
  }
}
