/* =====================================================================
   DuoCore website server — zero dependencies, Node 18+.

   • Serves everything in /public
   • Proxies the Roblox API at /api/rbx/<host>/<path>
       e.g.  /api/rbx/games/v1/games?universeIds=123
         →   https://games.roblox.com/v1/games?universeIds=123
     Browsers can't call Roblox APIs directly (CORS), so the page calls
     this proxy instead. Responses are cached in memory so the site stays
     fast and never hits Roblox rate limits, no matter how many visitors.

   Run:   node server.js          (then open http://localhost:3000)
   Port:  PORT=8080 node server.js
   ===================================================================== */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// Only these Roblox API hosts can be proxied (host.roblox.com).
const ALLOWED_HOSTS = new Set(["games", "thumbnails", "users", "groups", "apis"]);

// Cache lifetimes in seconds, matched by path prefix (first match wins).
const CACHE_TTL = [
  ["apis/universes", 24 * 3600], // place → universe never changes
  ["games/v1/games/votes", 300],
  ["games/v1/games", 45],        // players online / visits
  ["thumbnails", 900],
  ["users", 900],
  ["groups", 300],
];
const DEFAULT_TTL = 120;
const UPSTREAM_TIMEOUT_MS = 10000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
};

/* ---------- tiny in-memory cache with request coalescing ---------- */
const cache = new Map();   // key → { expires, status, body }
const inflight = new Map(); // key → Promise

function ttlFor(hostAndPath) {
  for (const [prefix, ttl] of CACHE_TTL) if (hostAndPath.startsWith(prefix)) return ttl;
  return DEFAULT_TTL;
}

async function fetchUpstream(host, rest) {
  const url = `https://${host}.roblox.com/${rest}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "DuoCoreSite/1.0 (+website stats)" },
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function proxy(host, rest) {
  const key = `${host}/${rest}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return { ...hit, cached: true };
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const r = await fetchUpstream(host, rest);
      const ttl = r.status === 200 ? ttlFor(key) : 15; // don't hammer upstream on errors either
      const entry = { status: r.status, body: r.body, expires: Date.now() + ttl * 1000, ttl };
      cache.set(key, entry);
      return entry;
    } catch (err) {
      if (hit) return { ...hit, stale: true }; // serve stale data rather than nothing
      return { status: 502, body: JSON.stringify({ error: "upstream unavailable", detail: String(err && err.message) }), ttl: 0 };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Evict expired entries now and then so memory stays flat.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expires + 600000 < now) cache.delete(k);
}, 60000).unref();

/* ---------- http server ---------- */
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "content-type": "application/json; charset=utf-8" }, headers || {}));
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden", { "content-type": "text/plain" });

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      // unknown path → 404 page (keeps things simple for a one-page site)
      return send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const isAsset = ext !== ".html";
    res.writeHead(200, {
      "content-type": type,
      "content-length": stat.size,
      "cache-control": isAsset ? "public, max-age=3600" : "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, JSON.stringify({ error: "method not allowed" }));
  }

  if (url.startsWith("/api/rbx/")) {
    const m = url.slice("/api/rbx/".length).match(/^([a-z]+)\/(.+)$/);
    if (!m || !ALLOWED_HOSTS.has(m[1])) return send(res, 400, JSON.stringify({ error: "bad request" }));
    const host = m[1];
    const rest = m[2];
    if (!/^[\w\-./?=&%,+]*$/.test(rest)) return send(res, 400, JSON.stringify({ error: "bad path" }));

    const r = await proxy(host, rest);
    const maxAge = Math.max(0, Math.round(((r.expires || Date.now()) - Date.now()) / 1000));
    return send(res, r.status, r.body, {
      "cache-control": `public, max-age=${Math.min(maxAge, 60)}`,
      "x-cache": r.cached ? "HIT" : r.stale ? "STALE" : "MISS",
      "access-control-allow-origin": "*",
    });
  }

  if (url === "/healthz") return send(res, 200, JSON.stringify({ ok: true, cached: cache.size }));

  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`DuoCore site running  →  http://localhost:${PORT}`);
  console.log(`Roblox API proxy      →  http://localhost:${PORT}/api/rbx/games/v1/games?universeIds=…`);
});
