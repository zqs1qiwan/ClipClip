import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createStorage,
  moveFile,
  sanitizeFileName,
  isSafeStoredName
} from "../../src/server/storage.js";

async function makeConfig(overrides = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "clipclip-test-"));
  return {
    dataDir: base,
    stateDir: path.join(base, "state"),
    uploadsDir: path.join(base, "uploads"),
    tmpDir: path.join(base, "tmp"),
    stateFile: path.join(base, "state", "clipclip-state.json"),
    recentFilesLimit: 10,
    pasteTtlHours: 24,
    fileTtlHours: 24,
    ...overrides
  };
}

test("sanitizeFileName removes unsafe characters", () => {
  assert.equal(sanitizeFileName('../a:<bad>.txt'), "..-a--bad-.txt");
});

test("isSafeStoredName rejects traversal and foreign prefixes", () => {
  assert.equal(isSafeStoredName("abc123-file.txt", "abc123"), true);
  assert.equal(isSafeStoredName("../escape.txt", "abc123"), false);
  assert.equal(isSafeStoredName("abc123/../escape.txt", "abc123"), false);
  assert.equal(isSafeStoredName("other-file.txt", "abc123"), false);
  assert.equal(isSafeStoredName("abc123-. .txt", "abc123"), true);
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
  const fetched = await storage.readPaste(paste.id);

  assert.equal(fetched.status, "ok");
  assert.equal(fetched.paste.content, "fixed text");
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

test("concurrent writes are serialized into one valid state file", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);
  const values = Array.from({ length: 40 }, (_, index) => `value-${index}`);

  await Promise.all(values.map((value) => storage.setLiveClipboard(value)));

  const raw = await fs.readFile(config.stateFile, "utf8");
  const parsed = JSON.parse(raw);
  assert.ok(values.includes(parsed.liveClipboard.content));

  const nextStorage = await createStorage(config);
  assert.ok(values.includes(nextStorage.getLiveClipboard().content));
  const tempEntries = await fs.readdir(config.stateDir);
  assert.equal(tempEntries.some((entry) => entry.endsWith(".tmp")), false);
});

test("corrupt state is backed up instead of silently overwritten", async () => {
  const config = await makeConfig();
  await fs.mkdir(config.stateDir, { recursive: true });
  await fs.writeFile(config.stateFile, "{ definitely not json");

  const storage = await createStorage(config);
  assert.equal(storage.getLiveClipboard().content, "");

  const entries = await fs.readdir(config.stateDir);
  assert.equal(entries.some((entry) => entry.includes(".corrupt-")), true);
  JSON.parse(await fs.readFile(config.stateFile, "utf8"));
});

test("invalid file entries are dropped and storedName traversal is never used", async () => {
  const config = await makeConfig();
  await fs.mkdir(config.stateDir, { recursive: true });
  await fs.mkdir(config.uploadsDir, { recursive: true });
  const outsidePath = path.join(config.dataDir, "escape.txt");
  await fs.writeFile(outsidePath, "must not be deleted");

  const now = new Date().toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  await fs.writeFile(
    config.stateFile,
    JSON.stringify({
      liveClipboard: { roomId: "main", content: "", updatedAt: null },
      pastes: [],
      files: [
        {
          id: "abc123",
          originalName: "escape.txt",
          storedName: "../../escape.txt",
          mimeType: "text/plain",
          sizeBytes: 5,
          createdAt: now,
          expiresAt: future,
          downloadCount: 0
        },
        {
          id: "def456",
          originalName: "valid.txt",
          storedName: "def456-valid.txt",
          mimeType: "text/plain",
          sizeBytes: 5,
          createdAt: now,
          expiresAt: future,
          downloadCount: 0
        }
      ]
    })
  );
  await fs.writeFile(path.join(config.uploadsDir, "def456-valid.txt"), "valid");

  const storage = await createStorage(config);
  assert.deepEqual(storage.listRecentFiles().map((file) => file.id), ["def456"]);
  assert.equal(await fs.readFile(outsidePath, "utf8"), "must not be deleted");

  const entries = await fs.readdir(config.stateDir);
  assert.equal(entries.some((entry) => entry.includes(".invalid-")), true);
});

test("expired files are filtered from latest, recent and summary", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);
  const sourcePath = path.join(config.stateDir, "expired.txt");
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
  assert.equal(storage.getFile(file.id), null);
});

test("storage hashes passphrases, enforces reveal and burns only once", async () => {
  const config = await makeConfig();
  const storage = await createStorage(config);
  const paste = await storage.createPaste("reveal secret", 24, {
    passphrase: "storage-pass",
    burnAfterRead: true
  });

  assert.equal(paste.hasPassphrase, true);
  assert.equal(paste.passphraseHash, undefined);

  const raw = await fs.readFile(config.stateFile, "utf8");
  assert.equal(raw.includes("storage-pass"), false);
  const stored = JSON.parse(raw).pastes.find((entry) => entry.id === paste.id);
  assert.match(stored.passphraseHash, /^[a-f0-9]{64}$/);

  assert.equal((await storage.readPaste(paste.id)).status, "passphrase_required");
  assert.equal(
    (await storage.readPaste(paste.id, { passphrase: "wrong" })).status,
    "invalid_passphrase"
  );

  const reads = await Promise.all(
    Array.from({ length: 10 }, () =>
      storage.readPaste(paste.id, { passphrase: "storage-pass" })
    )
  );
  assert.equal(reads.filter((result) => result.status === "ok").length, 1);
  assert.equal(reads.filter((result) => result.status === "not_found").length, 9);
  assert.equal((await storage.readPaste(paste.id)).status, "not_found");
  assert.equal(storage.getSummary().pastes, 0);
});

test("legacy pastes without passphrase fields remain unprotected", async () => {
  const config = await makeConfig();
  await fs.mkdir(config.stateDir, { recursive: true });
  const now = new Date().toISOString();
  await fs.writeFile(
    config.stateFile,
    JSON.stringify({
      liveClipboard: { roomId: "main", content: "", updatedAt: null },
      pastes: [
        {
          id: "legacy123",
          content: "legacy content",
          createdAt: now,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          burnAfterRead: false,
          firstReadAt: null
        }
      ],
      files: []
    })
  );

  const storage = await createStorage(config);
  const legacy = await storage.readPaste("legacy123");
  assert.equal(legacy.status, "ok");
  assert.equal(legacy.paste.hasPassphrase, false);
});

test("startup removes stale temporary upload files", async () => {
  const config = await makeConfig();
  await fs.mkdir(config.tmpDir, { recursive: true });
  const stalePath = path.join(config.tmpDir, "stale-upload.tmp");
  await fs.writeFile(stalePath, "stale");

  await createStorage(config);

  const stillExists = await fs.access(stalePath).then(() => true).catch(() => false);
  assert.equal(stillExists, false);
});