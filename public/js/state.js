export const TABS = ["live", "paste", "files"];
export const LANGUAGES = ["zh", "en"];

const STORAGE_KEYS = {
  tab: "clipclip-active-tab",
  language: "clipclip-language"
};

export function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be disabled; preferences simply reset on reload.
  }
}

export function normalizeTab(value) {
  return TABS.includes(value) ? value : "live";
}

export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : "zh";
}

export function loadPreferences() {
  return {
    tab: normalizeTab(readStorage(STORAGE_KEYS.tab)),
    language: normalizeLanguage(readStorage(STORAGE_KEYS.language))
  };
}

export function saveTab(tab) {
  writeStorage(STORAGE_KEYS.tab, normalizeTab(tab));
}

export function saveLanguage(language) {
  writeStorage(STORAGE_KEYS.language, normalizeLanguage(language));
}

/**
 * Single mutable application state. Transient UI concerns (progress, alerts)
 * live here so a language switch can re-render without losing them.
 */
export function createState(preferences = {}) {
  return {
    language: normalizeLanguage(preferences.language),
    tab: normalizeTab(preferences.tab),
    publicMode: false,
    auth: "unknown",
    view: "app",
    connection: "connecting",
    appAlert: null,
    live: {
      dirty: false,
      saving: false,
      saveTimer: null,
      version: 0,
      lastSentContent: null,
      lastUpdatedAt: null,
      pendingRemote: null,
      alert: null
    },
    paste: {
      result: null,
      alert: null,
      busy: false
    },
    files: {
      items: [],
      renderedLatestId: null,
      selected: null,
      upload: {
        phase: "idle",
        progress: 0,
        alert: null,
        lastFile: null
      },
      loadAlert: null,
      limit: null
    },
    pastePage: {
      id: null,
      payload: null,
      error: null,
      locked: false,
      passphrase: "",
      busy: false,
      alert: null
    },
    login: {
      busy: false,
      message: null
    }
  };
}