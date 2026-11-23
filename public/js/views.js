import { t, translate } from "./i18n.js";
import { formatBytes } from "./format.js";
import {
  copyWithFeedback,
  formatTime,
  setAppAlert,
  setIdleLabel,
  setLiveAlert,
  setLoginAlert,
  setLogoutVisible,
  setPasteAlert,
  setPasteLockAlert,
  setProgress,
  setUploadAlert,
  setConnection,
  setLiveStatus,
  setTabs,
  ui
} from "./ui.js";

function absoluteUrl(path) {
  return `${window.location.origin}${path}`;
}

function fillResultCard(spec) {
  const node = ui.templates.resultCard.content.firstElementChild.cloneNode(true);
  node.querySelector(".result-title").textContent = spec.title;

  const badge = node.querySelector(".mini-badge");
  if (spec.badge) {
    badge.textContent = spec.badge;
    badge.hidden = false;
  }

  node.querySelector(".result-sub").textContent = spec.subtitle || "";

  const primary = node.querySelector(".link-button");
  primary.href = spec.href;
  primary.textContent = spec.primaryLabel;
  if (spec.primaryDownload) {
    primary.setAttribute("download", "");
  }

  const copyButton = node.querySelector("[data-role='copy']");
  setIdleLabel(copyButton, t("actions.copyLink"));
  copyButton.addEventListener("click", () => copyWithFeedback(copyButton, spec.copyValue));

  node.querySelector(".result-meta").textContent = spec.meta || "";
  return node;
}

function historyItem(file) {
  const node = ui.templates.historyItem.content.firstElementChild.cloneNode(true);
  node.dataset.fileId = file.id;
  node.querySelector(".history-title").textContent = file.fileName;
  node.querySelector(".history-sub").textContent = formatBytes(file.sizeBytes);

  const download = node.querySelector(".secondary-link");
  const href = absoluteUrl(file.downloadUrl);
  download.href = href;
  download.textContent = t("actions.download");
  download.setAttribute("download", "");

  const copyButton = node.querySelector("[data-role='copy']");
  setIdleLabel(copyButton, t("actions.copyLink"));
  copyButton.addEventListener("click", () => copyWithFeedback(copyButton, href));

  node.querySelector(".history-meta-line").textContent = t("files.expires", {
    time: formatTime(file.expiresAt)
  });
  return node;
}

export function renderConnection(state) {
  setConnection(state.connection);
}

export function renderLiveStatus(state) {
  if (state.connection === "offline") {
    setLiveStatus(t("live.offlineNote"), "warning");
    return;
  }
  if (state.live.saving) {
    setLiveStatus(t("live.saving"));
    return;
  }
  if (state.live.dirty) {
    setLiveStatus(t("live.dirty"), "warning");
    return;
  }
  if (state.live.lastUpdatedAt) {
    setLiveStatus(t("live.updated", { time: formatTime(state.live.lastUpdatedAt) }));
    return;
  }
  setLiveStatus(t("live.waiting"));
}

export function renderRemoteNotice(state) {
  if (!ui.live.remoteNotice) {
    return;
  }
  ui.live.remoteNotice.hidden = !state.live.pendingRemote;
}

export function renderLiveAlert(state) {
  setLiveAlert(state.live.alert);
}

export function renderLiveControls(state) {
  setIdleLabel(ui.live.copyButton, t("actions.copy"));
  setIdleLabel(ui.live.syncButton, t("live.sync"));
  ui.live.clearButton.disabled = ui.live.textarea.value.length === 0;
}

export function renderPasteResult(state) {
  const result = ui.paste.result;
  result.textContent = "";
  if (!state.paste.result) {
    result.textContent = t("paste.empty");
  } else {
    const paste = state.paste.result;
    const href = absoluteUrl(paste.url);
    result.append(
      fillResultCard({
        title: t("paste.ready"),
        subtitle: href,
        href,
        primaryLabel: t("actions.open"),
        copyValue: href,
        badge: paste.burnAfterRead ? t("paste.burnBadge") : "",
        meta: paste.burnAfterRead
          ? t("pastePage.burnMeta", { time: formatTime(paste.expiresAt) })
          : t("paste.expires", { time: formatTime(paste.expiresAt) })
      })
    );
  }
  setPasteAlert(state.paste.alert);
  ui.paste.createButton.disabled = Boolean(state.paste.busy);
  ui.paste.createButton.setAttribute("aria-busy", state.paste.busy ? "true" : "false");
}

export function renderSelection(state) {
  const file = state.files.selected;
  if (!file) {
    ui.files.inputLabel.textContent = t("files.select");
    ui.files.selectionMeta.textContent = state.files.limit
      ? t("files.limit", { size: formatBytes(state.files.limit) })
      : t("files.dropSubtitle");
  } else {
    ui.files.inputLabel.textContent = file.name;
    ui.files.selectionMeta.textContent = t("files.selected", {
      name: file.name,
      size: formatBytes(file.size)
    });
  }
  ui.files.uploadButton.disabled = !file || state.files.upload.phase === "uploading";
}

export function renderUpload(state) {
  const upload = state.files.upload;
  if (upload.phase === "uploading") {
    ui.files.status.textContent = t("files.uploading");
  } else if (upload.phase === "done") {
    ui.files.status.textContent = t("files.uploaded");
  } else {
    ui.files.status.textContent = t("files.idle");
  }
  setUploadAlert(upload.alert);
  setProgress(upload.progress);
  ui.files.uploadButton.disabled = !state.files.selected || upload.phase === "uploading";
  ui.files.uploadButton.setAttribute("aria-busy", upload.phase === "uploading" ? "true" : "false");
}

