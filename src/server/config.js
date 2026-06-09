import path from "node:path";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const dataDir = env.CLIPCLIP_DATA_DIR || path.resolve(process.cwd(), "data");

  return {
    host: env.CLIPCLIP_HOST || "0.0.0.0",
    port: parsePositiveInt(env.CLIPCLIP_PORT, 8080),
    publicBaseUrl: env.CLIPCLIP_PUBLIC_BASE_URL || "",
    dataDir,
    stateDir: path.join(dataDir, "state"),
    uploadsDir: path.join(dataDir, "uploads"),
    stateFile: path.join(dataDir, "state", "clipclip-state.json"),
    maxUploadMb: parsePositiveInt(env.CLIPCLIP_MAX_UPLOAD_MB, 50),
    pasteTtlHours: parsePositiveInt(env.CLIPCLIP_PASTE_TTL_HOURS, 24),
    fileTtlHours: parsePositiveInt(env.CLIPCLIP_FILE_TTL_HOURS, 24),
    cleanupIntervalMs: parsePositiveInt(env.CLIPCLIP_CLEANUP_INTERVAL_MS, 60000),
    liveContentLimit: parsePositiveInt(env.CLIPCLIP_LIVE_CONTENT_LIMIT, 100000)
  };
}
