import { api } from "./api.js";
import { renderAppAlert, renderLogin } from "./views.js";
import { setView, ui } from "./ui.js";

let resumeAfterLogin = null;

function loginErrorSpec(error) {
  if (error.code === "unauthorized") {
    return { key: "auth.invalid", tone: "error" };
  }
  if (error.code === "rateLimited") {
    return { key: "auth.rateLimited", tone: "error" };
  }
  if (error.code === "network") {
    return { key: "error.network", tone: "error" };
  }
  if (error.code === "server") {
    return { key: "error.server", tone: "error" };
  }
  return { key: "error.generic", tone: "error" };
}

export function showLogin(state, { reason = null, resume = null } = {}) {
  resumeAfterLogin = resume;
  state.view = "login";
  state.login.busy = false;
  state.login.message = reason ? { key: reason, tone: "warning" } : null;
  setView("login");
  renderLogin(state);
  document.title = "ClipClip";
  window.setTimeout(() => {
    ui.login.token?.focus();
  }, 0);
}

async function submitLogin(state, event) {
  event.preventDefault();
  const token = ui.login.token.value;

  if (!token.trim()) {
    state.login.message = { key: "auth.required", tone: "warning" };
    renderLogin(state);
    ui.login.token.focus();
    return;
  }

  state.login.busy = true;
  state.login.message = null;
  renderLogin(state);

  try {
    await api.login(token);
    state.login.busy = false;
    state.login.message = null;
    state.auth = "authed";
    state.publicMode = true;
    ui.login.token.value = "";
    renderLogin(state);
    const resume = resumeAfterLogin;
    resumeAfterLogin = null;
    await resume?.();
  } catch (error) {
    state.login.busy = false;
    if (error.code === "aborted") {
      renderLogin(state);
      return;
    }
    state.login.message = loginErrorSpec(error);
    renderLogin(state);
    ui.login.token.focus();
    ui.login.token.select();
  }
}

export async function signOut(state, { onSignedOut } = {}) {
  let reason = null;

  try {
    await api.logout();
  } catch (error) {
    if (error.code !== "notFound" && error.code !== "methodNotAllowed") {
      state.appAlert = {
        key: "auth.logoutFailed",
        detailKey: error.code === "network" ? "error.network" : "error.server",
        tone: "error",
        onRetry: () => signOut(state, { onSignedOut })
      };
      renderAppAlert(state);
      return;
    }
    reason = "auth.logoutUnsupported";
  }

  state.auth = "unauth";
  onSignedOut?.(reason);
}

export function initAuth(state, { onSignedOut } = {}) {
  ui.login.form.addEventListener("submit", (event) => {
    submitLogin(state, event);
  });

  ui.logoutButton.addEventListener("click", () => {
    signOut(state, { onSignedOut });
  });
}