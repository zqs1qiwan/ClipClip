import { api, uploadFile } from "./api.js";
import { t } from "./i18n.js";
import { formatBytes } from "./format.js";
import { announce, setProgress, ui } from "./ui.js";
import { renderAppAlert, renderFiles, renderSelection, renderUpload } from "./views.js";

const RECENT_LIMIT = 10;
const MB = 1024 * 1024;

function uploadErrorSpec(state, error, retry) {
  if (error.code === "tooLarge") {
    if (state.files.limit) {
      return { key: "files.tooLargeLimit", vars: { limit: formatBytes(state.files.limit) }, tone: "error", onRetry: retry };
    }
    return { key: "files.tooLarge", tone: "error", onRetry: retry };
  }
  return {
    key: "files.uploadFailed",
    detailKey: error.code === "network" ? "error.network" : "error.server",
    tone: "error",
    onRetry: retry
  };
}

function learnLimitFromError(state, error) {
  const match = /(\d+)\s*MB/i.exec(error?.message || "");
  if (match) {
    state.files.limit = Number(match[1]) * MB;
  }
}

export function setSelectedFile(state, file) {
  const next = file || null;
  if (state.files.selected?.name !== next?.name || state.files.selected?.size !== next?.size) {
    state.files.upload.phase = "idle";
    state.files.upload.progress = 0;
    state.files.upload.alert = null;
    setProgress(0);
  }
  state.files.selected = next;
  renderSelection(state);
  renderUpload(state);
}

export function setFileLimit(state, maxUploadMb) {
  const value = Number(maxUploadMb);
  if (Number.isFinite(value) && value > 0) {
    state.files.limit = value * MB;
    renderSelection(state);
  }
}

export function applyFilesPayload(state, payload) {
  let incoming;
  if (Array.isArray(payload?.files)) {
    incoming = payload.files;
  } else if (payload?.latest) {
    const rest = state.files.items.filter((file) => file.id !== payload.latest.id);
    incoming = [payload.latest, ...rest].slice(0, RECENT_LIMIT);
  } else {
    return;
  }

  state.files.items = incoming;
  renderFiles(state, { incremental: true });
}

export async function loadFiles(state) {
  try {
    const payload = await api.getRecentFiles();
    state.files.items = Array.isArray(payload?.files) ? payload.files : [];
    state.files.loadAlert = null;
    if (state.appAlert?.key === "files.loadFailed") {
      state.appAlert = null;
    }
    renderAppAlert(state);
    renderFiles(state, { incremental: true });
  } catch (error) {
    if (error.code === "unauthorized" || error.code === "aborted") {
      return;
    }
    if (error.code === "notFound") {
      state.files.items = [];
      renderFiles(state, { incremental: true });
      return;
    }
    state.files.loadAlert = {
      key: "files.loadFailed",
      detailKey: error.code === "network" ? "error.network" : "error.server",
      tone: "error",
      onRetry: () => {
        state.files.loadAlert = null;
        renderAppAlert(state);
        loadFiles(state);
      }
    };
    state.appAlert = state.files.loadAlert;
    renderAppAlert(state);
  }
}

export async function uploadSelectedFile(state) {
  const file = state.files.selected;
  if (!file) {
    state.files.upload.alert = { message: t("files.selectFirst"), tone: "warning" };
    renderUpload(state);
    return;
  }

  state.files.upload.phase = "uploading";
  state.files.upload.progress = 0;
  state.files.upload.alert = null;
  state.files.upload.lastFile = file;
  setProgress(0);
  renderUpload(state);

  try {
    await uploadFile(file, {
      onProgress: (percent) => {
        state.files.upload.progress = percent;
        setProgress(percent);
      }
    });
    setSelectedFile(state, null);
    ui.files.input.value = "";
    state.files.upload.phase = "done";
    state.files.upload.progress = 100;
    setProgress(100);
    renderUpload(state);
    announce(t("files.uploaded"));
    await loadFiles(state);
  } catch (error) {
    state.files.upload.phase = "error";
    state.files.upload.progress = 0;
    setProgress(0);

    if (error.code === "unauthorized" || error.code === "aborted") {
      renderUpload(state);
      return;
    }

    learnLimitFromError(state, error);
    state.files.upload.alert = uploadErrorSpec(state, error, () => uploadSelectedFile(state));
    renderUpload(state);
  }
}

export function initFiles(state, { onTab } = {}) {
  ui.files.input.addEventListener("change", () => {
    setSelectedFile(state, ui.files.input.files?.[0] || null);
  });

  ui.files.browseButton.addEventListener("click", () => {
    ui.files.input.click();
  });

  ui.files.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ui.files.input.click();
    }
  });

  ui.files.uploadButton.addEventListener("click", () => {
    uploadSelectedFile(state);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.files.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.files.dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    ui.files.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      ui.files.dropzone.classList.remove("is-dragging");
    });
  });

  ui.files.dropzone.addEventListener("drop", (event) => {
    const dropped = event.dataTransfer?.files;
    if (!dropped?.length) {
      return;
    }
    setSelectedFile(state, dropped[0]);
    onTab?.("files");
  });
}