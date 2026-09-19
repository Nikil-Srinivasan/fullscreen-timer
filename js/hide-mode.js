/* ---------------------------------------------------------------------------
   hide-mode.js — blank the screen, flash the time on the minute.

   For a talk, a timer you can stare at is a timer you *will* stare at. Hidden
   mode blanks the display while the clock runs and reveals it briefly each time
   the chosen boundary is crossed.

   The boundary is computed from the *displayed* seconds rather than from raw
   elapsed time, so the flash lands exactly when the digits would have rolled
   over — 5:00 to 4:59 — instead of a fraction of a second either side.
--------------------------------------------------------------------------- */

export function createHideController() {
  let bucket = null;      // which interval we were in at the last update
  let revealUntil = 0;    // performance.now() timestamp

  /** Forget where we were; the next update counts as a fresh reveal. */
  function reset() {
    bucket = null;
    revealUntil = 0;
  }

  /** Show the time for a moment without touching the schedule. */
  function peek(ms) {
    revealUntil = Math.max(revealUntil, performance.now() + ms);
  }

  /**
   * @param {object} opts
   * @param {number} opts.hideMinutes    0 when hidden mode is off
   * @param {number} opts.displaySeconds the number currently on screen
   * @param {boolean} opts.running
   * @param {number} opts.revealMs
   * @returns {{blank: boolean, revealed: boolean}}
   */
  function update({ hideMinutes, displaySeconds, running, revealMs }) {
    // A paused timer is always readable — you paused it to look at it.
    if (!hideMinutes || !running) {
      bucket = null;
      return { blank: false, revealed: false };
    }

    const now = performance.now();
    const step = hideMinutes * 60;
    const index = Math.floor(Math.max(0, displaySeconds) / step);

    let revealed = false;
    if (index !== bucket) {
      bucket = index;
      revealUntil = now + revealMs;
      revealed = true;
    }

    return { blank: now >= revealUntil, revealed };
  }

  return { reset, peek, update };
}
