import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../src/server/app.js";
import { createStorage } from "../../src/server/storage.js";

async function makeConfig(overrides = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "clipclip-app-test-"));
  return {
    dataDir: base,
    stateDir: path.join(base, "state"),
    uploadsDir: path.join(base, "uploads"),
    tmpDir: path.join(base, "tmp"),
    stateFile: path.join(base, "state", "clipclip-state.json"),
    maxUploadMb: 5,
    liveContentLimit: 1024 * 128,
    pasteContentLimit: 1024 * 1024,
    pasteTtlHours: 24,
    pasteTtlMaxHours: 168,
    maxPastePassphraseLen: 128,
    revealRateLimit: 5,
    revealRateWindowMs: 60000,
    fileTtlHours: 24,
    recentFilesLimit: 10,
    accessToken: "",
    publicMode: false,
    trustProxy: false,
    sessionTtlMs: 24 * 60 * 60 * 1000,
    maxSseClients: 100,
    sseHeartbeatMs: 25000,
    sseIdleTimeoutMs: 300000,
    ...overrides
  };
}

async function startServer(overrides = {}) {
  const config = await makeConfig(overrides);
  const storage = await createStorage(config);
  const server = createApp({ config, storage });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    config,
    storage,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

function rawRequest(baseUrl, requestText) {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(port), hostname, () => {
      socket.write(requestText);
    });
    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("close", () => resolve(response));
    socket.on("error", reject);
    setTimeout(() => {
      socket.destroy();
      resolve(response);
    }, 2000).unref();
  });
}

function openSse(baseUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}/api/events`, { headers }, (response) => {
      resolve({ request, response });
    });
    request.on("error", reject);
  });
}

function waitForSseChunk(response, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let received = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for SSE chunk. Received: ${received.slice(0, 200)}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      response.off("data", onData);
    }

    function onData(chunk) {
      received += chunk.toString();
      if (predicate(received)) {
        cleanup();
        resolve(received);
      }
    }

    response.on("data", onData);
  });
}

async function login(baseUrl, token, extraHeaders = {}) {
  return fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ token })
  });
}

async function createPaste(baseUrl, payload, headers = {}) {
  return fetch(`${baseUrl}/api/pastes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload)
  });
}

async function reveal(baseUrl, id, passphrase, headers = {}) {
  return fetch(`${baseUrl}/api/pastes/${id}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ passphrase })
  });
}

function multipartBody(boundary, filename, content, { fieldName = "file", useRfc5987 = false } = {}) {
  const disposition = useRfc5987
    ? `Content-Disposition: form-data; name="${fieldName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    : `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`;
  return Buffer.from(
    `--${boundary}\r\n${disposition}\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`,
    "utf8"
  );
}

function firstSetCookie(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values[0] || "";
}

test("file upload keeps the original decoded name and returns a download link", async () => {
  const { server, baseUrl, close } = await startServer();

  try {
    const uploadResponse = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-File-Name": encodeURIComponent("测试 文件.txt")
      },
      body: "hello from clipclip"
    });

    assert.equal(uploadResponse.status, 201);
    const uploadPayload = await uploadResponse.json();
    assert.equal(uploadPayload.fileName, "测试 文件.txt");
    assert.match(uploadPayload.downloadUrl, /^\/api\/files\/[^/]+\/download$/);

    const downloadResponse = await fetch(`${baseUrl}${uploadPayload.downloadUrl}`);
    assert.equal(downloadResponse.status, 200);
    assert.equal(await downloadResponse.text(), "hello from clipclip");
  } finally {
    await close();
  }
});

test("latest uploaded file is discoverable for other devices", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const initialResponse = await fetch(`${baseUrl}/api/files/latest`);
    assert.equal(initialResponse.status, 404);

    const uploadResponse = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-File-Name": "shared-note.txt"
      },
      body: "hello from another device"
    });

    assert.equal(uploadResponse.status, 201);
    const uploadPayload = await uploadResponse.json();

    const latestResponse = await fetch(`${baseUrl}/api/files/latest`);
    assert.equal(latestResponse.status, 200);

    const latestPayload = await latestResponse.json();
    assert.equal(latestPayload.id, uploadPayload.id);
    assert.equal(latestPayload.fileName, "shared-note.txt");
    assert.match(latestPayload.downloadUrl, /^\/api\/files\/[^/]+\/download$/);
  } finally {
    await close();
  }
});

