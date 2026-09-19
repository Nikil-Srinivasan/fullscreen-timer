/* ---------------------------------------------------------------------------
   clock.js — the timing engine.

   Time is *derived from a timestamp*, never accumulated tick by tick. Counting
   setInterval callbacks drifts by seconds over a long talk and stalls outright
   in a background tab; reading performance.now() each frame cannot drift, and a
   tab that comes back from the background simply reports the correct value.

   Two things drive updates:
     - requestAnimationFrame, for smooth on-screen updates
     - a 200 ms interval, which keeps running when the tab is hidden and rAF is
       throttled, so the alarm still fires and hidden-mode reveals stay on time
--------------------------------------------------------------------------- */

const BACKGROUND_TICK_MS = 200;

/**
 * @param {(elapsedMs: number, running: boolean) => void} onTick
 */
export function createClock(onTick) {
  let running = false;
  let startedAt = 0;
  let bankedMs = 0;
  let rafId = 0;
  let intervalId = 0;

  const now = () => performance.now();

  const elapsed = () => bankedMs + (running ? now() - startedAt : 0);

  const emit = () => onTick(elapsed(), running);

  function loop() {
    if (!running) return;
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    startedAt = now();
    running = true;
    intervalId = setInterval(emit, BACKGROUND_TICK_MS);
    loop();
  }

  function pause() {
    if (!running) return;
    bankedMs += now() - startedAt;
    running = false;
    cancelAnimationFrame(rafId);
    clearInterval(intervalId);
    rafId = 0;
    intervalId = 0;
    emit();
  }

  function toggle() {
    if (running) pause();
    else start();
  }

  /** Stop and return to zero elapsed. */
  function reset() {
    pause();
    bankedMs = 0;
    emit();
  }

  /** Move the clock without disturbing whether it is running. */
  function setElapsed(ms) {
    const value = Math.max(0, ms);
    if (running) {
      startedAt = now();
      bankedMs = value;
    } else {
      bankedMs = value;
    }
    emit();
  }

  return {
    start,
    pause,
    toggle,
    reset,
    setElapsed,
    emit,
    get running() {
      return running;
    },
    get elapsed() {
      return elapsed();
    },
  };
}
