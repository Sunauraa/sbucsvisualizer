/* ============================================================
   quiz.js: predict the next step before it happens.

   With "Quiz me" on, the player stops at a good moment and asks one
   question, built from the frames already recorded, so every module
   gets it without extra code:

     which line runs next?   at a branch: a line that this very run
                             left in more than one direction
     what happens next?      elsewhere: the real next caption against
                             captions from other steps of this run

   The answer is simply the next frame, so a question can never go out
   of date. Answering reveals the result and carries on.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const LS = "dsa.quiz.score.v1";
  const ANCHOR = /\s*@@([\w-]+(?:,[\w-]+)*)\s*$/;
  const SPACING = 4;                        /* at least this many steps between two questions */

  const plain = (html) => {
    const d = document.createElement("div");
    d.innerHTML = String(html == null ? "" : html);
    return d.textContent.replace(/\s+/g, " ").trim();
  };
  const anchors = (line) => (line == null ? [] : (Array.isArray(line) ? line : [line]).filter((a) => typeof a === "string").map((a) => a.replace(/\^$/, "")));
  const lineKey = (line) => anchors(line).join("+");
  const shuffled = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* The listing lines for a key, in the language on screen: [{ text, tags }] */
  function listingLines(player, key) {
    const docks = D._docks || [];
    const dock = player.code && player.code.listings && player.code.listings[key] ? player.code : docks.find((d) => d.listings[key]);
    const L = dock && dock.listings[key];
    if (!L) return null;
    const src = L[D.lang()] || L.pseudo || L.java;
    if (!src) return null;
    return src.map((t) => {
      const m = ANCHOR.exec(t);
      return { text: (m ? t.slice(0, m.index) : t).replace(/\s*\/\/.*$/, "").trim(), tags: m ? m[1].split(",") : [] };
    }).filter((l) => l.text && l.tags.length);
  }

  /* ---------- building a question for frame i → i + 1 ---------- */
  function lineQuestion(player, frames, i, nexts) {
    const f = frames[i], g = frames[i + 1];
    const key = g.code || f.code;
    if (!key || f.line == null || g.line == null || (f.code && g.code && f.code !== g.code)) return null;
    const want = anchors(g.line), from = lineKey(f.line);
    if (!want.length || lineKey(g.line) === from) return null;
    const lines = listingLines(player, key);
    if (!lines) return null;
    const right = lines.find((l) => want.some((a) => l.tags.indexOf(a) >= 0));
    if (!right) return null;
    const isRight = (l) => l.text === right.text || want.some((a) => l.tags.indexOf(a) >= 0);
    const seen = new Set(), pool = [];
    const add = (l) => { if (l && !isRight(l) && !seen.has(l.text)) { seen.add(l.text); pool.push(l); } };
    /* the best wrong answers are the other ways this same line went during this run */
    (nexts.get(from) || new Set()).forEach((k) => k.split("+").forEach((a) => add(lines.find((l) => l.tags.indexOf(a) >= 0))));
    shuffled(lines).forEach(add);
    if (pool.length < 2) return null;
    const opts = shuffled([{ text: right.text, ok: true }].concat(pool.slice(0, 3).map((l) => ({ text: l.text, ok: false }))));
    return { kind: "line", ask: "Which line runs next?", opts: opts, explain: plain(g.note) };
  }
  function stepQuestion(frames, i) {
    const g = frames[i + 1];
    const right = plain(g.note);
    if (right.length < 12 || right.length > 220) return null;
    /* wrong answers: captions from nearby steps of this run, which sound as plausible as the real one */
    const seen = new Set([right]), pool = [];
    const order = [];
    for (let d = 2; d < 40 && order.length < 40; d++) { if (frames[i + d]) order.push(frames[i + d]); if (frames[i + 1 - d]) order.push(frames[i + 1 - d]); }
    order.forEach((h) => {
      const t = plain(h.note);
      if (t.length >= 12 && t.length <= 220 && !seen.has(t)) { seen.add(t); pool.push(t); }
    });
    if (pool.length < 2) return null;
    const opts = shuffled([{ text: right, ok: true }].concat(pool.slice(0, 3).map((t) => ({ text: t, ok: false }))));
    return { kind: "step", ask: "What happens next?", opts: opts, explain: "" };
  }

  function successors(frames) {
    const nexts = new Map();
    for (let i = 0; i + 1 < frames.length; i++) {
      const a = lineKey(frames[i].line), b = lineKey(frames[i + 1].line);
      if (!a || !b || frames[i].code !== frames[i + 1].code) continue;
      if (!nexts.has(a)) nexts.set(a, new Set());
      nexts.get(a).add(b);
    }
    return nexts;
  }

  /* ---------- score, kept between pages ---------- */
  let score = { right: 0, total: 0 };
  try { const s = JSON.parse(localStorage.getItem(LS) || "null"); if (s && s.total >= 0) score = s; } catch (e) {}
  const saveScore = () => { try { localStorage.setItem(LS, JSON.stringify(score)); } catch (e) {} };

  D.playerAddons.push(function (player) {
    let on = false, asked = -1, open = null, last = -1e9, nexts = new Map(), resumed = false;
    const btn = D.el("button", { type: "button", class: "tool-btn", "aria-pressed": "false", title: "Stop before some steps and ask what happens next", text: "Quiz me" });
    const panel = D.el("section", { class: "learn-panel quiz", hidden: "", "aria-label": "Predict the next step" });
    player.tools.appendChild(btn);
    player.extra.appendChild(panel);

    function close() {
      open = null;
      panel.hidden = true;
      panel.innerHTML = "";
    }
    function reset() { close(); asked = -1; last = -1e9; }
    player.loadHooks.push((frames) => { reset(); nexts = on ? successors(frames) : new Map(); });
    /* moving by any other route (the slider, back, first, last) drops a question that no longer applies */
    player.frameHooks.push((f, i) => { if (open && i !== open.at) close(); });

    btn.addEventListener("click", () => {
      on = !on;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("on", on);
      nexts = on ? successors(player.frames) : new Map();
      reset();
    });

    function build(i) {
      const frames = player.frames;
      if (i + 1 >= frames.length || i - last < SPACING || !frames[i + 1].note) return null;
      if (frames[i].L || frames[i + 1].L) return stepQuestion(frames, i);
      const from = lineKey(frames[i].line);
      const branch = from && nexts.has(from) && nexts.get(from).size > 1;
      if (branch) { const q = lineQuestion(player, frames, i, nexts); if (q) return q; }
      /* no branch here: ask about one step in six, or the quiz gets in the way */
      if (i - last >= 6 || last < 0) return lineQuestion(player, frames, i, nexts) || stepQuestion(frames, i);
      return null;
    }

    function answer(q, idx, choices) {
      if (q.answered) return;
      q.answered = true;
      const ok = q.opts[idx].ok;
      score.total++;
      if (ok) score.right++;
      saveScore();
      D.emit("quiz", { ok: ok });
      choices.forEach((b, j) => {
        b.disabled = true;
        b.classList.toggle("right", q.opts[j].ok);
        b.classList.toggle("wrong", j === idx && !ok);
        b.setAttribute("aria-label", (q.opts[j].ok ? "Correct answer: " : j === idx ? "Your answer, incorrect: " : "") + q.opts[j].text);
      });
      const res = panel.querySelector(".quiz-result");
      res.innerHTML = "";
      res.appendChild(D.el("b", { text: ok ? "Correct." : "Not quite." }));
      if (q.explain) res.appendChild(document.createTextNode(" " + q.explain));
      res.appendChild(D.el("span", { class: "quiz-score", text: score.right + " of " + score.total + " right" }));
      const go = D.el("button", { type: "button", class: "primary", text: "Next step" });
      go.addEventListener("click", () => advance(q));
      res.appendChild(go);
      go.focus({ preventScroll: true });
    }
    function advance(q) {
      close();
      asked = q.at;                      /* let the gate pass this frame */
      const wasPlaying = q.wasPlaying;
      player.goto(q.at + 1);
      /* the panel that had the focus is gone, so hand it back to the player */
      const play = player.mount.querySelector('[data-a="play"]');
      if (play) play.focus({ preventScroll: true });
      if (wasPlaying) player.play();
    }

    function show(q, i) {
      q.at = i;
      q.wasPlaying = player.playing;
      open = q;
      player.pause();
      panel.hidden = false;
      panel.innerHTML = "";
      const title = D.el("h3", { text: q.ask, tabindex: "-1" });
      const head = D.el("div", { class: "learn-head" }, [title]);
      const skip = D.el("button", { type: "button", class: "ghost", text: "Skip" });
      skip.addEventListener("click", () => advance(q));
      head.appendChild(skip);
      panel.appendChild(head);
      const list = D.el("div", { class: "quiz-opts", role: "group", "aria-label": q.ask });
      const choices = q.opts.map((o, j) => {
        const b = D.el("button", { type: "button", class: "quiz-opt" + (q.kind === "line" ? " is-code" : "") });
        b.appendChild(D.el("kbd", { text: j + 1 }));
        b.appendChild(D.el("span", { text: o.text }));
        b.addEventListener("click", () => answer(q, j, choices));
        list.appendChild(b);
        return b;
      });
      panel.appendChild(list);
      panel.appendChild(D.el("div", { class: "quiz-result", role: "status", "aria-live": "polite" }));
      open.choices = choices;
      title.focus({ preventScroll: true });
    }

    player.gate = function (i) {
      if (!on) return false;
      if (open) return true;             /* already waiting for an answer */
      if (asked === i) { asked = -1; return false; }
      const q = build(i);
      if (!q) return false;
      last = i;
      show(q, i);
      return true;
    };

    /* keys 1 to 4 answer, Enter moves on */
    document.addEventListener("keydown", (e) => {
      if (!open || panel.hidden) return;
      const t = e.target;
      if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= open.opts.length && !open.answered) { e.preventDefault(); answer(open, n - 1, open.choices); }
    });
  });
})();
