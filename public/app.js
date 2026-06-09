import { flashButtonState } from "./lib/button-feedback.js";
import { copyText } from "./lib/clipboard.js";

const translations = {
  en: {
    "topbar.endpointLabel": "Access",
    "tabs.live": "Clipboard",
    "tabs.paste": "Share Link",
    "tabs.files": "Files",
    "live.title": "Live Clipboard",
    "live.placeholder": "Paste or type text here",
    "paste.title": "Share Link",
    "paste.placeholder": "Text for a fixed share link",
    "paste.viewTitle": "Shared Paste",
    "paste.created": "Share link is ready.",
    "file.title": "File Transfer",
    "file.select": "Choose a file",
    "file.selectHint": "Newest 10 files stay in the queue.",
    "file.idle": "Ready.",
    "file.uploading": "Uploading...",
    "file.uploaded": "Upload complete.",
    "file.latestTitle": "Ready to download",
    "file.queueTitle": "Recent uploads",
    "file.empty": "No files in the queue yet.",
    "file.historyEmpty": "Upload history will appear here.",
    "file.selectFirst": "Select a file first.",
    "file.selected": "Selected: {name} ({size} KB)",
    "file.kb": "{name} ({size} KB)",
    "file.latestBadge": "Latest",
    "file.count": "{count} files",
    "actions.copy": "Copy",
    "actions.copyLink": "Copy link",
    "actions.copied": "Copied",
    "actions.manualCopy": "Manual Copy",
    "actions.blocked": "Blocked",
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
    "paste.expires": "Expires: {time}",
    "time.never": "Never",
    "error.generic": "Something went wrong."
  },
  zh: {
    "topbar.endpointLabel": "\u8bbf\u95ee",
    "tabs.live": "\u526a\u8d34\u677f",
    "tabs.paste": "\u5206\u4eab\u94fe\u63a5",
    "tabs.files": "\u6587\u4ef6",
    "live.title": "\u5b9e\u65f6\u526a\u8d34\u677f",
    "live.placeholder": "\u5728\u8fd9\u91cc\u7c98\u8d34\u6216\u8f93\u5165\u6587\u672c",
    "paste.title": "\u5206\u4eab\u94fe\u63a5",
    "paste.placeholder": "\u8f93\u5165\u8981\u56fa\u5b9a\u5206\u4eab\u7684\u6587\u672c",
    "paste.viewTitle": "\u5206\u4eab\u5185\u5bb9",
    "paste.created": "\u5206\u4eab\u94fe\u63a5\u5df2\u751f\u6210",
    "file.title": "\u6587\u4ef6\u4e2d\u8f6c",
    "file.select": "\u9009\u62e9\u6587\u4ef6",
    "file.selectHint": "\u961f\u5217\u4f1a\u4fdd\u7559\u6700\u65b0 10 \u4e2a\u6587\u4ef6",
    "file.idle": "\u51c6\u5907\u5c31\u7eea",
    "file.uploading": "\u6b63\u5728\u4e0a\u4f20...",
    "file.uploaded": "\u4e0a\u4f20\u5b8c\u6210",
    "file.latestTitle": "\u5f53\u524d\u53ef\u4e0b\u8f7d",
    "file.queueTitle": "\u6700\u8fd1\u4e0a\u4f20",
    "file.empty": "\u961f\u5217\u91cc\u8fd8\u6ca1\u6709\u6587\u4ef6",
    "file.historyEmpty": "\u4e0a\u4f20\u8bb0\u5f55\u4f1a\u663e\u793a\u5728\u8fd9\u91cc",
    "file.selectFirst": "\u8bf7\u5148\u9009\u62e9\u6587\u4ef6",
    "file.selected": "\u5df2\u9009\u62e9\uff1a{name} ({size} KB)",
    "file.kb": "{name} ({size} KB)",
    "file.latestBadge": "\u6700\u65b0",
    "file.count": "{count} \u4e2a\u6587\u4ef6",
    "actions.copy": "\u590d\u5236",
    "actions.copyLink": "\u590d\u5236\u94fe\u63a5",
    "actions.copied": "\u5df2\u590d\u5236",
    "actions.manualCopy": "\u624b\u52a8\u590d\u5236",
    "actions.blocked": "\u65e0\u6cd5\u590d\u5236",
    "actions.clear": "\u6e05\u7a7a",
    "actions.sync": "\u540c\u6b65",
    "actions.createLink": "\u751f\u6210",
    "actions.upload": "\u4e0a\u4f20",
    "actions.open": "\u6253\u5f00",
    "actions.download": "\u4e0b\u8f7d",
    "actions.useLive": "\u4f7f\u7528\u526a\u8d34\u677f\u5185\u5bb9",
    "status.connecting": "\u8fde\u63a5\u4e2d",
    "status.live": "\u5df2\u8fde\u63a5",
    "status.reconnecting": "\u91cd\u8fde\u4e2d",
    "live.waiting": "\u7b49\u5f85\u9996\u6b21\u540c\u6b65",
    "live.updated": "\u6700\u8fd1\u540c\u6b65\uff1a{time}",
    "paste.empty": "\u8fd8\u6ca1\u6709\u5206\u4eab\u94fe\u63a5",
    "paste.required": "\u8bf7\u5148\u8f93\u5165\u8981\u5206\u4eab\u7684\u6587\u672c",
    "paste.expires": "\u8fc7\u671f\u65f6\u95f4\uff1a{time}",
    "time.never": "\u6682\u65e0",
    "error.generic": "\u51fa\u4e86\u70b9\u95ee\u9898"
  }
};

