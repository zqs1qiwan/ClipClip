import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createStorage } from "./storage.js";

process.on("unhandledRejection", (reason) => {
  // Never log request bodies, clipboard text, filenames, or tokens.
  console.error("Unhandled rejection:", reason?.code || reason?.name || "unknown");
});

let config;
let storage;
let server;

try {
  config = loadConfig();
  storage = await createStorage(config);
  server = createApp({ config, storage });
} catch (error) {
  console.error("ClipClip startup failed:", error?.code || error?.name || "unknown");
  process.exit(1);
}

server.listen(config.port, config.host, () => {
  console.log(`ClipClip listening on http://${config.host}:${config.port}`);
});

const cleanupTimer = setInterval(() => {
  storage.cleanupExpired().catch((error) => {
    console.error("Cleanup failed:", error?.code || error?.name || "unknown");
  });
}, config.cleanupIntervalMs);

cleanupTimer.unref();

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`ClipClip shutting down (${signal})`);
  clearInterval(cleanupTimer);
  server.close((error) => {
    if (error) {
      console.error("Server close failed:", error?.code || error?.name || "unknown");
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));