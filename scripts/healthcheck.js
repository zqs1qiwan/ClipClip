// Container healthcheck for ClipClip.
//
// Called by the Dockerfile HEALTHCHECK and by the docker-compose healthcheck, so the
// probe logic has a single source of truth. Uses Node's built-in fetch: the image ships
// without curl/wget.
//
// Exit codes: 0 = healthy, 1 = unhealthy (Docker reports "unhealthy" after --retries).
import process from "node:process";

const host = process.env.CLIPCLIP_HEALTHCHECK_HOST || "127.0.0.1";
const port = process.env.CLIPCLIP_PORT || "5678";
// Stay below the Docker healthcheck timeout (5s in Dockerfile/compose).
const timeoutMs = Number.parseInt(process.env.CLIPCLIP_HEALTHCHECK_TIMEOUT_MS || "4000", 10);
const url = `http://${host}:${port}/api/health`;

async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.error(`healthcheck: ${url} returned HTTP ${response.status}`);
      return 1;
    }

    const payload = await response.json();
    if (payload?.status !== "ok") {
      console.error(`healthcheck: ${url} returned unexpected payload: ${JSON.stringify(payload)}`);
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(`healthcheck: ${url} failed: ${error.message}`);
    return 1;
  } finally {
    clearTimeout(timer);
  }
}

process.exit(await probe());