const state = {
  activeTab: localStorage.getItem("clipclip-active-tab") || "live",
  language: localStorage.getItem("clipclip-language") || "zh",
  currentPaste: null,
  recentFiles: [],
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
const uploadBox = document.querySelector(".upload-box");
const uploadStatus = document.querySelector("#upload-status");
const uploadProgressBar = document.querySelector("#upload-progress-bar");
const fileCurrent = document.querySelector("#file-current");
const fileHistoryList = document.querySelector("#file-history-list");
const fileHistoryEmpty = document.querySelector("#file-history-empty");
const fileCount = document.querySelector("#file-count");

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

function setButtonIdleLabel(button, label) {
  button.dataset.idleLabel = label;
  if (!button.dataset.copyState) {
    button.textContent = label;
  }
}

function applyCopyFeedback(button, mode) {
  const idleLabel = button.dataset.idleLabel || button.textContent;
  if (mode === "prompt") {
    flashButtonState(button, {
      idleLabel,
      activeLabel: t("actions.manualCopy"),
      tone: "warning"
    });
    return;
  }

  flashButtonState(button, {
    idleLabel,
    activeLabel: t("actions.copied"),
    tone: "success"
  });
}

async function copyWithButton(button, value) {
  try {
    const mode = await copyText(value);
    applyCopyFeedback(button, mode);
  } catch {
    flashButtonState(button, {
      idleLabel: button.dataset.idleLabel || button.textContent,
      activeLabel: t("actions.blocked"),
      tone: "warning"
    });
  }
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
    panel.hidden = panel.dataset.panel !== tabName;
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

function createCopyButton(
  label,
  onCopy,
  className = "secondary-button small-button copy-feedback-button"
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  setButtonIdleLabel(button, label);
  button.addEventListener("click", () => onCopy(button));
  return button;
}

function createResultCard({
  title,
  subtitle,
  href,
  expiresAt,
  primaryActionLabel = t("actions.open"),
  badgeText = ""
}) {
  const card = document.createElement("div");
  card.className = "result-card";

  const headerRow = document.createElement("div");
  headerRow.className = "result-header";

  const titleNode = document.createElement("strong");
  titleNode.className = "result-title";
  titleNode.textContent = title;
  headerRow.append(titleNode);

  if (badgeText) {
    const badge = document.createElement("span");
    badge.className = "mini-badge";
    badge.textContent = badgeText;
    headerRow.append(badge);
  }

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

  const copyButton = createCopyButton(t("actions.copyLink"), (button) =>
    copyWithButton(button, href)
  );

  const expiresNode = document.createElement("span");
  expiresNode.className = "muted-text";
  expiresNode.textContent = t("paste.expires", { time: formatTime(expiresAt) });

  actionPair.append(openButton, copyButton);
  actions.append(actionPair, expiresNode);
  card.append(headerRow, subtitleNode, actions);
  return card;
}

function createFileHistoryItem(file) {
  const item = document.createElement("li");
  item.className = "history-item";

  const meta = document.createElement("div");
  meta.className = "history-meta";

  const title = document.createElement("strong");
  title.className = "history-title";
  title.textContent = file.fileName;

  const details = document.createElement("span");
  details.className = "muted-text";
  details.textContent = `${t("file.kb", {
    name: file.fileName,
    size: String(Math.max(1, Math.round(file.sizeBytes / 1024)))
  })} - ${formatTime(file.expiresAt)}`;

  meta.append(title, details);

  const actions = document.createElement("div");
  actions.className = "history-actions";

  const downloadLink = document.createElement("a");
  downloadLink.className = "secondary-link";
  downloadLink.href = `${window.location.origin}${file.downloadUrl}`;
  downloadLink.target = "_blank";
  downloadLink.rel = "noreferrer";
  downloadLink.textContent = t("actions.download");

  const copyButton = createCopyButton(
    t("actions.copyLink"),
    (button) => copyWithButton(button, `${window.location.origin}${file.downloadUrl}`),
    "ghost-button copy-feedback-button"
  );

  actions.append(downloadLink, copyButton);
  item.append(meta, actions);
  return item;
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

function renderFiles(files) {
  state.recentFiles = Array.isArray(files) ? files : [];
  fileCurrent.innerHTML = "";
  fileHistoryList.innerHTML = "";

  const [latestFile, ...olderFiles] = state.recentFiles;
  fileCount.textContent = t("file.count", { count: String(state.recentFiles.length) });

  if (!latestFile) {
    fileCurrent.textContent = t("file.empty");
    fileHistoryEmpty.hidden = false;
    fileHistoryEmpty.textContent = t("file.historyEmpty");
    return;
  }

  fileCurrent.append(
    createResultCard({
      title: latestFile.fileName,
      subtitle: t("file.kb", {
        name: latestFile.fileName,
        size: String(Math.max(1, Math.round(latestFile.sizeBytes / 1024)))
      }),
      href: `${window.location.origin}${latestFile.downloadUrl}`,
      expiresAt: latestFile.expiresAt,
      primaryActionLabel: t("actions.download"),
      badgeText: t("file.latestBadge")
    })
  );

  const historyItems = olderFiles.map((file) => createFileHistoryItem(file));
  fileHistoryList.append(...historyItems);
  fileHistoryEmpty.hidden = historyItems.length > 0;
  fileHistoryEmpty.textContent = t("file.historyEmpty");
}

function applyLanguage() {
  translateStaticText();
  endpointValue.textContent = window.location.origin;
  setConnectionState(connectionBadge.dataset.state || "connecting");
  setButtonIdleLabel(liveCopyButton, t("actions.copy"));

  if (liveUpdatedAt.dataset.updatedAt) {
    updateLiveTimestamp(liveUpdatedAt.dataset.updatedAt);
  } else {
    liveUpdatedAt.textContent = t("live.waiting");
  }

  setSelectedFile(state.selectedFile);
  renderFiles(state.recentFiles);

  if (state.currentPaste) {
    renderPasteResult(state.currentPaste);
  } else {
    pasteResult.textContent = t("paste.empty");
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

async function loadRecentFiles() {
  const payload = await api("/api/files/recent");
  renderFiles(payload.files || []);
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
    if (payload.type === "files:snapshot" || payload.type === "files:updated") {
      renderFiles(payload.files || []);
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
    uploadStatus.textContent = t("file.selectFirst");
    return;
  }

  fileUploadButton.disabled = true;
  uploadStatus.textContent = t("file.uploading");
  setUploadProgress(3);

  try {
    await uploadFileWithProgress(file);
    uploadStatus.textContent = t("file.uploaded");
    setUploadProgress(100);
    await loadRecentFiles();
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
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelector("#paste-view-content").textContent = payload.content;
  document.querySelector("#paste-view-meta").textContent = t("paste.expires", {
    time: formatTime(payload.expiresAt)
  });
  const pasteViewCopyButton = document.querySelector("#paste-view-copy-button");
  setButtonIdleLabel(pasteViewCopyButton, t("actions.copy"));
  pasteViewCopyButton.classList.add("copy-feedback-button");
  pasteViewCopyButton.addEventListener("click", () =>
    copyWithButton(pasteViewCopyButton, payload.content)
  );
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
  await loadRecentFiles();
  bindLiveEvents();
  bindFileInteractions();

  liveSaveButton.addEventListener("click", () => saveLiveClipboard(liveTextarea.value));
  liveCopyButton.classList.add("copy-feedback-button");
  liveCopyButton.addEventListener("click", () => copyWithButton(liveCopyButton, liveTextarea.value));
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
