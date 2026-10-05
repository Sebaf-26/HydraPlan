// Zero-dependency server: serves the Vite build from ./dist, stores plans in
// DATA_DIR/hydraplan.json and images (overlays, photos) in DATA_DIR/uploads, proxies
// satellite tiles (Esri World Imagery) and address search (Nominatim).
// Everything except the login screen requires the ADMIN_USERNAME/ADMIN_PASSWORD session.
import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir, stat, unlink, readdir } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "dist");
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = join(DATA_DIR, "hydraplan.json");
const UPLOADS = join(DATA_DIR, "uploads");
const PORT = Number(process.env.PORT || 8094);
const UA = "HydraPlan/1.0 (self-hosted garden planner; github.com/Sebaf-26/HydraPlan)";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};
const IMAGE_EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

// ---------- auth ----------

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("ADMIN_USERNAME e ADMIN_PASSWORD sono obbligatorie: impostale nelle variabili d'ambiente dello stack.");
  process.exit(1);
}
const SESSION_DAYS = 30;
const COOKIE = "hydraplan_sid";

await mkdir(UPLOADS, { recursive: true });

// Random secret kept in the data volume so logins survive restarts. The signing
// key also mixes in the credentials: changing the password logs every device out.
async function loadSecret() {
  const file = join(DATA_DIR, "session.secret");
  try {
    const s = (await readFile(file, "utf8")).trim();
    if (s.length >= 32) return s;
  } catch {}
  const s = randomBytes(32).toString("hex");
  await writeFile(file, s, { mode: 0o600 });
  return s;
}
const SIGNING_KEY = createHmac("sha256", await loadSecret()).update(`${ADMIN_USERNAME}\n${ADMIN_PASSWORD}`).digest();
const sign = (data) => createHmac("sha256", SIGNING_KEY).update(data).digest("base64url");

