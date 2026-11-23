import { api } from "./api.js";
import { applyFilesPayload } from "./files.js";
import { applyLivePayload } from "./live.js";
import { renderConnection } from "./views.js";

const PROBE_INTERVAL_MS = 5000;

let source = null;
let lastProbeAt = 0;

export function disconnectEvents(state) {
  if (source) {
    source.close();
    source = null;
  }
  if (state) {
    state.connection = "offline";
  }
}

function probeSession(state, onUnauthorized) {
  const now = Date.now();
  if (now - lastProbeAt < PROBE_INTERVAL_MS) {
    return;
  }
  lastProbeAt = now;

  api
    .getLive()
    .then(() => {
      // Endpoint is reachable again; EventSource will report open on its own.
    })
    .catch((error) => {
      if (error.code === "unauthorized") {
        disconnectEvents(state);
        onUnauthorized?.("expired");
        return;
      }
      if (error.code === "network") {
        state.connection = "offline";
        renderConnection(state);
      }
    });
}

export function connectEvents(state, { onUnauthorized } = {}) {
  disconnectEvents(state);
  state.connection = "connecting";
  renderConnection(state);

  if (state.auth === "unauth") {
    return null;
  }

  source = new EventSource("/api/events");

  source.addEventListener("open", () => {
    state.connection = "live";
    renderConnection(state);
  });

  source.addEventListener("error", () => {
    state.connection = "reconnecting";
    renderConnection(state);
    if (state.publicMode) {
      probeSession(state, onUnauthorized);
    }
  });

  source.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.type === "live:snapshot" || payload.type === "live:updated") {
      applyLivePayload(state, payload, { initial: payload.type === "live:snapshot" });
      return;
    }

    if (payload.type === "files:snapshot" || payload.type === "files:updated") {
      applyFilesPayload(state, payload);
    }
  };

  return source;
}