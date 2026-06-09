import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath, contentType) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(res);
}

async function readJsonBody(req, limitBytes) {
  let received = 0;
  const chunks = [];

  for await (const chunk of req) {
    received += chunk.length;
    if (received > limitBytes) {
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
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
  if (fileName.endsWith(".json")) return "application/json; charset=utf-8";
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

class UploadLimitStream extends Transform {
  constructor(limitBytes) {
    super();
    this.limitBytes = limitBytes;
    this.receivedBytes = 0;
  }

  _transform(chunk, encoding, callback) {
    this.receivedBytes += chunk.length;
    if (this.receivedBytes > this.limitBytes) {
      callback(new Error("FILE_TOO_LARGE"));
      return;
    }
    callback(null, chunk);
  }
}

export function createApp({ config, storage }) {
  const clients = new Set();

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
      sendFile(res, filePath, getMimeType(filePath));
    } catch {
      json(res, 404, { error: "Not found" });
    }
  }

  async function handleFileUpload(req, res) {
    const rawFileName = req.headers["x-file-name"];
    const fileName = decodeHeaderFileName(Array.isArray(rawFileName) ? rawFileName[0] : rawFileName);
    const mimeType = req.headers["content-type"] || "application/octet-stream";
    const maxUploadBytes = config.maxUploadMb * 1024 * 1024;
    const contentLength = Number.parseInt(req.headers["content-length"] || "0", 10);

    if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
      json(res, 413, { error: `File is larger than ${config.maxUploadMb} MB.` });
      return;
    }

    const tempPath = path.join(
      os.tmpdir(),
      `clipclip-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const sink = fs.createWriteStream(tempPath);
    const limiter = new UploadLimitStream(maxUploadBytes);

    try {
      await pipeline(req, limiter, sink);
    } catch (error) {
      await fsp.rm(tempPath, { force: true });
      throw error;
    }

    const file = await storage.saveFile({
      originalName: fileName,
      mimeType,
      sizeBytes: limiter.receivedBytes,
      sourcePath: tempPath,
      ttlHours: config.fileTtlHours
    });

    json(res, 201, {
      id: file.id,
      fileName: file.originalName,
      downloadUrl: `/api/files/${file.id}/download`,
      expiresAt: file.expiresAt,
      sizeBytes: file.sizeBytes
    });
    return file;
  }

  function broadcastEvent(message) {
    const payload = sseMessage(message);
    for (const client of clients) {
      client.write(payload);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = getRequestUrl(req);

    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");

    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, {
          status: "ok",
          service: "clipclip",
          version: "0.1.0",
          storage: storage.getSummary()
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/live") {
        json(res, 200, storage.getLiveClipboard());
        return;
      }

      if (req.method === "PUT" && url.pathname === "/api/live") {
        const body = await readJsonBody(req, config.liveContentLimit + 4096);
        const content = typeof body.content === "string" ? body.content : "";
        if (Buffer.byteLength(content, "utf8") > config.liveContentLimit) {
          json(res, 413, { error: "Clipboard content is too large." });
          return;
        }
        const live = await storage.setLiveClipboard(content);
        broadcastEvent({ type: "live:updated", ...live });
        json(res, 200, live);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive"
        });
        res.write(sseMessage({ type: "live:snapshot", ...storage.getLiveClipboard() }));
        const latestFile = storage.getLatestFile();
        if (latestFile) {
          res.write(sseMessage({ type: "file:snapshot", ...serializeFile(latestFile) }));
        }
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/pastes") {
        const body = await readJsonBody(req, 524288);
        if (typeof body.content !== "string" || body.content.length === 0) {
          json(res, 400, { error: "Paste content is required." });
          return;
        }
        const paste = await storage.createPaste(body.content, config.pasteTtlHours);
        json(res, 201, {
          id: paste.id,
          url: `/p/${paste.id}`,
          expiresAt: paste.expiresAt
        });
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/pastes/")) {
        const id = url.pathname.split("/").pop();
        const paste = storage.getPaste(id);
        if (!paste) {
          json(res, 404, { error: "Paste not found." });
          return;
        }
        json(res, 200, paste);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/files") {
        const file = await handleFileUpload(req, res);
        broadcastEvent({ type: "file:updated", ...serializeFile(file) });
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

      if (req.method === "GET" && /^\/api\/files\/[^/]+$/.test(url.pathname)) {
        const id = url.pathname.split("/").pop();
        const file = storage.getFile(id);
        if (!file) {
          json(res, 404, { error: "File not found." });
          return;
        }
        json(res, 200, serializeFile(file));
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/files/") && url.pathname.endsWith("/download")) {
        const parts = url.pathname.split("/");
        const id = parts[3];
        const file = storage.getFile(id);
        if (!file) {
          json(res, 404, { error: "File not found." });
          return;
        }
        await storage.markFileDownloaded(id);
        res.writeHead(200, {
          "Content-Type": file.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
          "Content-Length": file.sizeBytes,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(file.filePath).pipe(res);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        await handleStatic(res, url);
        return;
      }

      json(res, 405, { error: "Method not allowed." });
    } catch (error) {
      if (error.message === "BODY_TOO_LARGE" || error.message === "FILE_TOO_LARGE") {
        json(res, 413, { error: "Payload too large." });
        return;
      }
      if (error instanceof SyntaxError) {
        json(res, 400, { error: "Invalid JSON body." });
        return;
      }
      console.error(error);
      json(res, 500, { error: "Internal server error." });
    }
  });

  return server;
}
