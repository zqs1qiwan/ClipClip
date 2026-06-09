const buttonTimers = new WeakMap();

export function flashButtonState(
  button,
  { idleLabel, activeLabel, tone = "neutral", durationMs = 1400 },
  deps = globalThis
) {
  if (!button) {
    return;
  }

  const setTimeoutRef = deps.setTimeout?.bind(deps) || setTimeout;
  const clearTimeoutRef = deps.clearTimeout?.bind(deps) || clearTimeout;
  const previousTimer = buttonTimers.get(button);

  if (previousTimer) {
    clearTimeoutRef(previousTimer);
  }

  button.textContent = activeLabel;
  button.dataset.copyState = tone;

  const timer = setTimeoutRef(() => {
    button.textContent = idleLabel;
    delete button.dataset.copyState;
    buttonTimers.delete(button);
  }, durationMs);

  buttonTimers.set(button, timer);
}