function renderLatestFile(state) {
  const latest = state.files.items[0] || null;
  const current = ui.files.current;
  current.textContent = "";

  if (!latest) {
    current.textContent = t("files.empty");
    state.files.renderedLatestId = null;
    return;
  }

  const href = absoluteUrl(latest.downloadUrl);
  current.append(
    fillResultCard({
      title: latest.fileName,
      badge: t("files.latest"),
      subtitle: formatBytes(latest.sizeBytes),
      href,
      primaryLabel: t("actions.download"),
      primaryDownload: true,
      copyValue: href,
      meta: t("files.expires", { time: formatTime(latest.expiresAt) })
    })
  );
  state.files.renderedLatestId = latest.id;
}

function reconcileHistory(desired) {
  const list = ui.files.history;
  const desiredIds = new Set(desired.map((file) => file.id));

  Array.from(list.children).forEach((node) => {
    if (!desiredIds.has(node.dataset.fileId)) {
      node.remove();
    }
  });

  desired.forEach((file, index) => {
    const current = list.children[index];
    if (current && current.dataset.fileId === file.id) {
      return;
    }
    const existing = Array.from(list.children).find((node) => node.dataset.fileId === file.id);
    const node = existing || historyItem(file);
    list.insertBefore(node, current || null);
  });
}

export function renderFiles(state, { incremental = false } = {}) {
  const items = state.files.items;

  if (!incremental || !state.files.renderedLatestId || items[0]?.id !== state.files.renderedLatestId) {
    renderLatestFile(state);
  }

  const older = items.slice(1);
  if (!incremental) {
    ui.files.history.textContent = "";
    older.forEach((file) => ui.files.history.append(historyItem(file)));
  } else {
    reconcileHistory(older);
  }

  ui.files.historyEmpty.hidden = older.length > 0;
  ui.files.historyEmpty.textContent = t("files.historyEmpty");
  ui.files.count.textContent = t(items.length === 1 ? "files.count.one" : "files.count.many", {
    count: items.length
  });
}

export function renderPastePage(state) {
  const { payload, error } = state.pastePage;

  if (payload) {
    const burn = payload.burnAfterRead === true;
    ui.pastePage.content.textContent = payload.content;
    ui.pastePage.meta.textContent = burn
      ? t("pastePage.burnMeta", { time: formatTime(payload.expiresAt) })
      : t("pastePage.expires", { time: formatTime(payload.expiresAt) });
    if (ui.pastePage.burnBadge) {
      ui.pastePage.burnBadge.hidden = !burn;
    }
    document.title = `${t("pastePage.title")} · ClipClip`;
    setIdleLabel(ui.pastePage.copyButton, t("actions.copy"));
    ui.pastePage.copyButton.dataset.copyValue = payload.content;
    ui.pastePage.copyButton.disabled = false;
  } else {
    if (ui.pastePage.burnBadge) {
      ui.pastePage.burnBadge.hidden = true;
    }
    ui.pastePage.copyButton.disabled = true;
    ui.pastePage.copyButton.dataset.copyValue = "";
  }

  if (error) {
    let message = error.key ? t(error.key, error.vars || {}) : t("pastePage.unavailable");
    if (error.detailKey) {
      message = `${message} ${t(error.detailKey)}`;
    }
    ui.pasteErrorView.message.textContent = message;
    ui.pasteErrorView.retryButton.textContent = t("pastePage.retry");
    ui.pasteErrorView.backLink.textContent = t("pastePage.back");
    document.title = `${t("pastePage.unavailable")} · ClipClip`;
  }
}

export function renderPasteLock(state) {
  setPasteLockAlert(state.pastePage.alert);
  ui.pasteLock.submit.disabled = Boolean(state.pastePage.busy);
  ui.pasteLock.submit.setAttribute("aria-busy", state.pastePage.busy ? "true" : "false");
  ui.pasteLock.submit.textContent = state.pastePage.busy
    ? t("pasteLock.submitting")
    : t("pasteLock.submit");
  if (state.view === "paste-lock") {
    document.title = `${t("pasteLock.title")} · ClipClip`;
  }
}

export function renderAppAlert(state) {
  setAppAlert(state.appAlert);
}

export function renderLogin(state) {
  setLoginAlert(state.login.message);
  ui.login.submit.disabled = state.login.busy;
  ui.login.submit.setAttribute("aria-busy", state.login.busy ? "true" : "false");
  ui.login.submit.textContent = state.login.busy ? t("auth.submitting") : t("auth.submit");
}

export function renderAll(state) {
  translate(document);
  ui.langButtons.forEach((button) => {
    const active = button.dataset.lang === state.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  setTabs(state.tab);
  renderConnection(state);
  renderLiveStatus(state);
  renderRemoteNotice(state);
  renderLiveAlert(state);
  renderLiveControls(state);
  renderPasteResult(state);
  renderSelection(state);
  renderUpload(state);
  renderFiles(state);
  renderPastePage(state);
  renderPasteLock(state);
  renderAppAlert(state);
  renderLogin(state);
  setLogoutVisible(state.publicMode);
}