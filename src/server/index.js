import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createStorage } from "./storage.js";

const config = loadConfig();
const storage = await createStorage(config);
const server = createApp({ config, storage });

server.listen(config.port, config.host, () => {
  console.log(`ClipClip listening on http://${config.host}:${config.port}`);
});

const cleanupTimer = setInterval(() => {
  storage.cleanupExpired().catch((error) => {
    console.error("Cleanup failed", error);
  });
}, config.cleanupIntervalMs);

cleanupTimer.unref();
