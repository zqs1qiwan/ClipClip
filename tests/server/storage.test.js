import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStorage, moveFile, sanitizeFileName } from "../../src/server/storage.js";

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

test("moveFile falls back to copy when rename crosses devices", async () => {
  const calls = [];
  const fileOps = {
    async rename(sourcePath, targetPath) {
      calls.push(["rename", sourcePath, targetPath]);
      const error = new Error("Cross-device link");
      error.code = "EXDEV";
      throw error;
    },
    async copyFile(sourcePath, targetPath) {
      calls.push(["copyFile", sourcePath, targetPath]);
    },
    async rm(sourcePath, options) {
      calls.push(["rm", sourcePath, options]);
    }
  };

  await moveFile("C:/tmp/source.bin", "D:/data/target.bin", fileOps);

  assert.deepEqual(calls, [
    ["rename", "C:/tmp/source.bin", "D:/data/target.bin"],
    ["copyFile", "C:/tmp/source.bin", "D:/data/target.bin"],
    ["rm", "C:/tmp/source.bin", { force: true }]
  ]);
});