function safeEqual(a, b) {
  const ha = createHmac("sha256", SIGNING_KEY).update(String(a)).digest();
  const hb = createHmac("sha256", SIGNING_KEY).update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isAuthed(req) {
  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!cookie) return false;
  const [payload, sig] = cookie.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function sessionCookie(req, value, maxAge) {
  const https = req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? "; Secure" : ""}`;
}

// Brute-force brake: 5 wrong attempts per IP lock it out for 15 minutes.
const failures = new Map();
// Behind Cloudflare → Nginx Proxy Manager: CF-Connecting-IP is the real client; otherwise
// take the hop the proxy appended last (the first X-Forwarded-For entry is client-controlled).
const clientIp = (req) =>
  String(req.headers["cf-connecting-ip"] || "").trim() ||
  String(req.headers["x-forwarded-for"] || "").split(",").pop().trim() ||
  req.socket.remoteAddress;

async function handleLogin(req, res) {
  const ip = clientIp(req);
  const f = failures.get(ip);
  if (f && f.count >= 5 && Date.now() - f.last < 15 * 60_000) {
    return sendJson(res, 429, { error: "Troppi tentativi. Riprova tra 15 minuti." });
  }
  let payload;
  try {
    payload = JSON.parse((await readBody(req)).toString("utf8"));
  } catch {
    return sendJson(res, 400, { error: "JSON non valido" });
  }
  const okUser = safeEqual(payload?.username ?? "", ADMIN_USERNAME);
  const okPass = safeEqual(payload?.password ?? "", ADMIN_PASSWORD);
  if (!okUser || !okPass) {
    const next = f && Date.now() - f.last < 15 * 60_000 ? f.count + 1 : 1;
    failures.set(ip, { count: next, last: Date.now() });
    return sendJson(res, 401, { error: "Nome utente o password errati." });
  }
  failures.delete(ip);
  res.setHeader("Set-Cookie", sessionCookie(req, makeToken(), SESSION_DAYS * 86400));
  sendJson(res, 200, { ok: true });
}

// ---------- storage ----------

let db = { plans: [], plants: [], orphans: {} };
try {
  const loaded = JSON.parse(await readFile(DATA_FILE, "utf8"));
  db = {
    plans: Array.isArray(loaded.plans) ? loaded.plans : [],
    plants: Array.isArray(loaded.plants) ? loaded.plants : [],
    orphans: loaded.orphans && typeof loaded.orphans === "object" ? loaded.orphans : {}
  };
} catch {}

let writing = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(db);
  writing = writing
    .then(async () => {
      await writeFile(DATA_FILE + ".tmp", snapshot);
      await rename(DATA_FILE + ".tmp", DATA_FILE);
    })
    .catch((err) => console.error("persist failed:", err));
  return writing;
}

// ---------- validation ----------

const str = (v, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, fallback = null) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const color = (v) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v : "");
const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const KINDS = ["giardino", "orto", "terrazzo", "casa", "altro"];

function points(v) {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 2000)
    .map((p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : [null, null]))
    .filter(([x, y]) => x !== null && y !== null);
}

const FILE_RE = /^[\w-]+\.(png|jpg|webp)$/;
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, num(v, fallback)));

// Photos attached to any element (works documentation): uploaded file + date + caption.
function photos(v) {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 60)
    .filter((ph) => FILE_RE.test(ph?.file || ""))
    .map((ph) => ({ file: ph.file, date: date(ph.date), caption: str(ph.caption, 500) }));
}

function cleanElement(e) {
  const base = { id: str(e?.id, 64) || randomUUID(), name: str(e?.name, 120), note: str(e?.note, 4000), locked: !!e?.locked, photos: photos(e?.photos) };
  const x = num(e?.x), y = num(e?.y);
  const hasXY = x !== null && y !== null;
  switch (e?.type) {
    case "area": {
      const pts = points(e.points);
      if (pts.length < 3) return null;
      return { ...base, type: "area", kind: str(e.kind, 30) || "aiuola", color: color(e.color), points: pts };
    }
    case "line": {
      const pts = points(e.points);
      if (pts.length < 2) return null;
      return {
        ...base, type: "line", kind: str(e.kind, 30) || "vialetto", color: color(e.color), width: clamp(e.width, 0, 20, 0.1), points: pts,
        // pipes / ducts: content, diameter in mm, depth in cm
        content: str(e.content, 30), diameter: clamp(e.diameter, 0, 2000, 0), depth: clamp(e.depth, 0, 1000, 0)
      };
    }
    case "plant":
      if (!hasXY) return null;
      return { ...base, type: "plant", plantId: str(e.plantId, 64), x, y, d: clamp(e.d, 0.05, 60, 1), color: color(e.color), planted: date(e.planted) };
    case "label":
      if (!hasXY || !str(e.text)) return null;
      return { ...base, type: "label", x, y, text: str(e.text, 300), size: clamp(e.size, 0.1, 20, 0.6), color: color(e.color) };
    case "dim": {
      const pts = points(e.points);
      if (pts.length !== 2) return null;
      return { ...base, type: "dim", points: pts };
    }
    case "stone":
      if (!hasXY) return null;
      return {
        ...base, type: "stone", x, y, w: clamp(e.w, 0.05, 20, 0.4), h: clamp(e.h, 0.05, 20, 0.4), rotation: clamp(e.rotation, -360, 360, 0),
        shape: e.shape === "round" ? "round" : "rect", material: str(e.material, 60), color: color(e.color)
      };
    case "pozzetto":
      if (!hasXY) return null;
      return {
        ...base, type: "pozzetto", x, y, w: clamp(e.w, 0.05, 5, 0.4), h: clamp(e.h, 0.05, 5, 0.4), rotation: clamp(e.rotation, -360, 360, 0),
        depth: clamp(e.depth, 0, 1000, 0), cover: str(e.cover, 60), color: color(e.color)
      };
    case "photo":
      if (!hasXY) return null;
      return { ...base, type: "photo", x, y };
    default:
      return null;
  }
}

// Images laid over the plan (satellite, floor plans, rectified photos), drawn in list order.
function cleanOverlay(o) {
  if (!o || !FILE_RE.test(o.file || "")) return null;
  const width = num(o.width), height = num(o.height);
  if (!(width > 0) || !(height > 0)) return null;
  return {
    id: str(o.id, 64) || randomUUID(),
    file: o.file,
    name: str(o.name, 120) || "Immagine",
    x: num(o.x, 0),
    y: num(o.y, 0),
    width,
    height,
    rotation: clamp(o.rotation, -360, 360, 0),
    opacity: clamp(o.opacity, 0.05, 1, 0.8),
    locked: o.locked !== false,
    hidden: !!o.hidden,
    source: str(o.source, 300),
    date: date(o.date)
  };
}

function cleanPlan(p, id, previous) {
  if (!str(p?.name)) return null;
  const now = new Date().toISOString();
  // v1.0 had a single `background`: it becomes the first overlay.
  const overlays = Array.isArray(p.overlays) ? p.overlays : p.background ? [{ ...p.background, name: "Sfondo" }] : [];
  return {
    id,
    name: str(p.name, 120),
    kind: KINDS.includes(p.kind) ? p.kind : "giardino",
    notes: str(p.notes, 10000),
    created: previous?.created || now,
    updated: now,
    grid: clamp(p.grid, 0.05, 10, 1),
    snap: p.snap !== false,
    snapStep: clamp(p.snapStep, 0.01, 10, 0.1),
    overlays: overlays.slice(0, 100).map(cleanOverlay).filter(Boolean),
    elements: Array.isArray(p.elements) ? p.elements.slice(0, 10000).map(cleanElement).filter(Boolean) : []
  };
}

function cleanPlant(p) {
  if (!str(p?.name)) return null;
  return {
    id: str(p.id, 64) || "c-" + randomUUID(),
    name: str(p.name, 120),
    latin: str(p.latin, 120),
    cat: str(p.cat, 30) || "perenne",
    d: Math.min(60, Math.max(0.05, num(p.d, 1))),
    h: Math.min(80, Math.max(0, num(p.h, 1))),
    color: color(p.color) || "#5b8c3a",
    note: str(p.note, 2000)
  };
}

const summary = (p) => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  created: p.created,
  updated: p.updated,
  thumb: p.overlays.find((o) => !o.hidden)?.file || null,
  counts: {
    plants: p.elements.filter((e) => e.type === "plant").length,
    areas: p.elements.filter((e) => e.type === "area").length,
    elements: p.elements.length
  }
});

// Uploads no plan references any more are kept for a week (so undo after deleting
// an image still works), then removed.
function referencedFiles() {
  const set = new Set();
  for (const p of db.plans) {
    p.overlays.forEach((o) => set.add(o.file));
    p.elements.forEach((e) => e.photos?.forEach((ph) => set.add(ph.file)));
  }
  return set;
}

async function collectGarbage() {
  const used = referencedFiles();
  const now = Date.now();
  let changed = false;
  for (const file of await readdir(UPLOADS).catch(() => [])) {
    if (used.has(file)) {
      if (db.orphans[file]) delete db.orphans[file], (changed = true);
    } else if (!db.orphans[file]) {
      db.orphans[file] = now;
      changed = true;
    } else if (now - db.orphans[file] > 7 * 864e5) {
      await unlink(join(UPLOADS, file)).catch(() => {});
      delete db.orphans[file];
      changed = true;
    }
  }
  if (changed) await persist();
}
setInterval(() => collectGarbage().catch((e) => console.error("gc", e)), 6 * 3600e3);

// One-time upgrade of plans saved by v1.0 (single `background` → `overlays`).
if (db.plans.some((p) => !Array.isArray(p.overlays))) {
  db.plans = db.plans.map((p) => (Array.isArray(p.overlays) ? p : { ...cleanPlan(p, p.id, p), updated: p.updated }));
  await persist();
}
await collectGarbage();

// ---------- helpers ----------

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 5_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function jsonBody(req) {
  return JSON.parse((await readBody(req)).toString("utf8"));
}

// Nominatim allows ~1 request/second: queue calls so we never exceed it.
let nominatimQueue = Promise.resolve();
function nominatim(path) {
  const run = nominatimQueue.then(async () => {
    const res = await fetch("https://nominatim.openstreetmap.org" + path, {
      headers: { "User-Agent": UA, "Accept-Language": "it,en" }
    });
    if (!res.ok) throw new Error("nominatim " + res.status);
    return res.json();
  });
  nominatimQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

// Small in-memory LRU so panning back and forth over the same area is instant.
const tileCache = new Map();
async function tile(z, x, y) {
  const key = `${z}/${y}/${x}`;
  if (tileCache.has(key)) {
    const hit = tileCache.get(key);
    tileCache.delete(key);
    tileCache.set(key, hit);
    return hit;
  }
  const res = await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${key}`, {
    headers: { "User-Agent": UA }
  });
  if (!res.ok) throw new Error("tile " + res.status);
  const body = { type: res.headers.get("content-type") || "image/jpeg", data: Buffer.from(await res.arrayBuffer()) };
  tileCache.set(key, body);
  if (tileCache.size > 800) tileCache.delete(tileCache.keys().next().value);
  return body;
}

