import { t, locale } from "./i18n.js";
import { formatDateTime } from "./format.js";
import { flashButtonState } from "../button-feedback.js";
import { copyText } from "../lib/clipboard.js";

function byId(id) {
  return document.getElementById(id);
}

function bySelector(selector) {
  return document.querySelector(selector);
}

function buildRefs() {
  return {
    appShell: byId("app-shell"),
    loginView: byId("login-view"),
    pasteView: byId("paste-view"),
    pasteError: byId("paste-error"),
    connectionBadge: byId("connection-badge"),
    logoutButton: byId("logout-button"),
    appAlert: byId("app-alert"),
    a11yStatus: byId("a11y-status"),
    tabs: Array.from(document.querySelectorAll(".tab-button")),
    panels: Array.from(document.querySelectorAll("[data-panel]")),
    langButtons: Array.from(document.querySelectorAll(".lang-button")),
    live: {
      textarea: byId("live-textarea"),
      copyButton: byId("live-copy"),
      syncButton: byId("live-sync"),
      clearButton: byId("live-clear"),
      status: byId("live-status"),
      alert: byId("live-alert"),
      remoteNotice: byId("remote-notice"),
      remoteApply: byId("remote-apply"),
      remoteDismiss: byId("remote-dismiss")
    },
    paste: {
      textarea: byId("paste-textarea"),
      expiry: byId("paste-expiry"),
      burn: byId("paste-burn"),
      passphrase: byId("paste-passphrase"),
      createButton: byId("paste-create"),
      fillButton: byId("paste-fill"),
      result: byId("paste-result"),
      alert: byId("paste-alert")
    },
    files: {
      input: byId("file-input"),
      inputLabel: byId("file-input-label"),
      browseButton: byId("file-browse"),
      uploadButton: byId("file-upload"),
      selectionMeta: byId("file-selection-meta"),
      dropzone: bySelector(".dropzone"),
      progress: byId("upload-progress"),
      progressBar: byId("upload-bar"),
      status: byId("upload-status"),
      alert: byId("upload-alert"),
      current: byId("file-current"),
      history: byId("file-history"),
      historyEmpty: byId("file-history-empty"),
      count: byId("file-count")
    },
    login: {
      form: byId("login-form"),
      token: byId("login-token"),
      submit: byId("login-submit"),
      error: byId("login-error")
    },
    pastePage: {
      content: byId("paste-content"),
      meta: byId("paste-meta"),
      burnBadge: byId("paste-burn-badge"),
      copyButton: byId("paste-copy")
    },
    pasteLock: {
      view: byId("paste-lock"),
      form: byId("paste-lock-form"),
      passphrase: byId("paste-lock-passphrase"),
      submit: byId("paste-lock-submit"),
      error: byId("paste-lock-error")
    },
    qr: {
      button: byId("qr-button"),
      modal: byId("qr-modal"),
      code: byId("qr-code"),
      url: byId("qr-url"),
      copy: byId("qr-copy"),
      close: byId("qr-close")
    },
    pasteErrorView: {
      message: byId("paste-error-message"),
      retryButton: byId("paste-error-retry"),
      backLink: byId("paste-error-back")
    },
    templates: {
      resultCard: byId("tpl-result-card"),
      historyItem: byId("tpl-history-item")
    }
  };
}

export const ui = buildRefs();

export function setView(view) {
  const shells = {
    app: ui.appShell,
    login: ui.loginView,
    paste: ui.pasteView,
    "paste-lock": ui.pasteLock.view,
    "paste-error": ui.pasteError
  };
  Object.entries(shells).forEach(([name, element]) => {
    if (element) {
      element.hidden = name !== view;
    }
  });
}

export function setConnection(mode) {
  if (!ui.connectionBadge) {
    return;
  }
  ui.connectionBadge.dataset.state = mode;
  ui.connectionBadge.textContent = t(`status.${mode}`);
}

export function setTabs(tab) {
  ui.tabs.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });
  ui.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
}

export function setLiveStatus(message, tone = "muted") {
  if (!ui.live.status) {
    return;
  }
  ui.live.status.textContent = message;
  ui.live.status.dataset.tone = tone;
}

export function setLiveAlert(spec) {
  setAlert(ui.live.alert, spec);
}

export function setPasteAlert(spec) {
  setAlert(ui.paste.alert, spec);
}

export function setPasteLockAlert(spec) {
  setAlert(ui.pasteLock.error, spec);
}

export function setUploadAlert(spec) {
  setAlert(ui.files.alert, spec);
}

export function setAppAlert(spec) {
  setAlert(ui.appAlert, spec);
}

export function setLoginAlert(spec) {
  setAlert(ui.login.error, spec);
}

export function setAlert(node, spec) {
  if (!node) {
    return;
  }
  const textNode = node.querySelector(".alert-text");
  const action = node.querySelector(".alert-action");

  if (!spec) {
    node.hidden = true;
    if (textNode) textNode.textContent = "";
    if (action) {
      action.hidden = true;
      action.onclick = null;
    }
    return;
  }

  node.hidden = false;
  node.dataset.tone = spec.tone || "warning";
  if (textNode) {
    let message = spec.key ? t(spec.key, spec.vars || {}) : spec.message || "";
    if (spec.detailKey) {
      message = `${message} ${t(spec.detailKey)}`.trim();
    }
    textNode.textContent = message;
  }
  if (action) {
    if (spec.onRetry) {
      action.hidden = false;
      action.textContent = t("actions.retry");
      action.onclick = spec.onRetry;
    } else {
      action.hidden = true;
      action.onclick = null;
    }
  }
}

export function announce(message) {
  if (!ui.a11yStatus || !message) {
    return;
  }
  ui.a11yStatus.textContent = "";
  window.setTimeout(() => {
    ui.a11yStatus.textContent = message;
  }, 30);
}

export function setButtonBusy(button, busy) {
  if (!button) {
    return;
  }
  button.disabled = Boolean(busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
}

export function setIdleLabel(button, label) {
  if (!button) {
    return;
  }
  button.dataset.idleLabel = label;
  if (!button.dataset.copyState) {
    button.textContent = label;
  }
}

export async function copyWithFeedback(button, value) {
  const idleLabel = button?.dataset.idleLabel || button?.textContent || t("actions.copy");
  try {
    const mode = await copyText(value);
    const manual = mode === "prompt";
    flashButtonState(button, {
      idleLabel,
      activeLabel: manual ? t("actions.manualCopy") : t("actions.copied"),
      tone: manual ? "warning" : "success"
    });
    announce(manual ? t("actions.manualCopy") : t("actions.copied"));
  } catch {
    flashButtonState(button, {
      idleLabel,
      activeLabel: t("actions.blocked"),
      tone: "warning"
    });
    announce(t("actions.blocked"));
  }
}

export function setProgress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  if (ui.files.progressBar) {
    ui.files.progressBar.style.inlineSize = `${value}%`;
  }
  if (ui.files.progress) {
    ui.files.progress.setAttribute("aria-valuenow", String(Math.round(value)));
  }
}

export function setLogoutVisible(visible) {
  if (ui.logoutButton) {
    ui.logoutButton.hidden = !visible;
  }
}

export function formatTime(value) {
  return formatDateTime(value, locale(), t("time.never"));
}