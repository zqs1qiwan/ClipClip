import crypto from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

const COOKIE_NAME = "clipclip_session";
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 60 * 1000;
const MAX_XFF_LENGTH = 64;
const MAX_TOKEN_LENGTH = 4096;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  if (res.headersSent || res.writableEnded || res.destroyed) {
    if (!res.writableEnded && !res.destroyed) {
      res.destroy();
    }
    return;
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function parseCookie(headerValue, name) {
  if (typeof headerValue !== "string") {
    return null;
  }

  for (const part of headerValue.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }

  return null;
}

function normalizeForwardedIp(value) {
  if (typeof value !== "string") {
    return "";
  }

  let candidate = value.trim();
  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  }
  if (candidate.length === 0 || candidate.length > MAX_XFF_LENGTH) {
    return "";
  }
  if (!/^[0-9A-Fa-f:.]+$/.test(candidate)) {
    return "";
  }
  if (!isIPv4(candidate) && !isIPv6(candidate)) {
    return "";
  }
  return candidate;
}

export function getRequestIp(req, trustProxy) {
  if (trustProxy) {
    const header = req.headers["x-forwarded-for"];
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw === "string") {
      const leftmost = raw.split(",").map((entry) => entry.trim()).find(Boolean);
      const forwarded = normalizeForwardedIp(leftmost);
      if (forwarded) {
        return forwarded;
      }
    }
  }

  return req.socket?.remoteAddress || "unknown";
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return typeof value === "string" ? value.split(",")[0].trim() : "";
}

export function isSecureRequest(req) {
  if (req.socket?.encrypted === true) {
    return true;
  }
  return firstHeaderValue(req.headers["x-forwarded-proto"]).toLowerCase() === "https";
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest();
}

function constantTimeEqual(leftValue, rightValue) {
  // Hash both values to fixed-length digests first, then compare without
  // leaking length or early-exit information.
  return crypto.timingSafeEqual(sha256(leftValue), sha256(rightValue));
}

function sessionCookie(token, ttlMs, secure) {
  const maxAge = Math.max(0, Math.floor(ttlMs / 1000));
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function createAuth({ config = {} } = {}) {
  const accessToken = typeof config.accessToken === "string" ? config.accessToken : "";
  const isPublicMode = accessToken.length > 0;
  const trustProxy = config.trustProxy === true;
  const sessionTtlMs =
    Number.isFinite(config.sessionTtlMs) && config.sessionTtlMs > 0
      ? Math.floor(config.sessionTtlMs)
      : DEFAULT_SESSION_TTL_MS;

  const sessions = new Map();
  const loginFailures = new Map();

  function pruneSessions() {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (!session || session.expiresAt <= now) {
        sessions.delete(token);
      }
    }
  }

  function pruneLoginFailures() {
    const now = Date.now();
    for (const [ip, timestamps] of loginFailures) {
      const recent = timestamps.filter((timestamp) => now - timestamp < LOGIN_RATE_WINDOW_MS);
      if (recent.length > 0) {
        loginFailures.set(ip, recent);
      } else {
        loginFailures.delete(ip);
      }
    }
  }

  const cleanupTimer = setInterval(() => {
    pruneSessions();
    pruneLoginFailures();
  }, 60 * 1000);
  cleanupTimer.unref?.();

  function sessionTokenFromRequest(req) {
    const cookieToken = parseCookie(req.headers.cookie, COOKIE_NAME);
    if (cookieToken && sessions.has(cookieToken)) {
      pruneSessions();
      if (sessions.has(cookieToken)) {
        return cookieToken;
      }
    }

    const authorization = req.headers.authorization;
    const match = typeof authorization === "string" ? /^Bearer\s+(.+)$/i.exec(authorization) : null;
    if (match) {
      const bearerToken = match[1].trim();
      if (sessions.has(bearerToken)) {
        return bearerToken;
      }
      if (isPublicMode && constantTimeEqual(bearerToken, accessToken)) {
        return bearerToken;
      }
    }

    return null;
  }

  function middleware(req, res, url) {
    if (!isPublicMode) {
      return false;
    }

    pruneSessions();
    pruneLoginFailures();

    const pathname = url?.pathname || "";
    const isApiPath = pathname === "/api" || pathname.startsWith("/api/");

    // Static assets and SPA shell do not contain sensitive data. Public mode
    // protects API data endpoints only; this keeps index.html/login view
    // reachable without a session.
    if (!isApiPath) {
      return false;
    }

    if (
      pathname === "/api/health" ||
      pathname === "/api/login" ||
      pathname === "/api/logout"
    ) {
      return false;
    }

    if (sessionTokenFromRequest(req)) {
      return false;
    }

    sendJson(res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": "Bearer" });
    return true;
  }

  function loginHandler(req, res, _url, body = {}) {
    if (!isPublicMode) {
      sendJson(res, 200, { ok: true });
      return;
    }

    pruneSessions();
    pruneLoginFailures();

    const ip = getRequestIp(req, trustProxy && isPublicMode);
    const recentFailures = loginFailures.get(ip) || [];
    if (recentFailures.length >= LOGIN_RATE_LIMIT) {
      sendJson(res, 429, { error: "Too many attempts" }, { "Retry-After": "60" });
      return;
    }

    const token = typeof body?.token === "string" ? body.token : "";
    if (token.length > MAX_TOKEN_LENGTH || !token || !constantTimeEqual(token, accessToken)) {
      recentFailures.push(Date.now());
      loginFailures.set(ip, recentFailures);
      sendJson(res, 401, { error: "Invalid token" });
      return;
    }

    loginFailures.delete(ip);

    const sessionToken = crypto.randomBytes(32).toString("base64url");
    sessions.set(sessionToken, { expiresAt: Date.now() + sessionTtlMs });
    res.setHeader("Set-Cookie", sessionCookie(sessionToken, sessionTtlMs, isSecureRequest(req)));
    sendJson(res, 200, { ok: true });
  }

  function logoutHandler(req, res, _url) {
    const cookieToken = parseCookie(req.headers.cookie, COOKIE_NAME);
    if (cookieToken) {
      sessions.delete(cookieToken);
    }

    const authorization = req.headers.authorization;
    const match = typeof authorization === "string" ? /^Bearer\s+(.+)$/i.exec(authorization) : null;
    if (match) {
      sessions.delete(match[1].trim());
    }

    res.setHeader("Set-Cookie", sessionCookie("", 0, isSecureRequest(req)));
    sendJson(res, 200, { ok: true });
  }

  function dispose() {
    clearInterval(cleanupTimer);
    sessions.clear();
    loginFailures.clear();
  }

  return {
    middleware,
    loginHandler,
    logoutHandler,
    isPublicMode,
    dispose,
    sessionTtlMs
  };
}