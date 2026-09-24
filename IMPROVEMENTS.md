# Improvement backlog

Prioritised by **impact** (how much it changes what people experience or whether the timer can be trusted) and **effort** (rough size of the change). Reviewed from `main.js`, `state.js`, `keyboard.js`, `clock.js`, `sound.js`, `hide-mode.js` and `index.html`. Items marked *verify* were not confirmed because the relevant file (`display.js`, `ui.js`, `components.css`) or a real device was not checked.

Nothing here overrides the deliberate behaviours listed in `CLAUDE.md`; where an idea touches one, it is framed as opt-in.

**Legend**: Impact — High / Med / Low. Effort — S (under an hour) / M (a few hours) / L (a day or more).

---

## P0 — Must fix

| # | Item | Area | Impact | Effort |
|---|------|------|--------|--------|
| 1 | Visible "time's up" state | UX | High | S |
| 2 | Touch-friendly time adjustment | UX | High | M |
| 3 | Survive a page refresh while running | Feature | High | M |
| 4 | Alarm that is hard to miss (repeat until dismissed, test button) | UX / Feature | High | M |
| 5 | Screen-reader label for the digits | Accessibility | High | S |

### 1. Visible "time's up" state
- **Problem:** at zero, `finishCountdown()` resets straight to `0:00` and clears the length. The only cues are one ~0.7 s chime, a vibration and a screen-reader announcement. With sound muted or a noisy room, the screen looks identical to "never started".
- **Fix:** show a clear finish state for a few seconds (red/flashing "Time's up"), then settle to the reset `0:00`. Keep the auto-reset behaviour.
- **Watch out:** hidden mode already peeks for at least 3 s at zero; the finish state should work with it, not fight it.

### 2. Touch-friendly time adjustment
- **Problem:** tapping a digit only selects a unit. Changing it needs the mouse wheel or arrow keys, which phones and tablets lack. Touch users must open Settings or use presets.
- **Fix:** swipe up/down on the digits, or small +/− buttons shown when a unit is selected and the clock is paused.
- **Watch out:** the digits now have `user-select: none`, so drag gestures won't start a text selection. Keep `touch-action` in mind so a swipe doesn't scroll the page.

### 3. Survive a page refresh while running
- **Problem:** only settings are persisted, not run state. A reload, crash or accidental navigation mid-talk resets the timer.
- **Fix:** store the wall-clock start timestamp and banked time; on load, resume and recompute. Must still respect "a hash on load overrides saved preferences" (a shared link should start fresh).
- **Watch out:** `performance.now()` is not comparable across page loads, so use `Date.now()` for the persisted value only and convert on resume. In-run time must stay `performance.now()`-based.

### 4. Alarm that is hard to miss
- **Problem:** one short chime; the repeat option was removed in `76092a8`. Easy to miss when presenting or looking away. No way to test the sound.
- **Fix:** an option to keep ringing until dismissed (any key/tap), plus a "Test sound" button in Settings. Optionally a volume control.
- **Verify:** whether the alarm plays when the tab is in the background, especially on iOS, where audio can be suspended.

### 5. Screen-reader label for the digits *(verify)*
- **Problem:** the SVG has a static `aria-label="Timer"`. Unless `display.js` updates it, the current time is never exposed to assistive tech. Amber/red warning colours should not be the only signal either.
- **Fix:** update the label with the time as it changes (throttled, e.g. per minute) or expose it via the existing live region; confirm contrast of the warning tones.

---

## P1 — Should do

| # | Item | Area | Impact | Effort |
|---|------|------|--------|--------|
| 6 | "Run again" / last-used length after finishing | UX | Med | S |
| 7 | Keyboard number entry (type `2500` → 25:00) | UX | Med | M |
| 8 | Custom hide-mode intervals (2, 10, 15 min…) | Feature | Med | S |
| 9 | Stopwatch laps / split times | Feature | Med | M |
| 10 | Installable PWA icons (192/512 PNG, iOS touch icon) | Feature | Med | S |
| 11 | Automated check for `state.js` (hash parsing, validation) | Maintenance | Med | M |

- **6.** Reset and finish both clear the length to 0 (deliberate). Presets `1`–`9` help, but a "last used" chip would speed up repeat use such as rehearsals and exercise rounds.
- **7.** Faster than wheel or arrows. Number keys `1`–`9` are presets, so this needs an explicit edit mode to avoid the clash.
- **8.** Hide mode only offers 1 or 5 minutes. `state.js` validates against `['off','1','5']`, so both the validator and the URL key (`h`) need widening.
- **9.** The stopwatch is start/stop/reset only.
- **10.** The manifest and `apple-touch-icon` point at an SVG. Android install prompts want 192 px and 512 px PNGs; iOS ignores SVG touch icons. Check with Lighthouse.
- **11.** There is no test suite (by design, per `CLAUDE.md`). A tiny script, or a CI step that imports `state.js` and feeds it sample hashes, would protect the most logic-heavy file without adding a build.

---

## P2 — Good to have

| # | Item | Area | Impact | Effort |
|---|------|------|--------|--------|
| 12 | Editable / custom presets | UX | Low–Med | M |
| 13 | Alarm sound choice and volume | Feature | Low–Med | M |
| 14 | Interval / Pomodoro sequences (e.g. 25/5 repeating) | Feature | Low–Med | L |
| 15 | Opt-in overtime (count past zero, default off) | Feature | Low–Med | M |
| 16 | Toggle for warning colours | UX | Low | S |
| 17 | Translations (UI strings are hard-coded English) | Feature | Low | L |
| 18 | Multiple timers or pop-out / picture-in-picture window | Feature | Low | L |

- **15.** Conflicts with "countdowns stop at zero (no negative time)", so it must be a setting that defaults to off.
- **16.** Thresholds themselves stay fixed as designed; only an on/off switch is proposed.

---

## Housekeeping

- Add a `.gitattributes` (`* text=auto eol=lf`) — Git currently warns that LF will be converted to CRLF on this machine.
- Keep `sw.js` `ASSETS` and `CACHE` in sync if any of the above adds files (new icons, new modules).
- After #1–#4, update the README's shortcut/feature lists and the Help panel so they match.

## Suggested order of work

1. **#1 Finish state** and **#5 accessibility label** — small, high-visibility, no engine changes.
2. **#2 Touch adjustment** — unblocks phone and tablet users.
3. **#3 Persist running timer** — touches `clock.js`/`state.js`; do it on its own and test carefully.
4. **#4 Alarm repeat and test button**, then the P1 items in table order.
