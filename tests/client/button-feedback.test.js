import test from "node:test";
import assert from "node:assert/strict";
import { flashButtonState } from "../../public/lib/button-feedback.js";

test("flashButtonState updates the button label and restores it after timeout", () => {
  const button = {
    textContent: "Copy",
    dataset: {}
  };
  const timers = [];

  flashButtonState(
    button,
    {
      idleLabel: "Copy",
      activeLabel: "Copied",
      tone: "success",
      durationMs: 1000
    },
    {
      setTimeout(callback) {
        timers.push(callback);
        return callback;
      },
      clearTimeout() {}
    }
  );

  assert.equal(button.textContent, "Copied");
  assert.equal(button.dataset.copyState, "success");

  timers[0]();

  assert.equal(button.textContent, "Copy");
  assert.equal("copyState" in button.dataset, false);
});
