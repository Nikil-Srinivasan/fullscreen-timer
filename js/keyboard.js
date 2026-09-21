/* ---------------------------------------------------------------------------
   keyboard.js — shortcuts.

   Three things worth knowing:
     - Typing in the settings fields must never trigger a shortcut.
     - Space and Enter on a focused button already fire a click, so we let the
       button handle them instead of acting twice.
     - All four arrows move by one step of whichever digit group (hours,
       minutes, seconds) was last clicked — see actions.selectUnit in main.js.
--------------------------------------------------------------------------- */

function isTypingTarget(node) {
  if (!(node instanceof HTMLElement)) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

/**
 * @param {object} actions handlers for every binding; see main.js
 */
export function bindKeyboard(actions) {
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;

    if (isTypingTarget(event.target)) {
      if (event.key === 'Escape') event.target.blur();
      return;
    }

    // Leave browser and OS shortcuts alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;
    const onButton = event.target instanceof HTMLElement && event.target.closest('button');
    if (onButton && (key === ' ' || key === 'Enter' || key === 'Spacebar')) return;

    let handled = true;

    switch (key) {
      case ' ':
      case 'Spacebar':
        actions.toggleStart();
        break;
      case 'r':
      case 'R':
        actions.reset();
        break;
      case 's':
      case 'S':
        actions.toggleMode();
        break;
      case 'f':
      case 'F':
        actions.toggleFullscreen();
        break;
      case 'h':
      case 'H':
        actions.cycleHide();
        break;
      case 't':
      case 'T':
        actions.cycleTheme();
        break;
      case 'm':
      case 'M':
        actions.toggleSound();
        break;
      case 'ArrowUp':
      case 'ArrowRight':
        actions.adjustBySelected(1);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        actions.adjustBySelected(-1);
        break;
      case ',':
        actions.openSettings();
        break;
      case '?':
      case '/':
        actions.openHelp();
        break;
      case 'Escape':
        actions.escape();
        break;
      default:
        if (key >= '1' && key <= '9') actions.preset(Number(key) - 1);
        else handled = false;
    }

    if (handled) {
      event.preventDefault();
    } else {
      // Any other key still counts as "let me look at the time".
      actions.unboundKey();
    }
  });
}
