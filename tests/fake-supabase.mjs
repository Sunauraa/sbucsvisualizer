/* A stand-in for Supabase, for the tests: just enough of its auth (Google sign-in with PKCE, refresh, sign-out),
   its REST database (with the same "own rows only" and "newest change wins" rules as supabase/schema.sql), and
   its management API (project status, restore) for api/keepalive.js. Mounted by server.mjs under /__supabase,
   so it's on the site's own origin and the real Content-Security-Policy applies unchanged. */
import crypto from "node:crypto";

export const ANON = "anon-test-key";

export function fakeSupabase() {
  const st = {
    nextUser: { id: "u-alice", email: "alice@example.edu", name: "Alice Student" },
    ttl: 3600,
    down: false,                  /* the database refuses everything (offline / paused) */
    projectStatus: "ACTIVE_HEALTHY",
    restored: 0, pings: 0, logouts: 0,
    codes: new Map(), access: new Map(), refresh: new Map(),
    tables: { progress: new Map(), leetcode: new Map(), notes: new Map() },
    users: new Set(),
    requests: [],
  };
  const KEYS = { progress: (r) => r.user_id + "|" + r.page, leetcode: (r) => r.user_id + "|" + r.problem, notes: (r) => r.id };
  const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const json = (res, status, body) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(body === undefined ? "" : JSON.stringify(body)); };
  const issue = (user) => {
    const at = "at-" + crypto.randomBytes(8).toString("hex"), rt = "rt-" + crypto.randomBytes(8).toString("hex");
    st.access.set(at, { user, exp: Date.now() + st.ttl * 1000 });
    st.refresh.set(rt, user);
    st.users.add(user.id);
    return { access_token: at, refresh_token: rt, expires_in: st.ttl, expires_at: Math.floor(Date.now() / 1000) + st.ttl, token_type: "bearer",
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.name } } };
  };
  const readBody = (req) => new Promise((r) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => r(raw)); });
  const who = (req) => {
    const t = (req.headers.authorization || "").replace(/^Bearer /, "");
    const a = st.access.get(t);
    return a && a.exp > Date.now() ? a.user : null;
  };
  /* the "keep_newest" trigger, and a far-future clock pulled back */
  function write(table, row) {
    const k = KEYS[table](row);
    const old = st.tables[table].get(k);
    const r = Object.assign({}, row);
    if (Date.parse(r.updated_at) > Date.now() + 5 * 60000) r.updated_at = new Date().toISOString();
    if (old && r.updated_at < old.updated_at) return;
    if (table === "notes" && old && !("frames" in r)) r.frames = old.frames;
    st.tables[table].set(k, Object.assign({}, old || {}, r));
  }

  async function handle(req, res, path) {
    const url = new URL(req.url, "http://x");
    st.requests.push(req.method + " " + path);
    /* ---------- management API (keepalive) ---------- */
    let m;
    if ((m = /^\/mgmt\/v1\/projects\/([\w-]+)(\/restore)?$/.exec(path))) {
      if (req.headers.authorization !== "Bearer mgmt-token") return json(res, 401, { message: "bad token" });
      if (!m[2]) return json(res, 200, { id: m[1], status: st.projectStatus });
      st.restored++; st.projectStatus = "RESTORING"; st.down = false;
      return json(res, 200, {});
    }
    /* ---------- auth ---------- */
    /* authorize is a browser navigation, so (as on Supabase) it carries no API key; everything else needs one */
    if (path !== "/auth/v1/authorize" && req.headers.apikey !== ANON) return json(res, 401, { message: "No API key found in request" });
    if (path === "/auth/v1/authorize") {
      const back = url.searchParams.get("redirect_to");
      const challenge = url.searchParams.get("code_challenge");
      if (url.searchParams.get("provider") !== "google" || !back || !challenge || url.searchParams.get("code_challenge_method") !== "s256") return json(res, 400, { message: "bad authorize" });
      const code = "c-" + crypto.randomBytes(6).toString("hex");
      st.codes.set(code, { challenge, user: st.nextUser });
      res.statusCode = 302;
      res.setHeader("location", back + (back.includes("?") ? "&" : "?") + "code=" + code);
      return res.end();
    }
    if (path === "/auth/v1/token" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const grant = url.searchParams.get("grant_type");
      if (grant === "pkce") {
        const c = st.codes.get(body.auth_code);
        st.codes.delete(body.auth_code);
        if (!c || b64url(crypto.createHash("sha256").update(body.code_verifier || "").digest()) !== c.challenge) return json(res, 400, { message: "invalid PKCE" });
        return json(res, 200, issue(c.user));
      }
      if (grant === "refresh_token") {
        const user = st.refresh.get(body.refresh_token);
        if (!user || !st.users.has(user.id)) return json(res, 400, { message: "invalid refresh token" });
        st.refresh.delete(body.refresh_token);
        return json(res, 200, issue(user));
      }
      return json(res, 400, { message: "bad grant" });
    }
    if (path === "/auth/v1/logout") { st.logouts++; st.access.delete((req.headers.authorization || "").replace(/^Bearer /, "")); return json(res, 204); }
    /* ---------- database ---------- */
    if (st.down) return json(res, 503, { message: "project paused" });
    if (path === "/rest/v1/rpc/ping") {
      /* like Supabase with its newer keys: a key that isn't a JWT is refused in the Authorization header */
      if (/^Bearer sb_|^Bearer anon-/.test(req.headers.authorization || "")) return json(res, 401, { message: "Invalid JWT" });
      st.pings++; return json(res, 200, new Date().toISOString());
    }
    const user = who(req);
    if (!user) return json(res, 401, { message: "JWT expired" });
    if (path === "/rest/v1/rpc/delete_me") {
      for (const t of Object.keys(st.tables)) for (const [k, r] of st.tables[t]) if (r.user_id === user.id) st.tables[t].delete(k);
      st.users.delete(user.id);
      return json(res, 204);
    }
    const table = (/^\/rest\/v1\/(progress|leetcode|notes)$/.exec(path) || [])[1];
    if (!table) return json(res, 404, { message: "no such table" });
    if (req.method === "GET") {
      let rows = [...st.tables[table].values()].filter((r) => r.user_id === user.id);     /* row-level security */
      const pin = /^in\.\((.*)\)$/.exec(url.searchParams.get("page") || "");
      if (pin) { const set = pin[1].split(",").map((x) => x.replace(/^"|"$/g, "")); rows = rows.filter((r) => set.includes(r.page)); }
      const idEq = /^eq\.(.*)$/.exec(url.searchParams.get("id") || "");
      if (idEq) rows = rows.filter((r) => r.id === idEq[1]);
      const cols = (url.searchParams.get("select") || "*").split(",");
      if (cols[0] !== "*") rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] === undefined ? null : r[c]])));
      return json(res, 200, rows);
    }
    if (req.method === "POST") {
      const rows = [].concat(JSON.parse((await readBody(req)) || "[]"));
      if (rows.some((r) => r.user_id !== user.id)) return json(res, 403, { message: "new row violates row-level security policy" });
      if (table === "notes" && rows.some((r) => r.frames && Buffer.byteLength(JSON.stringify(r.frames)) > 30000)) return json(res, 400, { message: "frames too big" });
      rows.forEach((r) => write(table, r));
      return json(res, 201);
    }
    return json(res, 405, { message: "method" });
  }
  return { state: st, handle };
}
