/* ============================================================
   /api/keepalive: keeps the free Supabase project awake, with nobody watching it.

   Supabase pauses a free project after a week without database activity, and
   un-pausing by hand is the one manual job accounts would otherwise need. Vercel
   Cron calls this once a day (vercel.json → "crons"; free on Hobby, and unlike a
   GitHub Actions schedule it isn't switched off when the repo has no commits).

     1. It calls the database's ping() three times (supabase/schema.sql), which
        writes a timestamp: real database activity.
     2. If the project is paused anyway, it asks Supabase's Management API to
        restore it (POST /v1/projects/{ref}/restore).

   Settings (Vercel → Settings → Environment Variables):
     SUPABASE_URL           https://<ref>.supabase.co
     SUPABASE_ANON_KEY      the project's public anon key
     SUPABASE_ACCESS_TOKEN  a Supabase access token that can restore the project
     CRON_SECRET            any long random string; Vercel Cron sends it, so
                            nobody else can make this run
   No dependencies.
   ============================================================ */
"use strict";

const PINGS = 3;
const TIMEOUT_MS = 8000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function call(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await fetch(url, Object.assign({ signal: ctl.signal }, opts)); }
  finally { clearTimeout(timer); }
}

/* the project ref is the first part of its URL: https://abcd1234.supabase.co → abcd1234 */
const refOf = (url) => { try { return new URL(url).hostname.split(".")[0]; } catch (e) { return ""; } };

module.exports = async function handler(req, res) {
  const env = process.env;
  if (!env.CRON_SECRET || req.headers.authorization !== "Bearer " + env.CRON_SECRET) return send(res, 401, { error: "Only Vercel Cron runs this." });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return send(res, 503, { error: "Accounts are not set up (SUPABASE_URL, SUPABASE_ANON_KEY)." });

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  let ok = 0, last = null;
  for (let i = 0; i < PINGS; i++) {
    try {
      const r = await call(base + "/rest/v1/rpc/ping", {
        method: "POST",
        headers: { apikey: env.SUPABASE_ANON_KEY, authorization: "Bearer " + env.SUPABASE_ANON_KEY, "content-type": "application/json" },
        body: "{}",
      });
      if (r.ok) ok++; else last = "ping answered " + r.status;
    } catch (e) { last = "ping failed: " + (e && e.name); }
  }
  if (ok === PINGS) return send(res, 200, { ok: true, pings: ok });

  /* the database didn't answer: if the project is paused, restore it */
  const api = (env.SUPABASE_API_URL || "https://api.supabase.com").replace(/\/+$/, "");
  const ref = env.SUPABASE_PROJECT_REF || refOf(base);
  if (!env.SUPABASE_ACCESS_TOKEN || !ref) {
    console.error("keepalive: database unreachable (" + last + ") and no access token to restore it");
    return send(res, 502, { ok: false, pings: ok, error: last, restore: "not configured" });
  }
  const auth = { authorization: "Bearer " + env.SUPABASE_ACCESS_TOKEN };
  try {
    const s = await call(api + "/v1/projects/" + ref, { headers: auth });
    const status = s.ok ? String((await s.json()).status || "") : "status answered " + s.status;
    if (!/INACTIVE|PAUSED/i.test(status)) {
      console.error("keepalive: database unreachable (" + last + "), project status " + status);
      return send(res, 502, { ok: false, pings: ok, error: last, status: status });
    }
    const r = await call(api + "/v1/projects/" + ref + "/restore", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, auth), body: "{}" });
    if (!r.ok) {
      console.error("keepalive: restore answered " + r.status);
      return send(res, 502, { ok: false, status: status, restore: r.status });
    }
    console.log("keepalive: project was " + status + ", restore requested");
    return send(res, 200, { ok: true, restored: true, status: status });
  } catch (e) {
    console.error("keepalive: management API failed: " + (e && e.name));
    return send(res, 502, { ok: false, pings: ok, error: "management API failed" });
  }
};
