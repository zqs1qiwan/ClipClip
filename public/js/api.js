export class ApiError extends Error {
  constructor(message, { status = 0, code = "http" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function codeForStatus(status) {
  if (status === 0) return "network";
  if (status === 400) return "badRequest";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 405) return "methodNotAllowed";
  if (status === 408) return "timeout";
  if (status === 413) return "tooLarge";
  if (status === 429) return "rateLimited";
  if (status >= 500) return "server";
  return "http";
}

async function parsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const { body, method = "GET", headers = {}, signal } = options;
  let response;

  try {
    response = await fetch(path, {
      method,
      body,
      headers: {
        ...(body && typeof body === "string" ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      credentials: "same-origin",
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("aborted", { code: "aborted" });
    }
    throw new ApiError("network", { code: "network", status: 0 });
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    const apiError = new ApiError(payload?.error || `HTTP ${response.status}`, {
      status: response.status,
      code: codeForStatus(response.status)
    });
    if (response.status === 401 && path !== "/api/login") {
      unauthorizedHandler?.(apiError);
    }
    throw apiError;
  }

  return payload;
}

export const api = {
  health() {
    return request("/api/health");
  },
  getLive() {
    return request("/api/live");
  },
  saveLive(content) {
    return request("/api/live", {
      method: "PUT",
      body: JSON.stringify({ content })
    });
  },
  getRecentFiles() {
    return request("/api/files/recent");
  },
  createPaste({ content, expiresInHours, burnAfterRead, passphrase }) {
    const body = { content };
    if (typeof expiresInHours === "number" && expiresInHours > 0) {
      body.expiresInHours = expiresInHours;
    }
    if (burnAfterRead === true) {
      body.burnAfterRead = true;
    }
    if (typeof passphrase === "string" && passphrase.length > 0) {
      body.passphrase = passphrase;
    }
    return request("/api/pastes", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  getPaste(id) {
    return request(`/api/pastes/${encodeURIComponent(id)}`);
  },
  revealPaste(id, passphrase) {
    return request(`/api/pastes/${encodeURIComponent(id)}/reveal`, {
      method: "POST",
      body: JSON.stringify({ passphrase })
    });
  },
  login(token) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify({ token })
    });
  },
  logout() {
    return request("/api/logout", { method: "POST" });
  }
};

/**
 * Upload a file with progress reporting. Uses XHR because fetch has no
 * upload-progress event. Rejects with ApiError so callers can localize.
 */
export function uploadFile(file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload || {});
        return;
      }

      const apiError = new ApiError(payload?.error || `HTTP ${xhr.status}`, {
        status: xhr.status,
        code: codeForStatus(xhr.status)
      });
      if (xhr.status === 401) {
        unauthorizedHandler?.(apiError);
      }
      reject(apiError);
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("network", { status: 0, code: "network" }));
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiError("aborted", { status: 0, code: "aborted" }));
    });

    xhr.send(file);
  });
}