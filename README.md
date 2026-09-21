# Fullscreen Timer

A countdown and stopwatch for presentations, talks, workshops and exams — built to be
readable from the back of the room.

**Live:** https://nikil-srinivasan.github.io/fullscreen-timer/

## Why another timer

Most web timers cap how large the digits can get. On a 4K TV or a lecture-hall projector
they stop growing and sit marooned in the middle of the screen. This one has **no maximum
size**: the digits are SVG fitted to their own bounding box, so they fill whatever you
give them — a 320px phone or an 8K wall.

## Features

- **Countdown or stopwatch**, switched with a segmented toggle that shows the mode you're in
- **Start / pause / reset**, from a button or the spacebar — clicking the digits never starts
  or stops the clock. Reset always clears to zero, the same as a stopwatch; Start stays
  disabled until a countdown has a length to run
- **Fullscreen**, with the controls fading out once you stop moving the mouse
- **Hide the timer** and let it flash the time every 1 or 5 minutes — you glance instead
  of stare. A tap peeks without disturbing the run.
- **Dark / light / auto** theme
- **Editable length** — hour/minute/second fields, preset chips, or arrow keys and the scroll
  wheel over the digits. Click an hour, minute or second digit to choose which one arrows and
  the wheel change, one unit at a time. Only while paused — a running countdown holds still.
- **Warning colours** — amber for the last 50% of the countdown, red for the final 15%, scaled
  to the length of the timer rather than a fixed number of seconds
- **Alarm** at zero, synthesised in the browser (no audio files)
- **Stops at zero** — a countdown never counts into negative time
- **Progress ring** tracing the edge of the screen, which works at any aspect ratio
- **Screen wake lock**, so the display does not sleep mid-talk
- **Shareable links** — "Copy shareable link" in Settings builds a link describing the exact
  setup; the address bar itself never rewrites itself as you use the app
- **Offline** once loaded, and installable as an app

## Keyboard

| Key | Does |
| --- | --- |
| <kbd>Space</kbd> | Start / pause |
| <kbd>R</kbd> | Reset |
| <kbd>S</kbd> | Switch countdown / stopwatch |
| <kbd>F</kbd> | Fullscreen on / off |
| <kbd>H</kbd> | Cycle hide mode: off, 1 min, 5 min |
| <kbd>T</kbd> | Theme: auto, light, dark |
| <kbd>M</kbd> | Mute / unmute the alarm |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↓</kbd> <kbd>↑</kbd> | Adjust the selected unit (click a digit group to pick hours, minutes, or seconds) |
| Scroll wheel | Adjust the selected unit |
| <kbd>1</kbd>–<kbd>9</kbd> | Jump to a preset length |
| <kbd>,</kbd> | Settings |
| <kbd>?</kbd> | Shortcuts |
| <kbd>Esc</kbd> | Close panels, or leave fullscreen |

## Sharing a setup

The address bar deliberately stays put as you use the app — it does not rewrite itself on
every change. To send someone the exact setup, use "Copy shareable link" in Settings, which
builds a link like:

```
https://nikil-srinivasan.github.io/fullscreen-timer/#m=cd&d=900&h=5&t=dark
```

`m` mode (`cd`/`sw`) · `d` length in seconds · `h` hide interval · `t` theme ·
`r` reveal seconds · `s` sound · `rg` ring · `wk` wake lock · `ck` clock.

A link always wins over saved preferences, so a shared timer opens the same way for
everyone. Opening the plain URL instead just restores your own last-used settings, saved
locally in the browser.

## Running it locally

It is plain HTML, CSS and ES modules — no build, no dependencies. ES modules will not load
over `file://`, so serve the folder:

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>.

## How it is put together

```
index.html            markup only
css/tokens.css        colours, theme, the type scale
css/layout.css        app shell and the responsive rules
css/components.css    buttons, panels, overlays
js/clock.js           timing engine
js/display.js         the fit-to-viewport digits and the ring
js/state.js           settings, localStorage, URL hash
js/hide-mode.js       blank screen and the periodic flash
js/main.js            wiring
```

Two decisions carry the whole thing:

- **Time is derived from a timestamp, never accumulated.** Counting `setInterval` callbacks
  drifts over a long talk and stalls in a background tab; reading `performance.now()` each
  frame cannot drift, and a tab returning from the background reports the right time by
  construction.
- **The digits are an SVG `viewBox` fitted to the text.** The browser scales that box to the
  container, so there is no font-size ceiling anywhere. Re-measuring happens only when the
  *shape* changes (`9:59` to `1:00:00`), not every frame.

## Known limits

- iOS Safari has no Fullscreen API for ordinary elements, so fullscreen falls back to a CSS
  overlay: it hides the page chrome, but not Safari's own toolbars.
- Wake Lock is missing in some browsers (older Safari among them). It degrades silently.
- Browsers require one interaction on the page before audio can play, so the alarm is armed
  by your first click or keypress.

## Search visibility

The page carries a descriptive title and meta description, a canonical URL, Open Graph and
Twitter card tags, `WebApplication` and `FAQPage` JSON-LD, a sitemap, and roughly 700 words
of real content below the timer. The timer itself still occupies exactly one viewport and
the article is hidden entirely in fullscreen.

Two things are worth knowing:

- **`robots.txt` only counts at a domain root.** Crawlers read
  `nikil-srinivasan.github.io/robots.txt`, which belongs to the account's own
  `nikil-srinivasan.github.io` repository, not to this one. The copy here does nothing today
  and becomes correct the moment a custom domain is attached. Submit the sitemap directly in
  Search Console instead.
- **The tab title is restored when the clock is idle.** While the timer runs the title is
  prefixed with the time; it must fall back to the full authored title, because search results
  and bookmarks use whatever the rendered DOM holds.

Submitting the site to Google needs a Google account, so it cannot be scripted from here —
see `SEO.md` for the steps.

## Licence

MIT — see [LICENSE](LICENSE).

The digits use a self-hosted copy of [Inconsolata](https://github.com/googlefonts/Inconsolata)
(chosen for its default slashed zero, so it renders identically in every browser regardless of
which system fonts a browser's privacy settings expose), licensed under the SIL Open Font
Licence — see `assets/fonts/OFL.txt`.

Inspired by [alphakevin/fullscreen-timer](https://github.com/alphakevin/fullscreen-timer).
