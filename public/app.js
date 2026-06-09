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
    "paste.created": "Paste link is ready.",
    "file.title": "Small File Drop",
    "file.hint": "Upload a small file and open it from another device.",
    "file.select": "Choose a file",
    "file.selectHint": "Files up to the configured limit can be shared.",
    "actions.copy": "Copy",
    "actions.copyLink": "Copy link",
    "actions.clear": "Clear",
    "actions.sync": "Sync",
    "actions.createLink": "Create",
    "actions.upload": "Upload",
    "actions.open": "Open",
    "actions.useLive": "Use live",
    "status.connecting": "Connecting",
    "status.live": "Live",
    "status.reconnecting": "Reconnecting",
    "live.waiting": "Waiting for first update.",
    "live.updated": "Last synced: {time}",
    "paste.empty": "No paste created yet.",
    "paste.required": "Paste content is required.",
    "file.empty": "No file uploaded yet.",
    "file.selectFirst": "Select a file first.",
    "file.selected": "Selected: {name} ({size} KB)",
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
    "paste.created": "分享链接已生成。",
    "file.title": "小文件中转",
    "file.hint": "上传一个小文件，再到另一台设备打开。",
    "file.select": "选择文件",
    "file.selectHint": "可分享不超过配置上限的小文件。",
    "actions.copy": "复制",
    "actions.copyLink": "复制链接",
    "actions.clear": "清空",
    "actions.sync": "同步",
    "actions.createLink": "生成",
    "actions.upload": "上传",
    "actions.open": "打开",
    "actions.useLive": "使用实时文本",
    "status.connecting": "连接中",
    "status.live": "已连接",
    "status.reconnecting": "重连中",
    "live.waiting": "等待首次同步。",
    "live.updated": "最近同步：{time}",
    "paste.empty": "还没有生成分享链接。",
    "paste.required": "请输入要分享的文本。",
    "file.empty": "还没有上传文件。",
    "file.selectFirst": "请先选择文件。",
    "file.selected": "已选择：{name}（{size} KB）",
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
const pasteFillLiveButton = document.querySelector("#paste-fill-live-button");
const pasteCreateButton = document.querySelector("#paste-create-button");
const pasteResult = document.querySelector("#paste-result");
const fileInput = document.querySelector("#file-input");
const fileInputLabel = document.querySelector("#file-input-label");
const fileSelectionMeta = document.querySelector("#file-selection-meta");
const fileUploadButton = document.querySelector("#file-upload-button");
const fileResult = document.querySelector("#file-result");
const uploadBox = document.querySelector(".upload-box");

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

function setConnectionState(mode) {
  connectionBadge.dataset.state = mode;
  connectionBadge.textContent = t(`status.${mode}`);
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

function updateFileSelectionMeta(file) {
  if (!file) {
    fileSelectionMeta.textContent = t("file.selectHint");
    fileInputLabel.textContent = t("file.select");
    return;
  }
  fileInputLabel.textContent = file.name;
  fileSelectionMeta.textContent = t("file.selected", {
    name: file.name,
    size: String(Math.max(1, Math.round(file.size / 1024)))
  });
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

function createResultCard({ title, subtitle, href, expiresAt }) {
  const card = document.createElement("div");
  card.className = "result-card";

  const titleNode = document.createElement("strong");
  titleNode.className = "result-title";
  titleNode.textContent = title;

  const subtitleNode = document.createElement("div");
  subtitleNode.className = "result-link";
  subtitleNode.textContent = subtitle;

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const actionPair = document.createElement("div");
  actionPair.className = "result-action-pair";

  const openButton = document.createElement("a");
  openButton.className = "link-button";
  openButton.href = href;
  openButton.target = "_blank";
  openButton.rel = "noreferrer";
  openButton.textContent = t("actions.open");

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "secondary-button small-button";
  copyButton.textContent = t("actions.copyLink");
  copyButton.addEventListener("click", () => copyText(href));

  const expiresNode = document.createElement("span");
  expiresNode.className = "muted-text";
  expiresNode.textContent = t("paste.expires", { time: formatTime(expiresAt) });

  actionPair.append(openButton, copyButton);
  actions.append(actionPair, expiresNode);
  card.append(titleNode, subtitleNode, actions);
  return card;
}

function renderPasteResult(paste) {
  state.currentPaste = paste;
  const href = `${window.location.origin}${paste.url}`;
  pasteResult.innerHTML = "";
  pasteResult.append(
    createResultCard({
      title: t("paste.created"),
      subtitle: href,
      href,
      expiresAt: paste.expiresAt
    })
  );
}

function renderFileResult(file) {
  const href = `${window.location.origin}${file.downloadUrl}`;
  fileResult.innerHTML = "";
  fileResult.append(
    createResultCard({
      title: file.fileName,
      subtitle: t("file.kb", {
        name: file.fileName,
        size: String(Math.max(1, Math.round(file.sizeBytes / 1024)))
      }),
      href,
      expiresAt: file.expiresAt
    })
  );
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

  endpointValue.textContent = window.location.origin;

  if (liveUpdatedAt.dataset.updatedAt) {
    updateLiveTimestamp(liveUpdatedAt.dataset.updatedAt);
  } else {
    liveUpdatedAt.textContent = t("live.waiting");
  }

  updateFileSelectionMeta(fileInput.files?.[0] || null);

  if (state.currentPaste) {
    renderPasteResult(state.currentPaste);
  } else if (!pasteResult.querySelector(".result-card")) {
    pasteResult.textContent = t("paste.empty");
  }

  if (!fileResult.querySelector(".result-card")) {
    fileResult.textContent = t("file.empty");
  }
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
  renderPasteResult(payload);
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

  renderFileResult(payload);
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
    await copyText(payload.content);
  });
  applyLanguage();
}

function bindLanguageEvents() {
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.language = button.dataset.lang;
      localStorage.setItem("clipclip-language", state.language);
      applyLanguage();
    });
  });
}

function bindFileInteractions() {
  fileInput.addEventListener("change", () => {
    updateFileSelectionMeta(fileInput.files?.[0] || null);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.remove("is-dragging");
    });
  });

  uploadBox.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }
    fileInput.files = files;
    updateFileSelectionMeta(files[0]);
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
  bindFileInteractions();

  liveSaveButton.addEventListener("click", () => saveLiveClipboard(liveTextarea.value));
  liveCopyButton.addEventListener("click", async () => {
    await copyText(liveTextarea.value);
  });
  liveClearButton.addEventListener("click", () => saveLiveClipboard(""));
  pasteFillLiveButton.addEventListener("click", () => {
    pasteTextarea.value = liveTextarea.value;
  });
  pasteCreateButton.addEventListener("click", createPaste);
  fileUploadButton.addEventListener("click", uploadFile);
}

boot().catch((error) => {
  console.error(error);
  connectionBadge.textContent = error.message || t("error.generic");
});
