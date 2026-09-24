/* ---------------------------------------------------------------------------
   format.js — turning milliseconds into the string on screen.
--------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, '0');

/**
 * Split a duration into the pieces the big display renders as separately
 * clickable hour / minute / second groups.
 *
 * Countdown rounds up, so a five minute timer reads "5:00" for its whole first
 * second and reaches "0:00" exactly as it expires. Stopwatch rounds down, so it
 * reads "0:00" for its first second — which is what a stopwatch should do.
 *
 * The leading unit is never zero-padded ("5:00", not "05:00"); every unit
 * after it is, same as a clock face.
 *
 * Negative input is clamped to zero, not signed — a countdown always stops
 * itself at zero (see main.js), and a stopwatch never runs backwards, so
 * there is no legitimate way to reach this with a negative value. Clamping
 * here as well means there is nowhere left in the app that could show one.
 *
 * @param {number} ms       milliseconds remaining/elapsed
 * @param {boolean} roundUp true for countdown
 */
export function splitDisplay(ms, roundUp = true) {
  const totalSeconds = roundUp ? Math.ceil(Math.max(0, ms) / 1000) : Math.floor(Math.max(0, ms) / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const showHours = hours > 0;

  return {
    showHours,
    hours: showHours ? String(hours) : '',
    minutes: showHours ? pad(minutes) : String(minutes),
    seconds: pad(seconds),
  };
}

/** Format a duration for the big display as one string (title bar, announcements). */
export function formatTime(ms, roundUp = true) {
  const { showHours, hours, minutes, seconds } = splitDisplay(ms, roundUp);
  return showHours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/** A duration as a screen reader should say it: "1 hour, 2 minutes, 5 seconds". */
export function spokenTime(ms, roundUp = true) {
  const totalSeconds = roundUp ? Math.ceil(Math.max(0, ms) / 1000) : Math.floor(Math.max(0, ms) / 1000);
  const parts = [
    [Math.floor(totalSeconds / 3600), 'hour'],
    [Math.floor((totalSeconds % 3600) / 60), 'minute'],
    [totalSeconds % 60, 'second'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : '0 seconds';
}

/** Local time of day, without seconds. */
export function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Split milliseconds into the hours / minutes / seconds fields. */
export function splitDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Recombine the fields into milliseconds. */
export function joinDuration({ hours = 0, minutes = 0, seconds = 0 }) {
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
