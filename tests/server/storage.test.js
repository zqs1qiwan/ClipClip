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

test("storage keeps only the most recent 10 files and removes older file data", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);
  const savedIds = [];

  for (let index = 0; index < 12; index += 1) {
    const sourcePath = path.join(config.stateDir, `source-${index}.txt`);
    await fs.writeFile(sourcePath, `file-${index}`);
    const file = await storage.saveFile({
      originalName: `file-${index}.txt`,
      mimeType: "text/plain",
      sizeBytes: 6,
      sourcePath,
      ttlHours: 24
    });
    savedIds.push(file.id);
  }

  const recentFiles = storage.listRecentFiles();
  assert.equal(recentFiles.length, 10);
  assert.deepEqual(
    recentFiles.map((file) => file.id),
    savedIds.slice(-10).reverse()
  );

  const removedOldest = await fs
    .access(path.join(config.uploadsDir, `${savedIds[0]}-file-0.txt`))
    .then(() => false)
    .catch(() => true);
  const removedSecondOldest = await fs
    .access(path.join(config.uploadsDir, `${savedIds[1]}-file-1.txt`))
    .then(() => false)
    .catch(() => true);

  assert.equal(removedOldest, true);
  assert.equal(removedSecondOldest, true);
});

test("cleanup removes entries whose files are already missing on disk", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);
  const sourcePath = path.join(config.stateDir, "missing-source.txt");
  await fs.writeFile(sourcePath, "missing");

  const file = await storage.saveFile({
    originalName: "missing.txt",
    mimeType: "text/plain",
    sizeBytes: 7,
    sourcePath,
    ttlHours: 24
  });

  await fs.rm(file.filePath, { force: true });
  await storage.cleanupExpired();

  assert.equal(storage.getFile(file.id), null);
  assert.equal(storage.listRecentFiles().length, 0);
});
