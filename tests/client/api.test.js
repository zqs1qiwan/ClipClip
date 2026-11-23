import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, api, setUnauthorizedHandler } from "../../public/js/api.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => payload
  };
}

test("ApiError carries status and code", () => {
  const error = new ApiError("boom", { status: 413, code: "tooLarge" });
  assert.equal(error.name, "ApiError");
  assert.equal(error.status, 413);
  assert.equal(error.code, "tooLarge");
});

test("api maps HTTP statuses to stable error codes", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    [400, "badRequest"],
    [401, "unauthorized"],
    [404, "notFound"],
    [405, "methodNotAllowed"],
    [413, "tooLarge"],
    [429, "rateLimited"],
    [500, "server"]
  ];

  setUnauthorizedHandler(null);
  try {
    for (const [status, code] of cases) {
      globalThis.fetch = async () => jsonResponse(status, { error: `status-${status}` });
      await assert.rejects(
        () => api.getLive(),
        (error) => error instanceof ApiError && error.status === status && error.code === code
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  }
});

test("api maps network failures to the network code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  try {
    await assert.rejects(
      () => api.health(),
      (error) => error instanceof ApiError && error.code === "network" && error.status === 0
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api maps AbortError to the aborted code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  try {
    await assert.rejects(
      () => api.health(),
      (error) => error instanceof ApiError && error.code === "aborted"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login 401 does not trigger the global unauthorized handler, other 401 endpoints do", async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  setUnauthorizedHandler((error) => seen.push(error.code));

  try {
    globalThis.fetch = async () => jsonResponse(401, { error: "Invalid token" });
    await assert.rejects(
      () => api.login("wrong"),
      (error) => error.code === "unauthorized"
    );
    assert.deepEqual(seen, [], "login 401 must be handled locally, not by the global hook");

    globalThis.fetch = async () => jsonResponse(401, { error: "Unauthorized" });
    await assert.rejects(
      () => api.getLive(),
      (error) => error.code === "unauthorized"
    );
    assert.deepEqual(seen, ["unauthorized"]);
  } finally {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  }
});

test("api.createPaste includes expiresInHours only when positive", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_path, options) => {
    bodies.push(JSON.parse(options.body));
    return jsonResponse(201, { ok: true });
  };
  try {
    await api.createPaste({ content: "hello" });
    await api.createPaste({ content: "hello", expiresInHours: 24 });
    await api.createPaste({ content: "hello", expiresInHours: 0 });
    assert.deepEqual(bodies, [
      { content: "hello" },
      { content: "hello", expiresInHours: 24 },
      { content: "hello" }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.login/logout call the expected endpoints with credentials", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return jsonResponse(200, { ok: true });
  };
  try {
    await api.login("secret");
    await api.logout();
    assert.equal(calls[0].path, "/api/login");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(JSON.parse(calls[0].options.body).token, "secret");
    assert.equal(calls[0].options.credentials, "same-origin");
    assert.equal(calls[1].path, "/api/logout");
    assert.equal(calls[1].options.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
