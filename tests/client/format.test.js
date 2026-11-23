import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBytes,
  formatDateTime,
  formatDurationHours
} from "../../public/js/format.js";

test("formatBytes maps invalid and non-positive values to 0 B", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-1), "0 B");
  assert.equal(formatBytes("not-a-number"), "0 B");
  assert.equal(formatBytes(undefined), "0 B");
});

test("formatBytes scales through B, KB, MB and GB with readable rounding", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(10240), "10 KB");
  assert.equal(formatBytes(1048576), "1 MB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5 MB");
  assert.equal(formatBytes(1073741824), "1 GB");
});

test("formatBytes keeps the largest unit for very large values", () => {
  assert.equal(formatBytes(2 * 1024 * 1024 * 1024), "2 GB");
});

test("formatDateTime returns the fallback for missing or malformed input", () => {
  assert.equal(formatDateTime(null, "en-US", "Never"), "Never");
  assert.equal(formatDateTime("", "en-US", "Never"), "Never");
  assert.equal(formatDateTime("not-a-date", "en-US", "Never"), "Never");
});

test("formatDateTime formats a valid ISO timestamp for the requested locale", () => {
  const formatted = formatDateTime("2024-01-02T03:04:00.000Z", "en-US", "Never");
  assert.notEqual(formatted, "Never");
  assert.match(formatted, /2024/);
});

test("formatDurationHours maps hours to h/d labels and rejects invalid values", () => {
  assert.equal(formatDurationHours(0), "");
  assert.equal(formatDurationHours(-3), "");
  assert.equal(formatDurationHours("bad"), "");
  assert.equal(formatDurationHours(1), "1h");
  assert.equal(formatDurationHours(12), "12h");
  assert.equal(formatDurationHours(24), "1d");
  assert.equal(formatDurationHours(48), "2d");
  assert.equal(formatDurationHours(36), "2d");
});
