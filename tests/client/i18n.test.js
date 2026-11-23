import test from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGES,
  getLanguage,
  locale,
  normalizeLanguage,
  setLanguage,
  t
} from "../../public/js/i18n.js";

// i18n keeps `language` at module scope and setLanguage touches `document`.
// Install a document stub for the whole file and restore it at the end.
const originalDocument = globalThis.document;
globalThis.document = { documentElement: { lang: "" } };

test.after(() => {
  setLanguage("zh");
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
});

test("LANGUAGES lists the supported languages", () => {
  assert.deepEqual(LANGUAGES, ["zh", "en"]);
});

test("normalizeLanguage only accepts zh/en and defaults to zh", () => {
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("zh"), "zh");
  assert.equal(normalizeLanguage("fr"), "zh");
  assert.equal(normalizeLanguage(undefined), "zh");
  assert.equal(normalizeLanguage(null), "zh");
});

test("setLanguage updates the document lang attribute and the active language", () => {
  assert.equal(setLanguage("en"), "en");
  assert.equal(getLanguage(), "en");
  assert.equal(locale(), "en-US");
  assert.equal(globalThis.document.documentElement.lang, "en");

  assert.equal(setLanguage("bogus"), "zh");
  assert.equal(locale(), "zh-CN");
  assert.equal(globalThis.document.documentElement.lang, "zh-CN");
});

test("t resolves keys in the active language and substitutes variables", () => {
  setLanguage("en");
  assert.equal(t("live.copy"), "Copy");
  assert.equal(t("live.updated", { time: "10:00" }), "Last synced: 10:00");
  assert.equal(t("files.selected", { name: "a.txt", size: "1 KB" }), "Selected: a.txt (1 KB)");

  setLanguage("zh");
  assert.equal(t("live.copy"), "复制");
  assert.equal(t("live.updated", { time: "10:00" }), "最近同步：10:00");
});

test("t falls back to en then to the raw key for unknown keys", () => {
  setLanguage("zh");
  assert.equal(t("definitely.unknown.key"), "definitely.unknown.key");
  assert.equal(t("actions.retry"), "重试");
  setLanguage("en");
  assert.equal(t("actions.retry"), "Retry");
});
