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
      append(node) {
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

  await copyText("hello", {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Clipboard blocked");
        }
      }
    },
    document
  });

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
