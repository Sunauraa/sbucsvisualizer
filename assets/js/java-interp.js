/* ============================================================
   java-interp.js: runs the Java that a data structures course uses,
   one statement at a time, recording a frame per statement.

   Why not real Java? A JVM in the browser is a large download with its
   own license terms, and a real JVM would not tell us which line is
   running. This small interpreter is free, starts instantly, and it
   never calls eval: student code can only do what this file implements,
   and it runs inside a Web Worker that the page can stop at any time.

   Supported: classes with fields, constructors, static and instance
   methods, single inheritance with super, generics (types are parsed and
   ignored), recursion, arrays of any dimension, control flow including
   switch and try / catch / throw, String, Math, Integer, Arrays, and
   ArrayList, LinkedList, Stack, ArrayDeque, Queue, HashMap, HashSet.
   Anything else is a clear error naming what is missing.
   Limits: long is a JS number, exact only up to 2^53.
   ============================================================ */
(function (root) {
  "use strict";

  class CompileError extends Error { constructor(msg, line) { super(msg); this.line = line; } }
  class StepLimit extends Error {}
  class JavaThrow extends Error { constructor(cls, msg, line) { super(msg); this.cls = cls; this.jmsg = msg; this.line = line; } }
  class BreakSig { constructor(label) { this.label = label; } }
  class ContinueSig { constructor(label) { this.label = label; } }
  class ReturnSig { constructor(val) { this.val = val; } }

  /* a plain lookup table: a Java name like toString must not find something on Object.prototype */
  const dict = (o) => Object.assign(Object.create(null), o || {});

  /* ---------- lexer ---------- */
  const KEYWORDS = new Set("abstract boolean break byte case catch char class continue default do double else extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while".split(" "));
  const OPS = [">>>=", "<<=", ">>=", ">>>", "...", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "->", "::", "+", "-", "*", "/", "%", "=", "<", ">", "!", "~", "?", ":", ";", ",", ".", "(", ")", "[", "]", "{", "}", "&", "|", "^", "@"];
  function lex(src) {
    const toks = [];
    let i = 0, line = 1;
    const n = src.length;
    const escapes = { n: "\n", t: "\t", r: "\r", "0": "\0", b: "\b", f: "\f", "\\": "\\", "'": "'", '"': '"' };
    while (i < n) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (c === " " || c === "\t" || c === "\r") { i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") {
        const start = line; i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
        if (i >= n) throw new CompileError("This comment is never closed: add */.", start);
        i += 2; continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w$]/.test(src[j])) j++;
        const w = src.slice(i, j);
        toks.push({ t: KEYWORDS.has(w) ? "kw" : "id", v: w, line });
        i = j; continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
        const m = /^(0[xX][0-9a-fA-F_]+[lL]?|0[bB][01_]+[lL]?|(?:[0-9][0-9_]*\.?[0-9_]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[dDfFlL]?)/.exec(src.slice(i));
        let s = m[0];
        i += s.length;
        const suffix = /[dDfFlL]$/.test(s) && !/^0[xX]/.test(s) ? s[s.length - 1].toLowerCase() : /^0[xXbB].*[lL]$/.test(s) ? "l" : "";
        if (suffix) s = s.slice(0, -1);
        s = s.replace(/_/g, "");
        const isFloat = !/^0[xXbB]/.test(s) && (/[.eE]/.test(s) || suffix === "d" || suffix === "f");
        const v = /^0[bB]/.test(s) ? parseInt(s.slice(2), 2) : Number(s);
        toks.push({ t: "num", v: v, ty: isFloat ? (suffix === "f" ? "float" : "double") : suffix === "l" ? "long" : "int", line });
        continue;
      }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < n && src[j] !== '"') {
          if (src[j] === "\n") throw new CompileError('This string is never closed: add a closing ".', line);
          if (src[j] === "\\") { s += escapes[src[j + 1]] != null ? escapes[src[j + 1]] : src[j + 1]; j += 2; } else s += src[j++];
        }
        if (j >= n) throw new CompileError('This string is never closed: add a closing ".', line);
        toks.push({ t: "str", v: s, line });
        i = j + 1; continue;
      }
      if (c === "'") {
        let j = i + 1, s;
        if (src[j] === "\\") { s = escapes[src[j + 1]] != null ? escapes[src[j + 1]] : src[j + 1]; j += 2; } else s = src[j++];
        if (src[j] !== "'") throw new CompileError("A char literal holds exactly one character, like 'a'. Use double quotes for a String.", line);
        toks.push({ t: "chr", v: s.charCodeAt(0), line });
        i = j + 1; continue;
      }
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new CompileError("I don't understand the character " + JSON.stringify(c) + " here.", line);
      toks.push({ t: "op", v: op, line });
      i += op.length;
    }
    toks.push({ t: "eof", v: "end of file", line });
    return toks;
  }

  /* ---------- parser ---------- */
  const PRIMS = new Set(["int", "long", "short", "byte", "double", "float", "boolean", "char", "void"]);
  const MODS = new Set(["public", "private", "protected", "static", "final", "abstract"]);

  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = (k) => toks[p + (k || 0)];
    const is = (v, k) => { const t = peek(k); return (t.t === "op" || t.t === "kw") && t.v === v; };
    const eat = (v) => { if (is(v)) { p++; return true; } return false; };
    const fail = (msg, t) => { throw new CompileError(msg, (t || peek()).line); };
    const expect = (v, hint) => {
      if (!is(v)) fail(hint || "Expected " + v + " but found " + (peek().t === "eof" ? "the end of the file" : '"' + peek().v + '"') + ".");
      return toks[p++];
    };
    const ident = (what) => {
      if (peek().t !== "id") fail("Expected " + (what || "a name") + " but found " + (peek().t === "eof" ? "the end of the file" : '"' + peek().v + '"') + ".");
      return toks[p++].v;
    };

    /* type := name [<...>] {[]} ; returns { name, dims } or null when this is not a type */
    function tryType() {
      const start = p;
      const t = peek();
      let name;
      if (t.t === "kw" && PRIMS.has(t.v)) { name = t.v; p++; }
      else if (t.t === "id") {
        name = t.v; p++;
        while (is(".") && peek(1).t === "id") { p++; name = toks[p++].v; }
        if (is("<") && !skipGenerics()) { p = start; return null; }
      } else return null;
      let dims = 0;
      while (is("[") && is("]", 1)) { p += 2; dims++; }
      if (is("...")) { p++; dims++; }
      return { name, dims };
    }
    function skipGenerics() {
      let depth = 0;
      const start = p;
      for (;;) {
        const t = peek();
        if (t.t === "op" && t.v === "<") depth++;
        else if (t.t === "op" && t.v === ">") depth--;
        else if (t.t === "op" && t.v === ">>") depth -= 2;
        else if (t.t === "op" && t.v === ">>>") depth -= 3;
        else if (t.t === "id" || (t.t === "kw" && (PRIMS.has(t.v) || t.v === "extends" || t.v === "super")) || (t.t === "op" && (t.v === "," || t.v === "?" || t.v === "." || t.v === "[" || t.v === "]" || t.v === "&"))) { /* inside the brackets */ }
        else { p = start; return false; }
        p++;
        if (depth <= 0) return depth === 0 || true;
      }
    }
    const needType = (what) => { const t = tryType(); if (!t) fail("Expected a type for " + what + "."); return t; };

    function mods() {
      const m = new Set();
      for (;;) {
        if (is("@") && peek(1).t === "id") { p += 2; if (is("(")) { let d = 0; do { if (is("(")) d++; if (is(")")) d--; p++; } while (d > 0); } continue; }
        if (peek().t === "kw" && MODS.has(peek().v)) { m.add(toks[p++].v); continue; }
        return m;
      }
    }

    function classDecl() {
      const line = expect("class").line;
      const name = ident("a class name");
      if (is("<")) skipGenerics();
      let sup = null;
      if (eat("extends")) { const t = needType("the parent class"); sup = t.name; }
      if (eat("implements")) { do { needType("the interface"); } while (eat(",")); }
      const c = { name, sup, line, fields: [], methods: dict(), ctors: [], statics: [], inner: [] };
      expect("{", "A class body starts with {.");
      while (!is("}")) {
        if (peek().t === "eof") fail("Class " + name + " is missing its closing }.");
        member(c);
      }
      p++;
      return c;
    }
    function member(c) {
      if (eat(";")) return;
      const m = mods();
      if (is("class")) { const inner = classDecl(); c.inner.push(inner); return; }
      if (is("interface") || is("enum")) fail("Interfaces and enums are not available in the playground yet. Use a class.");
      if (is("{")) { const b = block(); (m.has("static") ? c.statics : c.fields).push({ init: b, isBlock: true, isStatic: m.has("static") }); return; }
      if (is("<")) skipGenerics();
      /* constructor: Name ( */
      if (peek().t === "id" && peek().v === c.name && is("(", 1)) {
        const line = peek().line; p++;
        const params = paramList();
        if (eat("throws")) { do { needType("the exception"); } while (eat(",")); }
        c.ctors.push({ name: c.name, params, body: block(), line, isCtor: true, cls: c.name });
        return;
      }
      const ty = needType("this member");
      const nameTok = peek();
      const name = ident("a member name");
      if (is("(")) {
        const params = paramList();
        if (eat("throws")) { do { needType("the exception"); } while (eat(",")); }
        const isAbstract = eat(";");
        const body = isAbstract ? null : block();
        const fn = { name, params, body, line: nameTok.line, ret: ty, isStatic: m.has("static"), cls: c.name };
        (c.methods[name] = c.methods[name] || []).push(fn);
        return;
      }
      /* fields */
      let cur = name;
      for (;;) {
        let dims = ty.dims;
        while (is("[") && is("]", 1)) { p += 2; dims++; }
        let init = null;
        if (eat("=")) init = is("{") ? arrayInit({ name: ty.name, dims }) : expr();
        const f = { name: cur, type: { name: ty.name, dims }, init, isStatic: m.has("static"), line: nameTok.line };
        (m.has("static") ? c.statics : c.fields).push(f);
        if (eat(",")) { cur = ident("a field name"); continue; }
        break;
      }
      expect(";", "A field declaration ends with ;.");
    }
    function paramList() {
      expect("(");
      const out = [];
      if (!is(")")) do {
        mods();
        const t = needType("this parameter");
        const name = ident("a parameter name");
        let dims = t.dims;
        while (is("[") && is("]", 1)) { p += 2; dims++; }
        out.push({ name, type: { name: t.name, dims } });
      } while (eat(","));
      expect(")", "The parameter list needs a closing ).");
      return out;
    }

    function block() {
      const line = expect("{", "Expected { to start a block.").line;
      const body = [];
      while (!is("}")) {
        if (peek().t === "eof") fail("A { on line " + line + " is never closed: add a }.");
        body.push(statement());
      }
      const endLine = peek().line;
      p++;
      return { k: "block", body, line, endLine };
    }

    /* a declaration if a type is followed by a name and then = , ; [ or : */
    function looksLikeDecl() {
      const start = p;
      mods();
      const t = tryType();
      const ok = t && peek().t === "id" && (is("=", 1) || is(",", 1) || is(";", 1) || is("[", 1) || is(":", 1));
      p = start;
      return !!ok;
    }
    function declaration() {
      const line = peek().line;
      mods();
      const ty = needType("this variable");
      const vars = [];
      do {
        const name = ident("a variable name");
        let dims = ty.dims;
        while (is("[") && is("]", 1)) { p += 2; dims++; }
        const type = { name: ty.name, dims };
        let init = null;
        if (eat("=")) init = is("{") ? arrayInit(type) : expr();
        vars.push({ name, type, init });
      } while (eat(","));
      return { k: "decl", vars, line };
    }
    function arrayInit(type) {
      const line = expect("{").line;
      const inner = { name: type.name, dims: type.dims - 1 };
      const items = [];
      while (!is("}")) {
        items.push(is("{") ? arrayInit(inner) : expr());
        if (!eat(",")) break;
      }
      expect("}", "This array initializer needs a closing }.");
      return { k: "arrlit", elem: inner, items, line };
    }

    function statement() {
      const t = peek(), line = t.line;
      if (is("{")) return block();
      if (eat(";")) return { k: "empty", line };
      if (t.t === "id" && is(":", 1) && (toks[p + 2].v === "for" || toks[p + 2].v === "while" || toks[p + 2].v === "do")) {
        p += 2;
        const s = statement();
        s.label = t.v;
        return s;
      }
      if (eat("if")) {
        expect("(", "An if needs a condition in parentheses.");
        const cond = expr();
        expect(")", "The if condition needs a closing ).");
        const then = statement();
        const other = eat("else") ? statement() : null;
        return { k: "if", cond, then, other, line };
      }
      if (eat("while")) {
        expect("(", "A while needs a condition in parentheses.");
        const cond = expr();
        expect(")", "The while condition needs a closing ).");
        return { k: "while", cond, body: statement(), line };
      }
      if (eat("do")) {
        const body = statement();
        const wl = expect("while", "A do block ends with while (condition);.").line;
        expect("(");
        const cond = expr();
        expect(")");
        expect(";");
        return { k: "dowhile", cond, body, line, condLine: wl };
      }
      if (eat("for")) {
        expect("(", "A for needs parentheses.");
        if (looksLikeDecl()) {
          const save = p;
          mods();
          const ty = needType("the loop variable");
          const name = ident("the loop variable");
          if (eat(":")) {
            const iter = expr();
            expect(")", "The for-each needs a closing ).");
            return { k: "foreach", type: ty, name, iter, body: statement(), line };
          }
          p = save;
        }
        const init = [];
        if (!is(";")) {
          if (looksLikeDecl()) init.push(declaration());
          else do { const e = expr(); init.push({ k: "expr", e, line }); } while (eat(","));
        }
        expect(";", "A for loop has three parts separated by ;.");
        const cond = is(";") ? null : expr();
        expect(";", "A for loop has three parts separated by ;.");
        const update = [];
        if (!is(")")) do { update.push(expr()); } while (eat(","));
        expect(")", "The for loop needs a closing ).");
        return { k: "for", init, cond, update, body: statement(), line };
      }
      if (eat("return")) {
        const e = is(";") ? null : expr();
        expect(";", "A return ends with ;.");
        return { k: "return", e, line };
      }
      if (eat("break")) { const label = peek().t === "id" ? toks[p++].v : null; expect(";"); return { k: "break", label, line }; }
      if (eat("continue")) { const label = peek().t === "id" ? toks[p++].v : null; expect(";"); return { k: "continue", label, line }; }
      if (eat("throw")) { const e = expr(); expect(";", "A throw ends with ;."); return { k: "throw", e, line }; }
      if (eat("try")) {
        const body = block();
        const catches = [];
        while (eat("catch")) {
          expect("(");
          mods();
          const types = [needType("the exception").name];
          while (eat("|")) types.push(needType("the exception").name);
          const name = ident("the exception variable");
          expect(")");
          catches.push({ types, name, body: block() });
        }
        const fin = eat("finally") ? block() : null;
        if (!catches.length && !fin) fail("A try needs a catch or a finally.", t);
        return { k: "try", body, catches, fin, line };
      }
      if (eat("switch")) {
        expect("(");
        const subject = expr();
        expect(")");
        expect("{");
        const cases = [];
        while (!is("}")) {
          const c = { tests: [], body: [], line: peek().line };
          if (eat("default")) c.isDefault = true;
          else { expect("case", "A switch body holds case and default labels."); do { c.tests.push(expr()); } while (eat(",")); }
          if (is("->")) fail("The arrow form of switch is not available yet. Use case X: with break.");
          expect(":", "A case label ends with a colon.");
          while (!is("case") && !is("default") && !is("}")) {
            if (peek().t === "eof") fail("This switch is missing its closing }.");
            c.body.push(statement());
          }
          cases.push(c);
        }
        p++;
        return { k: "switch", subject, cases, line };
      }
      if (is("class")) fail("Declare classes outside methods in the playground.");
      if (looksLikeDecl()) {
        const d = declaration();
        expect(";", "A declaration ends with ;.");
        return d;
      }
      const e = expr();
      if (!["assign", "call", "new", "preinc", "postinc", "supercall"].includes(e.k)) fail("This expression is not a statement: it computes a value and throws it away.", t);
      expect(";", "A statement ends with ;.");
      return { k: "expr", e, line };
    }

    /* ---------- expressions, by precedence ---------- */
    const ASSIGN = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", ">>>="]);
    const BIN = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">=", "instanceof"], ["<<", ">>", ">>>"], ["+", "-"], ["*", "/", "%"]];
    function expr() {
      const left = ternary();
      const t = peek();
      if (t.t === "op" && ASSIGN.has(t.v)) {
        if (!["name", "field", "index"].includes(left.k)) fail("You can only assign to a variable, a field or an array element.");
        p++;
        return { k: "assign", op: t.v, target: left, value: expr(), line: t.line };
      }
      return left;
    }
    function ternary() {
      const c = binary(0);
      if (is("?")) {
        const line = toks[p++].line;
        const a = ternary();
        expect(":", "A ?: expression needs a colon.");
        return { k: "cond", c, a, b: ternary(), line };
      }
      return c;
    }
    function binary(level) {
      if (level >= BIN.length) return unary();
      let l = binary(level + 1);
      for (;;) {
        const t = peek();
        if ((t.t !== "op" && t.t !== "kw") || !BIN[level].includes(t.v)) return l;
        p++;
        if (t.v === "instanceof") { const ty = needType("instanceof"); l = { k: "instanceof", e: l, type: ty, line: t.line }; continue; }
        l = { k: "bin", op: t.v, l, r: binary(level + 1), line: t.line };
      }
    }
    function isCast() {
      /* "(" primitive ... ")" is always a cast; "(Name)" is one only when a value follows */
      if (!is("(")) return false;
      const start = p;
      p++;
      const t = tryType();
      const closed = t && is(")");
      let ans = false;
      if (closed) {
        const prim = PRIMS.has(t.name);
        p++;
        const nx = peek();
        ans = prim || nx.t === "id" || nx.t === "num" || nx.t === "str" || nx.t === "chr" || (nx.t === "kw" && ["this", "new", "true", "false", "null", "super"].includes(nx.v)) || (nx.t === "op" && (nx.v === "(" || nx.v === "!" || nx.v === "~"));
      }
      p = start;
      return ans;
    }
    function unary() {
      const t = peek();
      if (t.t === "op") {
        if (t.v === "-" || t.v === "+" || t.v === "!" || t.v === "~") { p++; return { k: "un", op: t.v, e: unary(), line: t.line }; }
        if (t.v === "++" || t.v === "--") {
          p++;
          const target = unary();
          if (!["name", "field", "index"].includes(target.k)) fail("++ and -- need a variable, a field or an array element.", t);
          return { k: "preinc", op: t.v, target, line: t.line };
        }
        if (isCast()) {
          p++;
          const ty = needType("this cast");
          p++;
          return { k: "cast", type: ty, e: unary(), line: t.line };
        }
      }
      return postfix();
    }
    function args() {
      expect("(");
      const out = [];
      if (!is(")")) do { out.push(expr()); } while (eat(","));
      expect(")", "This call needs a closing ).");
      return out;
    }
    function postfix() {
      let e = primary();
      for (;;) {
        const t = peek();
        if (t.t !== "op") return e;
        if (t.v === ".") {
          p++;
          if (is("<")) skipGenerics();
          const name = ident("a member name");
          if (is("(")) e = { k: "call", recv: e, name, args: args(), line: t.line };
          else e = { k: "field", recv: e, name, line: t.line };
        } else if (t.v === "[") {
          p++;
          const i = expr();
          expect("]", "An array index needs a closing ].");
          e = { k: "index", arr: e, i, line: t.line };
        } else if (t.v === "++" || t.v === "--") {
          if (!["name", "field", "index"].includes(e.k)) fail("++ and -- need a variable, a field or an array element.", t);
          p++;
          e = { k: "postinc", op: t.v, target: e, line: t.line };
        } else if (t.v === "->" || t.v === "::") {
          fail("Lambdas are not available in the playground yet.", t);
        } else return e;
      }
    }
    function primary() {
      const t = peek();
      if (t.t === "num") { p++; return { k: "lit", v: t.v, ty: t.ty, line: t.line }; }
      if (t.t === "str") { p++; return { k: "lit", v: t.v, ty: "String", line: t.line }; }
      if (t.t === "chr") { p++; return { k: "lit", v: t.v, ty: "char", line: t.line }; }
      if (t.t === "kw") {
        if (t.v === "true" || t.v === "false") { p++; return { k: "lit", v: t.v === "true", ty: "boolean", line: t.line }; }
        if (t.v === "null") { p++; return { k: "lit", v: null, ty: "null", line: t.line }; }
        if (t.v === "this") {
          p++;
          if (is("(")) return { k: "thiscall", args: args(), line: t.line };
          return { k: "this", line: t.line };
        }
        if (t.v === "super") {
          p++;
          if (is("(")) return { k: "supercall", args: args(), line: t.line };
          expect(".");
          const name = ident("a member name");
          if (is("(")) return { k: "call", recv: { k: "super", line: t.line }, name, args: args(), line: t.line };
          return { k: "field", recv: { k: "this", line: t.line }, name, line: t.line };
        }
        if (t.v === "new") return newExpr();
      }
      if (t.t === "op" && t.v === "(") {
        p++;
        const e = expr();
        expect(")", "This expression needs a closing ).");
        return e;
      }
      if (t.t === "id") {
        p++;
        /* java.util.Arrays.sort(a) is just Arrays.sort(a) */
        if ((t.v === "java" || t.v === "javax") && is(".")) {
          while (is(".") && peek(1).t === "id" && /^[a-z]/.test(peek(1).v)) p += 2;
          if (is(".")) { p++; const cn = ident("a class name"); return { k: "name", name: cn, line: t.line }; }
        }
        if (is("(")) return { k: "call", recv: null, name: t.v, args: args(), line: t.line };
        return { k: "name", name: t.v, line: t.line };
      }
      fail(t.t === "eof" ? "The file ended in the middle of an expression." : 'I expected a value here but found "' + t.v + '".');
    }
    function newExpr() {
      const line = expect("new").line;
      const t = peek();
      let name;
      if (t.t === "kw" && PRIMS.has(t.v)) { name = t.v; p++; }
      else {
        name = ident("a class name");
        while (is(".") && peek(1).t === "id") { p++; name = toks[p++].v; }
        if (is("<")) skipGenerics();
      }
      if (is("[")) {
        const sizes = [];
        let dims = 0;
        while (is("[")) {
          p++;
          if (is("]")) { p++; dims++; continue; }
          if (dims > sizes.length) fail("Give the sizes of an array's first dimensions, not its last ones.");
          sizes.push(expr());
          dims++;
          expect("]", "An array size needs a closing ].");
        }
        if (is("{")) {
          if (sizes.length) fail("Give either the sizes or the initial values of an array, not both.");
          return arrayInit({ name, dims });
        }
        if (!sizes.length) fail("A new array needs a size, or initial values in { }.");
        return { k: "newarr", elem: name, dims, sizes, line };
      }
      if (!is("(")) fail("new " + name + " needs ( ) or [ ].");
      const a = args();
      if (is("{")) fail("Anonymous classes are not available in the playground yet.");
      return { k: "new", cls: name, args: a, line };
    }

    /* ---------- the file: classes, or loose methods and statements ---------- */
    const classes = [];
    const loose = { name: "Main", sup: null, line: 1, fields: [], methods: dict(), ctors: [], statics: [], inner: [] };
    const looseBody = [];
    while (peek().t !== "eof") {
      if (is("import") || is("package")) { while (!is(";") && peek().t !== "eof") p++; eat(";"); continue; }
      if (eat(";")) continue;
      const start = p;
      const m = mods();
      if (is("class")) { classes.push(classDecl()); continue; }
      if (is("interface") || is("enum")) fail("Interfaces and enums are not available in the playground yet. Use a class.");
      /* a method written directly in the file */
      const save = p;
      if (is("<")) skipGenerics();
      const ty = tryType();
      if (ty && peek().t === "id" && is("(", 1)) {
        const nameTok = toks[p++];
        const params = paramList();
        const fn = { name: nameTok.v, params, body: block(), line: nameTok.line, ret: ty, isStatic: true, cls: "Main" };
        (loose.methods[fn.name] = loose.methods[fn.name] || []).push(fn);
        continue;
      }
      p = save;
      if (m.size) p = start;
      looseBody.push(statement());
    }
    if (looseBody.length) {
      if (loose.methods.main) throw new CompileError("Put these statements inside main, or remove main.", looseBody[0].line);
      loose.methods.main = [{ name: "main", params: [], body: { k: "block", body: looseBody, line: looseBody[0].line }, line: looseBody[0].line, ret: { name: "void", dims: 0 }, isStatic: true, cls: "Main" }];
    }
    if (Object.keys(loose.methods).length) classes.push(loose);
    const flat = [];
    (function add(list) { list.forEach((c) => { flat.push(c); add(c.inner); }); })(classes);
    return flat;
  }

  /* ---------- values ----------
     A value is { t, v }: t is a type name; v is a number, boolean, string, null or a heap object.
     Heap objects are { id, kind: "array" | "obj" | "list" | "map" | "set" | "exc", … }. */
  const NUMERIC = dict({ byte: 1, short: 2, char: 2, int: 3, long: 4, float: 5, double: 6 });
  const isNum = (t) => NUMERIC[t] != null;
  const mk = (t, v) => ({ t, v });
  const NULL = mk("null", null), TRUE = mk("boolean", true), FALSE = mk("boolean", false), VOID = mk("void", undefined);
  const BOX = dict({ Integer: "int", Long: "long", Double: "double", Float: "float", Character: "char", Boolean: "boolean", Short: "short", Byte: "byte" });
  const typeName = (ty) => ty.name + "[]".repeat(ty.dims || 0);
  const defaultFor = (ty) => {
    if (ty.dims) return NULL;
    switch (ty.name) {
      case "int": case "short": case "byte": case "long": case "char": return mk(ty.name, 0);
      case "double": case "float": return mk(ty.name, 0);
      case "boolean": return FALSE;
      default: return NULL;
    }
  };
  function wrap(v, t) {
    switch (t) {
      case "int": return v | 0;
      case "short": return (v << 16) >> 16;
      case "byte": return (v << 24) >> 24;
      case "char": return v & 0xffff;
      case "long": return Math.trunc(v);
      case "float": return Math.fround(v);
      default: return v;
    }
  }
  function fmtDouble(x) {
    if (Number.isNaN(x)) return "NaN";
    if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
    if (Number.isInteger(x) && Math.abs(x) < 1e7) return x.toFixed(1);
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e7)) {
      const [m, e] = x.toExponential().split("e");
      return (m.indexOf(".") < 0 ? m + ".0" : m) + "E" + Number(e);
    }
    return String(x);
  }

  const EXCEPTIONS = dict({
    Throwable: null, Exception: "Throwable", Error: "Throwable", RuntimeException: "Exception",
    IllegalArgumentException: "RuntimeException", IllegalStateException: "RuntimeException", ArithmeticException: "RuntimeException",
    NullPointerException: "RuntimeException", IndexOutOfBoundsException: "RuntimeException",
    ArrayIndexOutOfBoundsException: "IndexOutOfBoundsException", StringIndexOutOfBoundsException: "IndexOutOfBoundsException",
    NegativeArraySizeException: "RuntimeException", ClassCastException: "RuntimeException", UnsupportedOperationException: "RuntimeException",
    NoSuchElementException: "RuntimeException", EmptyStackException: "RuntimeException", NumberFormatException: "IllegalArgumentException",
    ArrayStoreException: "RuntimeException", ConcurrentModificationException: "RuntimeException", StackOverflowError: "Error", OutOfMemoryError: "Error",
    InterruptedException: "Exception", IOException: "Exception", CloneNotSupportedException: "Exception",
  });
  const COLLECTIONS = dict({ ArrayList: "list", LinkedList: "list", List: "list", Stack: "list", Vector: "list", ArrayDeque: "list", Deque: "list", Queue: "list", PriorityQueue: "pq", HashMap: "map", TreeMap: "map", LinkedHashMap: "map", Map: "map", HashSet: "set", TreeSet: "set", LinkedHashSet: "set", Set: "set" });

  /* ---------- the interpreter ---------- */
  function run(src, opts) {
    const o = Object.assign({ maxFrames: 4000, maxOps: 6000000, maxDepth: 600, maxOutput: 20000, maxShown: 120, maxHeapPerFrame: 300, heapBudget: 200000 }, opts || {});
    const DEEP = "the call stack passed this playground's limit of about " + o.maxDepth + " nested calls. Real Java allows thousands, so if your base case is right, try a smaller input.";
    let heapLeft = o.heapBudget;
    const classes = dict();
    parse(src).forEach((c) => {
      if (classes[c.name]) throw new CompileError("Class " + c.name + " is declared twice.", c.line);
      c.staticVals = dict();
      classes[c.name] = c;
    });
    Object.values(classes).forEach((c) => {
      if (c.sup && !classes[c.sup] && !(c.sup in EXCEPTIONS)) throw new CompileError("Class " + c.name + " extends " + c.sup + ", which isn't declared here.", c.line);
    });
    const frames = [];
    let output = "", ops = 0, nextId = 1, truncated = false, curLine = 0;
    const stack = [];
    const lineOf = (n) => (n && n.line) || curLine;

    const raise = (cls, msg, line) => {
      snapshot(line || curLine, { event: "throw", thrown: cls + (msg != null ? ": " + msg : "") });
      throw new JavaThrow(cls, msg, line || curLine);
    };
    const tick = () => { if (++ops > o.maxOps) { const e = new StepLimit(); e.line = curLine; throw e; } };
    const isSub = (c, sup) => {
      for (let k = c; k; k = classes[k] ? classes[k].sup : EXCEPTIONS[k]) if (k === sup) return true;
      return false;
    };
    const excClass = (name) => name in EXCEPTIONS || (classes[name] && isSub(name, "Throwable"));

    /* ---------- snapshots ---------- */
    function snapVal(val, seen) {
      if (val.v === null || val.v === undefined) return "null";
      if (typeof val.v === "object") { seen.add(val.v); return { ref: val.v.id }; }
      return text(val);
    }
    function snapshot(line, extra) {
      if (frames.length >= o.maxFrames || heapLeft <= 0) { truncated = true; return; }
      const seen = new Set();
      /* a very deep recursion keeps only its two ends: the middle would cost memory on every step, and is never drawn */
      const kept = stack.length > 24 ? stack.slice(0, 2).concat(stack.slice(-20)) : stack;
      const st = kept.map((fr) => {
        const vars = {};
        if (fr.self) vars.this = snapVal(fr.self, seen);
        fr.scopes.forEach((sc) => sc.forEach((val, name) => { vars[name] = snapVal(val, seen); }));
        return { label: fr.label, vars, id: fr.id };
      });
      Object.values(classes).forEach((c) => Object.keys(c.staticVals).forEach((k) => { const v = c.staticVals[k]; if (v.v && typeof v.v === "object") seen.add(v.v); }));
      const statics = {};
      Object.values(classes).forEach((c) => Object.keys(c.staticVals).forEach((k) => { statics[c.name + "." + k] = snapVal(c.staticVals[k], seen); }));
      const heap = {};
      const todo = Array.from(seen), done = new Set();
      while (todo.length && done.size < o.maxHeapPerFrame) {
        const h = todo.pop();
        if (done.has(h)) continue;
        done.add(h);
        heapLeft -= 1 + (h.data ? Math.min(h.data.length, o.maxShown) : 0);
        const nest = (x) => { const s = new Set(); const r = snapVal(x, s); s.forEach((q) => todo.push(q)); return r; };
        if (h.kind === "array") heap[h.id] = { kind: "array", elem: h.elem, length: h.data.length, data: h.data.slice(0, o.maxShown).map(nest) };
        else if (h.kind === "obj") { const f = {}; h.fields.forEach((v, k) => { f[k] = nest(v); }); heap[h.id] = { kind: "obj", cls: h.cls, fields: f }; }
        else if (h.kind === "list" || h.kind === "set" || h.kind === "pq") heap[h.id] = { kind: "list", cls: h.cls, length: h.data.length, data: h.data.slice(0, o.maxShown).map(nest) };
        else if (h.kind === "map") heap[h.id] = { kind: "map", cls: h.cls, entries: Array.from(h.map.values()).slice(0, o.maxShown).map((e) => [nest(e.k), nest(e.v)]) };
        else if (h.kind === "exc") heap[h.id] = { kind: "obj", cls: h.cls, fields: { message: h.msg == null ? "null" : h.msg } };
        else if (h.kind === "sb") heap[h.id] = { kind: "obj", cls: h.cls, fields: { value: '"' + h.s + '"' } };
        else heap[h.id] = { kind: "obj", cls: h.cls || "Object", fields: {} };
      }
      frames.push(Object.assign({ line, stack: st, heap, statics, out: output.length, hiddenFrames: stack.length - kept.length }, extra || {}));
    }

    /* ---------- printing ---------- */
    function text(val, depth) {
      depth = depth || 0;
      if (val.v === null || val.v === undefined) return "null";
      switch (val.t) {
        case "char": return String.fromCharCode(val.v);
        case "double": case "float": return fmtDouble(val.v);
        case "boolean": return val.v ? "true" : "false";
        case "String": return val.v;
      }
      if (typeof val.v === "number") return String(val.v);
      const h = val.v;
      if (depth > 4) return "...";
      if (h.kind === "list" || h.kind === "set" || h.kind === "pq") return "[" + h.data.map((x) => text(x, depth + 1)).join(", ") + "]";
      if (h.kind === "map") return "{" + Array.from(h.map.values()).map((e) => text(e.k, depth + 1) + "=" + text(e.v, depth + 1)).join(", ") + "}";
      if (h.kind === "exc") return h.cls + (h.msg != null ? ": " + h.msg : "");
      if (h.kind === "sb") return h.s;
      if (h.kind === "array") return (h.elem === "int" ? "[I" : h.elem === "double" ? "[D" : "[" + h.elem) + "@" + h.id.toString(16);
      if (h.kind === "obj") {
        const m = findMethod(h.cls, "toString", 0);
        if (m) return text(invoke(m, val, [], curLine), depth + 1);
        return h.cls + "@" + h.id.toString(16);
      }
      return String(h);
    }
    function print(s) {
      if (output.length < o.maxOutput) output += s;
      if (output.length >= o.maxOutput && !output.endsWith("…(output cut off)")) output += "…(output cut off)";
    }

    /* ---------- variables ---------- */
    function lookup(name) {
      const fr = stack[stack.length - 1];
      for (let i = fr.scopes.length - 1; i >= 0; i--) if (fr.scopes[i].has(name)) return { scope: fr.scopes[i], name };
      return null;
    }
    function fieldOwner(name) {
      /* a bare name that is not a local: this.name, or a static of this class or its parents */
      const fr = stack[stack.length - 1];
      if (fr.self && fr.self.v && fr.self.v.fields && fr.self.v.fields.has(name)) return { obj: fr.self.v, name };
      for (let c = classes[fr.cls]; c; c = classes[c.sup]) if (name in c.staticVals) return { cls: c, name };
      return null;
    }
    const staticOf = (clsName, name) => { for (let c = classes[clsName]; c; c = classes[c.sup]) if (name in c.staticVals) return c; return null; };

    /* an assignment must be legal Java: no silent loss of precision, and no type mismatch */
    function coerce(val, ty, line, what) {
      const want = ty.dims ? typeName(ty) : ty.name;
      if (ty.dims) {
        if (val.t === "null") return val;
        if (val.v && val.v.kind === "array") return val;
        throw new CompileError("Type mismatch: " + (what || "this value") + " needs a " + want + ", not a " + shownType(val) + ".", line);
      }
      if (isNum(want)) {
        const from = BOX[val.t] || val.t;
        if (val.t === "null") raise("NullPointerException", "cannot store null in a " + want, line);
        if (!isNum(from)) throw new CompileError("Type mismatch: " + (what || "this value") + " needs a " + want + ", not a " + shownType(val) + ".", line);
        if (NUMERIC[from] > NUMERIC[want] && !val.constant) throw new CompileError("Possible lossy conversion from " + from + " to " + want + ": add a cast like (" + want + ") if you mean it.", line);
        if (from === "char" && want === "short") return mk(want, wrap(val.v, want));
        return mk(want, wrap(val.v, want));
      }
      if (want === "boolean") {
        if (val.t !== "boolean") throw new CompileError("Type mismatch: " + (what || "this value") + " needs a boolean, not a " + shownType(val) + ".", line);
        return val;
      }
      if (want === "String") {
        if (val.t !== "String" && val.t !== "null") throw new CompileError("Type mismatch: " + (what || "this value") + " needs a String, not a " + shownType(val) + ". Add \"\" + to turn it into text.", line);
        return val;
      }
      if (want in BOX) {
        if (val.t === "null") return val;
        const from = BOX[val.t] || val.t;
        if (from !== BOX[want] && !(val.constant && isNum(from) && isNum(BOX[want]) && NUMERIC[from] <= 3 && NUMERIC[BOX[want]] <= 3)) throw new CompileError("Type mismatch: " + (what || "this value") + " needs a " + want + ", not a " + shownType(val) + ".", line);
        return mk(BOX[want], val.v);
      }
      if (classes[want] && !classes[want].isGeneric) {
        if (val.t === "null") return val;
        if (val.v && val.v.kind === "obj" && isSub(val.v.cls, want)) return val;
        if (val.v && val.v.kind === "exc" && isSub(val.v.cls, want)) return val;
        throw new CompileError("Type mismatch: " + (what || "this value") + " needs a " + want + ", not a " + shownType(val) + ".", line);
      }
      return val;             /* Object, a generic T, a collection type: anything goes */
    }
    const shownType = (val) => (val.v && typeof val.v === "object" ? (val.v.cls || (val.v.kind === "array" ? val.v.elem + "[]" : val.v.kind)) : val.t);

    /* ---------- methods ---------- */
    function findMethod(clsName, name, argc) {
      for (let c = classes[clsName]; c; c = classes[c.sup]) {
        const list = c.methods[name];
        if (list) { const m = list.find((f) => f.params.length === argc && f.body); if (m) return m; }
      }
      return null;
    }
    /* overloads: prefer the one whose parameter types fit these arguments best */
    function pickOverload(clsName, name, argv) {
      const cands = [];
      for (let c = classes[clsName]; c; c = classes[c.sup]) (c.methods[name] || []).forEach((m) => { if (m.params.length === argv.length && m.body) cands.push(m); });
      if (cands.length < 2) return cands[0] || null;
      const score = (m) => m.params.reduce((s, p, i) => {
        const a = argv[i], want = p.type.dims ? null : p.type.name;
        const from = BOX[a.t] || a.t;
        if (want === from) return s + 3;
        if (want && isNum(want) && isNum(from)) return NUMERIC[from] <= NUMERIC[want] ? s + 2 : s - 100;
        return s + 1;
      }, 0);
      return cands.slice().sort((a, b) => score(b) - score(a))[0];
    }
    function invoke(fn, self, argv, line) {
      if (stack.length >= o.maxDepth) raise("StackOverflowError", DEEP, line);
      const scope = new Map();
      scope.types = new Map();
      fn.params.forEach((p, i) => { scope.set(p.name, coerce(argv[i], p.type, line, "parameter " + p.name)); scope.types.set(p.name, p.type); });
      const argText = fn.params.map((p, i) => { const v = scope.get(p.name); return v.v && typeof v.v === "object" ? p.name : short(text(v)); }).join(", ");
      const id = nextId++;
      stack.push({ scopes: [scope], self, cls: fn.cls, label: (fn.isCtor ? "new " : "") + fn.name + "(" + argText + ")", id, name: fn.name });
      snapshot(fn.line, { event: "call", fnName: fn.name });
      let ret = VOID;
      const callerLine = curLine;
      /* the method's own scope stays open through its last snapshot, so its locals are visible as it returns */
      stack[stack.length - 1].scopes.push(new Map());
      try {
        try {
          for (const st of fn.body.body) exec(st);
          if (fn.ret && fn.ret.name !== "void" && !fn.isCtor) throw new CompileError("Method " + fn.name + " must return a " + typeName(fn.ret) + ", but it reached its end without a return.", fn.line);
          if (fn.body.endLine) snapshot(fn.body.endLine, { event: "return", fnName: fn.name, retVal: null });
        } catch (sig) {
          if (!(sig instanceof ReturnSig)) throw sig;
          ret = sig.val;
          if (fn.ret && !fn.isCtor) {
            if (fn.ret.name === "void" && !fn.ret.dims) {
              if (ret !== VOID) throw new CompileError("Method " + fn.name + " is void, so it cannot return a value.", curLine);
            } else {
              if (ret === VOID) throw new CompileError("Method " + fn.name + " must return a " + typeName(fn.ret) + ".", curLine);
              ret = coerce(ret, fn.ret, curLine, "the return value");
            }
          }
          snapshot(curLine, { event: "return", fnName: fn.name, retVal: ret === VOID ? null : short(text(ret)) });
        }
      } finally {
        stack.pop();
        curLine = callerLine;
      }
      return ret;
    }
    const short = (s) => (s.length > 24 ? s.slice(0, 21) + "…" : s);
    function construct(clsName, argv, line) {
      const c = classes[clsName];
      const obj = { id: nextId++, kind: "obj", cls: clsName, fields: new Map() };
      const self = mk("ref", obj);
      const chain = [];
      for (let k = c; k; k = classes[k.sup]) chain.unshift(k);
      chain.forEach((k) => k.fields.forEach((f) => { if (!f.isBlock) obj.fields.set(f.name, defaultFor(f.type)); }));
      if (isSub(clsName, "Throwable")) { obj.msg = null; obj.isExc = true; }
      runCtor(c, self, argv, line);
      return self;
    }
    function runFieldInits(c, self) {
      /* field initializers run in a tiny frame of their own, so they can use this */
      c.fields.forEach((f) => {
        if (f.isBlock) { stack.push({ scopes: [new Map()], self, cls: c.name, label: c.name + " fields", id: nextId++, name: "<init>" }); try { execBlock(f.init); } finally { stack.pop(); } return; }
        if (!f.init) return;
        stack.push({ scopes: [new Map()], self, cls: c.name, label: c.name + " fields", id: nextId++, name: "<init>" });
        try { self.v.fields.set(f.name, coerce(evalExpr(f.init), f.type, f.line, "field " + f.name)); } finally { stack.pop(); }
      });
    }
    function runCtor(c, self, argv, line) {
      const fn = c.ctors.find((k) => k.params.length === argv.length);
      if (!fn && (c.ctors.length || argv.length)) {
        if (argv.length === 1 && c.sup && isSub(c.name, "Throwable")) { self.v.msg = text(argv[0]); runFieldInits(c, self); return; }
        throw new CompileError("Class " + c.name + " has no constructor taking " + argv.length + " argument" + (argv.length === 1 ? "" : "s") + ".", line);
      }
      if (!fn) {
        if (c.sup && classes[c.sup]) runCtor(classes[c.sup], self, [], line);
        runFieldInits(c, self);
        return;
      }
      /* a constructor runs super(...), then the field initializers, then the rest of its body */
      const body = fn.body.body;
      const first = body[0];
      const explicit = first && first.k === "expr" && (first.e.k === "supercall" || first.e.k === "thiscall");
      if (!explicit) { if (c.sup && classes[c.sup]) runCtor(classes[c.sup], self, [], line); runFieldInits(c, self); }
      invoke(fn, self, argv, line);
    }

    /* ---------- statements ---------- */
    function execBlock(b) {
      const fr = stack[stack.length - 1];
      fr.scopes.push(new Map());
      try { for (const s of b.body) exec(s); } finally { fr.scopes.pop(); }
    }
    const inner = (s) => { if (s.k === "block") execBlock(s); else { const fr = stack[stack.length - 1]; fr.scopes.push(new Map()); try { exec(s); } finally { fr.scopes.pop(); } } };
    const truthy = (e, what) => {
      const c = evalExpr(e);
      if (c.t !== "boolean") throw new CompileError("The " + what + " must be true or false, but this is a " + shownType(c) + ". Did you mean == ?", lineOf(e));
      return c.v;
    };
    function declare(name, val, line, type) {
      const fr = stack[stack.length - 1];
      for (let i = fr.scopes.length - 1; i >= 0; i--) if (fr.scopes[i].has(name)) throw new CompileError("Variable " + name + " is already declared in this method.", line);
      const sc = fr.scopes[fr.scopes.length - 1];
      sc.set(name, val);
      if (type) { if (!sc.types) sc.types = new Map(); sc.types.set(name, type); }
    }
    /* loop bodies catch break and continue meant for them; anything labelled for an outer loop passes through */
    function loopBody(s, body) {
      try { inner(body); return true; } catch (sig) {
        if (sig instanceof BreakSig && (!sig.label || sig.label === s.label)) return false;
        if (sig instanceof ContinueSig && (!sig.label || sig.label === s.label)) return true;
        throw sig;
      }
    }
    function step(line) { curLine = line; tick(); snapshot(line); }

    function exec(s) {
      tick();
      switch (s.k) {
        case "block": return execBlock(s);
        case "empty": return;
        case "decl":
          step(s.line);
          s.vars.forEach((d) => {
            const name = d.name;
            if (d.type.name === "var" && !d.type.dims) {
              if (!d.init) throw new CompileError("A var needs an initial value.", s.line);
              return declare(name, evalExpr(d.init), s.line);
            }
            declare(name, d.init ? coerce(evalExpr(d.init), d.type, s.line, "variable " + name) : defaultFor(d.type), s.line, d.type);
          });
          return;
        case "expr": step(s.line); evalExpr(s.e); return;
        case "if":
          step(s.line);
          if (truthy(s.cond, "if condition")) inner(s.then);
          else if (s.other) inner(s.other);
          return;
        case "while":
          for (;;) {
            step(s.line);
            if (!truthy(s.cond, "while condition")) return;
            if (!loopBody(s, s.body)) return;
          }
        case "dowhile":
          for (;;) {
            if (!loopBody(s, s.body)) return;
            step(s.condLine);
            if (!truthy(s.cond, "while condition")) return;
          }
        case "for": {
          const fr = stack[stack.length - 1];
          fr.scopes.push(new Map());
          try {
            step(s.line);
            s.init.forEach((i) => { if (i.k === "decl") { i.vars.forEach((d) => declare(d.name, d.init ? coerce(evalExpr(d.init), d.type, s.line, "variable " + d.name) : defaultFor(d.type), s.line, d.type)); } else evalExpr(i.e); });
            for (;;) {
              curLine = s.line;
              if (s.cond && !truthy(s.cond, "for condition")) { snapshot(s.line); return; }
              if (!loopBody(s, s.body)) return;
              step(s.line);
              s.update.forEach((u) => evalExpr(u));
            }
          } finally { fr.scopes.pop(); }
        }
        case "foreach": {
          step(s.line);
          const it = evalExpr(s.iter);
          if (it.v === null) raise("NullPointerException", "cannot loop over null", s.line);
          const items = !it.v || typeof it.v !== "object" ? null : it.v.kind === "array" ? it.v.data : it.v.kind === "map" ? null : it.v.data;
          if (!items) throw new CompileError("A for-each needs an array or a collection.", s.line);
          const fr = stack[stack.length - 1];
          for (let i = 0; i < items.length; i++) {
            const scope = new Map();
            scope.set(s.name, s.type.name === "var" ? items[i] : coerce(items[i], s.type, s.line, "variable " + s.name));
            if (s.type.name !== "var") { scope.types = new Map(); scope.types.set(s.name, s.type); }
            fr.scopes.push(scope);
            try {
              step(s.line);
              if (!loopBody(s, s.body)) return;
            } finally { fr.scopes.pop(); }
          }
          return;
        }
        case "return":
          step(s.line);
          throw new ReturnSig(s.e ? evalExpr(s.e) : VOID);
        case "break": step(s.line); throw new BreakSig(s.label);
        case "continue": step(s.line); throw new ContinueSig(s.label);
        case "throw": {
          step(s.line);
          const e = evalExpr(s.e);
          if (e.v === null) raise("NullPointerException", "cannot throw null", s.line);
          if (!e.v || (e.v.kind !== "exc" && !e.v.isExc)) throw new CompileError("Only exceptions can be thrown.", s.line);
          snapshot(s.line, { event: "throw", thrown: e.v.cls + (e.v.msg != null ? ": " + e.v.msg : "") });
          const err = new JavaThrow(e.v.cls, e.v.msg, s.line);
          err.obj = e;
          throw err;
        }
        case "try": {
          step(s.line);
          try {
            try { execBlock(s.body); } catch (err) {
              if (err instanceof RangeError) throw wrapOverflow();
              if (!(err instanceof JavaThrow)) throw err;
              const c = s.catches.find((k) => k.types.some((t) => isSub(err.cls, t)));
              if (!c) throw err;
              const fr = stack[stack.length - 1];
              const scope = new Map();
              scope.set(c.name, err.obj || mk("ref", { id: nextId++, kind: "exc", cls: err.cls, msg: err.jmsg }));
              fr.scopes.push(scope);
              try { execBlock(c.body); } finally { fr.scopes.pop(); }
            }
          } finally {
            if (s.fin) execBlock(s.fin);
          }
          return;
        }
        case "switch": {
          step(s.line);
          const v = evalExpr(s.subject);
          let hit = s.cases.findIndex((c) => c.tests.some((t) => { const x = evalExpr(t); return x.v === v.v; }));
          if (hit < 0) hit = s.cases.findIndex((c) => c.isDefault);
          if (hit < 0) return;
          const fr = stack[stack.length - 1];
          fr.scopes.push(new Map());
          try {
            for (let i = hit; i < s.cases.length; i++) for (const b of s.cases[i].body) exec(b);
          } catch (sig) {
            if (!(sig instanceof BreakSig) || sig.label) throw sig;
          } finally { fr.scopes.pop(); }
          return;
        }
        default: throw new CompileError("This statement is not supported in the playground.", s.line);
      }
    }
    const wrapOverflow = () => new JavaThrow("StackOverflowError", DEEP, curLine);

    /* ---------- expressions ---------- */
    const numOf = (val, line) => {
      const from = BOX[val.t] || val.t;
      if (val.t === "null") raise("NullPointerException", "cannot do arithmetic on null", line);
      if (!isNum(from)) return null;
      return from;
    };
    function promote(a, b) {
      if (a === "double" || b === "double") return "double";
      if (a === "float" || b === "float") return "float";
      if (a === "long" || b === "long") return "long";
      return "int";
    }
    function imul(a, b, ty) { if (ty === "int") return Math.imul(a, b); return a * b; }
    function arith(op, l, r, line) {
      const a = numOf(l, line), b = numOf(r, line);
      if (a == null || b == null) throw new CompileError('The operator "' + op + '" needs numbers, not ' + shownType(a == null ? l : r) + ".", line);
      const ty = promote(a, b);
      const x = l.v, y = r.v;
      let v;
      switch (op) {
        case "+": v = x + y; break;
        case "-": v = x - y; break;
        case "*": v = imul(x, y, ty); break;
        case "/":
          if (ty === "int" || ty === "long") {
            if (y === 0) raise("ArithmeticException", "/ by zero", line);
            v = Math.trunc(x / y);
          } else v = x / y;
          break;
        case "%":
          if ((ty === "int" || ty === "long") && y === 0) raise("ArithmeticException", "/ by zero", line);
          v = x % y;
          break;
      }
      const out = mk(ty, wrap(v, ty));
      if (l.constant && r.constant) out.constant = true;
      return out;
    }
    function compare(op, l, r, line) {
      const a = numOf(l, line), b = numOf(r, line);
      if (a == null || b == null) throw new CompileError('The operator "' + op + '" needs numbers. For Strings or objects use compareTo.', line);
      const x = l.v, y = r.v;
      return (op === "<" ? x < y : op === ">" ? x > y : op === "<=" ? x <= y : x >= y) ? TRUE : FALSE;
    }
    function bits(op, l, r, line) {
      if (l.t === "boolean" && r.t === "boolean") {
        const v = op === "&" ? l.v && r.v : op === "|" ? l.v || r.v : l.v !== r.v;
        return v ? TRUE : FALSE;
      }
      const a = numOf(l, line), b = numOf(r, line);
      if (a == null || b == null || NUMERIC[a] > 4 || NUMERIC[b] > 4) throw new CompileError('The operator "' + op + '" needs integers or booleans.', line);
      const ty = op.length > 1 ? (a === "long" ? "long" : "int") : promote(a, b);
      let v;
      if (ty === "long") {
        const X = BigInt(l.v), Y = BigInt(r.v);
        const big = op === "&" ? X & Y : op === "|" ? X | Y : op === "^" ? X ^ Y : op === "<<" ? BigInt.asIntN(64, X << (Y & 63n)) : op === ">>" ? X >> (Y & 63n) : BigInt.asUintN(64, X) >> (Y & 63n);
        v = Number(big);
      } else {
        v = op === "&" ? l.v & r.v : op === "|" ? l.v | r.v : op === "^" ? l.v ^ r.v : op === "<<" ? l.v << r.v : op === ">>" ? l.v >> r.v : (l.v >>> r.v) | 0;
      }
      return mk(ty, v);
    }
    function equal(l, r) {
      const a = BOX[l.t] || l.t, b = BOX[r.t] || r.t;
      if (isNum(a) && isNum(b)) return l.v === r.v;
      if (l.t === "String" && r.t === "String") return l.v === r.v;
      return l.v === r.v;
    }
    function binop(e) {
      const op = e.op;
      if (op === "&&") {
        const l = evalExpr(e.l);
        if (l.t !== "boolean") throw new CompileError("&& needs true or false on both sides.", e.line);
        if (!l.v) return FALSE;
        const r = evalExpr(e.r);
        if (r.t !== "boolean") throw new CompileError("&& needs true or false on both sides.", e.line);
        return r;
      }
      if (op === "||") {
        const l = evalExpr(e.l);
        if (l.t !== "boolean") throw new CompileError("|| needs true or false on both sides.", e.line);
        if (l.v) return TRUE;
        const r = evalExpr(e.r);
        if (r.t !== "boolean") throw new CompileError("|| needs true or false on both sides.", e.line);
        return r;
      }
      return applyBin(op, evalExpr(e.l), evalExpr(e.r), e.line);
    }
    function applyBin(op, l, r, line) {
      switch (op) {
        case "+":
          if (l.t === "String" || r.t === "String" || (l.v && typeof l.v === "object") || (r.v && typeof r.v === "object")) {
            if (l.t !== "String" && r.t !== "String") throw new CompileError('The operator "+" needs numbers or a String.', line);
            return mk("String", text(l) + text(r));
          }
          return arith(op, l, r, line);
        case "-": case "*": case "/": case "%": return arith(op, l, r, line);
        case "<": case ">": case "<=": case ">=": return compare(op, l, r, line);
        case "==": return equal(l, r) ? TRUE : FALSE;
        case "!=": return equal(l, r) ? FALSE : TRUE;
        case "&": case "|": case "^": case "<<": case ">>": case ">>>": return bits(op, l, r, line);
      }
      throw new CompileError("Unknown operator " + op + ".", line);
    }

    const arrIndex = (e) => {
      const a = evalExpr(e.arr);
      if (a.v === null) raise("NullPointerException", "the array is null", e.line);
      if (!a.v || a.v.kind !== "array") throw new CompileError("Only arrays can use [ ]. For a list, call get(i).", e.line);
      const idx = evalExpr(e.i);
      const from = BOX[idx.t] || idx.t;
      if (!isNum(from) || NUMERIC[from] > 3) throw new CompileError("An array index must be an int, not a " + shownType(idx) + ".", e.line);
      if (idx.v < 0 || idx.v >= a.v.data.length) raise("ArrayIndexOutOfBoundsException", "Index " + idx.v + " out of bounds for length " + a.v.data.length, e.line);
      return { arr: a.v, i: idx.v };
    };
    /* where an assignment lands: returns { get, set } */
    function place(target) {
      switch (target.k) {
        case "name": {
          const local = lookup(target.name);
          if (local) return { get: () => local.scope.get(target.name), set: (v) => local.scope.set(target.name, v), type: local.scope.types ? local.scope.types.get(target.name) : null };
          const own = fieldOwner(target.name);
          if (own && own.obj) return { get: () => own.obj.fields.get(target.name), set: (v) => own.obj.fields.set(target.name, v), type: fieldType(own.obj.cls, target.name) };
          if (own) return { get: () => own.cls.staticVals[target.name], set: (v) => { own.cls.staticVals[target.name] = v; }, type: staticType(own.cls, target.name) };
          throw new CompileError("Variable " + target.name + " isn't declared. Declare it with a type first, like int " + target.name + " = 0;", target.line);
        }
        case "field": {
          if (target.recv.k === "name" && !lookup(target.recv.name) && !fieldOwner(target.recv.name) && classes[target.recv.name]) {
            const c = staticOf(target.recv.name, target.name);
            if (!c) throw new CompileError("Class " + target.recv.name + " has no static field " + target.name + ".", target.line);
            return { get: () => c.staticVals[target.name], set: (v) => { c.staticVals[target.name] = v; }, type: staticType(c, target.name) };
          }
          const r = evalExpr(target.recv);
          if (r.v === null) raise("NullPointerException", "cannot assign field " + target.name + " because the object is null", target.line);
          if (!r.v || r.v.kind !== "obj") throw new CompileError("Only objects have fields.", target.line);
          if (!r.v.fields.has(target.name)) throw new CompileError("Class " + r.v.cls + " has no field " + target.name + ".", target.line);
          return { get: () => r.v.fields.get(target.name), set: (v) => r.v.fields.set(target.name, v), type: fieldType(r.v.cls, target.name) };
        }
        case "index": {
          const { arr, i } = arrIndex(target);
          return { get: () => arr.data[i], set: (v) => { arr.data[i] = v; }, type: arr.elemType };
        }
      }
      throw new CompileError("You can't assign to this.", target.line);
    }
    function fieldType(clsName, name) {
      for (let c = classes[clsName]; c; c = classes[c.sup]) { const f = c.fields.find((x) => x.name === name); if (f) return f.type; }
      return null;
    }
    function staticType(c, name) { const f = c.statics.find((x) => x.name === name); return f ? f.type : null; }
    /* a local keeps the type it was declared with: the value already there says what it is */
    function storeType(pl, cur) {
      if (pl.type) return pl.type;
      if (cur && cur.t && cur.t !== "null" && cur.t !== "ref" && !(cur.v && typeof cur.v === "object")) return { name: cur.t, dims: 0 };
      return null;
    }
    function assign(e) {
      const pl = place(e.target);
      const cur = pl.get();
      let val;
      if (e.op === "=") {
        val = e.value.k === "arrlit" ? evalExpr(e.value) : evalExpr(e.value);
        const ty = storeType(pl, cur);
        if (ty) val = coerce(val, ty, e.line, "this " + (e.target.k === "index" ? "element" : "variable"));
      } else {
        /* a compound assignment casts back to the variable's type, as Java does */
        const op = e.op.slice(0, -1);
        const res = applyBin(op, cur, evalExpr(e.value), e.line);
        const ty = BOX[cur.t] || cur.t;
        val = isNum(ty) && isNum(res.t) ? mk(ty, castNum(res.v, res.t, ty)) : res;
      }
      pl.set(val);
      return val;
    }
    function castNum(v, from, to) {
      if ((from === "double" || from === "float") && NUMERIC[to] <= 4) {
        if (Number.isNaN(v)) return 0;
        const t = Math.trunc(v);
        if (to === "long") return t;
        if (t > 2147483647) return wrap(2147483647, to);
        if (t < -2147483648) return wrap(-2147483648, to);
        return wrap(t, to);
      }
      return wrap(v, to);
    }
    function incdec(e, post) {
      const pl = place(e.target);
      const cur = pl.get();
      const ty = BOX[cur.t] || cur.t;
      if (cur.t === "null") raise("NullPointerException", "cannot increment null", e.line);
      if (!isNum(ty)) throw new CompileError(e.op + " needs a number.", e.line);
      const nv = mk(ty, wrap(cur.v + (e.op === "++" ? 1 : -1), ty));
      pl.set(nv);
      return post ? cur : nv;
    }
    function makeArray(elem, dims, sizes, depth, line) {
      const n = sizes[depth];
      const elemDims = dims - depth - 1;
      const et = { name: elem, dims: elemDims };
      const shown = elem + "[]".repeat(elemDims);
      const data = new Array(n);
      tick();
      for (let i = 0; i < n; i++) data[i] = elemDims > 0 && depth + 1 < sizes.length ? makeArray(elem, dims, sizes, depth + 1, line) : defaultFor(et);
      return mk("ref", { id: nextId++, kind: "array", elem: shown, elemType: et, data });
    }

    function evalExpr(e) {
      tick();
      switch (e.k) {
        case "lit": { const v = mk(e.ty, e.v); if (isNum(e.ty) && NUMERIC[e.ty] <= 3) v.constant = true; return v; }
        case "name": {
          const local = lookup(e.name);
          if (local) return local.scope.get(e.name);
          const own = fieldOwner(e.name);
          if (own && own.obj) return own.obj.fields.get(e.name);
          if (own) return own.cls.staticVals[e.name];
          throw new CompileError("Variable " + e.name + " isn't declared.", e.line);
        }
        case "this": { const s = stack[stack.length - 1].self; if (!s) throw new CompileError("A static method has no this.", e.line); return s; }
        case "bin": return binop(e);
        case "un": {
          const v = evalExpr(e.e);
          if (e.op === "!") { if (v.t !== "boolean") throw new CompileError("! needs true or false.", e.line); return v.v ? FALSE : TRUE; }
          const from = numOf(v, e.line);
          if (!from) throw new CompileError('The operator "' + e.op + '" needs a number.', e.line);
          const ty = promote(from, "int");
          const out = mk(ty, e.op === "-" ? wrap(-v.v, ty) : e.op === "~" ? wrap(~v.v, ty) : v.v);
          if (v.constant) out.constant = true;
          return out;
        }
        case "cond": {
          const c = truthy(e.c, "?: condition");
          return evalExpr(c ? e.a : e.b);
        }
        case "assign": return assign(e);
        case "preinc": return incdec(e, false);
        case "postinc": return incdec(e, true);
        case "cast": {
          const v = evalExpr(e.e);
          const to = e.type.name;
          if (e.type.dims) return v;
          if (isNum(to)) {
            const from = numOf(v, e.line);
            if (!from) throw new CompileError("You can't cast a " + shownType(v) + " to " + to + ".", e.line);
            return mk(to, castNum(v.v, from, to));
          }
          if (to in BOX) return mk(BOX[to], v.v);
          if (classes[to] && v.v && v.v.kind === "obj" && !isSub(v.v.cls, to)) raise("ClassCastException", v.v.cls + " cannot be cast to " + to, e.line);
          return v;
        }
        case "instanceof": {
          const v = evalExpr(e.e);
          if (v.v === null) return FALSE;
          const name = e.type.name;
          if (name === "String") return v.t === "String" ? TRUE : FALSE;
          if (name in BOX) return (BOX[v.t] || v.t) === BOX[name] ? TRUE : FALSE;
          return v.v && v.v.cls && isSub(v.v.cls, name) ? TRUE : name === "Object" ? TRUE : FALSE;
        }
        case "index": { const { arr, i } = arrIndex(e); return arr.data[i]; }
        case "field": return getField(e);
        case "arrlit": {
          const items = e.items.map((x) => coerce(evalExpr(x), e.elem, e.line, "this element"));
          return mk("ref", { id: nextId++, kind: "array", elem: typeName(e.elem), elemType: e.elem, data: items });
        }
        case "newarr": {
          const sizes = e.sizes.map((s) => {
            const v = evalExpr(s);
            if (!isNum(BOX[v.t] || v.t) || NUMERIC[BOX[v.t] || v.t] > 3) throw new CompileError("An array size must be an int.", e.line);
            if (v.v < 0) raise("NegativeArraySizeException", String(v.v), e.line);
            if (v.v > 1000000) raise("OutOfMemoryError", "this playground limits an array to 1,000,000 elements", e.line);
            return v.v;
          });
          return makeArray(e.elem, e.dims, sizes, 0, e.line);
        }
        case "new": return newObject(e);
        case "call": return call(e);
        case "supercall": {
          const fr = stack[stack.length - 1];
          const c = classes[fr.cls];
          const argv = e.args.map(evalExpr);
          if (c.sup && classes[c.sup]) runCtor(classes[c.sup], fr.self, argv, e.line);
          else if (argv.length === 1 && isSub(fr.cls, "Throwable")) fr.self.v.msg = text(argv[0]);
          runFieldInits(c, fr.self);
          return VOID;
        }
        case "thiscall": {
          const fr = stack[stack.length - 1];
          runCtor(classes[fr.cls], fr.self, e.args.map(evalExpr), e.line);
          return VOID;
        }
      }
      throw new CompileError("This expression is not supported in the playground.", e.line);
    }
    function getField(e) {
      if (e.recv.k === "name" && !lookup(e.recv.name) && !fieldOwner(e.recv.name)) {
        const cn = e.recv.name;
        if (classes[cn]) {
          const c = staticOf(cn, e.name);
          if (c) return c.staticVals[e.name];
          throw new CompileError("Class " + cn + " has no static field " + e.name + ".", e.line);
        }
        const k = STATIC_CONST[cn] && STATIC_CONST[cn][e.name];
        if (k) return k;
        if (cn === "System" && (e.name === "out" || e.name === "err")) return mk("ref", { kind: "sysout", name: e.name, id: 0 });
        throw new CompileError(cn + " isn't declared.", e.line);
      }
      const r = evalExpr(e.recv);
      if (r.v === null) raise("NullPointerException", "cannot read field " + e.name + " because the object is null", e.line);
      if (r.v && r.v.kind === "array" && e.name === "length") return mk("int", r.v.data.length);
      if (r.t === "String" && e.name === "length") throw new CompileError("A String's length is a method: write length().", e.line);
      if (r.v && r.v.kind === "obj") {
        if (!r.v.fields.has(e.name)) throw new CompileError("Class " + r.v.cls + " has no field " + e.name + ".", e.line);
        return r.v.fields.get(e.name);
      }
      throw new CompileError("A " + shownType(r) + " has no field " + e.name + ".", e.line);
    }
    function newObject(e) {
      const argv = e.args.map(evalExpr);
      if (classes[e.cls]) return construct(e.cls, argv, e.line);
      if (e.cls in EXCEPTIONS) return mk("ref", { id: nextId++, kind: "exc", cls: e.cls, msg: argv.length ? text(argv[0]) : null });
      if (e.cls === "String") return argv.length ? mk("String", text(argv[0])) : mk("String", "");
      if (e.cls === "Object") return mk("ref", { id: nextId++, kind: "obj", cls: "Object", fields: new Map() });
      if (e.cls === "Random") return mk("ref", { id: nextId++, kind: "random", cls: "Random", seed: argv.length ? argv[0].v | 0 : 42 });
      if (e.cls === "StringBuilder") return mk("ref", { id: nextId++, kind: "sb", cls: "StringBuilder", s: argv.length && argv[0].t === "String" ? argv[0].v : "" });
      const kind = COLLECTIONS[e.cls];
      if (kind === "list" || kind === "set" || kind === "pq") {
        const h = { id: nextId++, kind, cls: e.cls, data: [] };
        if (argv.length === 1 && argv[0].v && argv[0].v.data) argv[0].v.data.forEach((x) => (kind === "set" ? setAdd(h, x) : h.data.push(x)));
        return mk("ref", h);
      }
      if (kind === "map") return mk("ref", { id: nextId++, kind: "map", cls: e.cls, map: new Map() });
      throw new CompileError("Class " + e.cls + " isn't declared here, and the playground doesn't include it.", e.line);
    }
    const hashKey = (v) => {
      if (v.v === null) return "null";
      if (v.t === "String") return "s" + v.v;
      if (typeof v.v === "object") return "o" + v.v.id;
      if (v.t === "char") return "c" + v.v;
      return "n" + v.v;
    };
    function setAdd(h, x) {
      const k = hashKey(x);
      if (h.data.some((y) => hashKey(y) === k)) return false;
      h.data.push(x);
      if (h.cls === "TreeSet") h.data.sort(compareVals);
      return true;
    }
    function compareVals(a, b) {
      if (a.t === "String" && b.t === "String") return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
      if (typeof a.v === "number" && typeof b.v === "number") return a.v - b.v;
      if (a.v && a.v.kind === "obj") {
        const m = findMethod(a.v.cls, "compareTo", 1);
        if (m) return invoke(m, a, [b], curLine).v;
      }
      raise("ClassCastException", "these values cannot be compared", curLine);
    }
    const STATIC_CONST = dict({
      Integer: { MAX_VALUE: mk("int", 2147483647), MIN_VALUE: mk("int", -2147483648) },
      Long: { MAX_VALUE: mk("long", 9223372036854775807), MIN_VALUE: mk("long", -9223372036854775808) },
      Double: { MAX_VALUE: mk("double", Number.MAX_VALUE), MIN_VALUE: mk("double", 5e-324), POSITIVE_INFINITY: mk("double", Infinity), NEGATIVE_INFINITY: mk("double", -Infinity), NaN: mk("double", NaN) },
      Math: { PI: mk("double", Math.PI), E: mk("double", Math.E) },
    });

    function call(e) {
      const line = e.line;
      /* a bare call: a method of this class or its parents */
      if (!e.recv) {
        const fr = stack[stack.length - 1];
        const argv = e.args.map(evalExpr);
        /* an instance method is looked up from the object's real class, so an override wins (dynamic dispatch) */
        const m = (fr.self && fr.self.v && fr.self.v.cls && pickOverload(fr.self.v.cls, e.name, argv)) || pickOverload(fr.cls, e.name, argv);
        if (!m) {
          const others = classes[fr.cls] && classes[fr.cls].methods[e.name];
          throw new CompileError(others ? "Method " + e.name + " doesn't take " + argv.length + " argument" + (argv.length === 1 ? "" : "s") + "." : "Method " + e.name + " isn't declared in class " + fr.cls + ".", line);
        }
        if (!m.isStatic && !fr.self) throw new CompileError("Method " + e.name + " isn't static, so a static method must call it on an object.", line);
        return invoke(m, m.isStatic ? null : fr.self, argv, line);
      }
      if (e.recv.k === "super") {
        const fr = stack[stack.length - 1];
        const argv = e.args.map(evalExpr);
        const sup = classes[fr.cls].sup;
        const m = sup && pickOverload(sup, e.name, argv);
        if (!m) throw new CompileError("The parent class has no method " + e.name + ".", line);
        return invoke(m, fr.self, argv, line);
      }
      /* a static call on a class name */
      if (e.recv.k === "name" && !lookup(e.recv.name) && !fieldOwner(e.recv.name)) {
        const cn = e.recv.name;
        const argv = e.args.map(evalExpr);
        if (classes[cn]) {
          const m = pickOverload(cn, e.name, argv);
          if (!m) throw new CompileError("Class " + cn + " has no method " + e.name + " taking " + argv.length + " argument" + (argv.length === 1 ? "" : "s") + ".", line);
          if (!m.isStatic) throw new CompileError("Method " + e.name + " isn't static: call it on an object.", line);
          return invoke(m, null, argv, line);
        }
        return builtinStatic(cn, e.name, argv, line);
      }
      const r = evalExpr(e.recv);
      const argv = e.args.map(evalExpr);
      if (r.v && r.v.kind === "sysout") {
        if (e.name === "println") { print((argv.length ? text(argv[0]) : "") + "\n"); return VOID; }
        if (e.name === "print") { print(argv.length ? text(argv[0]) : ""); return VOID; }
        if (e.name === "printf" || e.name === "format") { print(format(argv, line)); return VOID; }
        throw new CompileError("System.out has no method " + e.name + " here.", line);
      }
      if (r.v === null || r.v === undefined) raise("NullPointerException", 'cannot call "' + e.name + '" because the object is null', line);
      if (r.t === "String") return stringMethod(r.v, e.name, argv, line);
      if (typeof r.v !== "object") {
        if (e.name === "equals") return equal(r, argv[0]) ? TRUE : FALSE;
        if (e.name === "compareTo") return mk("int", Math.sign(r.v - argv[0].v));
        if (e.name === "intValue") return mk("int", castNum(r.v, r.t, "int"));
        if (e.name === "doubleValue") return mk("double", r.v);
        if (e.name === "toString") return mk("String", text(r));
        if (e.name === "hashCode") return mk("int", r.v | 0);
        throw new CompileError("A " + r.t + " has no method " + e.name + ".", line);
      }
      const h = r.v;
      if (h.kind === "obj") {
        const m = pickOverload(h.cls, e.name, argv);
        if (m) return invoke(m, r, argv, line);
        if (e.name === "toString") return mk("String", h.cls + "@" + h.id.toString(16));
        if (e.name === "equals") return h === argv[0].v ? TRUE : FALSE;
        if (e.name === "hashCode") return mk("int", h.id);
        if (e.name === "getMessage" && h.isExc) return h.msg == null ? NULL : mk("String", h.msg);
        throw new CompileError("Class " + h.cls + " has no method " + e.name + " taking " + argv.length + " argument" + (argv.length === 1 ? "" : "s") + ".", line);
      }
      if (h.kind === "exc") {
        if (e.name === "getMessage") return h.msg == null ? NULL : mk("String", h.msg);
        if (e.name === "toString") return mk("String", text(r));
        if (e.name === "printStackTrace") { print(text(r) + "\n"); return VOID; }
        throw new CompileError("Exceptions here only have getMessage and toString.", line);
      }
      if (h.kind === "array") {
        if (e.name === "clone") return mk("ref", { id: nextId++, kind: "array", elem: h.elem, elemType: h.elemType, data: h.data.slice() });
        if (e.name === "length") throw new CompileError("An array's length is a field: write length with no ( ).", line);
        throw new CompileError("Arrays have no method " + e.name + ".", line);
      }
      if (h.kind === "list" || h.kind === "set" || h.kind === "pq") return listMethod(r, e.name, argv, line);
      if (h.kind === "map") return mapMethod(h, e.name, argv, line);
      if (h.kind === "sb") return sbMethod(r, e.name, argv, line);
      if (h.kind === "random") return randomMethod(h, e.name, argv, line);
      throw new CompileError("This object has no method " + e.name + ".", line);
    }
    function format(argv, line) {
      if (!argv.length) return "";
      let i = 1;
      return text(argv[0]).replace(/%(-?\d*)(?:\.(\d+))?([dfsncb%x])/g, (m, width, prec, conv) => {
        if (conv === "n") return "\n";
        if (conv === "%") return "%";
        if (i >= argv.length) raise("IllegalArgumentException", "Format needs more arguments", line);
        const a = argv[i++];
        let s;
        if (conv === "f") s = Number(a.v).toFixed(prec == null ? 6 : Number(prec));
        else if (conv === "x") s = (a.v >>> 0).toString(16);
        else s = text(a);
        if (width) { const w = Math.abs(Number(width)); s = Number(width) < 0 || width[0] === "-" ? s.padEnd(w) : s.padStart(w); }
        return s;
      });
    }
    function builtinStatic(cn, name, a, line) {
      const num = (v) => v.v;
      const need = (n) => { if (a.length !== n) throw new CompileError(cn + "." + name + " takes " + n + " argument" + (n === 1 ? "" : "s") + ".", line); };
      if (cn === "Math") {
        switch (name) {
          case "abs": need(1); return mk(a[0].t, wrap(Math.abs(num(a[0])), a[0].t));
          case "max": need(2); { const t = promote(BOX[a[0].t] || a[0].t, BOX[a[1].t] || a[1].t); return mk(t, Math.max(num(a[0]), num(a[1]))); }
          case "min": need(2); { const t = promote(BOX[a[0].t] || a[0].t, BOX[a[1].t] || a[1].t); return mk(t, Math.min(num(a[0]), num(a[1]))); }
          case "pow": need(2); return mk("double", Math.pow(num(a[0]), num(a[1])));
          case "sqrt": need(1); return mk("double", Math.sqrt(num(a[0])));
          case "cbrt": need(1); return mk("double", Math.cbrt(num(a[0])));
          case "floor": need(1); return mk("double", Math.floor(num(a[0])));
          case "ceil": need(1); return mk("double", Math.ceil(num(a[0])));
          case "rint": need(1); { const x = num(a[0]), r = Math.round(x); return mk("double", Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r); }
          case "round": need(1); return mk("long", Math.floor(num(a[0]) + 0.5));
          case "log": need(1); return mk("double", Math.log(num(a[0])));
          case "log10": need(1); return mk("double", Math.log10(num(a[0])));
          case "exp": need(1); return mk("double", Math.exp(num(a[0])));
          case "random": need(0); return mk("double", lehmer());
          case "floorMod": need(2); if (num(a[1]) === 0) raise("ArithmeticException", "/ by zero", line); return mk("int", ((num(a[0]) % num(a[1])) + num(a[1])) % num(a[1]));
          case "floorDiv": need(2); if (num(a[1]) === 0) raise("ArithmeticException", "/ by zero", line); return mk("int", Math.floor(num(a[0]) / num(a[1])));
          case "sin": case "cos": case "tan": need(1); return mk("double", Math[name](num(a[0])));
          case "hypot": need(2); return mk("double", Math.hypot(num(a[0]), num(a[1])));
        }
      }
      if (cn === "Integer" || cn === "Long" || cn === "Double") {
        const ty = cn === "Integer" ? "int" : cn === "Long" ? "long" : "double";
        if (name === "parseInt" || name === "parseLong" || name === "parseDouble" || name === "valueOf") {
          need(1);
          if (a[0].t !== "String") return mk(ty, castNum(a[0].v, a[0].t, ty));
          const s = a[0].v.trim();
          if (!(ty === "double" ? /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/ : /^[-+]?\d+$/).test(s)) raise("NumberFormatException", 'For input string: "' + a[0].v + '"', line);
          return mk(ty, Number(s));
        }
        if (name === "toString") { need(1); return mk("String", text(a[0])); }
        if (name === "compare") { need(2); return mk("int", Math.sign(num(a[0]) - num(a[1]))); }
        if (name === "max" || name === "min") { need(2); return mk(ty, Math[name](num(a[0]), num(a[1]))); }
        if (name === "sum") { need(2); return mk(ty, wrap(num(a[0]) + num(a[1]), ty)); }
        if (cn === "Integer" && name === "highestOneBit") { need(1); const x = num(a[0]); return mk("int", x === 0 ? 0 : (x < 0 ? -2147483648 : 1 << (31 - Math.clz32(x)))); }
        if (cn === "Integer" && name === "bitCount") { need(1); let x = num(a[0]) >>> 0, c = 0; while (x) { c += x & 1; x >>>= 1; } return mk("int", c); }
      }
      if (cn === "Character") {
        const c = a[0] && a[0].v;
        const s = String.fromCharCode(c);
        switch (name) {
          case "isDigit": return /[0-9]/.test(s) ? TRUE : FALSE;
          case "isLetter": case "isAlphabetic": return /\p{L}/u.test(s) ? TRUE : FALSE;
          case "isLetterOrDigit": return /[\p{L}0-9]/u.test(s) ? TRUE : FALSE;
          case "isWhitespace": return /\s/.test(s) ? TRUE : FALSE;
          case "isUpperCase": return s !== s.toLowerCase() ? TRUE : FALSE;
          case "isLowerCase": return s !== s.toUpperCase() ? TRUE : FALSE;
          case "toUpperCase": return mk("char", s.toUpperCase().charCodeAt(0));
          case "toLowerCase": return mk("char", s.toLowerCase().charCodeAt(0));
          case "getNumericValue": return mk("int", parseInt(s, 36));
          case "toString": return mk("String", s);
        }
      }
      if (cn === "String") {
        if (name === "valueOf") { need(1); return mk("String", text(a[0])); }
        if (name === "format") return mk("String", format(a, line));
      }
      if (cn === "Boolean" && name === "parseBoolean") return a[0].v === "true" ? TRUE : FALSE;
      if (cn === "System") {
        if (name === "arraycopy") {
          need(5);
          const [src, sp, dst, dp, n] = a;
          if (src.v === null || dst.v === null) raise("NullPointerException", "arraycopy on null", line);
          if (sp.v < 0 || dp.v < 0 || n.v < 0 || sp.v + n.v > src.v.data.length || dp.v + n.v > dst.v.data.length) raise("ArrayIndexOutOfBoundsException", "arraycopy range out of bounds", line);
          const copy = src.v.data.slice(sp.v, sp.v + n.v);
          for (let i = 0; i < n.v; i++) dst.v.data[dp.v + i] = copy[i];
          return VOID;
        }
        if (name === "currentTimeMillis" || name === "nanoTime") return mk("long", ops);
      }
      if (cn === "Arrays") {
        const arr = a[0] && a[0].v;
        if (name === "toString") {
          need(1);
          if (arr === null) return mk("String", "null");
          return mk("String", "[" + arr.data.map((x) => text(x)).join(", ") + "]");
        }
        if (name === "deepToString") { need(1); const deep = (h) => "[" + h.data.map((x) => (x.v && x.v.kind === "array" ? deep(x.v) : text(x))).join(", ") + "]"; return mk("String", deep(arr)); }
        if (name === "sort") {
          if (a.length === 1) arr.data.sort(compareVals);
          else if (a.length === 3) { const part = arr.data.slice(a[1].v, a[2].v).sort(compareVals); part.forEach((x, i) => { arr.data[a[1].v + i] = x; }); } else throw new CompileError("This version of Arrays.sort isn't available here.", line);
          return VOID;
        }
        if (name === "fill") {
          if (a.length === 2) { const v = coerce(a[1], arr.elemType, line, "the fill value"); arr.data.fill(v); return VOID; }
          if (a.length === 4) { const v = coerce(a[3], arr.elemType, line, "the fill value"); arr.data.fill(v, a[1].v, a[2].v); return VOID; }
        }
        if (name === "copyOf") {
          need(2);
          const data = [];
          for (let i = 0; i < a[1].v; i++) data.push(i < arr.data.length ? arr.data[i] : defaultFor(arr.elemType));
          return mk("ref", { id: nextId++, kind: "array", elem: arr.elem, elemType: arr.elemType, data });
        }
        if (name === "copyOfRange") {
          need(3);
          const data = [];
          for (let i = a[1].v; i < a[2].v; i++) data.push(i < arr.data.length ? arr.data[i] : defaultFor(arr.elemType));
          return mk("ref", { id: nextId++, kind: "array", elem: arr.elem, elemType: arr.elemType, data });
        }
        if (name === "equals") { need(2); return arr.data.length === a[1].v.data.length && arr.data.every((x, i) => equal(x, a[1].v.data[i])) ? TRUE : FALSE; }
        if (name === "asList") return mk("ref", { id: nextId++, kind: "list", cls: "ArrayList", data: a.slice() });
      }
      if (cn === "List" && name === "of") return mk("ref", { id: nextId++, kind: "list", cls: "ArrayList", data: a.slice() });
      if (cn === "Collections") {
        const h = a[0] && a[0].v;
        if (name === "sort") { h.data.sort(compareVals); return VOID; }
        if (name === "reverse") { h.data.reverse(); return VOID; }
        if (name === "swap") { const t = h.data[a[1].v]; h.data[a[1].v] = h.data[a[2].v]; h.data[a[2].v] = t; return VOID; }
        if (name === "max" || name === "min") { if (!h.data.length) raise("NoSuchElementException", "the collection is empty", line); return h.data.slice().sort(compareVals)[name === "max" ? h.data.length - 1 : 0]; }
      }
      throw new CompileError(cn + "." + name + " isn't available in the playground" + (cn in { Math: 1, Arrays: 1, Integer: 1, Collections: 1, Character: 1, System: 1 } ? "." : ", or " + cn + " isn't declared."), line);
    }
    /* Math.random and new Random must repeat, or stepping back would mean nothing */
    let lseed = 42;
    const lehmer = () => { lseed = (lseed * 48271) % 2147483647; return lseed / 2147483647; };
    function randomMethod(h, name, a, line) {
      const nx = () => { h.seed = ((h.seed || 1) * 48271) % 2147483647; if (h.seed <= 0) h.seed += 2147483646; return h.seed / 2147483647; };
      if (name === "nextInt") {
        if (a.length && a[0].v <= 0) raise("IllegalArgumentException", "bound must be positive", line);
        return mk("int", a.length ? Math.floor(nx() * a[0].v) : Math.floor(nx() * 4294967296) - 2147483648);
      }
      if (name === "nextDouble") return mk("double", nx());
      if (name === "nextBoolean") return nx() < 0.5 ? TRUE : FALSE;
      throw new CompileError("Random." + name + " isn't available in the playground.", line);
    }
    function stringMethod(s, name, a, line) {
      const bounds = (i, n) => { if (i < 0 || i > n) raise("StringIndexOutOfBoundsException", "index " + i + ", length " + s.length, line); };
      switch (name) {
        case "length": return mk("int", s.length);
        case "charAt": if (a[0].v < 0 || a[0].v >= s.length) raise("StringIndexOutOfBoundsException", "Index " + a[0].v + " out of bounds for length " + s.length, line); return mk("char", s.charCodeAt(a[0].v));
        case "substring": { const i = a[0].v, j = a.length > 1 ? a[1].v : s.length; bounds(i, s.length); bounds(j, s.length); if (i > j) raise("StringIndexOutOfBoundsException", "begin " + i + ", end " + j, line); return mk("String", s.slice(i, j)); }
        case "indexOf": return mk("int", s.indexOf(a[0].t === "char" ? String.fromCharCode(a[0].v) : a[0].v, a[1] ? a[1].v : 0));
        case "lastIndexOf": return mk("int", s.lastIndexOf(a[0].t === "char" ? String.fromCharCode(a[0].v) : a[0].v));
        case "contains": return s.includes(text(a[0])) ? TRUE : FALSE;
        case "startsWith": return s.startsWith(a[0].v) ? TRUE : FALSE;
        case "endsWith": return s.endsWith(a[0].v) ? TRUE : FALSE;
        case "equals": return a[0].t === "String" && a[0].v === s ? TRUE : FALSE;
        case "equalsIgnoreCase": return a[0].t === "String" && a[0].v.toLowerCase() === s.toLowerCase() ? TRUE : FALSE;
        case "isEmpty": return s.length ? FALSE : TRUE;
        case "compareTo": { const b = a[0].v, n = Math.min(s.length, b.length); for (let i = 0; i < n; i++) if (s[i] !== b[i]) return mk("int", s.charCodeAt(i) - b.charCodeAt(i)); return mk("int", s.length - b.length); }
        case "toUpperCase": return mk("String", s.toUpperCase());
        case "toLowerCase": return mk("String", s.toLowerCase());
        case "trim": case "strip": return mk("String", s.trim());
        case "concat": return mk("String", s + a[0].v);
        case "repeat": return mk("String", s.repeat(a[0].v));
        case "replace": return mk("String", s.split(a[0].t === "char" ? String.fromCharCode(a[0].v) : a[0].v).join(a[1].t === "char" ? String.fromCharCode(a[1].v) : a[1].v));
        case "hashCode": { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return mk("int", h); }
        case "toString": return mk("String", s);
        case "toCharArray": return mk("ref", { id: nextId++, kind: "array", elem: "char", elemType: { name: "char", dims: 0 }, data: Array.from(s, (c) => mk("char", c.charCodeAt(0))) });
        case "split": return mk("ref", { id: nextId++, kind: "array", elem: "String", elemType: { name: "String", dims: 0 }, data: s.split(a[0].v === " " ? " " : new RegExp(a[0].v)).map((x) => mk("String", x)) });
      }
      throw new CompileError("String." + name + " isn't available in the playground.", line);
    }
    function sbMethod(r, name, a, line) {
      const h = r.v;
      switch (name) {
        case "append": h.s += text(a[0]); return r;
        case "toString": return mk("String", h.s);
        case "length": return mk("int", h.s.length);
        case "reverse": h.s = h.s.split("").reverse().join(""); return r;
        case "charAt": return stringMethod(h.s, "charAt", a, line);
        case "insert": h.s = h.s.slice(0, a[0].v) + text(a[1]) + h.s.slice(a[0].v); return r;
        case "deleteCharAt": h.s = h.s.slice(0, a[0].v) + h.s.slice(a[0].v + 1); return r;
        case "setLength": h.s = h.s.slice(0, a[0].v); return VOID;
      }
      throw new CompileError("StringBuilder." + name + " isn't available in the playground.", line);
    }
    function listMethod(r, name, a, line) {
      const h = r.v, d = h.data;
      const at = (i, n) => { if (i < 0 || i >= n) raise("IndexOutOfBoundsException", "Index " + i + " out of bounds for length " + n, line); };
      const empty = () => { raise(h.cls === "Stack" ? "EmptyStackException" : "NoSuchElementException", h.cls + " is empty", line); };
      const pqPush = (x) => { d.push(x); d.sort(compareVals); };
      if (h.kind === "pq") {
        switch (name) {
          case "add": case "offer": pqPush(a[0]); return TRUE;
          case "poll": return d.length ? d.shift() : NULL;
          case "remove": if (!a.length) { if (!d.length) empty(); return d.shift(); } break;
          case "peek": return d.length ? d[0] : NULL;
        }
      }
      if (h.kind === "set" && name === "add") return setAdd(h, a[0]) ? TRUE : FALSE;
      const key = (x) => hashKey(x);
      /* Stack and Deque's push differ: Stack's top is the end of the list, a Deque's is the front */
      const front = h.cls !== "Stack";
      switch (name) {
        case "size": return mk("int", d.length);
        case "isEmpty": case "empty": return d.length ? FALSE : TRUE;
        case "clear": d.length = 0; return VOID;
        case "contains": return d.some((x) => key(x) === key(a[0])) ? TRUE : FALSE;
        case "indexOf": return mk("int", d.findIndex((x) => key(x) === key(a[0])));
        case "toString": return mk("String", text(r));
        case "get": at(a[0].v, d.length); return d[a[0].v];
        case "set": { at(a[0].v, d.length); const old = d[a[0].v]; d[a[0].v] = a[1]; return old; }
        case "add":
          if (a.length === 2) { at(a[0].v, d.length + 1); d.splice(a[0].v, 0, a[1]); return VOID; }
          d.push(a[0]); return TRUE;
        case "addAll": a[0].v.data.forEach((x) => (h.kind === "set" ? setAdd(h, x) : d.push(x))); return TRUE;
        case "offer": case "offerLast": case "addLast": d.push(a[0]); return name === "addLast" ? VOID : TRUE;
        case "addFirst": d.unshift(a[0]); return VOID;
        case "offerFirst": d.unshift(a[0]); return TRUE;
        case "push": if (front) d.unshift(a[0]); else d.push(a[0]); return a[0];
        case "pop": if (!d.length) empty(); return front ? d.shift() : d.pop();
        case "peek": if (!d.length) { if (!front) empty(); return NULL; } return front ? d[0] : d[d.length - 1];
        case "poll": case "pollFirst": return d.length ? d.shift() : NULL;
        case "pollLast": return d.length ? d.pop() : NULL;
        case "peekFirst": return d.length ? d[0] : NULL;
        case "peekLast": return d.length ? d[d.length - 1] : NULL;
        case "getFirst": case "element": case "firstElement": if (!d.length) empty(); return d[0];
        case "getLast": case "lastElement": if (!d.length) empty(); return d[d.length - 1];
        case "removeFirst": if (!d.length) empty(); return d.shift();
        case "removeLast": if (!d.length) empty(); return d.pop();
        case "remove":
          if (!a.length) { if (!d.length) empty(); return d.shift(); }
          if (h.kind === "list" && a[0].t === "int") { at(a[0].v, d.length); return d.splice(a[0].v, 1)[0]; }
          { const i = d.findIndex((x) => key(x) === key(a[0])); if (i < 0) return FALSE; d.splice(i, 1); return TRUE; }
      }
      throw new CompileError(h.cls + "." + name + " isn't available in the playground.", line);
    }
    function mapMethod(h, name, a, line) {
      const m = h.map, key = (x) => hashKey(x);
      const sorted = () => { if (h.cls !== "TreeMap") return; const es = Array.from(m.entries()).sort((p, q) => compareVals(p[1].k, q[1].k)); m.clear(); es.forEach(([k, v]) => m.set(k, v)); };
      switch (name) {
        case "put": { const k = key(a[0]), old = m.get(k); m.set(k, { k: a[0], v: a[1] }); sorted(); return old ? old.v : NULL; }
        case "get": { const e = m.get(key(a[0])); return e ? e.v : NULL; }
        case "getOrDefault": { const e = m.get(key(a[0])); return e ? e.v : a[1]; }
        case "containsKey": return m.has(key(a[0])) ? TRUE : FALSE;
        case "containsValue": return Array.from(m.values()).some((e) => key(e.v) === key(a[0])) ? TRUE : FALSE;
        case "remove": { const k = key(a[0]), old = m.get(k); m.delete(k); return old ? old.v : NULL; }
        case "size": return mk("int", m.size);
        case "isEmpty": return m.size ? FALSE : TRUE;
        case "clear": m.clear(); return VOID;
        case "keySet": return mk("ref", { id: nextId++, kind: "set", cls: "HashSet", data: Array.from(m.values()).map((e) => e.k) });
        case "values": return mk("ref", { id: nextId++, kind: "list", cls: "ArrayList", data: Array.from(m.values()).map((e) => e.v) });
        case "toString": return mk("String", text(mk("ref", h)));
      }
      throw new CompileError(h.cls + "." + name + " isn't available in the playground.", line);
    }

    /* ---------- run main ---------- */
    let mainFn = null;
    Object.values(classes).forEach((c) => { const list = c.methods.main; if (list && !mainFn) mainFn = list.find((m) => m.isStatic !== false) || null; });
    if (!mainFn) throw new CompileError("Add public static void main(String[] args) so I know where to start.", 1);
    const result = { frames, truncated: false, error: null, stepLimit: false };
    /* static fields get their defaults, then their initial values in order */
    const boot = { scopes: [new Map()], self: null, cls: mainFn.cls, label: "static", id: nextId++, name: "<clinit>" };
    Object.values(classes).forEach((c) => c.statics.forEach((f) => { if (!f.isBlock) c.staticVals[f.name] = defaultFor(f.type); }));
    try {
      stack.push(boot);
      Object.values(classes).forEach((c) => c.statics.forEach((f) => {
        boot.cls = c.name;
        curLine = f.line || curLine;
        if (f.isBlock) execBlock(f.init);
        else if (f.init) c.staticVals[f.name] = coerce(evalExpr(f.init), f.type, f.line, "field " + f.name);
      }));
      stack.pop();
      const argv = mainFn.params.length ? [mk("ref", { id: nextId++, kind: "array", elem: "String", elemType: { name: "String", dims: 0 }, data: [] })] : [];
      invoke(mainFn, null, argv, mainFn.line);
    } catch (err) {
      if (err instanceof JavaThrow) {
        result.error = { kind: "runtime", cls: err.cls, message: err.jmsg, line: err.line };
        print("Exception in main: " + err.cls + (err.jmsg != null ? ": " + err.jmsg : "") + "\n");
      } else if (err instanceof RangeError) {
        result.error = { kind: "runtime", cls: "StackOverflowError", message: DEEP, line: curLine };
        print("Exception in main: StackOverflowError\n");
      } else if (err instanceof StepLimit) {
        result.stepLimit = true;
        result.error = { kind: "limit", message: "Stopped after " + o.maxOps.toLocaleString("en-US") + " operations. Is a loop or a recursion missing its stopping condition?", line: err.line };
      } else if (err instanceof CompileError) {
        err.line = err.line || curLine;
        throw err;
      } else if (err instanceof BreakSig || err instanceof ContinueSig) {
        throw new CompileError("break and continue only work inside a loop or switch.", curLine);
      } else throw err;
    }
    result.truncated = truncated;
    result.output = output;
    return result;
  }

  /* compile errors become a value, so callers have one shape to handle */
  function runJava(src, opts) {
    try { return run(src, opts); } catch (err) {
      if (err instanceof CompileError) return { frames: [], output: "", truncated: false, error: { kind: "compile", message: err.message, line: err.line || 1 } };
      throw err;
    }
  }

  root.runJava = runJava;
  if (typeof module !== "undefined" && module.exports) module.exports = { runJava };
})(typeof self !== "undefined" ? self : globalThis);

/* in a Web Worker: one message in, one result out */
if (typeof self !== "undefined" && typeof self.importScripts === "function") {
  self.onmessage = (e) => { self.postMessage({ result: self.runJava(e.data.code) }); };
}
