import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createAuth, getRequestIp, isSecureRequest } from "./auth.js";

const DEFAULT_MAX_UPLOAD_MB = 50;
const DEFAULT_LIVE_CONTENT_LIMIT = 100000;
const DEFAULT_PASTE_CONTENT_LIMIT = 524288;
const DEFAULT_MAX_SSE_CLIENTS = 100;
const DEFAULT_SSE_HEARTBEAT_MS = 25000;
const DEFAULT_SSE_IDLE_TIMEOUT_MS = 300000;
const MAX_SSE_BUFFERED_BYTES = 1024 * 1024;
const MAX_MULTIPART_OVERHEAD = 64 * 1024;

const SSE_HEARTBEAT_FRAME = ": keep-alive\n\n";

const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function json(res, statusCode, payload) {
  if (res.headersSent || res.writableEnded || res.destroyed) {
    if (!res.writableEnded && !res.destroyed) {
      res.destroy();
    }
    return;
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function applySecurityHeaders(req, res, isPublicMode) {
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Accel-Buffering", "no");

  if (isPublicMode) {
    res.setHeader("Content-Security-Policy", CSP_VALUE);
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (isSecureRequest(req)) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  }
}

async function sendFile(res, filePath, contentType) {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
  } catch {
    json(res, 404, { error: "Not found" });
    return;
  }

  let stream;
  try {
    stream = fs.createReadStream(filePath);
  } catch {
    json(res, 404, { error: "Not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  try {
    await pipeline(stream, res);
  } catch (error) {
    console.warn("Static file stream failed:", error?.code || "stream_error");
    res.destroy();
  }
}

function invalidBodyError() {
  const error = new Error("INVALID_BODY");
  error.code = "INVALID_BODY";
  return error;
}

async function readJsonBody(req, limitBytes) {
  let received = 0;
  const chunks = [];

  for await (const chunk of req) {
    received += chunk.length;
    if (received > limitBytes) {
      const error = new Error("BODY_TOO_LARGE");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) {
    return {};
  }

  const parsed = JSON.parse(body);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidBodyError();
  }
  return parsed;
}

function getRequestUrl(req) {
  return new URL(req.url, "http://localhost");
}

function sseMessage(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function getMimeType(fileName) {
  if (fileName.endsWith(".html")) return "text/html; charset=utf-8";
  if (fileName.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (fileName.endsWith(".css")) return "text/css; charset=utf-8";
  if (fileName.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (fileName.endsWith(".json")) return "application/json";
  if (fileName.endsWith(".webmanifest")) return "application/manifest+json";
  if (fileName.endsWith(".svg")) return "image/svg+xml";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  if (fileName.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function decodeHeaderFileName(value) {
  if (!value) {
    return "upload.bin";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serializeFile(file) {
  return {
    id: file.id,
    fileName: file.originalName,
    sizeBytes: file.sizeBytes,
    expiresAt: file.expiresAt,
    downloadUrl: `/api/files/${file.id}/download`
  };
}

function serializeFiles(files) {
  return files.map((file) => serializeFile(file));
}

function encodeRfc5987(value) {
  return encodeURIComponent(String(value || "download.bin")).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function contentDisposition(fileName) {
  const fallbackName = String(fileName || "download.bin")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 120) || "download.bin";
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}

class UploadLimitStream extends Transform {
  constructor(limitBytes) {
    super();
    this.limitBytes = limitBytes;
    this.receivedBytes = 0;
  }

  _transform(chunk, encoding, callback) {
    this.receivedBytes += chunk.length;
    if (this.receivedBytes > this.limitBytes) {
      const error = new Error("FILE_TOO_LARGE");
      error.code = "FILE_TOO_LARGE";
      callback(error);
      return;
    }
    callback(null, chunk);
  }
}

function getMultipartBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return (match?.[1] || match?.[2] || "").trim();
}

function decodeMultipartFilename(headerText) {
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\r\n]+)/i.exec(headerText);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      /* fall through to the plain filename */
    }
  }

  const quoted = /filename\s*=\s*"([^"]*)"/i.exec(headerText);
  const plain = quoted ? quoted[1] : (/filename\s*=\s*([^;\r\n]+)/i.exec(headerText)?.[1] || "").trim();
  if (!plain) {
    return "";
  }
  if (plain.includes("%")) {
    try {
      return decodeURIComponent(plain);
    } catch {
      return plain;
    }
  }
  return plain;
}

class MultipartFileParser extends Transform {
  constructor({ boundary, maxFileBytes }) {
    super();
    this.boundary = Buffer.from(`--${boundary}`);
    this.delimiter = Buffer.from(`\r\n--${boundary}`);
    this.maxFileBytes = maxFileBytes;
    this.buffer = Buffer.alloc(0);
    this.state = "preamble";
    this.fileName = "upload.bin";
    this.fileBytes = 0;
    this.finished = false;
  }

  _transform(chunk, encoding, callback) {
    if (this.finished) {
      callback();
      return;
    }
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      this.drain();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      if (!this.finished && this.state === "body" && this.buffer.length > 0) {
        this.emitFile(this.buffer);
        this.buffer = Buffer.alloc(0);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }

  emitFile(chunk) {
    if (chunk.length === 0) {
      return;
    }
    this.fileBytes += chunk.length;
    if (this.fileBytes > this.maxFileBytes) {
      const error = new Error("FILE_TOO_LARGE");
      error.code = "FILE_TOO_LARGE";
      throw error;
    }
    this.push(chunk);
  }

  drain() {
    if (this.state === "preamble") {
      const index = this.buffer.indexOf(this.boundary);
      if (index === -1) {
        if (this.buffer.length > 16 * 1024) {
          throw new Error("INVALID_MULTIPART");
        }
        return;
      }
      this.buffer = this.buffer.slice(index + this.boundary.length);
      if (this.buffer.length >= 2 && this.buffer[0] === 13 && this.buffer[1] === 10) {
        this.buffer = this.buffer.slice(2);
      }
      this.state = "headers";
    }

    if (this.state === "headers") {
      const index = this.buffer.indexOf("\r\n\r\n");
      if (index === -1) {
        if (this.buffer.length > 16 * 1024) {
          throw new Error("INVALID_MULTIPART");
        }
        return;
      }
      const headerText = this.buffer.slice(0, index).toString("utf8");
      this.buffer = this.buffer.slice(index + 4);
      this.fileName = decodeMultipartFilename(headerText) || this.fileName;
      this.state = "body";
    }

    if (this.state === "body") {
      const index = this.buffer.indexOf(this.delimiter);
      if (index === -1) {
        const safeLength = Math.max(0, this.buffer.length - this.delimiter.length);
        if (safeLength > 0) {
          this.emitFile(this.buffer.slice(0, safeLength));
          this.buffer = this.buffer.slice(safeLength);
        }
        return;
      }
      if (index > 0) {
        this.emitFile(this.buffer.slice(0, index));
      }
      this.buffer = this.buffer.slice(index + this.delimiter.length);
      this.finished = true;
    }
  }
}

export function createApp({ config, storage }) {
  const auth = createAuth({ config });
  const isPublicMode = auth.isPublicMode;
  const clients = new Map();

  const maxUploadBytes = positiveInt(config.maxUploadMb, DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
  const liveContentLimit = positiveInt(config.liveContentLimit, DEFAULT_LIVE_CONTENT_LIMIT);
  const pasteContentLimit = positiveInt(config.pasteContentLimit, DEFAULT_PASTE_CONTENT_LIMIT);
  const pasteTtlHours = positiveInt(config.pasteTtlHours, 24);
  const pasteTtlMaxHours = positiveInt(config.pasteTtlMaxHours, 168);
  const maxPastePassphraseLen = positiveInt(config.maxPastePassphraseLen, 128);
  const revealRateLimit = positiveInt(config.revealRateLimit, 5);
  const revealRateWindowMs = positiveInt(config.revealRateWindowMs, 60000);
  const trustProxy = config.trustProxy === true;
  const fileTtlHours = positiveInt(config.fileTtlHours, 24);
  const maxSseClients = positiveInt(config.maxSseClients, DEFAULT_MAX_SSE_CLIENTS);
  const sseHeartbeatMs = positiveInt(config.sseHeartbeatMs, DEFAULT_SSE_HEARTBEAT_MS);
  const sseIdleTimeoutMs = positiveInt(config.sseIdleTimeoutMs, DEFAULT_SSE_IDLE_TIMEOUT_MS);
  const tmpDir = config.tmpDir || path.join(path.dirname(config.uploadsDir), "tmp");

  const revealFailures = new Map();

  function pruneRevealFailures() {
    const now = Date.now();
    for (const [key, timestamps] of revealFailures) {
      const recent = timestamps.filter((timestamp) => now - timestamp < revealRateWindowMs);
      if (recent.length > 0) {
        revealFailures.set(key, recent);
      } else {
        revealFailures.delete(key);
      }
    }
  }

  function revealBucketKey(req, pasteId) {
    const ip = getRequestIp(req, trustProxy);
    return `${ip}\u0000${pasteId}`;
  }

  function isRevealLimited(key) {
    pruneRevealFailures();
    return (revealFailures.get(key) || []).length >= revealRateLimit;
  }

  function recordRevealFailure(key) {
    const failures = revealFailures.get(key) || [];
    failures.push(Date.now());
    revealFailures.set(key, failures);
  }

  function clearRevealFailures(key) {
    revealFailures.delete(key);
  }

  const revealCleanupTimer = setInterval(
    pruneRevealFailures,
    Math.min(60000, Math.max(1000, revealRateWindowMs))
  );
  revealCleanupTimer.unref?.();

  const liveBodyLimit = Math.max(4096, Math.min(8 * 1024 * 1024, liveContentLimit * 6 + 8192));
  const pasteBodyLimit = Math.max(4096, Math.min(8 * 1024 * 1024, pasteContentLimit * 6 + 8192));

  function removeClient(res) {
    const meta = clients.get(res);
    if (meta?.heartbeat) {
      clearTimeout(meta.heartbeat);
    }
    clients.delete(res);
  }

  function writeClient(res, payload) {
    if (res.destroyed || res.writableEnded) {
      removeClient(res);
      return false;
    }
    if (res.writableLength > MAX_SSE_BUFFERED_BYTES) {
      removeClient(res);
      res.destroy();
      return false;
    }
    try {
      res.write(payload);
      return true;
    } catch (error) {
      console.warn("SSE write failed:", error?.code || "stream_error");
      removeClient(res);
      res.destroy();
      return false;
    }
  }

  function broadcastEvent(message) {
    const payload = sseMessage(message);
    for (const res of clients.keys()) {
      writeClient(res, payload);
    }
  }

  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [res, meta] of clients) {
      if (now - meta.lastActivity > sseIdleTimeoutMs) {
        console.warn("SSE idle timeout reached");
        removeClient(res);
        res.end();
        continue;
      }
      if (writeClient(res, SSE_HEARTBEAT_FRAME)) {
        meta.lastActivity = now;
      }
    }
  }, sseHeartbeatMs);
  heartbeatTimer.unref?.();

  async function handleStatic(res, url) {
    const isRootLike = url.pathname === "/" || url.pathname.startsWith("/p/");
    const publicFile = isRootLike ? "index.html" : url.pathname.slice(1);
    const filePath = path.join(process.cwd(), "public", publicFile);

    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        json(res, 404, { error: "Not found" });
        return;
      }
      await sendFile(res, filePath, getMimeType(filePath));
    } catch {
      json(res, 404, { error: "Not found" });
    }
  }

  async function handleMultipartUpload(req, res, boundary) {
    await fsp.mkdir(tmpDir, { recursive: true, mode: 0o700 });
    const tempPath = path.join(
      tmpDir,
      `upload-${crypto.randomBytes(16).toString("hex")}.tmp`
    );

    const sink = fs.createWriteStream(tempPath, { flags: "wx", mode: 0o600 });
    const limiter = new UploadLimitStream(maxUploadBytes + MAX_MULTIPART_OVERHEAD);
    const parser = new MultipartFileParser({ boundary, maxFileBytes: maxUploadBytes });

    try {
      await pipeline(req, limiter, parser, sink);
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    let file;
    try {
      file = await storage.saveFile({
        originalName: parser.fileName || "upload.bin",
        mimeType: "application/octet-stream",
        sizeBytes: parser.fileBytes,
        sourcePath: tempPath,
        ttlHours: fileTtlHours
      });
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    json(res, 201, {
      id: file.id,
      fileName: file.originalName,
      downloadUrl: `/api/files/${file.id}/download`,
      expiresAt: file.expiresAt,
      sizeBytes: file.sizeBytes
    });
    return file;
  }

  async function handleFileUpload(req, res) {
    const rawFileName = req.headers["x-file-name"];
    const fileName = decodeHeaderFileName(Array.isArray(rawFileName) ? rawFileName[0] : rawFileName);
    const contentType = req.headers["content-type"] || "application/octet-stream";
    const isMultipart = contentType.toLowerCase().startsWith("multipart/form-data");
    const contentLength = Number.parseInt(req.headers["content-length"] || "0", 10);
    const earlyLimit = isMultipart ? maxUploadBytes + MAX_MULTIPART_OVERHEAD : maxUploadBytes;

    if (Number.isFinite(contentLength) && contentLength > earlyLimit) {
      json(res, 413, { error: `File is larger than ${config.maxUploadMb || DEFAULT_MAX_UPLOAD_MB} MB.` });
      return null;
    }

    if (isMultipart) {
      const boundary = getMultipartBoundary(contentType);
      if (!boundary) {
        json(res, 400, { error: "Invalid multipart body." });
        return null;
      }
      return handleMultipartUpload(req, res, boundary);
    }

    await fsp.mkdir(tmpDir, { recursive: true, mode: 0o700 });
    const tempPath = path.join(
      tmpDir,
      `upload-${crypto.randomBytes(16).toString("hex")}.tmp`
    );

    const sink = fs.createWriteStream(tempPath, { flags: "wx", mode: 0o600 });
    const limiter = new UploadLimitStream(maxUploadBytes);

    try {
      await pipeline(req, limiter, sink);
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    let file;
    try {
      file = await storage.saveFile({
        originalName: fileName,
        mimeType: contentType,
        sizeBytes: limiter.receivedBytes,
        sourcePath: tempPath,
        ttlHours: fileTtlHours
      });
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    json(res, 201, {
      id: file.id,
      fileName: file.originalName,
      downloadUrl: `/api/files/${file.id}/download`,
      expiresAt: file.expiresAt,
      sizeBytes: file.sizeBytes
    });
    return file;
  }

  const server = http.createServer(async (req, res) => {
    applySecurityHeaders(req, res, isPublicMode);

    let url;
    try {
      url = getRequestUrl(req);
    } catch {
      json(res, 400, { error: "Bad request" });
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, {
          status: "ok",
          service: "clipclip",
          version: "0.1.0",
          publicMode: isPublicMode,
          needsAuth: isPublicMode
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/login") {
        if (!auth.isPublicMode) {
          auth.loginHandler(req, res, url, {});
          return;
        }
        const body = await readJsonBody(req, 4096);
        auth.loginHandler(req, res, url, body);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/logout") {
        auth.logoutHandler(req, res, url);
        return;
      }

      if (auth.middleware(req, res, url)) {
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/live") {
        json(res, 200, storage.getLiveClipboard());
        return;
      }

      if (req.method === "PUT" && url.pathname === "/api/live") {
        const body = await readJsonBody(req, liveBodyLimit);
        if (typeof body.content !== "string") {
          json(res, 400, { error: "Clipboard content is required." });
          return;
        }
        if (Buffer.byteLength(body.content, "utf8") > liveContentLimit) {
          json(res, 413, { error: "Clipboard content is too large." });
          return;
        }
        const live = await storage.setLiveClipboard(body.content);
        broadcastEvent({ type: "live:updated", ...live });
        json(res, 200, live);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/events") {
        if (clients.size >= maxSseClients) {
          json(res, 503, { error: "Too many connections" });
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });

        const meta = { lastActivity: Date.now() };
        clients.set(res, meta);
        res.on("close", () => removeClient(res));
        res.on("error", (error) => {
          console.warn("SSE response error:", error?.code || "stream_error");
          removeClient(res);
        });

        if (!writeClient(res, sseMessage({ type: "live:snapshot", ...storage.getLiveClipboard() }))) {
          return;
        }
        if (!writeClient(res, sseMessage({ type: "files:snapshot", files: serializeFiles(storage.listRecentFiles()) }))) {
          return;
        }
        req.on("close", () => removeClient(res));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/pastes") {
        const body = await readJsonBody(req, pasteBodyLimit);
        if (typeof body.content !== "string" || body.content.length === 0) {
          json(res, 400, { error: "Paste content is required." });
          return;
        }
        if (Buffer.byteLength(body.content, "utf8") > pasteContentLimit) {
          json(res, 413, { error: "Paste content is too large." });
          return;
        }

        if (body.burnAfterRead !== undefined && typeof body.burnAfterRead !== "boolean") {
          json(res, 400, { error: "burnAfterRead must be a boolean." });
          return;
        }

        let passphrase = null;
        if (body.passphrase !== undefined) {
          if (typeof body.passphrase !== "string") {
            json(res, 400, { error: "Passphrase must be a string." });
            return;
          }
          const passphraseLength = [...body.passphrase].length;
          if (passphraseLength < 1 || passphraseLength > maxPastePassphraseLen) {
            json(res, 400, { error: "Passphrase length is invalid." });
            return;
          }
          passphrase = body.passphrase;
        }

        let ttlHours = pasteTtlHours;
        if (body.expiresInHours !== undefined) {
          const requested = Number(body.expiresInHours);
          if (!Number.isFinite(requested) || requested <= 0 || requested > pasteTtlMaxHours) {
            json(res, 400, { error: "Invalid expiresInHours." });
            return;
          }
          ttlHours = requested;
        }

        const paste = await storage.createPaste(body.content, ttlHours, {
          burnAfterRead: body.burnAfterRead === true,
          passphrase
        });
        json(res, 201, {
          id: paste.id,
          url: `/p/${paste.id}`,
          expiresAt: paste.expiresAt,
          burnAfterRead: paste.burnAfterRead,
          hasPassphrase: paste.hasPassphrase
        });
        return;
      }

      const revealMatch = /^\/api\/pastes\/([A-Za-z0-9_-]+)\/reveal$/.exec(url.pathname);
      if (req.method === "POST" && revealMatch) {
        const bucketKey = revealBucketKey(req, revealMatch[1]);
        if (isRevealLimited(bucketKey)) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil(revealRateWindowMs / 1000))));
          json(res, 429, { error: "Too many attempts" });
          return;
        }

        const body = await readJsonBody(req, 4096);
        const passphrase = typeof body.passphrase === "string" ? body.passphrase : null;
        const result = await storage.readPaste(revealMatch[1], { passphrase });
        if (result.status === "not_found") {
          clearRevealFailures(bucketKey);
          json(res, 404, { error: "Paste not found." });
          return;
        }
        if (result.status !== "ok") {
          recordRevealFailure(bucketKey);
          json(res, 403, { error: "Invalid passphrase" });
          return;
        }
        clearRevealFailures(bucketKey);
        json(res, 200, result.paste);
        return;
      }

      const pasteMatch = /^\/api\/pastes\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if (req.method === "GET" && pasteMatch) {
        const result = await storage.readPaste(pasteMatch[1]);
        if (result.status === "not_found") {
          json(res, 404, { error: "Paste not found." });
          return;
        }
        if (result.status !== "ok") {
          json(res, 403, { error: "Passphrase required" });
          return;
        }
        json(res, 200, result.paste);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/files") {
        const file = await handleFileUpload(req, res);
        if (!file) {
          return;
        }
        broadcastEvent({
          type: "files:updated",
          latest: serializeFile(file),
          files: serializeFiles(storage.listRecentFiles())
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/files/latest") {
        const file = storage.getLatestFile();
        if (!file) {
          json(res, 404, { error: "File not found." });
          return;
        }
        json(res, 200, serializeFile(file));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/files/recent") {
        json(res, 200, {
          files: serializeFiles(storage.listRecentFiles())
        });
        return;
      }

      const fileMatch = /^\/api\/files\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if (req.method === "GET" && fileMatch) {
        const file = storage.getFile(fileMatch[1]);
        if (!file) {
          json(res, 404, { error: "File not found." });
          return;
        }
        json(res, 200, serializeFile(file));
        return;
      }

      const downloadMatch = /^\/api\/files\/([A-Za-z0-9_-]+)\/download$/.exec(url.pathname);
      if (req.method === "GET" && downloadMatch) {
        const file = storage.getFile(downloadMatch[1]);
        if (!file) {
          json(res, 404, { error: "File not found." });
          return;
        }

        try {
          await fsp.access(file.filePath, fs.constants.R_OK);
        } catch {
          json(res, 404, { error: "File not found." });
          return;
        }

        void storage.markFileDownloaded(file.id).catch((error) => {
          console.warn("Download counter update failed:", error?.code || "error");
        });

        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": contentDisposition(file.originalName),
          "Content-Length": file.sizeBytes,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        });

        try {
          await pipeline(fs.createReadStream(file.filePath), res);
        } catch (error) {
          console.warn("File download stream failed:", error?.code || "stream_error");
          res.destroy();
        }
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        await handleStatic(res, url);
        return;
      }

      res.setHeader("Allow", "GET, HEAD, POST, PUT");
      json(res, 405, { error: "Method not allowed." });
    } catch (error) {
      if (error?.code === "BODY_TOO_LARGE" || error?.code === "FILE_TOO_LARGE") {
        json(res, 413, { error: "Payload too large." });
        return;
      }
      if (error?.code === "INVALID_BODY" || error instanceof SyntaxError) {
        json(res, 400, { error: "Invalid JSON body." });
        return;
      }
      if (error?.code === "INVALID_MULTIPART" || error?.message === "INVALID_MULTIPART") {
        json(res, 400, { error: "Invalid multipart body." });
        return;
      }
      console.error("Request failed:", error?.code || error?.name || "error");
      json(res, 500, { error: "Internal server error." });
    }
  });

  server.on("clientError", (error, socket) => {
    console.warn("HTTP client error:", error?.code || "client_error");
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    }
  });

  server.on("close", () => {
    clearInterval(heartbeatTimer);
    clearInterval(revealCleanupTimer);
    auth.dispose();
    for (const res of clients.keys()) {
      removeClient(res);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  return server;
}