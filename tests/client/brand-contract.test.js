import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regression net for the paper-ink rebrand (t25). JS only works by id/data-*
// attributes, so a visual rewrite must not rename/remove any contract hook.
// This test is meant to run in the router source tree on Linux with plain
// `node --test tests/**/*.test.js`: it reads files with node:fs, no DOM needed.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BRAND_DOC = path.join(ROOT, "docs", "BRAND.md");
const INDEX_HTML = path.join(ROOT, "public", "index.html");
const I18N_JS = path.join(ROOT, "public", "js", "i18n.js");

const read = (file) => fs.readFile(file, "utf8");

/** Extract the §6 ID list from BRAND.md itself, so the test tracks the contract. */
async function contractIds() {
  const doc = await read(BRAND_DOC);
  const line = doc.split("\n").find((row) => row.trim().startsWith("- IDs:"));
  assert.ok(line, "BRAND.md §6 must contain the '- IDs:' contract line");
  // The IDs are one comma-separated code span: `id-a, id-b, ...`
  const span = line.match(/`([^`]+)`/);
  assert.ok(span, "the - IDs: line must wrap its list in a code span");
  return span[1].split(",").map((id) => id.trim()).filter(Boolean);
}

/** Extract every id="..." value from the HTML. */
function htmlIds(html) {
  return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Extract key names defined inside one dictionary block of i18n.js. */
function dictKeys(source, language) {
  const match = new RegExp(`${language}\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(source);
  assert.ok(match, `i18n.js must define the ${language} dictionary`);
  return new Set([...match[1].matchAll(/["']([A-Za-z0-9_.]+)["']\s*:/g)].map((m) => m[1]));
}

test("BRAND.md §6 contract lists exactly 68 IDs", async () => {
  const ids = await contractIds();
  assert.equal(ids.length, 68, `expected 68 contract IDs, found ${ids.length}`);
  assert.equal(new Set(ids).size, 68, "contract IDs must be unique");
});

test("every BRAND.md §6 contract ID exists in index.html exactly once", async () => {
  const ids = await contractIds();
  const present = htmlIds(await read(INDEX_HTML));
  const missing = ids.filter((id) => !present.includes(id));
  assert.deepEqual(missing, [], `contract IDs missing from index.html: ${missing.join(", ")}`);

  const duplicates = present.filter((id, index) => present.indexOf(id) !== index);
  assert.deepEqual(duplicates, [], `duplicate id attributes in index.html: ${[...new Set(duplicates)].join(", ")}`);
});

test("required data-* attributes survive the rebrand", async () => {
  const html = await read(INDEX_HTML);
  for (const attr of [
    "data-i18n",
    "data-i18n-placeholder",
    "data-i18n-aria-label",
    "data-tab",
    "data-panel",
    "data-lang",
    "data-alert",
    'data-role="copy"'
  ]) {
    assert.ok(html.includes(attr), `index.html must keep ${attr}`);
  }

  // Concrete hook values the JS switches on.
  for (const tab of ["live", "paste", "files"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `missing data-tab=${tab}`);
    assert.ok(html.includes(`data-panel="${tab}"`), `missing data-panel=${tab}`);
  }
  for (const lang of ["zh", "en"]) {
    assert.ok(html.includes(`data-lang="${lang}"`), `missing data-lang=${lang}`);
  }
  assert.ok((html.match(/data-role="copy"/g) || []).length >= 2, "both result templates need data-role=copy");
});

test("alert and template class structure used by the renderer is intact", async () => {
  const html = await read(INDEX_HTML);
  for (const cls of [
    "alert-text",
    "alert-action",
    "result-title",
    "mini-badge",
    "result-sub",
    "link-button",
    "result-meta",
    "history-title",
    "history-sub",
    "history-meta-line",
    "secondary-link",
    "dropzone",
    "tab-button",
    "lang-button"
  ]) {
    assert.ok(html.includes(cls), `index.html must keep class ${cls}`);
  }
  assert.ok(html.includes("modal-open") || html.includes("modal"), "modal hooks must remain");
});

test("all i18n keys referenced by HTML exist in BOTH dictionaries", async () => {
  const html = await read(INDEX_HTML);
  const source = await read(I18N_JS);
  const en = dictKeys(source, "en");
  const zh = dictKeys(source, "zh");

  // Keys referenced from HTML via any data-i18n* attribute.
  const referenced = new Set();
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-aria-label)?=["']([^"']+)["']/g)) {
    referenced.add(m[1]);
  }
  assert.ok(referenced.size > 30, "expected the HTML to reference many i18n keys");

  const missingEn = [...referenced].filter((key) => !en.has(key));
  const missingZh = [...referenced].filter((key) => !zh.has(key));
  assert.deepEqual(missingEn, [], `HTML i18n keys missing in en: ${missingEn.join(", ")}`);
  assert.deepEqual(missingZh, [], `HTML i18n keys missing in zh: ${missingZh.join(", ")}`);
});

test("en and zh dictionaries have identical key sets (no untranslated brand keys)", async () => {
  const source = await read(I18N_JS);
  const en = dictKeys(source, "en");
  const zh = dictKeys(source, "zh");
  const onlyEn = [...en].filter((key) => !zh.has(key));
  const onlyZh = [...zh].filter((key) => !en.has(key));
  assert.deepEqual(onlyEn, [], `keys only in en: ${onlyEn.join(", ")}`);
  assert.deepEqual(onlyZh, [], `keys only in zh: ${onlyZh.join(", ")}`);
});

test("brand/footer/qr/pasteLock i18n keys from the rebrand are present", async () => {
  const source = await read(I18N_JS);
  const en = dictKeys(source, "en");
  const zh = dictKeys(source, "zh");
  const required = [
    "brand.kicker",
    "brand.tagline",
    "brand.standfirst",
    "footer.line",
    "footer.note",
    "actions.qr",
    "actions.copied",
    "qr.title",
    "qr.hint",
    "qr.urlLabel",
    "qr.copy",
    "qr.close",
    "paste.burnLabel",
    "paste.burnBadge",
    "paste.passphraseLabel",
    "pasteLock.title",
    "pasteLock.passphraseLabel",
    "pasteLock.submit",
    "pasteLock.invalid"
  ];
  for (const key of required) {
    assert.ok(en.has(key), `en missing rebrand key ${key}`);
    assert.ok(zh.has(key), `zh missing rebrand key ${key}`);
  }
});

test("copied feedback uses a text check mark, not an emoji, in both languages", async () => {
  const source = await read(I18N_JS);
  assert.match(source, /"actions\.copied"\s*:\s*"Copied ✓"/);
  assert.match(source, /"actions\.copied"\s*:\s*"已复制 ✓"/);
});