test("recent files endpoint returns the newest uploads first", async () => {
  const { baseUrl, close } = await startServer();

  try {
    for (const name of ["one.txt", "two.txt", "three.txt"]) {
      const uploadResponse = await fetch(`${baseUrl}/api/files`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-File-Name": name
        },
        body: `body-${name}`
      });
      assert.equal(uploadResponse.status, 201);
    }

    const response = await fetch(`${baseUrl}/api/files/recent`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.deepEqual(
      payload.files.map((file) => file.fileName),
      ["three.txt", "two.txt", "one.txt"]
    );
  } finally {
    await close();
  }
});

test("frontend helper modules are served from static routes", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/button-feedback.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/javascript; charset=utf-8");

    const body = await response.text();
    assert.match(body, /flashButtonState/);
  } finally {
    await close();
  }
});

test("malformed request target returns 400 without killing the server", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const response = await rawRequest(
      baseUrl,
      "GET //[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    );
    assert.match(response, /^HTTP\/1\.1 400/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    await close();
  }
});

test("clientError is answered with 400 and the server stays up", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const response = await rawRequest(baseUrl, "BROKEN REQUEST\r\n\r\n");
    assert.match(response, /400 Bad Request/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    await close();
  }
});

test("missing blob returns JSON 404 for download and the server stays up", async () => {
  const { config, storage, baseUrl, close } = await startServer();

  try {
    const sourcePath = path.join(config.tmpDir, "missing-source.txt");
    await fs.mkdir(config.tmpDir, { recursive: true });
    await fs.writeFile(sourcePath, "missing");
    const file = await storage.saveFile({
      originalName: "missing.txt",
      mimeType: "text/plain",
      sizeBytes: 7,
      sourcePath,
      ttlHours: 24
    });
    await fs.rm(file.filePath, { force: true });

    const response = await fetch(`${baseUrl}/api/files/${file.id}/download`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "File not found.");

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    await close();
  }
});

