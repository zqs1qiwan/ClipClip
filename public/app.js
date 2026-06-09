import { copyText } from "./lib/clipboard.js";

const translations = {
  en: {
    "brand.note": "Shared clipboard, fixed links, and small file transfer for your local network.",
    "topbar.endpointLabel": "Access",
    "tabs.live": "Clipboard",
    "tabs.paste": "Share Link",
    "tabs.files": "Files",
    "live.title": "Live Clipboard",
    "live.hint": "Everyone on the LAN sees the same text box in real time.",
    "live.placeholder": "Paste or type text here",
    "paste.title": "Fixed Share Link",
    "paste.hint": "Freeze a piece of text into a read-only link.",
    "paste.placeholder": "Text for a fixed share link",
    "paste.viewTitle": "Shared Paste",
    "paste.viewHint": "Read-only content",
    "paste.created": "Share link is ready.",
    "file.title": "Small File Drop",
    "file.hint": "Send a small file to another device with a simple download link.",
    "file.select": "Choose a file",
    "file.selectHint": "Good for quick transfers within the upload size limit.",
    "file.idle": "Ready.",
    "file.uploading": "Uploading...",
    "file.uploaded": "Upload complete.",
    "actions.copy": "Copy",
    "actions.copyLink": "Copy link",
    "actions.clear": "Clear",
    "actions.sync": "Sync",
    "actions.createLink": "Create",
    "actions.upload": "Upload",
    "actions.open": "Open",
    "actions.download": "Download",
    "actions.useLive": "Use clipboard text",
    "status.connecting": "Connecting",
    "status.live": "Live",
    "status.reconnecting": "Reconnecting",
    "live.waiting": "Waiting for first update.",
    "live.updated": "Last synced: {time}",
    "paste.empty": "No share link yet.",
    "paste.required": "Paste content is required.",
    "file.empty": "No file uploaded yet.",
    "file.selectFirst": "Select a file first.",
    "file.selected": "Selected: {name} ({size} KB)",
    "file.kb": "{name} ({size} KB)",
    "paste.expires": "Expires: {time}",
    "time.never": "Never",
    "error.generic": "Something went wrong."
  },
  zh: {
    "brand.note": "适合局域网内部使用的共享剪贴板、固定链接和小文件传输。",
    "topbar.endpointLabel": "访问地址",
    "tabs.live": "剪贴板",
    "tabs.paste": "分享链接",
    "tabs.files": "文件",
    "live.title": "实时剪贴板",
    "live.hint": "局域网内的设备会实时看到同一个文本框。",
    "live.placeholder": "在这里粘贴或输入文本",
    "paste.title": "固定分享链接",
    "paste.hint": "把一段文本冻结成只读链接，方便转发。",
    "paste.placeholder": "用于生成固定分享链接的文本",
    "paste.viewTitle": "分享内容",
    "paste.viewHint": "只读内容",
    "paste.created": "分享链接已生成。",
    "file.title": "小文件中转",
    "file.hint": "上传一个小文件，生成简单下载链接给其他设备。",
    "file.select": "选择文件",
    "file.selectHint": "适合快速传小文件，大小受上传上限控制。",
    "file.idle": "准备就绪。",
    "file.uploading": "正在上传...",
    "file.uploaded": "上传完成。",
    "actions.copy": "复制",
    "actions.copyLink": "复制链接",
    "actions.clear": "清空",
    "actions.sync": "同步",
    "actions.createLink": "生成",
    "actions.upload": "上传",
    "actions.open": "打开",
    "actions.useLive": "使用剪贴板内容",
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
    "time.never": "尚未同步",
    "error.generic": "出了点问题。"
  }
};

const state = {
  activeTab: localStorage.getItem("clipclip-active-tab") || "live",
  language: localStorage.getItem("clipclip-language") || "zh",
  currentPaste: null,
  currentFile: null,
  selectedFile: null
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
const uploadStatus = document.querySelector("#upload-status");
const uploadProgressBar = document.querySelector("#upload-progress-bar");

function t(key, vars = {}) {
  const dict = translations[state.language] || translations.en;
  const template = dict[key] || translations.en[key] || key;
  return Object.entries(vars).reduce(
    (value, [name, replacement]) => value.replace(`{${name}}`, replacement),
    template
  );
}

function formatTime(value) {
  if (!value) {
    return t("time.never");
  }
  const locale = state.language === "zh" ? "zh-CN" : "en-US";
  return new Date(value).toLocaleString(locale);
}

function translateStaticText() {
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
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  localStorage.setItem("clipclip-active-tab", tabName);

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === tabName;
    panel.hidden = !isActive;
  });
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

function setUploadProgress(value) {
  uploadProgressBar.style.inlineSize = `${Math.max(0, Math.min(100, value))}%`;
}

