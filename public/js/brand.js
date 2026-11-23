/**
 * Brand surface helpers for the Paper & Ink editorial UI.
 *
 * Kept deliberately small: the visual system lives in styles.css and the
 * brand assets live in /brand. This module only syncs the document-level
 * brand markers and the footer version line with runtime data.
 */

export const BRAND_NAME = "ClipClip";
export const BRAND_VERSION_FALLBACK = "0.1.0";

export function setBrandVersion(version) {
  const value = typeof version === "string" && version.trim() ? version.trim() : BRAND_VERSION_FALLBACK;
  const node = document.getElementById("app-version");
  if (node) {
    node.textContent = `v${value.replace(/^v/i, "")}`;
  }
  const root = document.documentElement;
  if (root?.dataset) {
    root.dataset.brand = "paper-ink";
    root.dataset.brandVersion = value;
  }
  return value;
}

export function initBrand(version = BRAND_VERSION_FALLBACK) {
  return setBrandVersion(version);
}