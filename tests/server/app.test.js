import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../src/server/app.js";
import { createStorage } from "../../src/server/storage.js";

async function makeConfig() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "clipclip-app-test-"));
  return {
    stateDir: path.join(base, "state"),
    uploadsDir: path.join(base, "uploads"),
    stateFile: path.join(base, "state", "clipclip-state.json"),
    maxUploadMb: 5,
    liveContentLimit: 1024 * 128,
    pasteTtlHours: 24,
    fileTtlHours: 24
  };
}

async function startServer() {
  const config = await makeConfig();
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
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

test("file upload keeps the original decoded name and returns a download link", async () => {
  const { server, baseUrl } = await startServer();

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
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("latest uploaded file is discoverable for other devices", async () => {
  const { server, baseUrl } = await startServer();

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
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("recent files endpoint returns the newest uploads first", async () => {
  const { server, baseUrl } = await startServer();

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
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
