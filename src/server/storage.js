import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATE = {
  liveClipboard: {
    roomId: "main",
    content: "",
    updatedAt: null
  },
  pastes: [],
  files: []
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PASS_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_STORED_NAME_LENGTH = 200;

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomBytes(9).toString("base64url");
}

function sanitizeFileName(name) {
  const trimmed = (name || "upload.bin").trim();
  const normalized = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
  return normalized.slice(0, 120) || "upload.bin";
}

function computeExpiresAt(hours) {
  const parsed = Number(hours);
  const ttlHours = Number.isFinite(parsed) && parsed >= 0 ? parsed : 24;
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now();
}

function isValidDateString(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isValidId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function hashPassphrase(passphrase) {
  return crypto.createHash("sha256").update(String(passphrase ?? ""), "utf8").digest("hex");
}

function verifyPassphraseHash(passphrase, expectedHash) {
  if (typeof expectedHash !== "string" || !PASS_HASH_PATTERN.test(expectedHash)) {
    return false;
  }
  const expected = Buffer.from(expectedHash, "hex");
  const actual = crypto.createHash("sha256").update(String(passphrase ?? ""), "utf8").digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function publicPaste(paste) {
  if (!paste) {
    return null;
  }
  const { passphraseHash, ...rest } = paste;
  return { ...rest };
}

function isSafeStoredName(name, id) {
  if (typeof name !== "string" || name.length === 0 || name.length > MAX_STORED_NAME_LENGTH) {
    return false;
  }
  if (name !== path.basename(name) || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return isValidId(id) && name.startsWith(`${id}-`);
}

function resolveInside(dir, name) {
  const base = path.resolve(dir);
  const target = path.resolve(base, name);
  if (target === base || !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

function normalizePaste(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  if (!isValidId(entry.id) || typeof entry.content !== "string") {
    return null;
  }
  if (!isValidDateString(entry.createdAt) || !isValidDateString(entry.expiresAt)) {
    return null;
  }

  const passphraseHash = typeof entry.passphraseHash === "string" && PASS_HASH_PATTERN.test(entry.passphraseHash)
    ? entry.passphraseHash.toLowerCase()
    : null;
  if (entry.hasPassphrase === true && !passphraseHash) {
    return null;
  }
  const hasPassphrase = entry.hasPassphrase === true && Boolean(passphraseHash);

  return {
    id: entry.id,
    content: entry.content,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    burnAfterRead: entry.burnAfterRead === true,
    hasPassphrase,
    passphraseHash,
    firstReadAt: isValidDateString(entry.firstReadAt) ? entry.firstReadAt : null
  };
}

function normalizeFile(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  if (!isValidId(entry.id) || !isSafeStoredName(entry.storedName, entry.id)) {
    return null;
  }
  if (typeof entry.originalName !== "string" || entry.originalName.length === 0) {
    return null;
  }
  if (!Number.isFinite(entry.sizeBytes) || entry.sizeBytes < 0) {
    return null;
  }
  if (!isValidDateString(entry.createdAt) || !isValidDateString(entry.expiresAt)) {
    return null;
  }

  return {
    id: entry.id,
    originalName: sanitizeFileName(entry.originalName),
    storedName: entry.storedName,
    mimeType: typeof entry.mimeType === "string" && entry.mimeType.length > 0
      ? entry.mimeType
      : "application/octet-stream",
    sizeBytes: entry.sizeBytes,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    downloadCount: Number.isInteger(entry.downloadCount) && entry.downloadCount >= 0
      ? entry.downloadCount
      : 0
  };
}

function normalizeState(stored) {
  const defaults = cloneDefaultState();
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return { state: defaults, droppedPastes: 0, droppedFiles: 0 };
  }

  const live = stored.liveClipboard && typeof stored.liveClipboard === "object"
    ? stored.liveClipboard
    : {};
  const pastes = Array.isArray(stored.pastes) ? stored.pastes : [];
  const files = Array.isArray(stored.files) ? stored.files : [];

  const normalizedPastes = pastes.map(normalizePaste).filter(Boolean);
  const normalizedFiles = files.map(normalizeFile).filter(Boolean);

  return {
    state: {
      liveClipboard: {
        roomId: "main",
        content: typeof live.content === "string" ? live.content : "",
        updatedAt: isValidDateString(live.updatedAt) ? live.updatedAt : null
      },
      pastes: normalizedPastes,
      files: normalizedFiles
    },
    droppedPastes: pastes.length - normalizedPastes.length,
    droppedFiles: files.length - normalizedFiles.length
  };
}

async function fileExists(filePath, fileOps = fs) {
  try {
    await fileOps.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function moveFile(sourcePath, targetPath, fileOps = fs) {
  try {
    await fileOps.rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
    await fileOps.copyFile(sourcePath, targetPath);
    await fileOps.rm(sourcePath, { force: true });
  }
}

export async function createStorage(config) {
  const stateDir = config.stateDir;
  const uploadsDir = config.uploadsDir;
  const stateFile = config.stateFile;
  const tmpDir = config.tmpDir || path.join(path.dirname(uploadsDir), "tmp");
  const recentFilesLimit = config.recentFilesLimit || 10;

  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(uploadsDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(tmpDir, { recursive: true, mode: 0o700 });

  async function removeStaleTmpFiles() {
    try {
      const entries = await fs.readdir(tmpDir, { withFileTypes: true });
      await Promise.all(
        entries.map((entry) =>
          fs.rm(path.join(tmpDir, entry.name), { recursive: true, force: true }).catch(() => {})
        )
      );
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("Temporary directory cleanup failed:", error?.code || "error");
      }
    }
  }

  await removeStaleTmpFiles();

  let state = cloneDefaultState();
  let rawState = null;
  let droppedPastes = 0;
  let droppedFiles = 0;
  let needsPersist = false;

  try {
    rawState = await fs.readFile(stateFile, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(rawState);
    } catch {
      const parseError = new Error("STATE_PARSE");
      parseError.code = "STATE_PARSE";
      throw parseError;
    }
    const normalized = normalizeState(parsed);
    state = normalized.state;
    droppedPastes = normalized.droppedPastes;
    droppedFiles = normalized.droppedFiles;
    needsPersist = droppedPastes > 0 || droppedFiles > 0;
  } catch (error) {
    if (error?.code === "ENOENT") {
      state = cloneDefaultState();
      needsPersist = true;
    } else if (error?.code === "STATE_PARSE") {
      const backupFile = `${stateFile}.corrupt-${Date.now()}`;
      await fs.rename(stateFile, backupFile);
      console.warn(
        "State file was unreadable; moved to backup:",
        path.basename(backupFile),
        "code: STATE_PARSE"
      );
      state = cloneDefaultState();
      needsPersist = true;
    } else {
      throw error;
    }
  }

  if ((droppedPastes > 0 || droppedFiles > 0) && rawState !== null) {
    const invalidBackup = `${stateFile}.invalid-${Date.now()}`;
    await fs.writeFile(invalidBackup, rawState, { mode: 0o600 });
    console.warn(
      "Dropped invalid state entries; original copied to:",
      path.basename(invalidBackup),
      `pastes=${droppedPastes}`,
      `files=${droppedFiles}`
    );
  }

  let persistChain = Promise.resolve();

  async function writeStateFile() {
    const tempFile = `${stateFile}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    const serialized = JSON.stringify(state, null, 2);

    let handle;
    try {
      handle = await fs.open(tempFile, "w", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(tempFile, stateFile);
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
      }
      await fs.rm(tempFile, { force: true }).catch(() => {});
      throw error;
    }
  }

  function persist() {
    const result = persistChain.then(writeStateFile);
    persistChain = result.catch(() => {});
    return result;
  }

  function enqueueStateOperation(operation) {
    const result = persistChain.then(operation);
    persistChain = result.catch(() => {});
    return result;
  }

  async function pruneFiles() {
    const nextFiles = [];

    for (const file of state.files) {
      const target = resolveInside(uploadsDir, file.storedName);
      if (!target || isExpired(file.expiresAt) || !(await fileExists(target))) {
        if (target) {
          await fs.rm(target, { force: true }).catch(() => {});
        }
        continue;
      }
      nextFiles.push(file);
    }

    const overflow = nextFiles.slice(recentFilesLimit);
    for (const file of overflow) {
      const target = resolveInside(uploadsDir, file.storedName);
      if (target) {
        await fs.rm(target, { force: true }).catch(() => {});
      }
    }

    state.files = nextFiles.slice(0, recentFilesLimit);
  }

  const storage = {
    getLiveClipboard() {
      return { ...state.liveClipboard };
    },
    async setLiveClipboard(content) {
      state.liveClipboard = {
        roomId: "main",
        content,
        updatedAt: nowIso()
      };
      await persist();
      return storage.getLiveClipboard();
    },
    async createPaste(content, ttlHours, options = {}) {
      const passphrase = typeof options.passphrase === "string" && options.passphrase.length > 0
        ? options.passphrase
        : null;
      const paste = {
        id: createId(),
        content,
        createdAt: nowIso(),
        expiresAt: computeExpiresAt(ttlHours),
        burnAfterRead: options.burnAfterRead === true,
        hasPassphrase: Boolean(passphrase),
        passphraseHash: passphrase ? hashPassphrase(passphrase) : null,
        firstReadAt: null
      };
      state.pastes.unshift(paste);
      await persist();
      return publicPaste(paste);
    },
    async readPaste(id, { passphrase } = {}) {
      if (!isValidId(id)) {
        return { status: "not_found" };
      }

      return enqueueStateOperation(async () => {
        const index = state.pastes.findIndex((entry) => entry.id === id);
        if (index === -1) {
          return { status: "not_found" };
        }

        const paste = state.pastes[index];
        if (isExpired(paste.expiresAt)) {
          return { status: "not_found" };
        }

        if (paste.hasPassphrase) {
          if (typeof passphrase !== "string") {
            return { status: "passphrase_required" };
          }
          if (!verifyPassphraseHash(passphrase, paste.passphraseHash)) {
            return { status: "invalid_passphrase" };
          }
        }

        const view = publicPaste(paste);

        if (paste.burnAfterRead) {
          state.pastes.splice(index, 1);
          try {
            await writeStateFile();
          } catch (error) {
            state.pastes.splice(index, 0, paste);
            throw error;
          }
        }

        return { status: "ok", paste: view };
      });
    },
    async saveFile({ originalName, mimeType, sizeBytes, sourcePath, ttlHours }) {
      const id = createId();
      const safeName = sanitizeFileName(originalName);
      // Keep stored names free of ".." segments so validation on restart accepts them.
      const storedSafeName = safeName.replace(/\.\./g, "--");
      const storedName = `${id}-${storedSafeName}`;
      const targetPath = resolveInside(uploadsDir, storedName);

      if (!targetPath) {
        throw new Error("INVALID_STORED_NAME");
      }

      await moveFile(sourcePath, targetPath);

      const file = {
        id,
        originalName: safeName,
        storedName,
        mimeType: mimeType || "application/octet-stream",
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
        createdAt: nowIso(),
        expiresAt: computeExpiresAt(ttlHours),
        downloadCount: 0
      };

      state.files.unshift(file);

      try {
        await pruneFiles();
        await persist();
      } catch (error) {
        state.files = state.files.filter((entry) => entry.id !== id);
        await fs.rm(targetPath, { force: true }).catch(() => {});
        throw error;
      }

      return {
        ...file,
        filePath: targetPath
      };
    },
    getFile(id) {
      if (!isValidId(id)) {
        return null;
      }
      const file = state.files.find((entry) => entry.id === id);
      if (!file || isExpired(file.expiresAt)) {
        return null;
      }
      const filePath = resolveInside(uploadsDir, file.storedName);
      if (!filePath) {
        return null;
      }
      return {
        ...file,
        filePath
      };
    },
    getLatestFile() {
      const file = state.files.find((entry) => !isExpired(entry.expiresAt));
      if (!file) {
        return null;
      }
      const filePath = resolveInside(uploadsDir, file.storedName);
      if (!filePath) {
        return null;
      }
      return {
        ...file,
        filePath
      };
    },
    listRecentFiles(limit = recentFilesLimit) {
      return state.files
        .filter((entry) => !isExpired(entry.expiresAt))
        .slice(0, limit)
        .map((file) => {
          const filePath = resolveInside(uploadsDir, file.storedName);
          return filePath
            ? {
                ...file,
                filePath
              }
            : null;
        })
        .filter(Boolean);
    },
    async markFileDownloaded(id) {
      if (!isValidId(id)) {
        return;
      }
      const file = state.files.find((entry) => entry.id === id);
      if (!file) {
        return;
      }
      file.downloadCount = (Number.isInteger(file.downloadCount) ? file.downloadCount : 0) + 1;
      try {
        await persist();
      } catch (error) {
        console.warn("Download counter persistence failed:", error?.code || "error");
      }
    },
    async cleanupExpired() {
      state.pastes = state.pastes.filter((paste) => !isExpired(paste.expiresAt));
      await pruneFiles();
      await persist();
    },
    getSummary() {
      return {
        pastes: state.pastes.filter((paste) => !isExpired(paste.expiresAt)).length,
        files: state.files.filter((file) => !isExpired(file.expiresAt)).length
      };
    }
  };

  await storage.cleanupExpired();
  if (needsPersist) {
    await persist();
  }

  return storage;
}

export { sanitizeFileName, isExpired, moveFile, isSafeStoredName, resolveInside, normalizeState };