# Handoff

Written 2026-09-19, for whoever (or whatever) picks this up next — likely a session with no
memory of how it was built. `README.md` explains what the app *is*; this file covers what state
it is in, what has actually been tested, and which parts look odd for a reason.

- **Live:** <https://nikil-srinivasan.github.io/fullscreen-timer/>
- **Repo:** <https://github.com/Nikil-Srinivasan/fullscreen-timer>
- **Deploy:** push to `main`. GitHub Pages builds from the branch root; no CI, no build step.
  A deploy takes one to two minutes.

## State

Everything described in the README is implemented and deployed. Working tree was clean and
fully pushed at the time of writing. There is no work in progress and nothing half-finished.

## Three decisions that look strange until you know why

If you are tempted to "simplify" any of these, read this first — each one is load-bearing and
each replaced something that was actively broken.

1. **`.digits` is absolutely positioned, not a percentage-sized grid item.**
   An `<svg>` with a viewBox is a replaced element. When its percentage height resolves against
   a grid area the spec treats as indefinite, it silently falls back to its *intrinsic aspect
   ratio*. On a 32:9 viewport that computed 1829px tall inside a 959px stage and the digits were
   cut off. Absolute positioning against the relative `.stage` makes both percentages definite.

2. **The service worker is network-first *and* revalidating (`cache: 'no-cache'`).**
   Cache-first meant every visitor saw the previous build for one load after each deploy. Fixing
   that alone was not enough: GitHub Pages serves with a ten minute `max-age`, so a plain
   `fetch` was still answered from the browser's own HTTP cache. Both the precache and the
   runtime fetch now revalidate. Unchanged files come back as cheap 304s.

3. **`document.title` is restored from a captured constant when the clock is idle.**
   It used to be set to the short string `'Fullscreen Timer'`, which overwrote the real page
   title on every load. Google indexes the rendered DOM, so the JS was quietly throwing away the
   SEO title. It is only prefixed with the time *while running*.

Also worth knowing, in the same spirit:

- **`.app` uses `grid-template-columns: minmax(0, 1fr)`.** The implicit `auto` column let a long
  badge widen the app past the viewport and push the controls off the right edge on a phone.
- **`[hidden] { display: none !important }` is deliberate.** Component rules set `display`, which
  beats the UA rule for `[hidden]` and left empty badge pills on screen.
- **Time is derived from `performance.now()`, never accumulated.** A 200ms interval runs
  alongside `requestAnimationFrame` because rAF is paused in background tabs — without it the
  alarm would not fire and hidden-mode reveals would drift while the tab is hidden.
- **Wheel events over `.stage` call `preventDefault()`.** That is why the page cannot be scrolled
  from the timer area, and why the explicit "About & FAQ" link exists under the controls.

## Verified, and how

Driven through an embedded Chromium against both the local server and the live site. Checked by
DOM measurement rather than screenshots where possible, because the browser pane returns stale
frames while it is hidden (and `requestAnimationFrame` does not fire there at all).

- Scaling with no clipping at 375×812, 768×1024, desktop, 3840×2160, 3440×1000 and 3840×1080.
- Countdown accuracy against wall time; auto-stop and auto-pause exactly at zero (there is no
  overtime any more — a countdown never counts negative, by explicit request).
- Hidden mode landing exactly on the minute boundary; tap-to-peek leaving run state untouched.
- Reset, mode switch, theme cycle, hide cycle, presets, settings panel, light and dark.
- Keyboard: space, `R`, arrow adjustments. Scroll-wheel editing including trackpad accumulation
  and the stopwatch-mode no-op.
- Zero console errors on the live HTTPS site.

## Not verified — treat as unknown, not working

- **Native fullscreen.** The embedded browser refuses the Fullscreen API, so only the
  pseudo-fullscreen CSS fallback was ever exercised. It toggled correctly both ways, but the real
  `requestFullscreen` path has never run.
- **The alarm.** Web Audio code has never actually made a sound here.
- **Wake lock.** Never observed acquiring a sentinel.
- **Anything iOS or Safari**, real touch input, and PWA installation.

All four want a real browser, and the mobile ones specifically want a real phone.

## Known quirks, not bugs

- Settings sync to the URL hash via `history.replaceState`, and `shareUrl()` builds from
  `origin + pathname`, so any **query string on the URL is dropped** shortly after load.
- `robots.txt` does nothing on `*.github.io`, because crawlers only read it at a domain root.
  It is kept for a future custom domain. See `SEO.md`.

## Next steps, roughly in order

1. **Search Console.** The one blocking item, and it needs a human with the Google account —
   steps are in `SEO.md`. It produces a `<meta name="google-site-verification" ...>` line that
   needs adding to `index.html` and deploying.
2. **Test the unverified list on a real phone**, especially iOS fullscreen and the alarm.
3. **A custom domain**, if search visibility matters — by far the largest single lever, and it
   means adding a `CNAME` file plus updating every absolute URL in `index.html`, `sitemap.xml`
   and `README.md`.
4. Optional: more indexable pages (exam timer, pomodoro, presentation timer) as genuinely
   distinct content rather than the same text reworded.

## Local-only things that do not travel

- The build plan lives at `C:\Users\Nikil\.claude\plans\` on the original Windows machine and was
  never committed.
- Local preview is `python -m http.server 5173` from the repo root. ES modules will not load over
  `file://`, so opening `index.html` directly will *not* work.
