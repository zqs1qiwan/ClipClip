const translations = {
  en: {
    "brand.note": "Internal clipboard and quick transfer tool for your local network.",
    "topbar.endpointLabel": "Access",
    "live.title": "Live Clipboard",
    "live.hint": "Sync one shared text box across devices on the LAN.",
    "live.placeholder": "Paste or type text here",
    "paste.title": "Fixed Paste Link",
    "paste.hint": "Create a read-only link from the current text.",
    "paste.placeholder": "Text for a fixed paste link",
    "paste.viewTitle": "Paste",
    "paste.viewHint": "Read-only content",
    "file.title": "Small File Drop",
    "file.hint": "Upload a small file and open it from another device.",
    "file.select": "Choose a file",
    "actions.copy": "Copy",
    "actions.clear": "Clear",
    "actions.sync": "Sync",
    "actions.createLink": "Create",
    "actions.upload": "Upload",
    "status.connecting": "Connecting",
    "status.live": "Live",
    "status.reconnecting": "Reconnecting",
    "live.waiting": "Waiting for first update.",
    "live.updated": "Last synced: {time}",
    "paste.empty": "No paste created yet.",
    "paste.required": "Paste content is required.",
    "file.empty": "No file uploaded yet.",
    "file.selectFirst": "Select a file first.",
    "file.kb": "{name} ({size} KB)",
    "paste.expires": "Expires: {time}",
    "error.generic": "Something went wrong."
  },
  zh: {
    "brand.note": "内网使用的共享剪贴板和快速传输工具。",
    "topbar.endpointLabel": "访问地址",
    "live.title": "实时剪贴板",
    "live.hint": "同一局域网内多个设备共享同一个文本框。",
    "live.placeholder": "在这里粘贴或输入文本",
    "paste.title": "固定分享链接",
    "paste.hint": "把当前文本生成只读链接。",
    "paste.placeholder": "用于生成固定链接的文本",
    "paste.viewTitle": "分享内容",
    "paste.viewHint": "只读内容",
    "file.title": "小文件中转",
    "file.hint": "上传一个小文件，再到另一台设备打开。",
    "file.select": "选择文件",
    "actions.copy": "复制",
    "actions.clear": "清空",
    "actions.sync": "同步",
    "actions.createLink": "生成",
    "actions.upload": "上传",
    "status.connecting": "连接中",
    "status.live": "已连接",
    "status.reconnecting": "重连中",
    "live.waiting": "等待首次同步。",
    "live.updated": "最近同步：{time}",
    "paste.empty": "还没有生成分享链接。",
    "paste.required": "请输入要分享的文本。",
    "file.empty": "还没有上传文件。",
    "file.selectFirst": "请先选择文件。",
    "file.kb": "{name}（{size} KB）",
    "paste.expires": "过期时间：{time}",
    "error.generic": "出现了一点问题。"
  }
};

const state = {
  language: localStorage.getItem("clipclip-language") || "zh",
  currentPaste: null
};

const liveTextarea = document.querySelector("#live-textarea");
const liveSaveButton = document.querySelector("#live-save-button");
const liveCopyButton = document.querySelector("#live-copy-button");
const liveClearButton = document.querySelector("#live-clear-button");
const liveUpdatedAt = document.querySelector("#live-updated-at");
const connectionBadge = document.querySelector("#connection-badge");
const endpointValue = document.querySelector("#endpoint-value");
const pasteTextarea = document.querySelector("#paste-textarea");
const pasteCreateButton = document.querySelector("#paste-create-button");
const pasteResult = document.querySelector("#paste-result");
const fileInput = document.querySelector("#file-input");
const fileInputLabel = document.querySelector("#file-input-label");
const fileUploadButton = document.querySelector("#file-upload-button");
const fileResult = document.querySelector("#file-result");

function t(key, vars = {}) {
  const dict = translations[state.language] || translations.en;
  const template = dict[key] || translations.en[key] || key;
  return Object.entries(vars).reduce((value, [name, replacement]) => {
    return value.replace(`{${name}}`, replacement);
  }, template);
}

