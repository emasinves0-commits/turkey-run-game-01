// Keyboard, mouse and touch input, with no drawing and no browser game logic in it.
// The game polls direction() every fixed step and takes one-shot actions with takeActions().
export const ACTION_JUMP = 1;
export const ACTION_SLIDE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let jumpQueued = false;

  function press(action) {
    actions |= action;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      press(ACTION_JUMP);
      // A jump key also confirms: the title and end screens say "press Space",
      // and the pointer already presses JUMP + CONFIRM together. Without this
      // Space did nothing on the title screen (only Enter/click started the
      // game) — the first thing a player tries was dead.
      press(ACTION_CONFIRM);
      jumpQueued = true;
      event.preventDefault();
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      press(ACTION_SLIDE);
      event.preventDefault();
    } else if (event.code === 'Enter') {
      press(ACTION_CONFIRM);
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      press(ACTION_PAUSE);
    } else if (event.code === 'KeyM') {
      press(ACTION_MUTE);
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    event.preventDefault();
    press(ACTION_JUMP);
    press(ACTION_CONFIRM);
    jumpQueued = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    // -1 slow down, 0 cruise, 1 sprint — read fresh every fixed step.
    direction() {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      if (right && !left) return 1;
      if (left && !right) return -1;
      return 0;
    },
    // Holding Down slides (and hides behind a haystack when one is near).
    sliding() {
      return keys.has('ArrowDown') || keys.has('KeyS');
    },
    jumpPressed() {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