test("invalid JSON bodies are rejected instead of being coerced", async () => {
  const { config, storage, baseUrl, close } = await startServer();

  try {
    await storage.setLiveClipboard("keep-me");

    const putCases = [
      "null",
      "[]",
      "{\"content\":123}",
      "{}",
      "not-json"
    ];

    for (const body of putCases) {
      const response = await fetch(`${baseUrl}/api/live`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body
      });
      assert.equal(response.status, 400, `PUT body ${body} should be rejected`);
    }

    const liveResponse = await fetch(`${baseUrl}/api/live`);
    assert.equal((await liveResponse.json()).content, "keep-me");

    for (const body of ["null", "[]", "{\"content\":\"\"}"]) {
      const response = await fetch(`${baseUrl}/api/pastes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      assert.equal(response.status, 400, `paste body ${body} should be rejected`);
    }

    assert.equal(storage.getLiveClipboard().content, "keep-me");
    assert.equal(config.accessToken, "");
  } finally {
    await close();
  }
});

test("live clipboard accepts high-escape content within the byte limit", async () => {
  const { baseUrl, close } = await startServer({ liveContentLimit: 200 });

  try {
    const content = "\n".repeat(200);
    const accepted = await fetch(`${baseUrl}/api/live`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    assert.equal(accepted.status, 200);

    const tooLarge = await fetch(`${baseUrl}/api/live`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(201) })
    });
    assert.equal(tooLarge.status, 413);
  } finally {
    await close();
  }
});

test("expired files are hidden and cannot be downloaded", async () => {
  const { config, storage, baseUrl, close } = await startServer();

  try {
    const sourcePath = path.join(config.tmpDir, "expired-source.txt");
    await fs.mkdir(config.tmpDir, { recursive: true });
    await fs.writeFile(sourcePath, "expired");
    const file = await storage.saveFile({
      originalName: "expired.txt",
      mimeType: "text/plain",
      sizeBytes: 7,
      sourcePath,
      ttlHours: 0
    });

    assert.equal(storage.getLatestFile(), null);
    assert.deepEqual(storage.listRecentFiles(), []);
    assert.equal(storage.getSummary().files, 0);

    const latest = await fetch(`${baseUrl}/api/files/latest`);
    assert.equal(latest.status, 404);

    const recent = await fetch(`${baseUrl}/api/files/recent`);
    assert.deepEqual((await recent.json()).files, []);

    const download = await fetch(`${baseUrl}/api/files/${file.id}/download`);
    assert.equal(download.status, 404);
  } finally {
    await close();
  }
});

test("download headers use octet-stream and RFC5987 filename encoding", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const uploadResponse = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: {
        "Content-Type": "text/html",
        "X-File-Name": encodeURIComponent("测试 文件.txt")
      },
      body: "<script>alert(1)</script>"
    });
    const uploadPayload = await uploadResponse.json();

    const downloadResponse = await fetch(`${baseUrl}${uploadPayload.downloadUrl}`);
    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadResponse.headers.get("content-type"), "application/octet-stream");
    assert.match(downloadResponse.headers.get("content-disposition"), /^attachment; filename=".*"; filename\*=UTF-8''/);
    assert.match(
      downloadResponse.headers.get("content-disposition"),
      /filename\*=UTF-8''%E6%B5%8B%E8%AF%95%20%E6%96%87%E4%BB%B6\.txt/
    );
    assert.equal(downloadResponse.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await downloadResponse.text(), "<script>alert(1)</script>");
  } finally {
    await close();
  }
});

test("local mode allows requests without authentication and reports publicMode=false", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.publicMode, false);
    assert.equal(healthPayload.needsAuth, false);
    assert.equal(health.headers.get("content-security-policy"), null);
    assert.equal(health.headers.get("cross-origin-embedder-policy"), null);

    const live = await fetch(`${baseUrl}/api/live`);
    assert.equal(live.status, 200);

    const loginResponse = await login(baseUrl, "anything");
    assert.equal(loginResponse.status, 200);
    assert.deepEqual(await loginResponse.json(), { ok: true });
  } finally {
    await close();
  }
});

test("public mode protects data, static pages and SSE, and exposes health", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.publicMode, true);
    assert.equal(healthPayload.needsAuth, true);
    assert.equal(healthPayload.storage, undefined);
    assert.match(health.headers.get("content-security-policy"), /default-src 'self'/);

    for (const pathname of ["/api/live", "/api/files/recent"]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 401, `${pathname} should require auth`);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
    }

    const events = await fetch(`${baseUrl}/api/events`);
    assert.equal(events.status, 401);
  } finally {
    await close();
  }
});

test("public mode serves static assets without auth while API data stays protected", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const indexResponse = await fetch(`${baseUrl}/`);
    assert.equal(indexResponse.status, 200);
    assert.match(indexResponse.headers.get("content-type"), /text\/html/);
    assert.equal(indexResponse.headers.get("cross-origin-embedder-policy"), "require-corp");
    const indexHtml = await indexResponse.text();
    assert.match(indexHtml, /id="login-view"/);
    assert.match(indexHtml, /id="app-shell"/);
    assert.match(indexHtml, /<script type="module" src="\/app\.js"><\/script>/);

    for (const pathname of [
      "/p/abc",
      "/app.js",
      "/button-feedback.js",
      "/lib/clipboard.js",
      "/js/api.js",
      "/styles.css"
    ]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, `${pathname} should be public static asset`);
      assert.notEqual(response.headers.get("content-type"), "application/json; charset=utf-8");
    }

    const putLive = await fetch(`${baseUrl}/api/live`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "blocked" })
    });
    assert.equal(putLive.status, 401);
    assert.deepEqual(await putLive.json(), { error: "Unauthorized" });

    for (const pathname of ["/api/live", "/api/events", "/api/pastes", "/api/files/latest", "/api/files/recent", "/api/files/example/download"]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 401, `${pathname} should require auth`);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
    }
  } finally {
    await close();
  }
});

test("login validates the token, sets session cookie and supports cookie and bearer auth", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const invalid = await login(baseUrl, "wrong");
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { error: "Invalid token" });

    const success = await login(baseUrl, "s3cret");
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { ok: true });

    const setCookie = firstSetCookie(success);
    assert.match(setCookie, /^clipclip_session=[A-Za-z0-9_-]+;/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /Max-Age=86400/);
    assert.doesNotMatch(setCookie, /Secure/);

    const cookie = setCookie.split(";")[0];
    const sessionToken = cookie.slice("clipclip_session=".length);

    const byCookie = await fetch(`${baseUrl}/api/live`, { headers: { Cookie: cookie } });
    assert.equal(byCookie.status, 200);

    const bySessionBearer = await fetch(`${baseUrl}/api/live`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert.equal(bySessionBearer.status, 200);

    const byAccessToken = await fetch(`${baseUrl}/api/live`, {
      headers: { Authorization: "Bearer s3cret" }
    });
    assert.equal(byAccessToken.status, 200);

    const byBadToken = await fetch(`${baseUrl}/api/live`, {
      headers: { Authorization: "Bearer nope" }
    });
    assert.equal(byBadToken.status, 401);
  } finally {
    await close();
  }
});

test("public mode login is rate limited per IP", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(baseUrl, `wrong-${attempt}`);
      assert.equal(response.status, 401);
    }

    const limited = await login(baseUrl, "s3cret");
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { error: "Too many attempts" });
  } finally {
    await close();
  }
});

test("trustProxy uses the leftmost X-Forwarded-For value for login rate limiting", async () => {
  const { baseUrl, close } = await startServer({
    accessToken: "s3cret",
    publicMode: true,
    trustProxy: true
  });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(baseUrl, `wrong-${attempt}`, {
        "X-Forwarded-For": "203.0.113.10"
      });
      assert.equal(response.status, 401);
    }

    // A different client IP is counted independently.
    const otherClient = await login(baseUrl, "wrong", {
      "X-Forwarded-For": "203.0.113.20"
    });
    assert.equal(otherClient.status, 401);

    // The exhausted client is still limited.
    const blocked = await login(baseUrl, "wrong", {
      "X-Forwarded-For": "203.0.113.10"
    });
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { error: "Too many attempts" });

    // Malformed XFF falls back to the socket address and remains counted.
    const malformed = await login(baseUrl, "wrong", {
      "X-Forwarded-For": "not-an-ip"
    });
    assert.equal(malformed.status, 401);
  } finally {
    await close();
  }
});

test("trustProxy=false ignores X-Forwarded-For for login rate limiting", async () => {
  const { baseUrl, close } = await startServer({
    accessToken: "s3cret",
    publicMode: true,
    trustProxy: false
  });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(baseUrl, `wrong-${attempt}`, {
        "X-Forwarded-For": `203.0.113.${attempt + 1}`
      });
      assert.equal(response.status, 401);
    }

    const blocked = await login(baseUrl, "s3cret", {
      "X-Forwarded-For": "203.0.113.99"
    });
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { error: "Too many attempts" });
  } finally {
    await close();
  }
});

test("burn-after-read paste is returned once and then disappears", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const createResponse = await createPaste(baseUrl, {
      content: "burn-secret",
      burnAfterRead: true
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.burnAfterRead, true);
    assert.equal(created.hasPassphrase, false);

    const firstRead = await fetch(`${baseUrl}/api/pastes/${created.id}`);
    assert.equal(firstRead.status, 200);
    assert.equal((await firstRead.json()).content, "burn-secret");

    const secondRead = await fetch(`${baseUrl}/api/pastes/${created.id}`);
    assert.equal(secondRead.status, 404);
  } finally {
    await close();
  }
});

test("passphrase-protected paste hides content on GET and reveal works", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const createResponse = await createPaste(baseUrl, {
      content: "passphrase-secret",
      passphrase: "correct horse battery"
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.hasPassphrase, true);

    const protectedGet = await fetch(`${baseUrl}/api/pastes/${created.id}`);
    assert.equal(protectedGet.status, 403);
    const protectedBody = await protectedGet.json();
    assert.deepEqual(protectedBody, { error: "Passphrase required" });
    assert.equal(protectedBody.content, undefined);

    const wrong = await fetch(`${baseUrl}/api/pastes/${created.id}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "wrong" })
    });
    assert.equal(wrong.status, 403);
    assert.deepEqual(await wrong.json(), { error: "Invalid passphrase" });

    const reveal = await fetch(`${baseUrl}/api/pastes/${created.id}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "correct horse battery" })
    });
    assert.equal(reveal.status, 200);
    assert.equal((await reveal.json()).content, "passphrase-secret");

    // Non-burn paste remains protected after a successful reveal.
    const afterReveal = await fetch(`${baseUrl}/api/pastes/${created.id}`);
    assert.equal(afterReveal.status, 403);
  } finally {
    await close();
  }
});

test("passphrase is persisted only as a SHA-256 hash", async () => {
  const { config, baseUrl, close } = await startServer();

  try {
    const response = await createPaste(baseUrl, {
      content: "hash-test-secret",
      passphrase: "hunter2-secret"
    });
    assert.equal(response.status, 201);
    const created = await response.json();

    const raw = await fs.readFile(config.stateFile, "utf8");
    assert.equal(raw.includes("hunter2-secret"), false);
    const state = JSON.parse(raw);
    const stored = state.pastes.find((paste) => paste.id === created.id);
    assert.ok(stored);
    assert.equal(stored.hasPassphrase, true);
    assert.match(stored.passphraseHash, /^[a-f0-9]{64}$/);
    assert.equal(stored.passphrase, undefined);
  } finally {
    await close();
  }
});

test("concurrent reveal of a burn paste succeeds only once", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const createResponse = await createPaste(baseUrl, {
      content: "race-secret",
      passphrase: "same-pass",
      burnAfterRead: true
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/pastes/${created.id}/reveal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase: "same-pass" })
        })
      )
    );
    const statuses = [];
    for (const response of responses) {
      statuses.push(response.status);
      await response.text();
    }
    assert.equal(statuses.filter((status) => status === 200).length, 1);
    assert.equal(statuses.filter((status) => status === 404).length, 9);
  } finally {
    await close();
  }
});

test("paste burn/passphrase fields are validated", async () => {
  const { baseUrl, close } = await startServer();

  try {
    for (const payload of [
      { content: "x", passphrase: 123 },
      { content: "x", passphrase: "x".repeat(129) },
      { content: "x", burnAfterRead: "yes" }
    ]) {
      const response = await createPaste(baseUrl, payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
    }
  } finally {
    await close();
  }
});

test("multipart upload parses UTF-8 and RFC5987 filenames and matches raw response shape", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const boundary = "----clipclip-test-boundary";
    const cases = [
      { filename: "测试 文件.txt", useRfc5987: false },
      { filename: "测试 文件.txt", useRfc5987: true }
    ];

    for (const scenario of cases) {
      const response = await fetch(`${baseUrl}/api/files`, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: multipartBody(boundary, scenario.filename, "multipart body", scenario)
      });
      assert.equal(response.status, 201);
      const payload = await response.json();
      assert.equal(payload.fileName, scenario.filename);
      assert.deepEqual(
        Object.keys(payload).sort(),
        ["downloadUrl", "expiresAt", "fileName", "id", "sizeBytes"]
      );

      const download = await fetch(`${baseUrl}${payload.downloadUrl}`);
      assert.equal(download.status, 200);
      assert.equal(await download.text(), "multipart body");
    }
  } finally {
    await close();
  }
});

test("multipart upload enforces the configured size limit", async () => {
  const { baseUrl, close } = await startServer({ maxUploadMb: 1 });

  try {
    const boundary = "----clipclip-size-boundary";
    const response = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: multipartBody(boundary, "big.bin", "x".repeat(1.5 * 1024 * 1024))
    });
    assert.equal(response.status, 413);
  } finally {
    await close();
  }
});

test("public mode protects paste reveal and multipart upload endpoints", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const paste = await createPaste(baseUrl, { content: "blocked", passphrase: "pw" });
    assert.equal(paste.status, 401);
    assert.deepEqual(await paste.json(), { error: "Unauthorized" });

    const reveal = await fetch(`${baseUrl}/api/pastes/example/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "pw" })
    });
    assert.equal(reveal.status, 401);
    assert.deepEqual(await reveal.json(), { error: "Unauthorized" });

    const boundary = "----clipclip-auth-boundary";
    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: multipartBody(boundary, "blocked.txt", "blocked")
    });
    assert.equal(upload.status, 401);
    assert.deepEqual(await upload.json(), { error: "Unauthorized" });
  } finally {
    await close();
  }
});

