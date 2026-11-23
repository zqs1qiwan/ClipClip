import path from "node:path";

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePort(value, fallback) {
  const parsed = parsePositiveInt(value, fallback);
  return parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const dataDir = env.CLIPCLIP_DATA_DIR || path.resolve(process.cwd(), "data");
  const accessToken = env.CLIPCLIP_ACCESS_TOKEN || "";

  return {
    host: env.CLIPCLIP_HOST || "0.0.0.0",
    port: parsePort(env.CLIPCLIP_PORT, 5678),
    publicBaseUrl: env.CLIPCLIP_PUBLIC_BASE_URL || "",
    dataDir,
    stateDir: path.join(dataDir, "state"),
    uploadsDir: path.join(dataDir, "uploads"),
    tmpDir: path.join(dataDir, "tmp"),
    stateFile: path.join(dataDir, "state", "clipclip-state.json"),
    accessToken,
    publicMode: Boolean(accessToken),
    trustProxy: String(env.CLIPCLIP_TRUST_PROXY || "").toLowerCase() === "1" ||
      String(env.CLIPCLIP_TRUST_PROXY || "").toLowerCase() === "true",
    sessionTtlMs: parsePositiveInt(env.CLIPCLIP_SESSION_TTL_SECONDS, 86400) * 1000 || DEFAULT_SESSION_TTL_MS,
    maxUploadMb: parsePositiveInt(env.CLIPCLIP_MAX_UPLOAD_MB, 50),
    recentFilesLimit: parsePositiveInt(env.CLIPCLIP_RECENT_FILES_LIMIT, 10),
    pasteTtlHours: parsePositiveInt(env.CLIPCLIP_PASTE_TTL_HOURS, 24),
    pasteTtlMaxHours: parsePositiveInt(env.CLIPCLIP_PASTE_TTL_MAX_HOURS, 168),
    pasteContentLimit: parsePositiveInt(env.CLIPCLIP_PASTE_CONTENT_LIMIT, 524288),
    maxPastePassphraseLen: parsePositiveInt(env.CLIPCLIP_MAX_PASTE_PASSPHRASE_LEN, 128),
    revealRateLimit: parsePositiveInt(env.CLIPCLIP_REVEAL_RATE_LIMIT, 5),
    revealRateWindowMs: parsePositiveInt(env.CLIPCLIP_REVEAL_RATE_WINDOW_MS, 60000),
    fileTtlHours: parsePositiveInt(env.CLIPCLIP_FILE_TTL_HOURS, 24),
    cleanupIntervalMs: parsePositiveInt(env.CLIPCLIP_CLEANUP_INTERVAL_MS, 60000),
    liveContentLimit: parsePositiveInt(env.CLIPCLIP_LIVE_CONTENT_LIMIT, 100000),
    maxSseClients: parsePositiveInt(env.CLIPCLIP_MAX_SSE_CLIENTS, 100),
    sseHeartbeatMs: parsePositiveInt(env.CLIPCLIP_SSE_HEARTBEAT_MS, 25000),
    sseIdleTimeoutMs: parsePositiveInt(env.CLIPCLIP_SSE_IDLE_TIMEOUT_MS, 300000)
  };
}