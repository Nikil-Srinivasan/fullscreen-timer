# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Plain HTML/CSS/ES modules: no build, no dependencies, no linter, no test suite. ES modules don't load over `file://`, so serve the folder:

```bash
python -m http.server 5173   # then open http://localhost:5173
```

(`.claude/launch.json` already defines this as the `fullscreen-timer` config.) The site deploys as-is to GitHub Pages (`.nojekyll` present).

## Architecture

`index.html` is markup only; `js/main.js` is the wiring layer that describes what happens on each interaction, and the other modules are single-purpose helpers it composes:

- `clock.js` — timing engine. **Time is derived from `performance.now()` timestamps, never accumulated from interval ticks** (no drift, correct after background-tab throttling). Keep it that way.
- `display.js` — the digits are an SVG `viewBox` fitted to the text so there is no font-size ceiling; re-measure only when the *shape* changes (`9:59` → `1:00:00`), not per frame. Also draws the progress ring.
- `state.js` — settings, localStorage persistence, URL hash parsing, and the warning thresholds/duration limits (`WARN_FRACTION`, `DANGER_FRACTION`, presets).
- `hide-mode.js`, `keyboard.js`, `screen.js` (fullscreen incl. iOS CSS-overlay fallback, wake lock), `sound.js` (synthesised alarm, no audio files; audio armed on first user gesture), `theme.js`, `ui.js` (DOM helpers), `format.js`.
- `css/tokens.css` (colours, theme, type scale) → `layout.css` (shell, responsive) → `components.css` (buttons, panels, overlays).

### Behaviours that are deliberate (don't "fix" them)

- The address bar never rewrites itself. Shareable links (`#m=cd&d=900&h=5&t=dark`; keys documented in README) are only built by "Copy shareable link" in Settings. A hash on load overrides saved preferences; a plain URL restores localStorage.
- Clicking the digits never starts/stops the clock; Reset always clears to zero; Start is disabled for a zero-length countdown; countdowns stop at zero (no negative time); length edits are only allowed while paused.
- Warning colours scale with timer length (amber last 50%, red last 15%), not fixed seconds.
- While running, the tab title is prefixed with the time but must be restored to the full authored title when idle (search results/bookmarks read the rendered DOM).

### Service worker (`sw.js`)

Network-first with cache fallback (deliberately not stale-while-revalidate, which serves the previous build after each deploy). The `ASSETS` list is hand-maintained: when adding/removing a file that ships, update it **and bump `CACHE`** (`fullscreen-timer-vN`) so old entries are purged.

### SEO

`index.html` carries meta/OG/JSON-LD and ~700 words of content below the timer (hidden in fullscreen; the timer must stay exactly one viewport). `robots.txt` is inert on a project-pages URL. See `SEO.md` for submission steps.