test("reveal is rate limited per client IP and paste", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const createResponse = await createPaste(baseUrl, {
      content: "reveal-limit",
      passphrase: "right-pass"
    });
    const created = await createResponse.json();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await reveal(baseUrl, created.id, `wrong-${attempt}`);
      assert.equal(response.status, 403);
    }

    const limited = await reveal(baseUrl, created.id, "right-pass");
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.deepEqual(await limited.json(), { error: "Too many attempts" });

    // Correct passphrase is still rejected while the bucket is exhausted.
    const stillLimited = await reveal(baseUrl, created.id, "right-pass");
    assert.equal(stillLimited.status, 429);
  } finally {
    await close();
  }
});

test("successful reveal clears the failure bucket", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const createResponse = await createPaste(baseUrl, {
      content: "reveal-reset",
      passphrase: "reset-pass"
    });
    const created = await createResponse.json();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await reveal(baseUrl, created.id, `wrong-${attempt}`);
      assert.equal(response.status, 403);
    }

    const success = await reveal(baseUrl, created.id, "reset-pass");
    assert.equal(success.status, 200);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await reveal(baseUrl, created.id, `again-${attempt}`);
      assert.equal(response.status, 403);
    }
    const limited = await reveal(baseUrl, created.id, "reset-pass");
    assert.equal(limited.status, 429);
  } finally {
    await close();
  }
});

