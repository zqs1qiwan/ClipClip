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
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now();
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
  await fs.mkdir(config.stateDir, { recursive: true });
  await fs.mkdir(config.uploadsDir, { recursive: true });
  const recentFilesLimit = config.recentFilesLimit || 10;

  let state = cloneDefaultState();

  async function persist() {
    const tempFile = `${config.stateFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
    await fs.rename(tempFile, config.stateFile);
  }

  try {
    const stored = JSON.parse(await fs.readFile(config.stateFile, "utf8"));
    state = {
      ...cloneDefaultState(),
      ...stored,
      liveClipboard: {
        ...cloneDefaultState().liveClipboard,
        ...(stored.liveClipboard || {})
      },
      pastes: Array.isArray(stored.pastes) ? stored.pastes : [],
      files: Array.isArray(stored.files) ? stored.files : []
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await persist();
  }

  async function pruneFiles() {
    const nextFiles = [];

    for (const file of state.files) {
      const filePath = path.join(config.uploadsDir, file.storedName);
      if (isExpired(file.expiresAt) || !(await fileExists(filePath))) {
        await fs.rm(filePath, { force: true });
        continue;
      }
      nextFiles.push(file);
    }

    const overflow = nextFiles.slice(recentFilesLimit);
    for (const file of overflow) {
      await fs.rm(path.join(config.uploadsDir, file.storedName), { force: true });
    }

    state.files = nextFiles.slice(0, recentFilesLimit);
  }

  return {
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
      return this.getLiveClipboard();
    },
    async createPaste(content, ttlHours) {
      const paste = {
        id: createId(),
        content,
        createdAt: nowIso(),
        expiresAt: computeExpiresAt(ttlHours),
        burnAfterRead: false,
        firstReadAt: null
      };
      state.pastes.unshift(paste);
      await persist();
      return { ...paste };
    },
    getPaste(id) {
      const paste = state.pastes.find((entry) => entry.id === id);
      if (!paste || isExpired(paste.expiresAt)) {
        return null;
      }
      return { ...paste };
    },
    async saveFile({ originalName, mimeType, sizeBytes, sourcePath, ttlHours }) {
      const id = createId();
      const safeName = sanitizeFileName(originalName);
      const storedName = `${id}-${safeName}`;
      const targetPath = path.join(config.uploadsDir, storedName);

      await moveFile(sourcePath, targetPath);

      const file = {
        id,
        originalName: safeName,
        storedName,
        mimeType: mimeType || "application/octet-stream",
        sizeBytes,
        createdAt: nowIso(),
        expiresAt: computeExpiresAt(ttlHours),
        downloadCount: 0
      };

      state.files.unshift(file);
      await pruneFiles();
      await persist();
      return {
        ...file,
        filePath: targetPath
      };
    },
    getFile(id) {
      const file = state.files.find((entry) => entry.id === id);
      if (!file || isExpired(file.expiresAt)) {
        return null;
      }
      return {
        ...file,
        filePath: path.join(config.uploadsDir, file.storedName)
      };
    },
    getLatestFile() {
      const file = state.files[0];
      if (!file) {
        return null;
      }
      return {
        ...file,
        filePath: path.join(config.uploadsDir, file.storedName)
      };
    },
    listRecentFiles(limit = recentFilesLimit) {
      return state.files.slice(0, limit).map((file) => ({
        ...file,
        filePath: path.join(config.uploadsDir, file.storedName)
      }));
    },
    async markFileDownloaded(id) {
      const file = state.files.find((entry) => entry.id === id);
      if (!file) {
        return;
      }
      file.downloadCount += 1;
      await persist();
    },
    async cleanupExpired() {
      state.pastes = state.pastes.filter((paste) => !isExpired(paste.expiresAt));
      await pruneFiles();
      await persist();
    },
    getSummary() {
      return {
        pastes: state.pastes.filter((paste) => !isExpired(paste.expiresAt)).length,
        files: state.files.length
      };
    }
  };
}

export { sanitizeFileName, isExpired, moveFile };