function setSelectedFile(file) {
  state.selectedFile = file || null;

  if (!file) {
    fileInputLabel.textContent = t("file.select");
    fileSelectionMeta.textContent = t("file.selectHint");
    uploadStatus.textContent = t("file.idle");
    setUploadProgress(0);
    return;
  }

  fileInputLabel.textContent = file.name;
  fileSelectionMeta.textContent = t("file.selected", {
    name: file.name,
    size: String(Math.max(1, Math.round(file.size / 1024)))
  });
  uploadStatus.textContent = t("file.idle");
  setUploadProgress(0);
}

function createResultCard({ title, subtitle, href, expiresAt, primaryActionLabel = t("actions.open") }) {
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
  openButton.textContent = primaryActionLabel;

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
      expiresAt: paste.expiresAt,
      primaryActionLabel: t("actions.open")
    })
  );
}

function renderFileResult(file) {
  state.currentFile = file;
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
      expiresAt: file.expiresAt,
      primaryActionLabel: t("actions.download")
    })
  );
}

function applyLanguage() {
  translateStaticText();
  endpointValue.textContent = window.location.origin;
  setConnectionState(connectionBadge.dataset.state || "connecting");

  if (liveUpdatedAt.dataset.updatedAt) {
    updateLiveTimestamp(liveUpdatedAt.dataset.updatedAt);
  } else {
    liveUpdatedAt.textContent = t("live.waiting");
  }

  setSelectedFile(state.selectedFile);

  if (state.currentPaste) {
    renderPasteResult(state.currentPaste);
  } else {
    pasteResult.textContent = t("paste.empty");
  }

  if (state.currentFile) {
    renderFileResult(state.currentFile);
  } else {
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
      return;
    }

    if (payload.type === "file:snapshot" || payload.type === "file:updated") {
      renderFileResult(payload);
    }
  };
}

async function loadLatestFile() {
  try {
    const payload = await api("/api/files/latest");
    renderFileResult(payload);
  } catch (error) {
    if (error.message === "File not found.") {
      fileResult.textContent = t("file.empty");
      return;
    }
    throw error;
  }
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

function uploadFileWithProgress(file) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/files");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setUploadProgress((event.loaded / event.total) * 100);
      }
    });

    request.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        reject(new Error(t("error.generic")));
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || t("error.generic")));
    });

    request.addEventListener("error", () => reject(new Error(t("error.generic"))));
    request.send(file);
  });
}

async function uploadFile() {
  const file = state.selectedFile || fileInput.files?.[0];
  if (!file) {
    fileResult.textContent = t("file.selectFirst");
    return;
  }

  fileUploadButton.disabled = true;
  uploadStatus.textContent = t("file.uploading");
  setUploadProgress(3);

  try {
    const payload = await uploadFileWithProgress(file);
    uploadStatus.textContent = t("file.uploaded");
    setUploadProgress(100);
    renderFileResult(payload);
  } catch (error) {
    uploadStatus.textContent = error.message || t("error.generic");
    setUploadProgress(0);
  } finally {
    fileUploadButton.disabled = false;
  }
}

async function loadPasteView(pasteId) {
  const payload = await api(`/api/pastes/${pasteId}`);
  const template = document.querySelector("#paste-view-template");
  const fragment = template.content.cloneNode(true);
  document.body.innerHTML = "";
  document.body.append(fragment);
  translateStaticText();
  document.querySelector("#paste-view-content").textContent = payload.content;
  document.querySelector("#paste-view-meta").textContent = t("paste.expires", {
    time: formatTime(payload.expiresAt)
  });
  document.querySelector("#paste-view-copy-button").addEventListener("click", async () => {
    await copyText(payload.content);
  });
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

function bindTabEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
}

function bindFileInteractions() {
  fileInput.addEventListener("change", () => {
    setSelectedFile(fileInput.files?.[0] || null);
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
    setSelectedFile(files[0]);
    setActiveTab("files");
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

  bindTabEvents();
  applyLanguage();
  setActiveTab(state.activeTab);
  await loadLiveClipboard();
  await loadLatestFile();
  bindLiveEvents();
  bindFileInteractions();

  liveSaveButton.addEventListener("click", () => saveLiveClipboard(liveTextarea.value));
  liveCopyButton.addEventListener("click", async () => {
    await copyText(liveTextarea.value);
  });
  liveClearButton.addEventListener("click", () => saveLiveClipboard(""));
  pasteFillLiveButton.addEventListener("click", () => {
    pasteTextarea.value = liveTextarea.value;
    setActiveTab("paste");
  });
  pasteCreateButton.addEventListener("click", createPaste);
  fileUploadButton.addEventListener("click", uploadFile);
}

boot().catch((error) => {
  console.error(error);
  connectionBadge.textContent = error.message || t("error.generic");
});