test("reveal buckets are independent for different paste ids", async () => {
  const { baseUrl, close } = await startServer();

  try {
    const first = await (await createPaste(baseUrl, {
      content: "first",
      passphrase: "first-pass"
    })).json();
    const second = await (await createPaste(baseUrl, {
      content: "second",
      passphrase: "second-pass"
    })).json();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await reveal(baseUrl, first.id, "wrong")).status, 403);
    }

    assert.equal((await reveal(baseUrl, first.id, "first-pass")).status, 429);
    assert.equal((await reveal(baseUrl, second.id, "second-pass")).status, 200);
  } finally {
    await close();
  }
});

test("reveal rate limiting uses X-Forwarded-For when trustProxy is enabled", async () => {
  const { baseUrl, close } = await startServer({
    accessToken: "s3cret",
    publicMode: true,
    trustProxy: true
  });

  try {
    const authHeaders = { Authorization: "Bearer s3cret" };
    const createResponse = await createPaste(
      baseUrl,
      { content: "proxy-reveal", passphrase: "proxy-pass" },
      authHeaders
    );
    const created = await createResponse.json();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await reveal(baseUrl, created.id, `wrong-${attempt}`, {
        ...authHeaders,
        "X-Forwarded-For": "203.0.113.10"
      });
      assert.equal(response.status, 403);
    }

    const otherClient = await reveal(baseUrl, created.id, "proxy-pass", {
      ...authHeaders,
      "X-Forwarded-For": "203.0.113.20"
    });
    assert.equal(otherClient.status, 200);

    const exhaustedClient = await reveal(baseUrl, created.id, "proxy-pass", {
      ...authHeaders,
      "X-Forwarded-For": "203.0.113.10"
    });
    assert.equal(exhaustedClient.status, 429);
  } finally {
    await close();
  }
});

