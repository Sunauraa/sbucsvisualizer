/* ============================================================
   tutor.js: the "Why?" button under every player.

   Free by design, in two layers:
     1. Saved explanations. why-data.js holds hand-written reasons for
        the important lines; anything else gets a reason worked out from
        the shape of the line itself. No network, works offline, and it
        cannot make things up.
     2. Ask AI (optional). If the Vercel function has a free-tier key, a
        question box appears. If there is no key, or the free limit runs
        out, the saved explanation simply stays on screen.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const ANCHOR = /\s*@@([\w-]+(?:,[\w-]+)*)\s*$/;

  const plain = (html) => {
    const d = document.createElement("div");
    d.innerHTML = String(html == null ? "" : html);
    return d.textContent.replace(/\s+/g, " ").trim();
  };
  const page = () => (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");

  /* ---------- which lines is this frame on? ---------- */
  function linesFor(player, f) {
    if (f.whyLine != null) return { lang: "java", lines: [{ text: String(f.whyLine).trim(), tags: [], cond: false, kind: f.whyKind, fn: f.whyFn }], key: null, anchors: [] };
    const dock = player.code;
    const key = f.code || (dock && dock.current);
    const L = dock && dock.listings && dock.listings[key];
    if (!L || f.line == null) return { lang: D.lang(), lines: [], key: key, anchors: [] };
    const lang = L[D.lang()] ? D.lang() : L.pseudo ? "pseudo" : "java";
    const wanted = (Array.isArray(f.line) ? f.line : [f.line]).filter((a) => typeof a === "string");
    const all = L[lang].map((t) => {
      const m = ANCHOR.exec(t);
      return { text: (m ? t.slice(0, m.index) : t).trim(), tags: m ? m[1].split(",") : [] };
    });
    const lines = [];
    wanted.forEach((w) => {
      const cond = w.endsWith("^"), a = cond ? w.slice(0, -1) : w;
      const hits = all.filter((l) => l.tags.indexOf(a) >= 0);
      (cond ? hits.slice(0, 1) : hits).forEach((l) => {
        if (lines.indexOf(l) < 0) { l.cond = cond; l.anchor = a; lines.push(l); }
      });
    });
    return { lang: lang, lines: lines, key: key, anchors: wanted.map((w) => w.replace(/\^$/, "")) };
  }

  /* ---------- a reason worked out from the shape of a line ---------- */
  /* text inside the first ( ... ), so "if (t == null) return;" gives "t == null" and not "t == null) return" */
  function parenthesized(t) {
    const open = t.indexOf("(");
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < t.length; i++) {
      if (t[i] === "(") depth++;
      else if (t[i] === ")" && --depth === 0) return { inner: t.slice(open + 1, i), rest: t.slice(i + 1).trim() };
    }
    return null;
  }
  /** explainLine("if (a[j] > a[j + 1]) {") → a sentence on what this kind of line does.
      It only sees the line's shape, so it must never claim more than the shape proves.
      opts: cond (the test failed), fn (this method's name), kind ("call" or "return" when the method starts or ends) */
  function explainLine(raw, opts) {
    const o = opts || {};
    if (o.kind === "call") return "The method starts here. It gets a new frame on the call stack, holding its own copy of each parameter.";
    if (o.kind === "return") return "This method has finished, so its frame leaves the call stack and control goes back to its caller.";
    const comment = (/\/\/\s*(.+)$/.exec(raw) || [])[1];
    const t = raw.replace(/\/\/.*$/, "").trim().replace(/;\s*$/, "").replace(/\{\s*$/, "").replace(/^\}\s*/, "").trim();
    if (!t) return "The block closes here, so control moves on to whatever comes after it.";
    const fn = o.fn;
    let m, why = null;
    const skip = o.cond ? " The test came out false this time, so its body is skipped." : "";
    if (/^(if|else\s+if)\b/.test(t)) {
      const p = parenthesized(t);
      const test = p && !/:\s*$/.test(t) ? p.inner : t.replace(/^(else\s+)?if\s*/, "").replace(/:.*$/, "");
      why = "A decision. What happens next depends on whether <code>" + esc(test.trim()) + "</code> is true." + skip;
    } else if (/^else\b/.test(t)) why = "The other branch: it runs because the earlier test was false.";
    else if (/^(while\b)/.test(t)) {
      const p = parenthesized(t);
      const test = p ? p.inner : t.replace(/^while\s*/, "").replace(/:\s*$/, "");
      why = "A loop test. The body repeats for as long as <code>" + esc(test.trim()) + "</code> stays true, so something in the body must eventually make it false." + (o.cond ? " It is false now, so the loop ends." : "");
    } else if (/^do\b/.test(t)) why = "A do loop runs its body once before it checks its condition for the first time.";
    else if (/^for\b/.test(t)) {
      const p = parenthesized(t);
      why = p && p.inner.indexOf(":") >= 0 && p.inner.indexOf(";") < 0
        ? "A for-each loop. The body runs once for each element, in order."
        : "A loop header. It sets where the loop starts, when it stops, and how it moves on after each pass." + (o.cond ? " The range is used up now, so the loop ends." : "");
    } else if ((m = /^return\b\s*(.*)$/.exec(t))) {
      why = m[1] ? "This call hands the value of <code>" + esc(m[1]) + "</code> back to whoever called it, and then its stack frame goes away." : "Nothing more to do here, so this call ends and control goes back to its caller.";
    } else if (/^(throw\b|error\b)/.test(t) || /:\s*error\b/.test(t)) {
      why = "This stops the method with an error. Unless a caller catches it, the program ends here.";
    } else if (/^break\b/.test(t)) why = "This leaves the nearest loop or switch immediately.";
    else if (/^continue\b/.test(t)) why = "This skips the rest of the loop's body and goes straight to the next pass.";
    else if (/^swap\b/.test(t)) why = "Two values trade places.";
    else if (/^class\b|^(public|private|protected)\s+class\b/.test(t)) why = "A class is a blueprint: it lists the fields and methods its objects will have.";
    else if ((m = /^(?:(?:final\s+)?[\w<>\[\],.]+\s+)?([\w.]+(?:\[[^\]]*\])*)\s*(?:←|=(?!=)|\+=|-=|\*=|\/=|%=)\s*(.+)$/.exec(t))) {
      const self = fn && new RegExp("\\b" + fn + "\\s*\\(").test(m[2]);
      why = self
        ? "The right side is a recursive call: this frame pauses here until that call returns, then stores its answer in <code>" + esc(m[1]) + "</code>."
        : /\bnew\b/.test(m[2])
          ? "Allocates new memory and stores a reference to it in <code>" + esc(m[1]) + "</code>."
          : "Stores a new value in <code>" + esc(m[1]) + "</code>, so every later line sees the update.";
    } else if ((m = /^(?:[\w<>\[\],.]+)\s+(\w+)$/.exec(t)) && !/^(new|return)\b/.test(t)) {
      why = "Declares <code>" + esc(m[1]) + "</code> with no value of its own yet.";
    } else if ((m = /^([\w.\[\]]+)\s*(\+\+|--)$/.exec(t)) || (m = /^(\+\+|--)\s*([\w.\[\]]+)$/.exec(t))) {
      const name = m[1] === "++" || m[1] === "--" ? m[2] : m[1], op = m[1] === "++" || m[1] === "--" ? m[1] : m[2];
      why = (op === "++" ? "Adds 1 to" : "Subtracts 1 from") + " <code>" + esc(name) + "</code>.";
    } else if ((m = /^(?:[\w.\[\]]+\.)?(\w+)\s*\(.*\)$/.exec(t))) {
      why = fn && m[1] === fn
        ? "A recursive call: the same method again, with new arguments. This frame waits here until it returns."
        : /^System\.(out|err)\./.test(t)
          ? "Prints to the output below."
          : "Calls <code>" + esc(m[1]) + "</code>. This method pauses here until that call returns.";
    } else if (/^[\w ]+\(.*\)\s*:?$/.test(t) || /^(?:public|private|protected|static|void|int|double|boolean)\b.*\(.*\)/.test(t)) {
      why = "The method starts here, with its own fresh parameters on the call stack.";
    }
    if (comment && why) why += " The listing's own note: " + esc(comment) + ".";
    else if (comment) why = esc(comment.charAt(0).toUpperCase() + comment.slice(1)) + ".";
    return why || "This line carries the operation one step further; the caption above says what it did with these values.";
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  D.explainLine = explainLine;

  /* ---------- the hand-written explanations load the first time someone asks ---------- */
  let dataPromise = null;
  function loadData() {
    if (D.WHY) return Promise.resolve(D.WHY);
    if (!dataPromise) dataPromise = new Promise((res) => {
      const s = document.createElement("script");
      s.src = D.ROOT + "assets/js/why-data.js";
      s.onload = () => res(D.WHY || {});
      s.onerror = () => res({});
      document.head.appendChild(s);
    });
    return dataPromise;
  }
  /** The explanation for this frame's lines: { html, saved } */
  function explanation(player, f, info) {
    const table = (D.WHY && D.WHY[page()] && D.WHY[page()][info.key]) || {};
    const parts = [], seen = new Set();
    let saved = false;
    info.lines.forEach((l) => {
      const hand = l.anchor && table[l.cond ? l.anchor + "^" : l.anchor];
      if (hand) { if (!seen.has(hand)) { seen.add(hand); parts.push(hand); saved = true; } return; }
      /* a condition that failed, with no note of its own: the note for the line still applies */
      const base = l.anchor && table[l.anchor];
      if (l.cond && base && !seen.has(base)) { seen.add(base); parts.push(base + " This time the test failed, so its body is skipped."); saved = true; return; }
      const name = info.key && player.code && player.code.listings[info.key] && (/(\w+)\s*\(/.exec(player.code.listings[info.key].java ? player.code.listings[info.key].java[0] : "") || [])[1];
      const auto = explainLine(l.text, { cond: l.cond, fn: name || l.fn, kind: l.kind });
      if (!seen.has(auto)) { seen.add(auto); parts.push(auto); }
    });
    return { html: parts, saved: saved };
  }

  /* ---------- Ask AI: only offered when the Vercel function says it is ready ---------- */
  let aiStatus = null;
  function checkAI() {
    if (aiStatus) return aiStatus;
    aiStatus = (location.protocol === "file:"
      ? Promise.resolve(false)
      : fetch(D.ROOT + "api/tutor", { method: "GET", headers: { accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : { enabled: false }))
          .then((j) => !!j.enabled)
          .catch(() => false));
    return aiStatus;
  }
  const CLIENT_LIMITS = { question: 400, note: 800, code: 1600 };
  async function ask(player, f, info, question, why) {
    const res = await fetch(D.ROOT + "api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: question.slice(0, CLIENT_LIMITS.question),
        page: document.title.slice(0, 80),
        step: plain(f.note).slice(0, CLIENT_LIMITS.note),
        lines: info.lines.map((l) => l.text).join("\n").slice(0, CLIENT_LIMITS.code),
        saved: why.map(plain).join(" ").slice(0, CLIENT_LIMITS.note),
      }),
    });
    let j = {};
    try { j = await res.json(); } catch (e) {}
    if (res.ok && j.answer) return { answer: j.answer };
    return { unavailable: true, message: j.message || "" };
  }

  D.playerAddons.push(function (player) {
    let open = false, question = "";
    const btn = D.el("button", { type: "button", class: "tool-btn", "aria-pressed": "false", title: "Explain why this step happens", text: "Why?" });
    const panel = D.el("section", { class: "learn-panel why", hidden: "", "aria-label": "Why this step" });
    player.tools.appendChild(btn);
    player.extra.appendChild(panel);

    function paint() {
      if (!open) return;
      const f = player.frames[player.index] || {};
      const info = linesFor(player, f);
      panel.innerHTML = "";
      const head = D.el("div", { class: "learn-head" }, [D.el("h3", { text: "Why this step?" })]);
      panel.appendChild(head);
      if (!info.lines.length) {
        panel.appendChild(D.el("p", { text: f.line === null || f.line === undefined ? "No line of code runs in this step. It is the start or the summary of the run, so the caption above says it all." : "No explanation for this step." }));
        paintAsk(f, info, []);
        return;
      }
      const pre = D.el("pre", { class: "why-code", "data-lang": info.lang });
      pre.textContent = info.lines.map((l) => l.text.replace(/\s*\/\/.*$/, "")).join("\n");
      panel.appendChild(pre);
      const ex = explanation(player, f, info);
      ex.html.forEach((h) => panel.appendChild(D.el("p", { html: h })));
      paintAsk(f, info, ex.html);
    }

    /* the box and the last answer survive stepping, but the answer belongs to the step it was asked on */
    let answerFor = null, answerEl = null;
    function paintAsk(f, info, why) {
      const slot = D.el("div", { class: "why-ask" });
      panel.appendChild(slot);
      checkAI().then((ready) => {
        if (!ready || !slot.isConnected) return;
        const form = D.el("form", { class: "ask-form" });
        const input = D.el("input", { type: "text", maxlength: CLIENT_LIMITS.question, placeholder: "Ask about this step", "aria-label": "Ask the AI tutor about this step" });
        input.value = question;
        input.addEventListener("input", () => { question = input.value; });
        const go = D.el("button", { type: "submit", text: "Ask AI" });
        const out = D.el("div", { class: "ask-out", role: "status", "aria-live": "polite" });
        form.appendChild(input);
        form.appendChild(go);
        slot.appendChild(form);
        slot.appendChild(out);
        slot.appendChild(D.el("p", { class: "ask-note", text: "Free AI, so it can be wrong: check it against the code. Your question goes to the AI provider, so leave out personal details." }));
        if (answerFor === player.index && answerEl) out.appendChild(answerEl);
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const q = input.value.trim();
          if (!q) { input.focus(); return; }
          go.disabled = true; input.disabled = true;
          out.textContent = "Thinking…";
          let r;
          try { r = await ask(player, f, info, q, why); } catch (err) { r = { unavailable: true }; }
          go.disabled = false; input.disabled = false;
          out.textContent = "";
          const el = r.answer
            ? D.el("p", { class: "ask-answer", text: r.answer })
            : D.el("p", { class: "ask-off", text: r.message || "The AI tutor is out of free answers for now. The explanation above still applies, so try again later." });
          answerFor = player.index; answerEl = el;
          out.appendChild(el);
          question = r.answer ? "" : q;
          input.value = question;
        });
      });
    }

    btn.addEventListener("click", async () => {
      open = !open;
      btn.setAttribute("aria-pressed", String(open));
      btn.classList.toggle("on", open);
      panel.hidden = !open;
      if (open) {
        player.pause();
        await loadData();
        paint();
        panel.scrollIntoView({ block: "nearest" });
      }
    });
    player.frameHooks.push(() => { if (open) paint(); });
    D.onLang(() => { if (open) paint(); });
  });
})();
