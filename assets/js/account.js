/* ============================================================
   account.js: optional sign-in (Google) that syncs, across every computer a student uses:
     - a progress map: tabs opened, operations run, quiz answers, per module
     - a LeetCode status on every practice problem: To do / Solved / Revisit
     - notes pinned to a step: a note on one exact moment of an animation, which reopens that moment

   Design (notes/design-decisions.md, decision 7):
     - The site stays static. This file talks straight to Supabase (login + Postgres) with fetch:
       no SDK, no server of our own. supabase/schema.sql makes every row readable and writable
       only by the student who owns it.
     - Local first: a change is saved on this computer at once and sent in the background, so it
       works offline and syncs when the network is back. The newest change to a record wins.
     - Nothing here runs until DSA.ACCOUNT (core.js) has a URL and key. Signed out, the site is
       exactly as before; these features appear only for a signed-in student.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const cfg = window.DSA_ACCOUNT || D.ACCOUNT || {};
  const api = { enabled: false, user: null, state: "off" };
  D.account = api;
  /* sign-in needs a secure page (https, or localhost) for the PKCE hash */
  if (!cfg.url || !cfg.anonKey || !window.isSecureContext || !(window.crypto && crypto.subtle)) return;
  api.enabled = true;

  const BASE = String(cfg.url).replace(/\/+$/, "");
  const PAGE = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  const K_SESSION = "dsa.session.v1", K_PKCE = "dsa.pkce.v1", K_DEVICE = "dsa.device.v1";
  const NOTE_BYTES = 24000;            /* the recorded steps kept with a note (the database allows 30,000) */
  const STATUS = [["none", "Not started"], ["todo", "To do"], ["solved", "Solved"], ["revisit", "Revisit"]];

  const now = () => new Date().toISOString();
  const bytes = (s) => new TextEncoder().encode(s).length;
  const plain = (html) => { const d = document.createElement("div"); d.innerHTML = String(html == null ? "" : html); return d.textContent.replace(/\s+/g, " ").trim(); };
  const b64url = (u8) => btoa(String.fromCharCode.apply(null, Array.from(u8))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const uni = (a, b) => Array.from(new Set([].concat(a || [], b || [])));
  const domReady = new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()));
  const device = (() => { try { let d = localStorage.getItem(K_DEVICE); if (!d) { d = uuid().slice(0, 8); localStorage.setItem(K_DEVICE, d); } return d; } catch (e) { return "this"; } })();

  /* ================= session: where it lives ================= */
  /* "Keep me signed in" puts the session in localStorage; otherwise sessionStorage, which the browser drops when
     it closes (for school computers). The synced data is cached next to the session and leaves with it. */
  let session = null, where = null, cache = null;
  const stores = () => { const s = []; try { s.push(localStorage); } catch (e) {} try { s.push(sessionStorage); } catch (e) {} return s; };
  function loadSession() {
    for (const st of stores()) {
      try {
        const s = JSON.parse(st.getItem(K_SESSION) || "null");
        if (s && s.refresh_token && s.user && s.user.id) { session = s; where = st; return; }
      } catch (e) {}
    }
  }
  function saveSession() { try { where.setItem(K_SESSION, JSON.stringify(session)); } catch (e) {} }
  const cacheKey = () => "dsa.sync." + session.user.id + ".v1";
  const emptyCache = () => ({ progress: {}, leetcode: {}, notes: {}, dirty: { progress: [], leetcode: [], notes: [] } });
  function loadCache() {
    try { cache = JSON.parse(where.getItem(cacheKey()) || "null"); } catch (e) { cache = null; }
    if (!cache || !cache.dirty) cache = emptyCache();
  }
  function saveCache() {
    if (!session || !cache) return;
    try { where.setItem(cacheKey(), JSON.stringify(cache)); }
    catch (e) {
      /* storage full: the steps of notes already on the server can be fetched again, so drop those first */
      Object.keys(cache.notes).forEach((id) => { if (!cache.dirty.notes.includes(id)) delete cache.notes[id].frames; });
      try { where.setItem(cacheKey(), JSON.stringify(cache)); } catch (e2) {}
    }
  }
  function forget() {
    if (where && session) { try { where.removeItem(cacheKey()); where.removeItem(K_SESSION); } catch (e) {} }
    session = null; cache = null; where = null; api.user = null;
  }
  const toSession = (s) => {
    const m = (s.user && s.user.user_metadata) || {};
    return {
      access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: { id: s.user.id, email: s.user.email || "", name: m.full_name || m.name || "" },
    };
  };

  /* ================= sign in with Google (OAuth with PKCE) ================= */
  async function signIn(keep) {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    try { sessionStorage.setItem(K_PKCE, JSON.stringify({ verifier: verifier, keep: !!keep, back: location.href })); } catch (e) {}
    const back = location.origin + location.pathname;
    location.assign(BASE + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(back) +
      "&code_challenge=" + challenge + "&code_challenge_method=s256");
  }
  /* back from Google: the page address carries ?code=… (or ?error=…) */
  async function finishSignIn() {
    const q = new URLSearchParams(location.search);
    const code = q.get("code"), err = q.get("error_description") || q.get("error");
    if (!code && !err) return;
    let pk = null;
    try { pk = JSON.parse(sessionStorage.getItem(K_PKCE) || "null"); sessionStorage.removeItem(K_PKCE); } catch (e) {}
    const u = new URL(location.href);
    ["code", "error", "error_code", "error_description"].forEach((k) => u.searchParams.delete(k));
    if (pk && pk.back) { try { u.hash = new URL(pk.back).hash; } catch (e) {} }
    history.replaceState(null, "", u.pathname + u.search + u.hash);
    if (err || !pk) { if (err) toast("Sign-in didn't finish: " + err); return; }
    try {
      const r = await fetch(BASE + "/auth/v1/token?grant_type=pkce", {
        method: "POST",
        headers: { apikey: cfg.anonKey, "content-type": "application/json" },
        body: JSON.stringify({ auth_code: code, code_verifier: pk.verifier }),
      });
      if (!r.ok) throw new Error("token " + r.status);
      where = pk.keep ? localStorage : sessionStorage;
      session = toSession(await r.json());
      saveSession();
    } catch (e) { toast("Sign-in didn't finish. Please try again."); }
  }

  let refreshing = null;
  function refresh() {
    if (!refreshing) refreshing = (async () => {
      try {
        const r = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: cfg.anonKey, "content-type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (r.ok) { const s = toSession(await r.json()); session.access_token = s.access_token; session.refresh_token = s.refresh_token; session.expires_at = s.expires_at; saveSession(); return true; }
        if (r.status === 400 || r.status === 401 || r.status === 403) { forget(); paint(); toast("You were signed out. Sign in again to keep syncing."); }
        return false;
      } catch (e) { return false; }   /* offline: keep the session and try later */
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  async function token() {
    if (!session) return null;
    if (session.expires_at * 1000 - Date.now() < 60000) await refresh();
    return session ? session.access_token : null;
  }

  /* ================= the database (PostgREST) ================= */
  async function rest(path, opts) {
    const o = opts || {};
    const call = async () => {
      const t = await token();
      if (!t) throw new Error("signed out or offline");
      const h = Object.assign({ apikey: cfg.anonKey, authorization: "Bearer " + t }, o.headers || {});
      if (o.body) h["content-type"] = "application/json";
      return fetch(BASE + "/rest/v1/" + path, { method: o.method || "GET", headers: h, body: o.body });
    };
    let r = await call();
    if (r.status === 401 && session && (await refresh())) r = await call();
    if (!r.ok) throw new Error("server " + r.status);
    return r;
  }
  const upsert = (table, conflict, rows) => rest(table + "?on_conflict=" + conflict, {
    method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows),
  });

  /* ================= sync ================= */
  function setState(s) { api.state = s; paintState(); }
  function markDirty(table, key) {
    const l = cache.dirty[table];
    if (!l.includes(key)) l.push(key);
    saveCache();
    clearTimeout(markDirty.t);
    markDirty.t = setTimeout(flush, 600);
    setState("saving");
  }
  /* a key leaves the dirty list only if nothing changed it while it was being sent */
  const settle = (table, sent) => { cache.dirty[table] = cache.dirty[table].filter((k) => !(k in sent) || sent[k] !== (cache[table][k] && cache[table][k].updated_at)); };

  let busy = null, again = false;
  async function flush() {
    if (!session || !cache) return;
    if (busy) { again = true; return busy; }
    busy = (async () => {
      const uid = session.user.id, d = cache.dirty;
      try {
        if (d.leetcode.length) {
          const sent = {};
          const rows = d.leetcode.map((n) => { sent[n] = cache.leetcode[n].updated_at; return { user_id: uid, problem: +n, status: cache.leetcode[n].status, updated_at: cache.leetcode[n].updated_at }; });
          await upsert("leetcode", "user_id,problem", rows);
          settle("leetcode", sent);
        }
        if (d.progress.length) {
          /* progress only ever grows, so merge with what the other computers sent before writing */
          const pages = d.progress.slice();
          const r = await rest("progress?select=page,data&page=in.(" + pages.map((p) => '"' + p + '"').join(",") + ")");
          (await r.json()).forEach((row) => { if (cache.progress[row.page]) cache.progress[row.page].data = mergeProgress(cache.progress[row.page].data, row.data); });
          const sent = {};
          const rows = pages.filter((p) => cache.progress[p]).map((p) => { sent[p] = cache.progress[p].updated_at; return { user_id: uid, page: p, data: cache.progress[p].data, updated_at: cache.progress[p].updated_at }; });
          if (rows.length) await upsert("progress", "user_id,page", rows);
          settle("progress", sent);
        }
        for (const id of d.notes.slice()) {
          const n = cache.notes[id];
          if (!n) continue;
          const row = { id: id, user_id: uid, page: n.page, body: n.body, meta: n.meta, deleted: !!n.deleted, updated_at: n.updated_at };
          if (n.frames) row.frames = n.frames;
          await upsert("notes", "id", [row]);
          const sent = {}; sent[id] = n.updated_at;
          settle("notes", sent);
          if (!cache.dirty.notes.includes(id)) delete n.frames;   /* on the server now; fetched again when opened */
        }
        saveCache();
        setState(cache.dirty.progress.length + cache.dirty.leetcode.length + cache.dirty.notes.length ? "saving" : "saved");
      } catch (e) {
        saveCache();
        setState(navigator.onLine === false ? "offline" : "error");
      }
    })();
    try { await busy; } finally { busy = null; }
    if (again) { again = false; return flush(); }
  }

  async function pull() {
    if (!session || !cache) return;
    try {
      const [p, l, n] = await Promise.all([
        rest("progress?select=page,data,updated_at"),
        rest("leetcode?select=problem,status,updated_at"),
        rest("notes?select=id,page,body,meta,deleted,updated_at"),
      ].map((x) => x.then((r) => r.json())));
      p.forEach((row) => {
        const mine = cache.progress[row.page];
        if (!mine) cache.progress[row.page] = { data: row.data, updated_at: row.updated_at };
        else {
          const merged = mergeProgress(mine.data, row.data);
          if (JSON.stringify(merged) !== JSON.stringify(row.data) && !cache.dirty.progress.includes(row.page)) cache.dirty.progress.push(row.page);
          mine.data = merged;
        }
      });
      const newer = (table, key, row) => {
        const mine = cache[table][key];
        if (mine && mine.updated_at >= row.updated_at) return false;
        cache.dirty[table] = cache.dirty[table].filter((k) => k !== key);   /* another computer changed it later */
        return true;
      };
      l.forEach((row) => { const k = String(row.problem); if (newer("leetcode", k, row)) cache.leetcode[k] = { status: row.status, updated_at: row.updated_at }; });
      n.forEach((row) => { if (newer("notes", row.id, row)) cache.notes[row.id] = { page: row.page, body: row.body, meta: row.meta, deleted: row.deleted, updated_at: row.updated_at }; });
      saveCache();
      if (cache.dirty.progress.length) flush();
      else setState("saved");
    } catch (e) { setState(navigator.onLine === false ? "offline" : "error"); }
    paint();
  }
  async function sync() { await flush(); await pull(); }

  /* ================= progress ================= */
  /* quiz answers are counted per computer and added up, so two computers never double-count or lose answers */
  function mergeProgress(a, b) {
    a = a || {}; b = b || {};
    const quiz = Object.assign({}, b.quiz || {});
    Object.keys(a.quiz || {}).forEach((dev) => {
      const x = a.quiz[dev], y = quiz[dev] || [0, 0];
      quiz[dev] = [Math.max(x[0], y[0]), Math.max(x[1], y[1])];
    });
    return {
      title: a.title || b.title || "",
      tabs: uni(a.tabs, b.tabs), tabsTotal: Math.max(a.tabsTotal || 0, b.tabsTotal || 0),
      ops: uni(a.ops, b.ops), opsTotal: Math.max(a.opsTotal || 0, b.opsTotal || 0),
      lc: uni(a.lc, b.lc), quiz: quiz,
    };
  }
  const quizSum = (q) => Object.values(q || {}).reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);
  const inPlayground = (p) => !!(p && p.mount && p.mount.closest && p.mount.closest("#playground"));
  const isModule = () => (D._players || []).some((p) => !inPlayground(p));
  const tabLabel = (b) => b.textContent.trim();

  function record(fn) {
    if (!session || !cache || !isModule()) return;
    const row = cache.progress[PAGE] || (cache.progress[PAGE] = { data: {}, updated_at: now() });
    const before = JSON.stringify(row.data);
    const d = row.data;
    d.title = (D.$("h1") ? D.$("h1").textContent.trim() : document.title);
    d.tabsTotal = Math.max(d.tabsTotal || 0, D.$$(".tabs button").length);
    d.opsTotal = Math.max(d.opsTotal || 0, new Set((D._docks || []).flatMap((k) => Object.keys(k.listings || {}))).size);
    fn(d);
    if (JSON.stringify(d) === before) return;
    row.updated_at = now();
    markDirty("progress", PAGE);
  }
  function recordVisit() {
    record((d) => {
      d.tabs = uni(d.tabs, D.$$(".tabs button.active").map(tabLabel));
      d.lc = uni(d.lc, D.practiceNumbers ? D.practiceNumbers() : []);
    });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".tabs button");
    if (b) setTimeout(() => record((d) => { d.tabs = uni(d.tabs, [tabLabel(b)]); }), 0);
  });
  D.on("run", (x) => { if (x.user && !inPlayground(x.player) && x.keys.length) record((d) => { d.ops = uni(d.ops, x.keys); }); });
  D.on("quiz", (x) => record((d) => {
    d.quiz = d.quiz || {};
    const q = d.quiz[device] || [0, 0];
    d.quiz[device] = [q[0] + (x.ok ? 1 : 0), q[1] + 1];
  }));
  D.on("practice", (x) => { decoratePractice(x.mount); record((d) => { d.lc = uni(d.lc, D.practiceNumbers ? D.practiceNumbers() : []); }); });

  /* ================= LeetCode status ================= */
  function decoratePractice(m) {
    if (!m) return;
    D.$$(".lc-cell", m).forEach((cell) => {
      let sel = cell.querySelector(".lc-status");
      if (!session) { if (sel) sel.remove(); delete cell.dataset.status; return; }
      const n = cell.dataset.n;
      if (!sel) {
        sel = D.el("select", { class: "lc-status", "aria-label": "Your status for " + n + ". " + cell.dataset.title });
        STATUS.forEach(([v, t]) => sel.appendChild(D.el("option", { value: v, text: t })));
        sel.addEventListener("change", () => {
          cache.leetcode[n] = { status: sel.value, updated_at: now() };
          cell.dataset.status = sel.value;
          markDirty("leetcode", n);
        });
        cell.appendChild(sel);
      }
      sel.value = (cache.leetcode[n] && cache.leetcode[n].status) || "none";
      cell.dataset.status = sel.value;
    });
  }

  /* ================= notes pinned to a step ================= */
  const noteUIs = [];
  D.playerAddons.push(function (player) {
    const btn = D.el("button", { type: "button", class: "tool-btn note-btn", "aria-pressed": "false", title: "Write a note on this exact step", text: "Note", hidden: "" });
    const panel = D.el("section", { class: "learn-panel note-panel", hidden: "", "aria-label": "Your note on this step" });
    player.tools.appendChild(btn);
    player.extra.appendChild(panel);
    const ui = { player: player, btn: btn, panel: panel, open: false };
    noteUIs.push(ui);
    btn.addEventListener("click", () => {
      ui.open = !ui.open;
      btn.setAttribute("aria-pressed", String(ui.open));
      btn.classList.toggle("on", ui.open);
      panel.hidden = !ui.open;
      if (ui.open) { player.pause(); paintNoteEditor(ui); panel.scrollIntoView({ block: "nearest" }); }
    });
    player.frameHooks.push(() => { if (ui.open) paintNoteEditor(ui); });
    paintNoteButton(ui);
  });
  function paintNoteButton(ui) {
    const on = !!session && !inPlayground(ui.player);
    ui.btn.hidden = !on;
    if (!on && ui.open) { ui.open = false; ui.panel.hidden = true; ui.btn.classList.remove("on"); ui.btn.setAttribute("aria-pressed", "false"); }
  }
  const titleOf = (player, f) => {
    const L = f.code && player.code && player.code.listings && player.code.listings[f.code];
    return (L && L.title) || plain(f.note).slice(0, 60) || "this run";
  };
  /* the steps around the pinned one, as many as fit */
  function capture(player) {
    try { return captureFrames(player); } catch (e) { return null; }   /* a frame that can't be written as JSON */
  }
  function captureFrames(player) {
    const frames = player.frames, i = player.index;
    let lo = Math.max(0, i - 10), hi = Math.min(frames.length, i + 11), json = "";
    for (;;) {
      json = JSON.stringify(frames.slice(lo, hi));
      if (bytes(json) <= NOTE_BYTES || hi - lo <= 1) break;
      if (i - lo > hi - 1 - i) lo++; else hi--;
    }
    if (bytes(json) > NOTE_BYTES) return null;
    return { frames: JSON.parse(json), step: i - lo };
  }
  function paintNoteEditor(ui) {
    const p = ui.player, f = p.frames[p.index] || {};
    ui.panel.innerHTML = "";
    ui.panel.appendChild(D.el("div", { class: "learn-head" }, [D.el("h3", { text: "Note on step " + (p.index + 1) + " of " + p.frames.length })]));
    if (p.frames.length < 2) {
      ui.panel.appendChild(D.el("p", { text: "Run something first, then pause on the step you want to remember." }));
      return;
    }
    const area = D.el("textarea", { class: "note-text", maxlength: "2000", rows: "3", "aria-label": "Your note", placeholder: "What do you want to remember about this step?" });
    const save = D.el("button", { type: "button", class: "primary", text: "Save note" });
    const out = D.el("p", { class: "small muted", role: "status" });
    ui.panel.append(area, D.el("div", { class: "note-actions" }, [save]), out);
    save.addEventListener("click", () => {
      const body = area.value.trim();
      if (!body) { area.focus(); return; }
      const cap = capture(p);
      if (!cap) { out.textContent = "This step holds too much to save with a note."; return; }
      const id = uuid();
      cache.notes[id] = {
        page: PAGE, body: body, deleted: false, updated_at: now(), frames: cap.frames,
        meta: { tabs: D.$$(".tabs button.active").map(tabLabel), mount: p.mount.id || "", title: titleOf(p, f), step: cap.step, at: p.index + 1, total: p.frames.length },
      };
      markDirty("notes", id);
      area.value = "";
      out.textContent = "Saved. It's under Your notes, and on every computer you sign in to.";
      paintNotesBox();
    });
  }

  async function framesOf(id) {
    const n = cache.notes[id];
    if (n && n.frames) return n.frames;
    try {
      const r = await rest("notes?select=frames&id=eq." + encodeURIComponent(id));
      const rows = await r.json();
      return rows[0] && rows[0].frames;
    } catch (e) { return null; }
  }
  async function openNote(id) {
    const n = cache && cache.notes[id];
    if (!n || n.deleted) { toast("That note isn't here any more."); return; }
    if (n.page !== PAGE) { location.assign(n.page + ".html#note=" + id); return; }
    const frames = await framesOf(id);
    if (!frames || !frames.length) { toast("This note's steps need a connection to load."); return; }
    for (const label of n.meta.tabs || []) {
      const b = D.$$(".tabs button").find((x) => tabLabel(x) === label);
      if (b && !b.classList.contains("active")) { b.click(); await new Promise((r) => setTimeout(r, 30)); }
    }
    const mount = n.meta.mount && document.getElementById(n.meta.mount);
    const players = (D._players || []).filter((p) => !inPlayground(p));
    const p = players.find((x) => x.mount === mount) || players.find((x) => x.mount && x.mount.offsetParent) || players[0];
    if (!p) return;
    p.load(frames, false);
    p.showControls(true);
    p.goto(Math.min(n.meta.step || 0, frames.length - 1));
    (p.scope || p.mount).scrollIntoView({ block: "start" });
  }
  function deleteNote(id) {
    const n = cache.notes[id];
    if (!n) return;
    n.deleted = true; n.body = ""; delete n.frames; n.updated_at = now();
    markDirty("notes", id);
    paint();
  }
  const liveNotes = (page) => Object.keys(cache.notes).map((id) => Object.assign({ id: id }, cache.notes[id]))
    .filter((n) => !n.deleted && (!page || n.page === page)).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  function noteLine(n) {
    const m = n.meta || {};
    return [(m.tabs || []).join(" · "), m.title, "step " + (m.at || (m.step || 0) + 1) + (m.total ? " of " + m.total : "")].filter(Boolean).join(" · ");
  }

  /* "Your notes": a box on each module page */
  function paintNotesBox() {
    let box = D.$("#my-notes");
    if (!session || !isModule()) { if (box) box.remove(); return; }
    if (!box) {
      box = D.el("section", { class: "panel my-notes", id: "my-notes", "aria-labelledby": "my-notes-h" }, [
        D.el("div", { class: "panel-title" }, [D.el("h2", { id: "my-notes-h", text: "Your notes" })]),
        D.el("div", { class: "my-notes-body" }),
      ]);
      const about = D.$("#about");
      if (about) about.parentNode.insertBefore(box, about); else D.$("main").appendChild(box);
      D.collapsible(box);
    }
    const body = box.querySelector(".my-notes-body");
    body.innerHTML = "";
    const list = liveNotes(PAGE);
    if (!list.length) { body.appendChild(D.el("p", { class: "small muted", text: "No notes yet. Pause on a step and press Note under the player." })); return; }
    const ul = D.el("ul", { class: "note-list" });
    list.forEach((n) => {
      const open = D.el("button", { type: "button", text: "Open", "aria-label": "Open note: " + noteLine(n) });
      const del = D.el("button", { type: "button", class: "ghost", text: "Delete", "aria-label": "Delete note: " + noteLine(n) });
      open.addEventListener("click", () => openNote(n.id));
      del.addEventListener("click", () => { if (confirm("Delete this note on every computer?")) deleteNote(n.id); });
      ul.appendChild(D.el("li", {}, [
        D.el("div", { class: "note-where small muted", text: noteLine(n) }),
        D.el("p", { class: "note-body", text: n.body }),
        D.el("div", { class: "note-actions" }, [open, del]),
      ]));
    });
    body.appendChild(ul);
  }

  /* ================= the progress map (the course page) ================= */
  function paintProgressMap() {
    const tiles = D.$$("main .tiles a.tile[href$='.html']");
    let box = D.$("#my-progress");
    if (!session || !tiles.length || isModule()) { if (box) box.remove(); return; }
    if (!box) {
      box = D.el("section", { class: "panel progress-map", id: "my-progress", "aria-labelledby": "my-progress-h" }, [
        D.el("div", { class: "panel-title" }, [D.el("h2", { id: "my-progress-h", text: "Your progress" })]),
        D.el("div", { class: "progress-body" }),
      ]);
      D.$("main").appendChild(box);
      D.collapsible(box);
    }
    const body = box.querySelector(".progress-body");
    body.innerHTML = "";
    const table = D.el("table", { class: "tbl progress-tbl" });
    table.appendChild(D.el("tr", {}, ["Module", "Tabs opened", "Operations run", "Quiz", "LeetCode", "Notes"].map((h) => D.el("th", { scope: "col", text: h }))));
    tiles.forEach((a) => {
      const page = a.getAttribute("href").replace(/\.html$/, "");
      const name = (a.querySelector("h2") || a).textContent.trim();
      const row = cache.progress[page], d = (row && row.data) || {};
      const [right, total] = quizSum(d.quiz);
      const lcs = (d.lc || []).map((x) => cache.leetcode[String(x)]).filter((x) => x && x.status !== "none");
      const solved = lcs.filter((x) => x.status === "solved").length, revisit = lcs.filter((x) => x.status === "revisit").length;
      const frac = (x, n) => (n ? x + " of " + n : x ? String(x) : "—");
      const cells = !row ? [D.el("td", { colspan: "5", class: "muted", text: "Not started" })] : [
        D.el("td", { text: frac((d.tabs || []).length, d.tabsTotal) }),
        D.el("td", { text: frac((d.ops || []).length, d.opsTotal) }),
        D.el("td", { text: total ? right + " of " + total + " right" : "—" }),
        D.el("td", { text: (d.lc || []).length ? solved + " solved of " + d.lc.length + (revisit ? ", " + revisit + " to revisit" : "") : "—" }),
        D.el("td", { text: String(liveNotes(page).length || "—") }),
      ];
      table.appendChild(D.el("tr", {}, [D.el("th", { scope: "row" }, [D.el("a", { href: a.getAttribute("href"), text: name })])].concat(cells)));
    });
    body.appendChild(D.el("div", { style: "overflow-x:auto", tabindex: "0", role: "region", "aria-label": "Progress by module" }, [table]));
    const notes = liveNotes(null);
    if (notes.length) {
      body.appendChild(D.el("h3", { text: "Your notes" }));
      const ul = D.el("ul", { class: "note-list" });
      notes.slice(0, 50).forEach((n) => ul.appendChild(D.el("li", {}, [
        D.el("a", { href: n.page + ".html#note=" + n.id, text: noteLine(n) }),
        D.el("p", { class: "note-body", text: n.body }),
      ])));
      body.appendChild(ul);
    }
  }

  /* ================= the account button ================= */
  let ui = null;
  function buildAccountUI() {
    const bar = D.$(".topbar-in");
    if (!bar || ui) return;
    const btn = D.el("button", { type: "button", class: "acct-btn", "aria-expanded": "false", "aria-controls": "acct-menu" });
    const menu = D.el("div", { class: "acct-menu", id: "acct-menu", hidden: "" });
    const wrap = D.el("div", { class: "acct" }, [btn, menu]);
    bar.appendChild(wrap);
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => { const open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) paintMenu(); });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); } });
    ui = { btn: btn, menu: menu, close: close };
  }
  const STATE_TEXT = { saved: "All changes saved.", saving: "Saving…", offline: "Offline: your changes will sync when you're back online.", error: "Couldn't reach the server. Your changes are kept here and will sync later." };
  function paintState() { const s = ui && ui.menu.querySelector(".acct-state"); if (s) s.textContent = STATE_TEXT[api.state] || ""; }
  function paintMenu() {
    const m = ui.menu;
    m.innerHTML = "";
    if (!session) {
      const keep = D.el("input", { type: "checkbox", id: "acct-keep", checked: "" });
      const go = D.el("button", { type: "button", class: "primary", text: "Continue with Google" });
      go.addEventListener("click", () => signIn(keep.checked));
      m.append(
        D.el("p", { text: "Sign in to keep a progress map, a status on every LeetCode problem, and notes on any step, on every computer you use." }),
        D.el("label", { class: "acct-keep", for: "acct-keep" }, [keep, " Keep me signed in on this computer"]),
        D.el("p", { class: "small muted", text: "On a shared computer, untick it: you're signed out when the browser closes." }),
        go,
        D.el("p", { class: "small muted" }, ["Stored: your email, progress, LeetCode status and notes. Nothing else. ", D.el("a", { href: D.ROOT + "privacy.html", text: "Privacy policy" })]),
      );
      return;
    }
    const out = D.el("button", { type: "button", text: "Sign out" });
    const del = D.el("button", { type: "button", class: "danger", text: "Delete my account" });
    out.addEventListener("click", signOut);
    del.addEventListener("click", deleteAccount);
    m.append(
      D.el("p", {}, ["Signed in as ", D.el("b", { text: session.user.email || session.user.name || "you" })]),
      D.el("p", { class: "small muted acct-state", role: "status", text: STATE_TEXT[api.state] || "" }),
      D.el("p", {}, [D.el("a", { href: D.ROOT + "cse214/index.html#my-progress", text: "Your progress" })]),
      D.el("div", { class: "acct-actions" }, [out, del]),
    );
  }
  async function signOut() {
    await flush();
    const t = session && session.access_token;
    if (t) fetch(BASE + "/auth/v1/logout", { method: "POST", headers: { apikey: cfg.anonKey, authorization: "Bearer " + t } }).catch(() => {});
    forget();
    if (ui) ui.close();
    paint();
    toast("Signed out. Your progress is safe in your account.");
  }
  async function deleteAccount() {
    if (!confirm("Delete your account, progress, LeetCode status and notes on every computer? This can't be undone.")) return;
    try {
      await rest("rpc/delete_me", { method: "POST", body: "{}" });
      forget();
      if (ui) ui.close();
      paint();
      toast("Your account and everything in it was deleted.");
    } catch (e) { toast("Couldn't delete the account right now. Check your connection and try again."); }
  }

  function toast(text) {
    domReady.then(() => {
      let t = D.$("#acct-toast");
      if (!t) { t = D.el("div", { id: "acct-toast", class: "acct-toast", role: "status", "aria-live": "polite" }); document.body.appendChild(t); }
      t.textContent = text;
      t.hidden = false;
      clearTimeout(toast.t);
      toast.t = setTimeout(() => { t.hidden = true; }, 6000);
    });
  }

  /* one place that makes the page match "signed in or not" */
  function paint() {
    api.user = session ? session.user : null;
    if (ui) {
      const label = session ? (session.user.name || session.user.email || "Account").split(/[\s@]/)[0] : "Sign in";
      ui.btn.textContent = label;
      ui.btn.setAttribute("aria-label", session ? "Account: signed in as " + (session.user.email || label) : "Sign in");
      ui.btn.classList.toggle("signed-in", !!session);
      if (!ui.menu.hidden) paintMenu();
    }
    noteUIs.forEach(paintNoteButton);
    D.$$("#practice").forEach(decoratePractice);
    paintNotesBox();
    paintProgressMap();
  }

  /* ================= start ================= */
  loadSession();
  if (session) loadCache();
  (async () => {
    await finishSignIn();
    if (session && !cache) loadCache();
    await domReady;
    buildAccountUI();
    paint();
    if (!session) return;
    recordVisit();
    await sync();
    const m = /^#note=([\w-]+)$/.exec(location.hash);
    if (m) openNote(m[1]);
  })();
  window.addEventListener("online", () => { if (session) sync(); });
  let lastPull = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (!session) return;
    if (document.visibilityState === "hidden") flush();
    else if (Date.now() - lastPull > 30000) { lastPull = Date.now(); sync(); }
  });
  window.addEventListener("hashchange", () => { const m = /^#note=([\w-]+)$/.exec(location.hash); if (m && session) openNote(m[1]); });

  api.sync = sync;
  api.openNote = openNote;
})();