test("reveal of a missing paste returns 404 without consuming rate limit", async () => {
  const { baseUrl, close } = await startServer();

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await reveal(baseUrl, "missing123", "wrong");
      assert.equal(response.status, 404);
    }
  } finally {
    await close();
  }
});

test("logout clears the session cookie and server-side session", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const success = await login(baseUrl, "s3cret");
    const cookie = firstSetCookie(success).split(";")[0];

    const logoutResponse = await fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(logoutResponse.status, 200);
    assert.deepEqual(await logoutResponse.json(), { ok: true });
    assert.match(firstSetCookie(logoutResponse), /Max-Age=0/);

    const afterLogout = await fetch(`${baseUrl}/api/live`, { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401);
  } finally {
    await close();
  }
});

test("secure cookie and HSTS are used when the request is HTTPS", async () => {
  const { baseUrl, close } = await startServer({ accessToken: "s3cret", publicMode: true });

  try {
    const success = await login(baseUrl, "s3cret", { "X-Forwarded-Proto": "https" });
    assert.equal(success.status, 200);
    assert.match(firstSetCookie(success), /; Secure/);
    assert.equal(
      success.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains"
    );
  } finally {
    await close();
  }
});

test("SSE sends snapshots, heartbeat comments and enforces the client cap", async () => {
  const { baseUrl, close } = await startServer({ maxSseClients: 1, sseHeartbeatMs: 30 });

  try {
    const first = await openSse(baseUrl);
    assert.equal(first.response.statusCode, 200);
    const snapshot = await waitForSseChunk(first.response, (value) => value.includes("live:snapshot"));
    assert.match(snapshot, /live:snapshot/);

    const heartbeat = await waitForSseChunk(first.response, (value) => value.includes(": keep-alive"));
    assert.match(heartbeat, /: keep-alive/);

    const second = await openSse(baseUrl);
    assert.equal(second.response.statusCode, 503);
    const body = await new Promise((resolve) => {
      let data = "";
      second.response.on("data", (chunk) => {
        data += chunk.toString();
      });
      second.response.on("end", () => resolve(data));
    });
    assert.deepEqual(JSON.parse(body), { error: "Too many connections" });

    first.request.destroy();
    second.request.destroy();
  } finally {
    await close();
  }
});