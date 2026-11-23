import test from "node:test";
import assert from "node:assert/strict";
import {
  TABS,
  createState,
  loadPreferences,
  normalizeLanguage,
  normalizeTab,
  saveLanguage,
  saveTab
} from "../../public/js/state.js";

test("TABS lists the supported tabs", () => {
  assert.deepEqual(TABS, ["live", "paste", "files"]);
});

test("normalizeTab defaults unknown values to live", () => {
  assert.equal(normalizeTab("paste"), "paste");
  assert.equal(normalizeTab("files"), "files");
  assert.equal(normalizeTab("bogus"), "live");
  assert.equal(normalizeTab(undefined), "live");
});

test("normalizeLanguage defaults unknown values to zh", () => {
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("zh"), "zh");
  assert.equal(normalizeLanguage("xx"), "zh");
});

test("loadPreferences reads and normalizes stored preferences", () => {
  const values = { "clipclip-active-tab": "files", "clipclip-language": "en" };
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return values[key] ?? null;
      },
      setItem() {}
    }
  };
  try {
    assert.deepEqual(loadPreferences(), { tab: "files", language: "en" });
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("loadPreferences tolerates storage access failures", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("disabled");
      }
    }
  };
  try {
    assert.deepEqual(loadPreferences(), { tab: "live", language: "zh" });
    assert.doesNotThrow(() => saveTab("paste"));
    assert.doesNotThrow(() => saveLanguage("en"));
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("saveTab/saveLanguage persist normalized values", () => {
  const stored = {};
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return stored[key] ?? null;
      },
      setItem(key, value) {
        stored[key] = value;
      }
    }
  };
  try {
    saveTab("bogus");
    saveLanguage("bogus");
    assert.equal(stored["clipclip-active-tab"], "live");
    assert.equal(stored["clipclip-language"], "zh");

    saveTab("files");
    saveLanguage("en");
    assert.equal(stored["clipclip-active-tab"], "files");
    assert.equal(stored["clipclip-language"], "en");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("createState initializes dirty/save and login fields for the dirty-flag and login state machines", () => {
  const state = createState({ tab: "paste", language: "en" });
  assert.equal(state.tab, "paste");
  assert.equal(state.language, "en");
  assert.equal(state.auth, "unknown");
  assert.equal(state.view, "app");
  assert.equal(state.publicMode, false);

  // dirty-flag state machine starts clean and idle.
  assert.equal(state.live.dirty, false);
  assert.equal(state.live.saving, false);
  assert.equal(state.live.saveTimer, null);
  assert.equal(state.live.pendingRemote, null);
  assert.equal(state.live.lastSentContent, null);

  // login state machine starts idle with no message.
  assert.equal(state.login.busy, false);
  assert.equal(state.login.message, null);

  // A state with invalid preferences is normalized.
  const normalized = createState({ tab: "???", language: "??" });
  assert.equal(normalized.tab, "live");
  assert.equal(normalized.language, "zh");
});
