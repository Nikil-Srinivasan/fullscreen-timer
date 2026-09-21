/* ---------------------------------------------------------------------------
   display.js — the two things that have to scale without limit:
   the digits, and the ring that traces the edge of the screen.

   The digits are SVG text inside a viewBox fitted to their own bounding box.
   The browser then scales that box to fill whatever container it is given, at
   any size, with no font-size ceiling anywhere. Re-measuring only happens when
   the *shape* of the string changes ("5:00" to "12:34" is free, "9:59" to
   "1:00:00" is not), so this costs nothing per frame.
--------------------------------------------------------------------------- */

/* --- Digits ------------------------------------------------------------- */

/**
 * The digits are several <tspan> children of one <text> — an hours group with
 * its separator, a minutes group, and a seconds group — so each unit is its
 * own hit-testable element a click can land on, while the whole thing still
 * measures and scales as a single block of text.
 *
 * @param {object} nodes
 * @param {SVGSVGElement} nodes.svg
 * @param {SVGTextElement} nodes.text
 * @param {SVGTSpanElement} nodes.hours
 * @param {SVGTSpanElement} nodes.hourSep
 * @param {SVGTSpanElement} nodes.minutes
 * @param {SVGTSpanElement} nodes.seconds
 */
export function createDigits({ svg, text, hours, hourSep, minutes, seconds }) {
  let lastKey = null;
  let lastShape = null;

  function refit() {
    let box;
    try {
      box = text.getBBox();
    } catch {
      return; // not rendered yet
    }
    if (!box.width || !box.height) return;

    // A little breathing room, proportional to the text so it scales too.
    const padX = box.width * 0.03;
    const padY = box.height * 0.12;
    svg.setAttribute(
      'viewBox',
      `${box.x - padX} ${box.y - padY} ${box.width + padX * 2} ${box.height + padY * 2}`,
    );
  }

  /** @param value the object returned by format.js's splitDisplay() */
  function render(value) {
    const key = `${value.showHours}|${value.hours}|${value.minutes}|${value.seconds}`;
    if (key === lastKey) return;
    lastKey = key;

    hours.textContent = value.hours;
    minutes.textContent = value.minutes;
    seconds.textContent = value.seconds;
    hours.style.display = value.showHours ? '' : 'none';
    hourSep.style.display = value.showHours ? '' : 'none';

    // Only re-measure when a group's *digit count* could have changed
    // ("9:59" to "12:34" needs it, "9:59" to "9:58" doesn't) — that's what
    // makes this free to call every frame.
    const shape = `${value.showHours}|${value.hours.length}|${value.minutes.length}`;
    if (shape !== lastShape) {
      lastShape = shape;
      refit();
    }
  }

  // A late-loading font would change the metrics under us.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refit).catch(() => {});
  }

  return { render, refit };
}

/* --- Progress ring ------------------------------------------------------ */

/** Rounded rectangle, drawn clockwise from top centre so progress starts at 12. */
function perimeterPath(x, y, w, h, r) {
  const cx = x + w / 2;
  return [
    `M ${cx} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `H ${cx}`,
  ].join(' ');
}

export function createRing({ svg, track, progress }) {
  let length = 0;
  let fraction = 1;

  function paint() {
    if (!length) return;
    progress.style.strokeDasharray = `${length}`;
    progress.style.strokeDashoffset = `${length * (1 - fraction)}`;
  }

  function layout() {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // Stroke grows with the screen but never disappears on a phone.
    const stroke = Math.max(3, Math.min(w, h) * 0.006);
    const inset = stroke;
    const radius = Math.min(Math.min(w, h) * 0.06 + stroke, Math.min(w, h) / 2 - inset);

    const d = perimeterPath(inset, inset, w - inset * 2, h - inset * 2, Math.max(0, radius));
    track.setAttribute('d', d);
    progress.setAttribute('d', d);
    track.style.strokeWidth = `${stroke}`;
    progress.style.strokeWidth = `${stroke}`;

    length = progress.getTotalLength();
    paint();
  }

  function setFraction(value) {
    const next = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    if (next === fraction) return;
    fraction = next;
    paint();
  }

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(layout).observe(svg);
  } else {
    window.addEventListener('resize', layout);
  }
  layout();

  return { layout, setFraction };
}
