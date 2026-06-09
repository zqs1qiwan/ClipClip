const liveTextarea = document.querySelector("#live-textarea");
const liveSaveButton = document.querySelector("#live-save-button");
const liveCopyButton = document.querySelector("#live-copy-button");
const liveClearButton = document.querySelector("#live-clear-button");
const liveUpdatedAt = document.querySelector("#live-updated-at");
const statusDot = document.querySelector("#live-status-dot");
const statusText = document.querySelector("#live-status-text");
const pasteTextarea = document.querySelector("#paste-textarea");
const pasteCreateButton = document.querySelector("#paste-create-button");
const pasteResult = document.querySelector("#paste-result");
const fileInput = document.querySelector("#file-input");
const fileUploadButton = document.querySelector("#file-upload-button");
const fileResult = document.querySelector("#file-result");

function setConnectionState(connected) {
  statusDot.dataset.connected = connected ? "true" : "false";
  statusText.textContent = connected ? "Live" : "Reconnecting";
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }
  return payload;
}

async function loadLiveClipboard() {
  const payload = await api("/api/live");
  liveTextarea.value = payload.content || "";
  liveUpdatedAt.textContent = `Last synced: ${formatTime(payload.updatedAt)}`;
}

async function saveLiveClipboard(content) {
  const payload = await api("/api/live", {
    method: "PUT",
    body: JSON.stringify({ content })
  });
  liveTextarea.value = payload.content || "";
  liveUpdatedAt.textContent = `Last synced: ${formatTime(payload.updatedAt)}`;
}

function bindLiveEvents() {
  const events = new EventSource("/api/events");
  events.addEventListener("open", () => setConnectionState(true));
  events.addEventListener("error", () => setConnectionState(false));
  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "live:snapshot" || payload.type === "live:updated") {
      liveTextarea.value = payload.content || "";
      liveUpdatedAt.textContent = `Last synced: ${formatTime(payload.updatedAt)}`;
    }
  };
}

async function createPaste() {
  const content = pasteTextarea.value.trim();
  if (!content) {
    pasteResult.textContent = "Paste content is required.";
    return;
  }
  const payload = await api("/api/pastes", {
    method: "POST",
    body: JSON.stringify({ content })
  });
  const fullUrl = `${window.location.origin}${payload.url}`;
  pasteResult.innerHTML = "";
  const link = document.createElement("a");
  link.href = fullUrl;
  link.textContent = fullUrl;
  link.target = "_blank";
  pasteResult.append(link);
}

async function uploadFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    fileResult.textContent = "Select a file first.";
    return;
  }
  const response = await fetch("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": file.name
    },
    body: file
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Upload failed.");
  }
  const link = `${window.location.origin}${payload.downloadUrl}`;
  fileResult.innerHTML = "";
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.textContent = `${payload.fileName} (${Math.max(1, Math.round(payload.sizeBytes / 1024))} KB)`;
  fileResult.append(anchor);
}

async function loadPasteView(pasteId) {
  const payload = await api(`/api/pastes/${pasteId}`);
  const template = document.querySelector("#paste-view-template");
  const fragment = template.content.cloneNode(true);
  document.body.innerHTML = "";
  document.body.append(fragment);
  document.querySelector("#paste-view-content").textContent = payload.content;
  document.querySelector("#paste-view-meta").textContent = `Expires: ${formatTime(payload.expiresAt)}`;
  document.querySelector("#paste-view-copy-button").addEventListener("click", async () => {
    await navigator.clipboard.writeText(payload.content);
  });
}

async function boot() {
  const match = window.location.pathname.match(/^\/p\/([^/]+)$/);
  if (match) {
    await loadPasteView(match[1]);
    return;
  }
  await loadLiveClipboard();
  bindLiveEvents();
  liveSaveButton.addEventListener("click", () => saveLiveClipboard(liveTextarea.value));
  liveCopyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(liveTextarea.value);
  });
  liveClearButton.addEventListener("click", () => saveLiveClipboard(""));
  pasteCreateButton.addEventListener("click", createPaste);
  fileUploadButton.addEventListener("click", uploadFile);
}

boot().catch((error) => {
  console.error(error);
  statusText.textContent = error.message || "Something went wrong.";
});
