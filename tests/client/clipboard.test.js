import test from "node:test";
import assert from "node:assert/strict";
import { copyText } from "../../public/lib/clipboard.js";

test("copyText falls back to execCommand when Clipboard API fails", async () => {
  const operations = [];
  const textarea = {
    value: "",
    setAttribute() {},
    style: {},
    focus() {
      operations.push("focus");
    },
    select() {
      operations.push("select");
    }
  };

  const document = {
    body: {
      appendChild(node) {
        operations.push(["append", node]);
      },
      removeChild(node) {
        operations.push(["remove", node]);
      }
    },
    createElement(tagName) {
      operations.push(["create", tagName]);
      return textarea;
    },
    execCommand(command) {
      operations.push(["exec", command]);
      return true;
    }
  };

  const mode = await copyText("hello", {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Clipboard blocked");
        }
      }
    },
    document
  });

  assert.equal(mode, "execCommand");
  assert.deepEqual(operations, [
    ["create", "textarea"],
    ["append", textarea],
    "focus",
    "select",
    ["exec", "copy"],
    ["remove", textarea]
  ]);
  assert.equal(textarea.value, "hello");
});

test("copyText falls back to prompt when programmatic copy is unavailable", async () => {
  const prompts = [];

  const mode = await copyText("manual", {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Clipboard blocked");
        }
      }
    },
    document: {
      body: {},
      execCommand() {
        return false;
      }
    },
    window: {
      prompt(message, value) {
        prompts.push([message, value]);
      }
    }
  });

  assert.equal(mode, "prompt");
  assert.deepEqual(prompts, [["Copy this text", "manual"]]);
});
