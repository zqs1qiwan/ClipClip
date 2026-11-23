const SIZE_UNITS = ["B", "KB", "MB", "GB"];

/**
 * Format a byte count using the smallest unit that keeps the number readable.
 * Pure helper so it can be unit tested outside the browser.
 */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const rounded = unit === 0 || size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${SIZE_UNITS[unit]}`;
}

/**
 * Format an ISO timestamp for the active locale. Returns `fallback` for
 * missing or unparsable values instead of throwing.
 */
export function formatDateTime(value, locale, fallback) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleString(locale);
}

export function formatDurationHours(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  if (value < 24) {
    return `${value}h`;
  }
  return `${Math.round(value / 24)}d`;
}