function formatTime(value) {
  if (!value) {
    return state.language === "zh" ? "未同步" : "Never";
  }
  const locale = state.language === "zh" ? "zh-CN" : "en-US";
  return new Date(value).toLocaleString(locale);
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === state.language);
  });
  endpointValue.textContent = `${window.location.origin}`;
  if (fileInput.files?.[0]) {
    fileInputLabel.textContent = fileInput.files[0].name;
  }
  if (state.currentPaste) {
    pasteResult.innerHTML = "";
    pasteResult.append(state.currentPaste);
  } else if (!pasteResult.querySelector("a")) {
    pasteResult.textContent = t("paste.empty");
  }
  if (!fileResult.querySelector("a")) {
    fileResult.textContent = t("file.empty");
  }
  if (!liveUpdatedAt.dataset.updatedAt) {
    liveUpdatedAt.textContent = t("live.waiting");
  }
}

function setConnectionState(mode) {
  connectionBadge.dataset.state = mode;
  connectionBadge.textContent = t(`status.${mode}`);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!headers["Content-Type"] && options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(payload?.error || t("error.generic"));
  }
  return payload;
}

function updateLiveTimestamp(updatedAt) {
  if (!updatedAt) {
    delete liveUpdatedAt.dataset.updatedAt;
    liveUpdatedAt.textContent = t("live.waiting");
    return;
  }
  liveUpdatedAt.dataset.updatedAt = updatedAt;
  liveUpdatedAt.textContent = t("live.updated", { time: formatTime(updatedAt) });
}

async function loadLiveClipboard() {
  const payload = await api("/api/live");
  liveTextarea.value = payload.content || "";
  updateLiveTimestamp(payload.updatedAt);
}

async function saveLiveClipboard(content) {
  const payload = await api("/api/live", {
    method: "PUT",
    body: JSON.stringify({ content })
  });
  liveTextarea.value = payload.content || "";
  updateLiveTimestamp(payload.updatedAt);
}

function bindLiveEvents() {
  const events = new EventSource("/api/events");
  events.addEventListener("open", () => setConnectionState("live"));
  events.addEventListener("error", () => setConnectionState("reconnecting"));
  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "live:snapshot" || payload.type === "live:updated") {
      liveTextarea.value = payload.content || "";
      updateLiveTimestamp(payload.updatedAt);
    }
  };
}

async function createPaste() {
  const content = pasteTextarea.value.trim();
  if (!content) {
    pasteResult.textContent = t("paste.required");
    return;
  }
  const payload = await api("/api/pastes", {
    method: "POST",
    body: JSON.stringify({ content })
  });
  const link = document.createElement("a");
  link.href = `${window.location.origin}${payload.url}`;
  link.textContent = link.href;
  link.target = "_blank";
  link.rel = "noreferrer";
  state.currentPaste = link;
  pasteResult.innerHTML = "";
  pasteResult.append(link);
}

async function uploadFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    fileResult.textContent = t("file.selectFirst");
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
    throw new Error(payload.error || t("error.generic"));
  }

  const anchor = document.createElement("a");
  anchor.href = `${window.location.origin}${payload.downloadUrl}`;
  anchor.textContent = t("file.kb", {
    name: payload.fileName,
    size: String(Math.max(1, Math.round(payload.sizeBytes / 1024)))
  });
  fileResult.innerHTML = "";
  fileResult.append(anchor);
}

async function loadPasteView(pasteId) {
  const payload = await api(`/api/pastes/${pasteId}`);
  const template = document.querySelector("#paste-view-template");
  const fragment = template.content.cloneNode(true);
  document.body.innerHTML = "";
  document.body.append(fragment);
  document.querySelector("#paste-view-content").textContent = payload.content;
  document.querySelector("#paste-view-meta").textContent = t("paste.expires", {
    time: formatTime(payload.expiresAt)
  });
  document.querySelector("#paste-view-copy-button").addEventListener("click", async () => {
    await navigator.clipboard.writeText(payload.content);
  });
  applyLanguage();
}

function bindLanguageEvents() {
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.language = button.dataset.lang;
      localStorage.setItem("clipclip-language", state.language);
      applyLanguage();
      if (liveUpdatedAt.dataset.updatedAt) {
        updateLiveTimestamp(liveUpdatedAt.dataset.updatedAt);
      }
    });
  });
}

async function boot() {
  setConnectionState("connecting");
  bindLanguageEvents();

  const match = window.location.pathname.match(/^\/p\/([^/]+)$/);
  if (match) {
    await loadPasteView(match[1]);
    return;
  }

  applyLanguage();
  await loadLiveClipboard();
  bindLiveEvents();

  fileInput.addEventListener("change", () => {
    fileInputLabel.textContent = fileInput.files?.[0]?.name || t("file.select");
  });

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
  connectionBadge.textContent = error.message || t("error.generic");
});
