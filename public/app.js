import { setUnauthorizedHandler } from "./js/api.js";
import { initAuth, showLogin } from "./js/auth.js";
import { initBrand, setBrandVersion } from "./js/brand.js";
import { connectEvents, disconnectEvents } from "./js/events.js";
import { initFiles, loadFiles, setFileLimit } from "./js/files.js";
import { createState, loadPreferences, saveLanguage, saveTab } from "./js/state.js";
import { initLive, loadLive } from "./js/live.js";
import { initPaste, initPasteLock } from "./js/paste.js";
import { initQRModal } from "./js/qr-modal.js";
import { registerServiceWorker } from "./js/pwa.js";
import { setLanguage, translate } from "./js/i18n.js";
import { api } from "./js/api.js";
import { copyWithFeedback, setTabs, setView, ui } from "./js/ui.js";
import { renderAll, renderAppAlert, renderPasteLock, renderPastePage } from "./js/views.js";

const preferences = loadPreferences();
const state = createState(preferences);
setLanguage(state.language);

const pasteRoute = window.location.pathname.match(/^\/p\/([^/]+)$/);

// Avoid flashing the clipboard shell on a share-link URL before the fetch runs.
setView(pasteRoute ? "paste" : "app");

function clearTransientAlerts() {
  state.appAlert = null;
  state.live.alert = null;
  state.paste.alert = null;
  state.files.upload.alert = null;
  state.files.loadAlert = null;
}

function clearSensitiveView() {
  window.clearTimeout(state.live.saveTimer);
  state.live.saveTimer = null;
  state.live.dirty = false;
  state.live.saving = false;
  state.live.pendingRemote = null;
  state.live.lastSentContent = null;
  state.live.lastUpdatedAt = null;
  ui.live.textarea.value = "";

  state.paste.result = null;
  ui.paste.textarea.value = "";

  state.files.items = [];
  state.files.renderedLatestId = null;
  state.files.selected = null;
  state.files.upload.phase = "idle";
  state.files.upload.progress = 0;
  state.files.upload.lastFile = null;
  ui.files.input.value = "";
  ui.files.history.textContent = "";
  ui.files.current.textContent = "";

  state.pastePage.payload = null;
  state.pastePage.error = null;
  state.pastePage.locked = false;
  state.pastePage.busy = false;
  state.pastePage.alert = null;
  state.pastePage.passphrase = "";
  if (ui.paste.passphrase) {
    ui.paste.passphrase.value = "";
  }
  if (ui.pasteLock.passphrase) {
    ui.pasteLock.passphrase.value = "";
  }

  clearTransientAlerts();
  renderAll(state);
}

function handleUnauthorized(reason = "expired") {
  if (state.auth === "unauth" && state.view === "login") {
    return;
  }
  state.auth = "unauth";
  state.publicMode = true;
  disconnectEvents(state);
  clearSensitiveView();
  showLogin(state, { reason, resume: startRoute });
}

function handleSignedOut(reason = null) {
  state.auth = "unauth";
  disconnectEvents(state);
  clearSensitiveView();
  showLogin(state, { reason, resume: startRoute });
}

async function probeHealth() {
  try {
    const health = await api.health();
    state.publicMode = health?.publicMode === true;
    setFileLimit(state, health?.maxUploadMb);
    if (health?.version) {
      setBrandVersion(health.version);
    }
  } catch (error) {
    if (error.code === "unauthorized") {
      state.publicMode = true;
      return;
    }
    // Health is public; a network failure is reported by the data requests.
  }
  renderAll(state);
}

async function openApp() {
  state.view = "app";
  setView("app");
  document.title = "ClipClip";
  state.connection = "connecting";
  renderAll(state);

  await Promise.allSettled([loadLive(state), loadFiles(state)]);

  if (state.auth === "unauth") {
    return;
  }
  state.auth = "authed";
  if (state.publicMode) {
    renderAll(state);
  }
  connectEvents(state, { onUnauthorized: handleUnauthorized });
}

