/* ───────────────────────────────────────────────────────────────────────────
   PCN Wiki — submission queue Worker

   A tiny backend for the "Add" page. Stores pending contributions (lots, farms,
   varieties) submitted by visitors so the queue is shared across everyone,
   not just the submitter's browser.

   Storage: a single Cloudflare KV key ("queue") holding a JSON array. The queue
   is small (it's drained weekly when Eugene + Claude vet and add entries), so
   one key is plenty and keeps reads/writes to a single round-trip.

   Endpoints
     GET  /queue          → { queue: [...] }            (public read)
     POST /submit         → { ok: true, entry }          (append one entry)
     POST /clear          → { ok: true }                 (admin: empty queue)  [requires token]
     POST /remove         → { ok: true }                 (admin: delete one id) [requires token]

   Bindings (see wrangler.toml)
     QUEUE_KV   — KV namespace
     ADMIN_TOKEN (secret, optional) — if set, /clear and /remove require
                  header  "x-admin-token: <token>"
   ─────────────────────────────────────────────────────────────────────────── */

const KEY = "queue";
const MAX_ENTRIES = 500;          // safety cap so the queue can't grow unbounded
const MAX_FIELD_LEN = 200;        // trim overly long inputs
const VALID_TYPES = new Set(["lot", "farm", "variety"]);

// Which fields we accept per type. Anything else in the payload is ignored.
const ALLOWED_FIELDS = {
  lot:     ["lotName", "lotFarm", "country"],
  farm:    ["farmName", "owner", "country"],
  variety: ["varietyName", "country"],
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    try {
      if (url.pathname === "/queue" && request.method === "GET") {
        const queue = await readQueue(env);
        return json({ queue }, 200, origin);
      }

      if (url.pathname === "/submit" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        const entry = sanitizeEntry(body);
        if (!entry) return json({ error: "Invalid submission" }, 400, origin);

        const queue = await readQueue(env);
        queue.unshift(entry);
        if (queue.length > MAX_ENTRIES) queue.length = MAX_ENTRIES;
        await env.QUEUE_KV.put(KEY, JSON.stringify(queue));
        return json({ ok: true, entry }, 200, origin);
      }

      if (url.pathname === "/remove" && request.method === "POST") {
        if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, origin);
        const body = await request.json().catch(() => ({}));
        const id = String(body.id || "");
        const queue = (await readQueue(env)).filter(e => e.id !== id);
        await env.QUEUE_KV.put(KEY, JSON.stringify(queue));
        return json({ ok: true }, 200, origin);
      }

      if (url.pathname === "/clear" && request.method === "POST") {
        if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, origin);
        await env.QUEUE_KV.put(KEY, JSON.stringify([]));
        return json({ ok: true }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: "Server error" }, 500, origin);
    }
  },
};

async function readQueue(env) {
  const raw = await env.QUEUE_KV.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeEntry(body) {
  if (!body || typeof body !== "object") return null;
  const type = String(body.type || "");
  if (!VALID_TYPES.has(type)) return null;

  const incoming = (body.vals && typeof body.vals === "object") ? body.vals : {};
  const vals = {};
  let any = false;
  for (const field of ALLOWED_FIELDS[type]) {
    const v = incoming[field];
    if (typeof v === "string" && v.trim()) {
      vals[field] = v.trim().slice(0, MAX_FIELD_LEN);
      any = true;
    }
  }
  if (!any) return null; // reject empty submissions

  return {
    id: "q" + Date.now() + Math.random().toString(36).slice(2, 6),
    type,
    vals,
    date: new Date().toISOString().slice(0, 10),
  };
}

function authorized(request, env) {
  // If no ADMIN_TOKEN is configured, admin endpoints are open (fine for a
  // personal project). Set the secret to lock them down.
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}