// ---------- API ----------

async function handleApi(req, res, url) {
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const [resource, id] = parts;

  if (resource === "health") return sendJson(res, 200, { ok: true });
  if (resource === "login" && req.method === "POST") return handleLogin(req, res);
  if (resource === "logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
    return sendJson(res, 200, { ok: true });
  }
  if (!isAuthed(req)) return sendJson(res, 401, { error: "Accesso richiesto" });
  if (resource === "me") return sendJson(res, 200, { username: ADMIN_USERNAME });

  if (resource === "plans") {
    if (req.method === "GET" && !id) return sendJson(res, 200, db.plans.map(summary));
    if (req.method === "POST" && !id) {
      const body = await jsonBody(req);
      // { fromId } duplicates an existing plan (a manual "version" snapshot).
      const source = body.fromId ? db.plans.find((p) => p.id === body.fromId) : null;
      const plan = cleanPlan(source ? { ...source, name: str(body.name) || source.name + " (copia)" } : body, randomUUID());
      if (!plan) return sendJson(res, 400, { error: "Nome obbligatorio" });
      db.plans.push(plan);
      await persist();
      return sendJson(res, 201, plan);
    }
    const idx = db.plans.findIndex((p) => p.id === id);
    if (idx < 0) return sendJson(res, 404, { error: "Progetto non trovato" });
    if (req.method === "GET") return sendJson(res, 200, db.plans[idx]);
    if (req.method === "PUT") {
      const previous = db.plans[idx];
      const plan = cleanPlan(await jsonBody(req), previous.id, previous);
      if (!plan) return sendJson(res, 400, { error: "Nome obbligatorio" });
      db.plans[idx] = plan;
      await persist();
      return sendJson(res, 200, { updated: plan.updated });
    }
    if (req.method === "DELETE") {
      db.plans.splice(idx, 1);
      await persist();
      return sendJson(res, 200, { ok: true });
    }
  }

  if (resource === "plants") {
    if (req.method === "GET") return sendJson(res, 200, db.plants);
    if (req.method === "PUT") {
      const list = await jsonBody(req);
      if (!Array.isArray(list)) return sendJson(res, 400, { error: "Lista attesa" });
      db.plants = list.slice(0, 2000).map(cleanPlant).filter(Boolean);
      await persist();
      return sendJson(res, 200, db.plants);
    }
  }

  if (resource === "uploads") {
    if (req.method === "POST" && !id) {
      const ext = IMAGE_EXT[(req.headers["content-type"] || "").split(";")[0]];
      if (!ext) return sendJson(res, 415, { error: "Solo immagini PNG, JPEG o WebP" });
      const data = await readBody(req, 25_000_000);
      const file = randomUUID() + ext;
      await writeFile(join(UPLOADS, file), data);
      return sendJson(res, 201, { file });
    }
    if (req.method === "GET" && /^[\w-]+\.(png|jpg|webp)$/.test(id || "")) {
      try {
        const data = await readFile(join(UPLOADS, id));
        res.writeHead(200, { "Content-Type": TYPES[extname(id)], "Cache-Control": "private, max-age=31536000, immutable" });
        return res.end(data);
      } catch {
        return sendJson(res, 404, { error: "Immagine non trovata" });
      }
    }
  }

  if (resource === "tiles" && req.method === "GET") {
    const [z, x, y] = parts.slice(1).map(Number);
    if (![z, x, y].every(Number.isInteger) || z < 0 || z > 20 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      return sendJson(res, 400, { error: "tile" });
    }
    const t = await tile(z, x, y);
    res.writeHead(200, { "Content-Type": t.type, "Cache-Control": "private, max-age=604800" });
    return res.end(t.data);
  }

  if (resource === "geocode" && req.method === "GET") {
    const q = str(url.searchParams.get("q"), 200).trim();
    if (q.length < 2) return sendJson(res, 200, []);
    const hits = await nominatim(`/search?format=json&limit=6&q=${encodeURIComponent(q)}`);
    return sendJson(res, 200, hits.map((h) => ({ label: h.display_name, lat: Number(h.lat), lng: Number(h.lon) })));
  }

  return sendJson(res, 404, { error: "not found" });
}

// ---------- static ----------

async function serveStatic(req, res, url) {
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();

  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(ROOT, "index.html"); // SPA fallback
  }

  try {
    const body = await readFile(file);
    // Vite fingerprints /assets/*, everything else must revalidate so redeploys show up at once.
    const cache = file.includes(`${ROOT}/assets/`) ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": cache });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  // The static bundle holds no data, so it is public; the app shows its own login when /api/me says 401.
  const handler = url.pathname.startsWith("/api/") ? handleApi : serveStatic;
  handler(req, res, url).catch((err) => {
    console.error(err);
    const status = err instanceof SyntaxError ? 400 : err.message === "too large" ? 413 : 502;
    if (!res.headersSent) sendJson(res, status, { error: String(err.message || err) });
    else res.end();
  });
}).listen(PORT, () => console.log(`hydraplan listening on :${PORT}, data in ${DATA_FILE}`));