async function openPaste(id) {
  state.view = "paste";
  state.pastePage.id = id;
  state.pastePage.locked = false;
  state.pastePage.busy = false;
  state.pastePage.alert = null;
  setView("paste");

  try {
    const payload = await api.getPaste(id);
    state.pastePage.payload = payload;
    state.pastePage.error = null;
    renderPastePage(state);
  } catch (error) {
    if (error.code === "unauthorized" || error.code === "aborted") {
      return;
    }
    if (error.code === "forbidden") {
      state.pastePage.payload = null;
      state.pastePage.error = null;
      state.pastePage.locked = true;
      state.pastePage.alert = null;
      state.pastePage.passphrase = "";
      if (ui.pasteLock.passphrase) {
        ui.pasteLock.passphrase.value = "";
      }
      state.view = "paste-lock";
      setView("paste-lock");
      renderPasteLock(state);
      window.setTimeout(() => {
        ui.pasteLock.passphrase?.focus();
      }, 0);
      return;
    }
    state.pastePage.payload = null;
    state.pastePage.error = {
      key: error.code === "notFound" ? "pastePage.notFound" : "pastePage.error",
      detailKey:
        error.code === "network"
          ? "error.network"
          : error.code === "server"
            ? "error.server"
            : null
    };
    state.view = "paste-error";
    setView("paste-error");
    renderPastePage(state);
  }
}

async function startRoute() {
  if (state.auth === "unauth") {
    return;
  }
  state.appAlert = null;
  renderAppAlert(state);

  if (pasteRoute) {
    await openPaste(pasteRoute[1]);
    return;
  }
  await openApp();
}

function setTab(tab) {
  state.tab = tab;
  saveTab(tab);
  setTabs(tab);
}

function initLanguage() {
  ui.langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.language = setLanguage(button.dataset.lang);
      saveLanguage(state.language);
      renderAll(state);
    });
  });
}

function initTabs() {
  ui.tabs.forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  ui.tabs.forEach((button) => {
    button.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) {
        return;
      }
      event.preventDefault();
      const index = ui.tabs.indexOf(button);
      let nextIndex = index;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + ui.tabs.length) % ui.tabs.length;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % ui.tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = ui.tabs.length - 1;
      const next = ui.tabs[nextIndex];
      next.focus();
      setTab(next.dataset.tab);
    });
  });
}

function initPastePage() {
  ui.pastePage.copyButton.addEventListener("click", () => {
    const value = ui.pastePage.copyButton.dataset.copyValue || "";
    if (!value) {
      return;
    }
    copyWithFeedback(ui.pastePage.copyButton, value);
  });

  ui.pasteErrorView.retryButton.addEventListener("click", () => {
    if (state.pastePage.id) {
      openPaste(state.pastePage.id);
    }
  });
}

function initBindings() {
  initLanguage();
  initTabs();
  initLive(state);
  initPaste(state);
  initPasteLock(state);
  initFiles(state, { onTab: setTab });
  initPastePage();
  initQRModal();
}

async function main() {
  setUnauthorizedHandler((error) => {
    if (error.code === "unauthorized") {
      handleUnauthorized("expired");
    }
  });

  initAuth(state, { onSignedOut: handleSignedOut });
  initBindings();
  initBrand();
  translate(document);
  renderAll(state);
  registerServiceWorker();

  window.addEventListener("online", () => {
    if (pasteRoute || state.auth === "unauth" || state.connection === "live") {
      return;
    }
    connectEvents(state, { onUnauthorized: handleUnauthorized });
  });

  if (pasteRoute) {
    await startRoute();
    return;
  }

  await probeHealth();

  if (state.auth === "unauth" && state.view === "login") {
    // A 401 from the health probe already showed the login screen; resume route
    // is wired through showLogin.
    return;
  }

  await startRoute();
}

main().catch((error) => {
  console.error(error);
  if (pasteRoute) {
    state.pastePage.error = { key: "error.generic" };
    state.view = "paste-error";
    setView("paste-error");
    renderPastePage(state);
    return;
  }
  setView("app");
  state.appAlert = { key: "error.generic", tone: "error", onRetry: () => window.location.reload() };
  renderAppAlert(state);
});