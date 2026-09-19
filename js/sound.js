/* ---------------------------------------------------------------------------
   sound.js — the alarm, synthesised with the Web Audio API.

   No audio files: a couple of oscillators with a short envelope beat shipping
   an mp3, and nothing to 404 on a slow conference network.

   Browsers will not let audio start without a user gesture, so the context is
   created on the first interaction and resumed on every later one.
--------------------------------------------------------------------------- */

const REPEAT_MS = 4_000;

export function createSound() {
  let ctx = null;
  let repeatTimer = 0;

  function context() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** Call from any click or keypress so the context is ready when we need it. */
  function unlock() {
    context();
  }

  function tone(startAt, frequency, duration, peak = 0.22) {
    const audio = context();
    if (!audio) return;

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);

    // A short attack and a smooth decay: a beep, not a click.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(audio.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  /** Three rising notes — audible across a room without being alarming. */
  function chime() {
    const audio = context();
    if (!audio) return;
    const t = audio.currentTime + 0.02;
    tone(t, 660, 0.18);
    tone(t + 0.22, 880, 0.18);
    tone(t + 0.44, 1175, 0.32, 0.26);
  }

  function alarm({ repeat = false } = {}) {
    stop();
    chime();
    if (repeat) {
      repeatTimer = setInterval(chime, REPEAT_MS);
    }
  }

  function stop() {
    if (repeatTimer) {
      clearInterval(repeatTimer);
      repeatTimer = 0;
    }
  }

  return { unlock, alarm, stop };
}
