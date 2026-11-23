import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../../public/js/api.js";
import { createState } from "../../public/js/state.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => payload
  };
}

test("api.createPaste omits burnAfterRead/passphrase unless meaningfully set", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_path, options) => {
    bodies.push(JSON.parse(options.body));
    return jsonResponse(201, { id: "abc", url: "/p/abc" });
  };
  try {
    await api.createPaste({ content: "hello" });
    await api.createPaste({ content: "hello", burnAfterRead: false, passphrase: "" });
    await api.createPaste({
      content: "hello",
      burnAfterRead: true,
      passphrase: "secret",
      expiresInHours: 24
    });
    assert.deepEqual(bodies, [
      { content: "hello" },
      { content: "hello" },
      {
        content: "hello",
        expiresInHours: 24,
        burnAfterRead: true,
        passphrase: "secret"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.revealPaste POSTs the passphrase to the reveal endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return jsonResponse(200, { id: "abc", content: "secret text" });
  };
  try {
    const payload = await api.revealPaste("abc-123", "口令");
    assert.equal(payload.content, "secret text");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "/api/pastes/abc-123/reveal");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].options.body), { passphrase: "口令" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.createPaste and revealPaste map 403 to the forbidden code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(403, { error: "Passphrase required" });
  try {
    await assert.rejects(
      () => api.revealPaste("abc", "x"),
      (error) => error.code === "forbidden" && error.status === 403
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createState exposes the paste lock state machine fields", () => {
  const state = createState();
  assert.equal(state.pastePage.id, null);
  assert.equal(state.pastePage.locked, false);
  assert.equal(state.pastePage.passphrase, "");
  assert.equal(state.pastePage.busy, false);
  assert.equal(state.pastePage.alert, null);
  assert.equal(state.pastePage.payload, null);
  assert.equal(state.pastePage.error, null);
});

test("qrTargetUrl returns origin + pathname only (no query/hash/token)", async () => {
  // qr-modal.js imports ui.js which builds DOM refs at module load; install a
  // minimal document stub before the dynamic import.
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { classList: { add() {}, remove() {} } }
  };
  globalThis.window = {
    location: {
      origin: "http://192.168.2.1:5678",
      pathname: "/",
      search: "?token=leak",
      hash: "#secret"
    },
    setTimeout: () => 0,
    clearTimeout: () => {}
  };

  try {
    const { qrTargetUrl } = await import("../../public/js/qr-modal.js");
    const url = qrTargetUrl();
    assert.equal(url, "http://192.168.2.1:5678/");
    assert.doesNotMatch(url, /token|leak|secret|hash/);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("qrTargetUrl preserves a /p/<id> pathname without leaking data", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { classList: { add() {}, remove() {} } }
  };
  globalThis.window = {
    location: { origin: "http://clip.clip:5678", pathname: "/p/abc123" },
    setTimeout: () => 0,
    clearTimeout: () => {}
  };
  try {
    const { qrTargetUrl } = await import("../../public/js/qr-modal.js");
    assert.equal(qrTargetUrl(), "http://clip.clip:5678/p/abc123");
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
