import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStorage, sanitizeFileName } from "../../src/server/storage.js";

async function makeConfig() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "clipclip-test-"));
  return {
    stateDir: path.join(base, "state"),
    uploadsDir: path.join(base, "uploads"),
    stateFile: path.join(base, "state", "clipclip-state.json"),
    pasteTtlHours: 24,
    fileTtlHours: 24
  };
}

test("sanitizeFileName removes unsafe characters", () => {
  assert.equal(sanitizeFileName('../a:<bad>.txt'), "..-a--bad-.txt");
});

test("storage persists live clipboard updates", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);

  await storage.setLiveClipboard("hello");

  const nextStorage = await createStorage(config);
  assert.equal(nextStorage.getLiveClipboard().content, "hello");
});

test("storage creates retrievable pastes", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);

  const paste = await storage.createPaste("fixed text", 24);
  const fetched = storage.getPaste(paste.id);

  assert.equal(fetched.content, "fixed text");
});
