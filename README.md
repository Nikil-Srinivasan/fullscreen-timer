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

- **Countdown or stopwatch**, switched with one button
- **Start / pause / reset**, from a button, the spacebar, or a tap on the digits
- **Fullscreen**, with the controls fading out once you stop moving the mouse
- **Hide the timer** and let it flash the time every 1 or 5 minutes — you glance instead
  of stare. A tap peeks without disturbing the run.
- **Dark / light / auto** theme
- **Editable length** — hour/minute/second fields, preset chips, or arrow keys, adjustable
  live while the timer runs
- **Warning colours** — amber, then red, at thresholds you choose
- **Alarm** at zero, synthesised in the browser (no audio files), with optional repeat
- **Overtime** — keeps counting past zero with a minus sign
- **Progress ring** tracing the edge of the screen, which works at any aspect ratio
- **Screen wake lock**, so the display does not sleep mid-talk
- **Shareable links** — the URL always describes the current setup
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
| <kbd>←</kbd> <kbd>→</kbd> | Countdown by one minute |
| <kbd>↓</kbd> <kbd>↑</kbd> | Countdown by ten seconds |
| <kbd>Shift</kbd> + arrows | Ten times the step |
| <kbd>1</kbd>–<kbd>9</kbd> | Jump to a preset length |
| <kbd>,</kbd> | Settings |
| <kbd>?</kbd> | Shortcuts |
| <kbd>Esc</kbd> | Close panels, or leave fullscreen |

## Sharing a setup

The address bar always reflects the current timer, so you can bookmark or send it:

```
https://nikil-srinivasan.github.io/fullscreen-timer/#m=cd&d=900&h=5&t=dark
```

`m` mode (`cd`/`sw`) · `d` length in seconds · `h` hide interval · `t` theme ·
`r` reveal seconds · `w` amber threshold · `g` red threshold · `s` sound · `rp` repeat ·
`rg` ring · `ot` overtime · `wk` wake lock · `ck` clock.

A link always wins over saved preferences, so a shared timer opens the same way for
everyone.

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

## Licence

MIT — see [LICENSE](LICENSE).

Inspired by [alphakevin/fullscreen-timer](https://github.com/alphakevin/fullscreen-timer).
