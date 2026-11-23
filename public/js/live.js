import { api } from "./api.js";
import { t } from "./i18n.js";
import { announce, copyWithFeedback, ui } from "./ui.js";
import {
  renderLiveAlert,
  renderLiveControls,
  renderLiveStatus,
  renderRemoteNotice
} from "./views.js";

const SAVE_DEBOUNCE_MS = 500;

function liveErrorSpec(error, retry) {
  if (error.code === "tooLarge") {
    return { key: "live.tooLarge", tone: "error", onRetry: retry };
  }
  return {
    key: "live.saveFailed",
    detailKey: error.code === "network" ? "error.network" : "error.server",
    tone: "error",
    onRetry: retry
  };
}

export function setTextareaValue(state, value, { preserveSelection = true } = {}) {
  const textarea = ui.live.textarea;
  if (textarea.value === value) {
    return;
  }

  if (!preserveSelection) {
    textarea.value = value;
    return;
  }

  const focused = document.activeElement === textarea;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const scrollTop = textarea.scrollTop;

  textarea.value = value;

  if (focused) {
    const max = value.length;
    textarea.setSelectionRange(Math.min(start, max), Math.min(end, max));
    textarea.scrollTop = scrollTop;
  }
}

export function applyLivePayload(state, payload, { initial = false } = {}) {
  const content = typeof payload?.content === "string" ? payload.content : "";
  state.live.lastUpdatedAt = payload?.updatedAt || null;

  // A snapshot/first response must never clobber an in-progress draft.
  if (initial && (state.live.dirty || state.live.saving)) {
    return;
  }

  // Echo of our own save: keep the local caret, never show a remote banner.
  if (state.live.lastSentContent !== null && state.live.lastSentContent === content) {
    state.live.pendingRemote = null;
    renderRemoteNotice(state);
    renderLiveStatus(state);
    return;
  }

  if (state.live.dirty || state.live.saving) {
    if (ui.live.textarea.value === content) {
      state.live.pendingRemote = null;
      renderRemoteNotice(state);
      renderLiveStatus(state);
      return;
    }
    state.live.pendingRemote = { content, updatedAt: payload?.updatedAt || null };
    renderRemoteNotice(state);
    renderLiveStatus(state);
    announce(t("live.remote"));
    return;
  }

  setTextareaValue(state, content, { preserveSelection: !initial });
  state.live.pendingRemote = null;
  renderRemoteNotice(state);
  renderLiveControls(state);
  renderLiveStatus(state);
}

export function applyRemoteUpdate(state) {
  const pending = state.live.pendingRemote;
  if (!pending) {
    return;
  }
  window.clearTimeout(state.live.saveTimer);
  state.live.saveTimer = null;
  setTextareaValue(state, pending.content, { preserveSelection: false });
  state.live.dirty = false;
  state.live.lastSentContent = null;
  state.live.lastUpdatedAt = pending.updatedAt || state.live.lastUpdatedAt;
  state.live.pendingRemote = null;
  renderRemoteNotice(state);
  renderLiveControls(state);
  renderLiveStatus(state);
  announce(t("live.remote"));
}

export function dismissRemoteUpdate(state) {
  state.live.pendingRemote = null;
  renderRemoteNotice(state);
  renderLiveStatus(state);
}

export async function saveLive(state, { manual = false } = {}) {
  if (state.live.saving) {
    return;
  }
  if (!manual && !state.live.dirty) {
    return;
  }

  window.clearTimeout(state.live.saveTimer);
  state.live.saveTimer = null;

  const content = ui.live.textarea.value;
  const version = state.live.version + 1;
  state.live.version = version;
  state.live.saving = true;
  state.live.lastSentContent = content;
  state.live.alert = null;
  renderLiveAlert(state);
  renderLiveStatus(state);
  renderLiveControls(state);

  try {
    const payload = await api.saveLive(content);
    if (state.live.version !== version) {
      return;
    }
    state.live.saving = false;
    state.live.dirty = ui.live.textarea.value !== content;
    state.live.lastUpdatedAt = payload?.updatedAt || state.live.lastUpdatedAt;
    state.live.pendingRemote = null;
    renderRemoteNotice(state);
    renderLiveControls(state);
    renderLiveStatus(state);
    if (state.live.dirty) {
      scheduleSave(state);
    }
  } catch (error) {
    if (state.live.version !== version) {
      return;
    }
    state.live.saving = false;
    if (error.code === "unauthorized" || error.code === "aborted") {
      renderLiveStatus(state);
      return;
    }
    state.live.lastSentContent = null;
    state.live.alert = liveErrorSpec(error, () => saveLive(state, { manual: true }));
    renderLiveAlert(state);
    renderLiveStatus(state);
    renderLiveControls(state);
  }
}

function scheduleSave(state) {
  window.clearTimeout(state.live.saveTimer);
  state.live.saveTimer = window.setTimeout(() => {
    state.live.saveTimer = null;
    saveLive(state);
  }, SAVE_DEBOUNCE_MS);
}

export async function loadLive(state, { payload = null } = {}) {
  state.live.alert = null;
  state.live.lastSentContent = null;
  renderLiveAlert(state);

  if (payload) {
    applyLivePayload(state, payload, { initial: true });
    return;
  }

  try {
    const data = await api.getLive();
    applyLivePayload(state, data, { initial: true });
  } catch (error) {
    if (error.code === "unauthorized" || error.code === "aborted") {
      return;
    }
    state.live.alert = {
      key: "live.loadFailed",
      detailKey: error.code === "network" ? "error.network" : "error.server",
      tone: "error",
      onRetry: () => loadLive(state)
    };
    renderLiveAlert(state);
    renderLiveStatus(state);
  }
}

export function initLive(state) {
  ui.live.textarea.addEventListener("input", () => {
    state.live.dirty = true;
    state.live.alert = null;
    renderLiveAlert(state);
    renderLiveStatus(state);
    renderLiveControls(state);
    scheduleSave(state);
  });

  ui.live.copyButton.addEventListener("click", () =>
    copyWithFeedback(ui.live.copyButton, ui.live.textarea.value)
  );

  ui.live.syncButton.addEventListener("click", () => saveLive(state, { manual: true }));

  ui.live.clearButton.addEventListener("click", () => {
    if (ui.live.textarea.value.length === 0) {
      return;
    }
    if (!window.confirm(t("live.confirmClear"))) {
      return;
    }
    setTextareaValue(state, "", { preserveSelection: false });
    state.live.dirty = false;
    if (state.live.saveTimer) {
      window.clearTimeout(state.live.saveTimer);
      state.live.saveTimer = null;
    }
    renderLiveControls(state);
    saveLive(state, { manual: true });
  });

  ui.live.remoteApply.addEventListener("click", () => applyRemoteUpdate(state));
  ui.live.remoteDismiss.addEventListener("click", () => dismissRemoteUpdate(state));
}