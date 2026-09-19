/* ---------------------------------------------------------------------------
   format.js — turning milliseconds into the string on screen.
--------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, '0');

/**
 * Format a duration for the big display.
 *
 * Countdown rounds up, so a five minute timer reads "5:00" for its whole first
 * second and reaches "0:00" exactly as it expires. Stopwatch rounds down, so it
 * reads "0:00" for its first second — which is what a stopwatch should do.
 *
 * @param {number} ms       signed milliseconds; negative means overtime
 * @param {boolean} roundUp true for countdown
 */
export function formatTime(ms, roundUp = true) {
  const negative = ms < 0;
  const abs = Math.abs(ms);
  const totalSeconds = negative || !roundUp
    ? Math.floor(abs / 1000)
    : Math.ceil(abs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const body = hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;

  // No sign at the exact moment of zero — "-0:00" looks like a glitch.
  return negative && totalSeconds > 0 ? `−${body}` : body;
}

/** A shape key like "0:00" that changes only when the layout changes. */
export function formatSignature(text) {
  return text.replace(/\d/g, '0');
}

/** "1 min", "1 h 30 min" — used on preset chips and in announcements. */
export function describeDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  if (seconds || !parts.length) parts.push(`${seconds} s`);
  return parts.join(' ');
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
