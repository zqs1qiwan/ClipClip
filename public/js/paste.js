import { api } from "./api.js";
import { t } from "./i18n.js";
import { announce, setView, ui } from "./ui.js";
import { renderPasteLock, renderPastePage, renderPasteResult } from "./views.js";

function pasteErrorSpec(error, retry) {
  if (error.code === "tooLarge") {
    return { key: "paste.tooLong", tone: "error", onRetry: retry };
  }
  if (error.code === "badRequest") {
    if (/passphrase/i.test(error.message || "")) {
      return { key: "paste.passphraseTooLong", tone: "warning", onRetry: retry };
    }
    return { key: "paste.required", tone: "warning", onRetry: retry };
  }
  return {
    key: "paste.failed",
    detailKey: error.code === "network" ? "error.network" : "error.server",
    tone: "error",
    onRetry: retry
  };
}

export async function createPaste(state) {
  const content = ui.paste.textarea.value;

  if (!content.trim()) {
    state.paste.alert = { key: "paste.required", tone: "warning" };
    renderPasteResult(state);
    ui.paste.textarea.focus();
    return;
  }

  const passphrase = ui.paste.passphrase?.value || "";
  if (passphrase.length > 128) {
    state.paste.alert = { key: "paste.passphraseTooLong", tone: "warning" };
    renderPasteResult(state);
    ui.paste.passphrase.focus();
    return;
  }

  const expiry = Number.parseInt(ui.paste.expiry.value, 10);
  const burnAfterRead = Boolean(ui.paste.burn?.checked);
  state.paste.busy = true;
  state.paste.alert = null;
  renderPasteResult(state);

  try {
    const paste = await api.createPaste({
      content,
      expiresInHours: Number.isFinite(expiry) ? expiry : undefined,
      burnAfterRead,
      passphrase
    });
    state.paste.busy = false;
    state.paste.result = {
      ...paste,
      burnAfterRead: burnAfterRead || paste.burnAfterRead === true,
      hasPassphrase: passphrase.length > 0 || paste.hasPassphrase === true
    };
    renderPasteResult(state);
    announce(t("paste.ready"));
  } catch (error) {
    state.paste.busy = false;
    if (error.code === "unauthorized" || error.code === "aborted") {
      renderPasteResult(state);
      return;
    }
    state.paste.alert = pasteErrorSpec(error, () => createPaste(state));
    renderPasteResult(state);
  }
}

function revealErrorSpec(error, retry) {
  if (error.code === "forbidden") {
    return { key: "pasteLock.invalid", tone: "error" };
  }
  if (error.code === "badRequest") {
    return { key: "pasteLock.required", tone: "warning" };
  }
  return {
    key: "pasteLock.failed",
    detailKey: error.code === "network" ? "error.network" : "error.server",
    tone: "error",
    onRetry: retry
  };
}

export async function revealPaste(state) {
  const passphrase = ui.pasteLock.passphrase?.value || "";

  if (!passphrase.trim()) {
    state.pastePage.alert = { key: "pasteLock.required", tone: "warning" };
    renderPasteLock(state);
    ui.pasteLock.passphrase.focus();
    return;
  }

  state.pastePage.busy = true;
  state.pastePage.alert = null;
  renderPasteLock(state);

  try {
    const payload = await api.revealPaste(state.pastePage.id, passphrase);
    state.pastePage.busy = false;
    state.pastePage.payload = payload;
    state.pastePage.locked = false;
    state.pastePage.error = null;
    state.pastePage.passphrase = "";
    ui.pasteLock.passphrase.value = "";
    setView("paste");
    renderPastePage(state);
    announce(t("pasteLock.revealed"));
  } catch (error) {
    state.pastePage.busy = false;
    if (error.code === "unauthorized" || error.code === "aborted") {
      renderPasteLock(state);
      return;
    }
    if (error.code === "notFound") {
      state.pastePage.payload = null;
      state.pastePage.error = { key: "pastePage.notFound" };
      state.view = "paste-error";
      setView("paste-error");
      renderPastePage(state);
      return;
    }
    state.pastePage.alert = revealErrorSpec(error, () => revealPaste(state));
    renderPasteLock(state);
    ui.pasteLock.passphrase.focus();
    ui.pasteLock.passphrase.select();
  }
}

export function initPaste(state) {
  ui.paste.createButton.addEventListener("click", () => createPaste(state));

  ui.paste.fillButton.addEventListener("click", () => {
    ui.paste.textarea.value = ui.live.textarea.value;
    ui.paste.textarea.focus();
  });
}

export function initPasteLock(state) {
  ui.pasteLock.form.addEventListener("submit", (event) => {
    event.preventDefault();
    revealPaste(state);
  });
}