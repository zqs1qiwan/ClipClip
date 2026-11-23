import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Static, structural accessibility checks only. Contrast ratios (BRAND.md §8)
// require a real browser/CDP and are handled by the captain's visual pass
// documented in VERIFICATION.md. Here we assert the structural hooks that must
// survive the rebrand so assistive tech keeps working.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const INDEX_HTML = path.join(ROOT, "public", "index.html");
const html = await fs.readFile(INDEX_HTML, "utf8");

test("tabs expose role=tab with aria-selected and aria-controls", () => {
  const tabs = [...html.matchAll(/<button[^>]*\brole="tab"[^>]*>/g)].map((m) => m[0]);
  assert.equal(tabs.length, 3, "expected exactly 3 tabs");
  for (const tab of tabs) {
    assert.match(tab, /aria-selected=/, "tab must expose aria-selected");
    assert.match(tab, /aria-controls="panel-/, "tab must point to its panel");
    assert.match(tab, /data-tab=/, "tab must keep its data-tab hook");
  }
});

test("tab panels expose role=tabpanel with aria-labelledby", () => {
  const panels = [...html.matchAll(/<section[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);
  assert.equal(panels.length, 3, "expected exactly 3 tab panels");
  for (const panel of panels) {
    assert.match(panel, /aria-labelledby="tab-/, "panel must be labelled by its tab");
    assert.match(panel, /data-panel=/, "panel must keep its data-panel hook");
  }
});

test("tablist container has an accessible name", () => {
  assert.match(html, /<nav[^>]*role="tablist"[^>]*>/);
  const nav = html.match(/<nav[^>]*role="tablist"[^>]*>/)[0];
  assert.ok(
    nav.includes("aria-label=") || nav.includes("data-i18n-aria-label="),
    "tablist must have aria-label or data-i18n-aria-label"
  );
});

test("QR modal is a labelled dialog with aria-modal", () => {
  const dialog = html.match(/<div[^>]*role="dialog"[^>]*>/);
  assert.ok(dialog, "modal must expose role=dialog");
  assert.match(dialog[0], /aria-modal="true"/, "dialog must be aria-modal");
  assert.match(dialog[0], /aria-labelledby="qr-modal-title"/, "dialog must be labelled");
  assert.ok(html.includes('id="qr-modal-title"'), "label target must exist");
});

test("status regions and progressbar expose live semantics", () => {
  assert.match(html, /id="connection-badge"[^>]*role="status"[\s\S]{0,80}aria-live="polite"|id="connection-badge"[\s\S]{0,120}aria-live="polite"/);
  const progress = html.match(/id="upload-progress"[\s\S]{0,200}?role="progressbar"/);
  assert.ok(progress, "upload progress must expose role=progressbar");
  assert.match(html, /aria-valuemin="0"/);
  assert.match(html, /aria-valuemax="100"/);
  assert.match(html, /id="a11y-status"[^>]*role="status"[^>]*aria-live="polite"/);
});

test("every <img> has an alt attribute (decorative marks use alt=\"\")", () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length > 0, "expected brand images in the rebranded page");
  for (const img of imgs) {
    assert.match(img, /\balt=/, `image must have an alt attribute: ${img.slice(0, 80)}`);
  }
});

test("form controls have labels or an accessible name hook", () => {
  // Inputs that are visibly labelled by a <label for=...>, carry a data-i18n
  // label/placeholder, or are JS-managed copy buttons are acceptable.
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(inputs.length >= 4, "expected the form inputs to survive");
  for (const input of inputs) {
    const id = (input.match(/\bid="([^"]+)"/) || [])[1];
    const labelled = id && html.includes(`for="${id}"`);
    const hasNameHook =
      /aria-label=/.test(input) || /data-i18n/.test(input) || /type="(checkbox|file)"/.test(input);
    assert.ok(
      labelled || hasNameHook,
      `input needs a <label for> or accessible-name hook: ${input.slice(0, 90)}`
    );
  }
});

test("language switch is a labelled group with pressed-state buttons", () => {
  assert.match(html, /role="group"[^>]*data-i18n-aria-label="lang.group"/);
  const langButtons = [...html.matchAll(/<button[^>]*data-lang="[^"]+"[^>]*>/g)].map((m) => m[0]);
  assert.equal(langButtons.length, 2, "expected 中/EN language buttons");
  for (const button of langButtons) {
    assert.match(button, /aria-pressed=/, "language buttons must expose aria-pressed");
  }
});

test("no interactive element relies on a bare emoji as its only label", () => {
  assert.doesNotMatch(html, /<button[^>]*>[\s]*[\u{1F300}-\u{1FAFF}]/u, "no emoji-only buttons (BRAND.md §1)");
});
