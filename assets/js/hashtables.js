/* ============================================================
   hashtables.js: separate chaining + three open-addressing
   probe strategies, with load factor and rehashing
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);

  const T = {
    mode: "chain",      /* chain | linear | quad */
    m: 11,
    slots: [],          /* chain: array of arrays. open: {k} | null | TOMB */
    n: 0,
    auto: true,
    keyType: "int",          /* "int" or "str": a table holds one kind of key */
    probesTotal: 0,
    opsTotal: 0,
  };
  const TOMB = "☠";   /* tombstone marker */
  let player, dock;

  /* ---------------- hashing ---------------- */
  function hashCode(k) {
    if (typeof k === "number") return k;
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
    return h;
  }
  const h1 = (k, m) => ((hashCode(k) % m) + m) % m;
  function isPrime(x) { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; }
  function nextPrime(x) { while (!isPrime(x)) x++; return x; }

  function probeAt(k, i) {
    const base = h1(k, T.m);
    if (T.mode === "linear") return (base + i) % T.m;
    if (T.mode === "quad") return (base + i * i) % T.m;
    return base;
  }
  function probeFormula(k, i) {
    const base = h1(k, T.m);
    if (T.mode === "linear") return "(h(k) + " + i + ") mod " + T.m + " = (" + base + " + " + i + ") mod " + T.m + " = " + probeAt(k, i);
    if (T.mode === "quad") return "(h(k) + " + i + "²) mod " + T.m + " = (" + base + " + " + i * i + ") mod " + T.m + " = " + probeAt(k, i);
    return String(base);
  }
  const hashNote = (k) =>
    typeof k === "number"
      ? "<span class='mono'>h(" + k + ") = " + k + " mod " + T.m + " = " + h1(k, T.m) + "</span>"
      : "<span class='mono'>h(\"" + k + "\") = " + hashCode(k) + " mod " + T.m + " = " + h1(k, T.m) + "</span>";

  /* a String's hash is only known once hash(s) has run, so the intro of a probing operation doesn't give it away */
  const introHash = (k) => (typeof k === "string" ? "its home slot comes from hash(k), computed at the first probe" : hashNote(k));
  const alpha = () => T.n / T.m;
  /* rehash limits: chains tolerate long lists; linear probing degrades past ~0.6; quadratic probing is only
     guaranteed to find a free slot while the table is at most half full (m prime), so it rehashes above 0.5 */
  const threshold = () => (T.mode === "chain" ? 0.9 : T.mode === "quad" ? 0.5 : 0.6);

  function fresh(m) {
    T.m = m;
    T.slots = new Array(m);
    for (let i = 0; i < m; i++) T.slots[i] = T.mode === "chain" ? [] : null;
    T.n = 0;
  }

  /* ---------------- code listings ---------------- */
  const CODE = {
    ch_put: {
      title: "put(k) · separate chaining",
      pseudo: [
        "put(k):",
        "  b ← h(k) mod m                     // which bucket @@hash",
        "  for each key x in bucket[b]:       // walk the chain @@loop",
        "    if x == k: return                // already present @@dup",
        "  bucket[b].addFirst(k)              // O(1) @@add",
        "  n ← n + 1 @@add",
        "  if n / m > maxLoad: rehash() @@rehash",
      ],
      java: [
        "void put(int k) {",
        "  int b = Math.floorMod(hash(k), m); @@hash",
        "  for (int x : table[b]) @@loop",
        "    if (x == k) return; @@dup",
        "  table[b].addFirst(k); @@add",
        "  n++; @@add",
        "  if ((double) n / m > MAX_LOAD) rehash(); @@rehash",
        "}",
      ],
    },
    ch_get: {
      title: "get(k) · separate chaining",
      pseudo: ["get(k):", "  b ← h(k) mod m @@hash", "  for each key x in bucket[b]: @@loop", "    if x == k: return true @@found", "  return false                       // chain exhausted @@miss"],
      java: ["boolean get(int k) {", "  int b = Math.floorMod(hash(k), m); @@hash", "  for (int x : table[b]) @@loop", "    if (x == k) return true; @@found", "  return false; @@miss", "}"],
    },
    ch_remove: {
      title: "remove(k) · separate chaining",
      pseudo: ["remove(k):", "  b ← h(k) mod m @@hash", "  for each key x in bucket[b]: @@loop", "    if x == k: unlink x;  n ← n - 1;  return @@found", "  // not present: nothing to do @@miss"],
      java: ["void remove(int k) {", "  int b = Math.floorMod(hash(k), m); @@hash", "  Iterator<Integer> it = table[b].iterator();", "  while (it.hasNext()) @@loop", "    if (it.next() == k) { it.remove();  n--;  return; } @@found", "} @@miss"],
    },
    rehash: {
      title: "rehash()",
      pseudo: [
        "rehash():",
        "  old ← table @@alloc",
        "  m ← nextPrime(2m + 1);  table ← new empty table of size m @@alloc",
        "  for each key k in old:             // tombstones are dropped @@loop",
        "    put(k)                           // new m ⇒ every index changes @@put",
      ],
      java: ["void rehash() {", "  var old = table; @@alloc", "  m = nextPrime(2 * m + 1);  table = newTable(m);  n = 0; @@alloc", "  for (int k : keysOf(old)) @@loop", "    put(k); @@put", "}"],
    },
  };
  /* open addressing: the listings differ only in the probe expression */
  function oaCode(mode) {
    const lin = mode === "linear";
    const P = {
      pseudo: lin ? "(h(k) + i) mod m                // linear probing" : "(h(k) + i²) mod m               // quadratic probing",
      java: lin ? "(hash(k) + i) % m;          // linear probing" : "(hash(k) + i * i) % m;      // quadratic probing",
    };
    const name = lin ? "linear probing" : "quadratic probing";
    CODE["oa_put_" + mode] = {
      title: "put(k) · " + name,
      pseudo: [
        "put(k):",
        "  tomb ← -1                          // first DELETED slot seen @@init",
        "  for i ← 0 to m-1: @@loop",
        "    j ← " + P.pseudo + " @@probe",
        "    if T[j] is EMPTY: @@empty",
        "      T[tomb ≥ 0 ? tomb : j] ← k;  n ← n + 1;  return @@store",
        "    if T[j] is DELETED: if tomb < 0: tomb ← j @@tomb",
        "    else if T[j] == k: return        // already present @@dup",
        "  error \"no free slot found\" @@full",
      ],
      java: [
        "void put(int k) {",
        "  int tomb = -1; @@init",
        "  for (int i = 0; i < m; i++) { @@loop",
        "    int j = " + P.java + " @@probe",
        "    if (table[j] == EMPTY) { @@empty",
        "      table[tomb >= 0 ? tomb : j] = k;  n++;  return; @@store",
        "    }",
        "    if (table[j] == DELETED) { if (tomb < 0) tomb = j; } @@tomb",
        "    else if (table[j] == k) return; @@dup",
        "  }",
        "  throw new IllegalStateException(\"no free slot\"); @@full",
        "}",
      ],
    };
    CODE["oa_get_" + mode] = {
      title: "get(k) · " + name,
      pseudo: [
        "get(k):",
        "  for i ← 0 to m-1: @@loop",
        "    j ← " + P.pseudo + " @@probe",
        "    if T[j] is EMPTY: return false   // k would have been put here @@empty",
        "    if T[j] is DELETED: continue     // must keep probing! @@tomb",
        "    if T[j] == k: return true @@found",
        "  return false @@miss",
      ],
      java: [
        "boolean get(int k) {",
        "  for (int i = 0; i < m; i++) { @@loop",
        "    int j = " + P.java + " @@probe",
        "    if (table[j] == EMPTY) return false; @@empty",
        "    if (table[j] == DELETED) continue; @@tomb",
        "    if (table[j] == k) return true; @@found",
        "  }",
        "  return false; @@miss",
        "}",
      ],
    };
    CODE["oa_remove_" + mode] = {
      title: "remove(k) · " + name,
      pseudo: [
        "remove(k):",
        "  for i ← 0 to m-1: @@loop",
        "    j ← " + P.pseudo + " @@probe",
        "    if T[j] is EMPTY: return         // not present @@empty",
        "    if T[j] == k: T[j] ← DELETED;  n ← n - 1;  return   // a tombstone, not EMPTY @@found",
        "  // not present @@miss",
      ],
      java: [
        "void remove(int k) {",
        "  for (int i = 0; i < m; i++) { @@loop",
        "    int j = " + P.java + " @@probe",
        "    if (table[j] == EMPTY) return; @@empty",
        "    if (table[j] == k) { table[j] = DELETED;  n--;  return; } @@found",
        "  }",
        "} @@miss",
      ],
    };
  }
  oaCode("linear");
  oaCode("quad");

  /* ---- String keys: the same algorithms, with String types, equals() and an explicit hash function ---- */
  function strVariant(L) {
    const map = (lines, fn) => lines.map((t) => { const i = t.lastIndexOf(" @@"); return i >= 0 ? fn(t.slice(0, i)) + t.slice(i) : fn(t); });
    return {
      title: L.title + " · String keys",
      pseudo: L.pseudo.slice(),
      java: map(L.java, (t) => t.replace(/\bint k\b/g, "String k").replace("(int x : table[b])", "(String x : table[b])")
        .replace("x == k", "x.equals(k)").replace("it.next() == k", "it.next().equals(k)").replace("table[j] == k", "k.equals(table[j])")
        .replace("Iterator<Integer>", "Iterator<String>")),
    };
  }
  Object.keys(CODE).forEach((k) => { CODE[k + "_s"] = strVariant(CODE[k]); });
  CODE.hash_s = {
    title: "hash(s) · polynomial string hash",
    pseudo: [
      "hash(s):                        // what Java's String.hashCode computes",
      "  h ← 0 @@init",
      "  for each character c in s: @@loop",
      "    h ← 31·h + code(c)            // kept to 32 bits, so it wraps around @@step",
      "  return h @@ret",
    ],
    java: [
      "static int hash(String s) {     // same value as s.hashCode()",
      "  int h = 0; @@init",
      "  for (int i = 0; i < s.length(); i++) @@loop",
      "    h = 31 * h + s.charAt(i);     // int overflow wraps around @@step",
      "  return h; @@ret",
      "}",
    ],
  };
  const listing = (op) => (op === "rehash" ? "rehash" : T.mode === "chain" ? "ch_" + op : "oa_" + op + "_" + T.mode) + (T.keyType === "str" ? "_s" : "");

  /* ---- specs ---- */
  {
    const M = (t) => "<span class='mono'>" + t + "</span>";
    const keyP = (str) => M("k") + (str ? ", a String key" : ", an int key (negative keys are fine; floorMod keeps the index in range)");
    const eq = (str) => (str ? " Keys are compared with " + M("equals") + ", never " + M("==") + ", which would only compare references." : "");
    const specs = {};
    [false, true].forEach((str) => {
      const sfx = str ? "_s" : "";
      const h = str ? "the polynomial hash of k" : "k itself";
      const L = str ? " (plus O(length of k) to hash it)" : "";
      specs["ch_put" + sfx] = { does: "Adds key k to bucket " + M("h(k) mod m") + "'s list unless it is already there, then rehashes if the load factor is too high. h(k) is " + h + "." + eq(str), params: keyP(str), returns: "nothing (a duplicate is ignored)", errors: "none", time: "O(n): if every key lands in the same bucket, or when the put triggers a rehash; O(1 + α) expected" + L, space: "O(1): one list node (O(n + m) during a rehash)" };
      specs["ch_get" + sfx] = { does: "Walks bucket " + M("h(k) mod m") + "'s list looking for k." + eq(str), params: keyP(str), returns: "true if k is in the table", errors: "none", time: "O(n): if every key collides into one chain; O(1 + α) expected" + L, space: "O(1)" };
      specs["ch_remove" + sfx] = { does: "Unlinks k from its bucket's list, if present. No tombstones are needed." + eq(str), params: keyP(str), returns: "nothing (a missing key is ignored)", errors: "none", time: "O(n): if every key collides into one chain; O(1 + α) expected" + L, space: "O(1)" };
      specs["rehash" + sfx] = { does: "Allocates a table of the next prime size above 2m and re-inserts every key; tombstones are dropped.", params: "none", returns: "nothing", errors: "none", time: "O(n + m): every key is re-inserted", space: "O(n + m): the new table" };
      ["linear", "quad"].forEach((mode) => {
        const how = mode === "linear" ? "the next slot, i = 1, 2, 3 …" : "offsets i² = 1, 4, 9 …";
        specs["oa_put_" + mode + sfx] = { does: "Probes from " + M("h(k) mod m") + ", trying " + how + ", and stores k in the first EMPTY slot (or the first tombstone passed)." + eq(str), params: keyP(str), returns: "nothing (a duplicate is ignored)", errors: "no free slot found: the table is full" + (mode === "quad" ? ", or quadratic probing missed the free slots (possible when α ≥ ½)" : ""), time: "O(m): a probe can visit every slot; O(1) expected while α stays small" + L, space: "O(1)" };
        specs["oa_get_" + mode + sfx] = { does: "Follows the same probe sequence as put until it finds k or an EMPTY slot. Tombstones do not stop it." + eq(str), params: keyP(str), returns: "true if k is in the table", errors: "none", time: "O(m): a probe can visit every slot; O(1) expected" + L, space: "O(1)" };
        specs["oa_remove_" + mode + sfx] = { does: "Finds k along its probe sequence and replaces it with a DELETED tombstone, so later searches still pass through." + eq(str), params: keyP(str), returns: "nothing (a missing key is ignored)", errors: "none", time: "O(m): a probe can visit every slot; O(1) expected" + L, space: "O(1)" };
      });
    });
    specs.hash_s = { does: "Turns a string into an int: h = 31·h + code(c) for each character. Position matters, so anagrams hash differently; different strings can still collide (\"Aa\" and \"BB\" both give 2112).", params: M("s") + ": the string", returns: "a 32-bit int, possibly negative after overflow: that is why the table uses floorMod", errors: "none", time: "O(length of s): Java caches the result inside the String", space: "O(1)", callVals: { s: '"cat"' } };
    D.specs(CODE, specs);
  }

  /* ---- classes: the fields every method uses (rehash is shared, so it follows the table on screen) ---- */
  function classFor(mode, str) {
    const K = str ? "String" : "Integer";
    if (mode === "chain") return {
      name: "ChainingHashTable",
      note: "Bucket b is a linked list of every key whose hash lands on b.",
      pseudo: [
        "class ChainingHashTable:",
        "  bucket                     // array of m lists; bucket[b] holds the keys that hash to b",
        "  m                          // number of buckets (a prime)",
        "  n                          // number of keys stored",
        "  maxLoad                    // rehash when n / m goes above this",
        "",
        "  constructor(m):",
        "    bucket ← array of m empty lists;  n ← 0",
      ],
      java: [
        "public class ChainingHashTable {",
        "  private LinkedList<" + K + ">[] table;   // table[b] = the keys that hash to bucket b",
        "  private int m;                     // number of buckets (a prime)",
        "  private int n;                     // number of keys stored",
        "  private static final double MAX_LOAD = 0.9;",
        "",
        "  public ChainingHashTable(int m) {  // constructor: new ChainingHashTable(11)",
        "    this.m = m;  n = 0;",
        "    table = new LinkedList[m];",
        "    for (int b = 0; b < m; b++) table[b] = new LinkedList<>();",
        "  }",
        "  // put, get, remove and rehash (below) use table, m and n",
        "}",
      ] };
    const lin = mode === "linear";
    return {
      name: lin ? "LinearProbingTable" : "QuadraticProbingTable",
      note: "Every key lives in the array itself. EMPTY is a slot never used; DELETED is a tombstone left by remove.",
      pseudo: [
        "class " + (lin ? "LinearProbingTable" : "QuadraticProbingTable") + ":",
        "  T                          // array of m slots: a key, EMPTY or DELETED",
        "  m                          // number of slots (a prime)",
        "  n                          // number of keys stored",
        "",
        "  constructor(m):",
        "    T ← array of m EMPTY slots;  n ← 0",
      ],
      java: [
        "public class " + (lin ? "LinearProbingTable" : "QuadraticProbingTable") + " {",
        "  private static final " + K + " EMPTY = null;                 // a slot never used",
        "  private static final " + K + " DELETED = " + (str ? "new String(\"☠\")" : "Integer.MIN_VALUE") + ";   // a tombstone",
        "  private " + K + "[] table;   // m slots, each a key, EMPTY or DELETED",
        "  private int m;               // number of slots (a prime)",
        "  private int n;               // number of keys stored",
        "",
        "  public " + (lin ? "LinearProbingTable" : "QuadraticProbingTable") + "(int m) {",
        "    this.m = m;  n = 0;  table = new " + K + "[m];   // every slot starts EMPTY",
        "  }",
        "  // put, get, remove and rehash (below) use table, m and n",
        "}",
      ] };
  }
  Object.keys(CODE).forEach((k) => {
    if (k === "hash_s" || /^rehash/.test(k)) return;
    const str = /_s$/.test(k);
    CODE[k].cls = classFor(/^ch_/.test(k) ? "chain" : /_linear/.test(k) ? "linear" : "quad", str);
  });
  const shareClass = () => { CODE.rehash.cls = classFor(T.mode, false); CODE.rehash_s.cls = classFor(T.mode, true); };

  /* ---------------- recorder ---------------- */
  function Ctx(limit) {
    const R = new D.Recorder(limit || 1000);
    return {
      probes: 0,
      frames: R.frames,
      codeKey: null,
      lineKey: null,
      code(k) { this.codeKey = k; this.lineKey = null; return this; },
      at(l) { this.lineKey = l; return this; },
      snap(marks, note, extra) {
        R.push(
          Object.assign(
            {
              mode: T.mode,
              m: T.m,
              n: T.n,
              slots: T.slots.map((s) => (Array.isArray(s) ? s.slice() : s)),
              marks: marks || {},
              note: note,
              probes: this.probes,
              alpha: alpha(),
              code: this.codeKey,
              line: this.lineKey,
            },
            extra || {}
          )
        );
      },
    };
  }

  /* ---------------- chaining ---------------- */
  /* For a String key, show the hash being computed, character by character, then return to the caller */
  function traceHash(c, k, backTo) {
    if (typeof k !== "string") return;
    c.code("hash_s");
    let h = 0;
    c.at("init").snap({}, "<b>hash(\"" + k + "\")</b>: start with h = 0.", { hc: { s: k, i: -1, h: 0 } });
    for (let i = 0; i < k.length; i++) {
      const code = k.charCodeAt(i), raw = h * 31 + code, nh = raw | 0;
      c.at(["loop", "step"]).snap({}, "'" + k[i] + "' has code " + code + ": h ← 31 · " + h + " + " + code + " = " + raw +
        (raw !== nh ? ", which does not fit in 32 bits, so it wraps around to <b>" + nh + "</b>." : "."), { hc: { s: k, i: i, h: nh } });
      h = nh;
    }
    c.at("loop").snap({}, "No characters left.", { hc: { s: k, i: k.length, h: h } });
    c.at("ret").snap({}, "Return <b>" + h + "</b>: exactly what Java's <span class='mono'>\"" + k + "\".hashCode()</span> gives." + (h < 0 ? " It is negative, so a plain % could give a negative index; floorMod (or ((h % m) + m) % m) keeps it in [0, m)." : ""), { hc: { s: k, i: k.length, h: h, done: true } });
    c.code(backTo);
  }
  function chainInsert(c, k) {
    c.code(listing("put"));
    if (typeof k === "string") { c.at("hash").snap({}, "<b>put(" + fmtk(k) + ")</b>: the bucket index needs hash(k), so call the string hash first."); traceHash(c, k, listing("put")); }
    const i = h1(k, T.m);
    c.at("hash").snap({ [i]: "active" }, "<b>put(" + fmtk(k) + ")</b>: " + hashNote(k) + ", so it belongs in bucket <b>" + i + "</b>.");
    const chain = T.slots[i];
    for (let j = 0; j < chain.length; j++) {
      c.probes++;
      c.at("loop").snap({ [i]: "cmp" }, (j ? "Next node in the chain: " : "Bucket " + i + " already holds " + chain.length + " key(s), a <b>collision</b>. Walk the chain. First node: ") + fmtk(chain[j]) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
      if (String(chain[j]) === String(k)) { c.at("dup").snap({ [i]: "done" }, fmtk(chain[j]) + " == " + fmtk(k) + ": the key is already here, so return without inserting.", { chainMark: { b: i, j: j, cls: "done" } }); return; }
      c.at("dup^").snap({ [i]: "cmp" }, fmtk(chain[j]) + " ≠ " + fmtk(k) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
    }
    c.at("loop").snap({ [i]: "cmp" }, chain.length ? "No more nodes in the chain, so " + fmtk(k) + " is not there yet." : "Bucket " + i + " is empty, so the loop body never runs.");
    chain.unshift(k);
    T.n++;
    c.probes++;
    c.at("add").snap({ [i]: "done" }, "Add it at the <b>front</b> of bucket " + i + "'s list: O(1), no shifting. Chain length is now " + chain.length + ". Load factor α = n/m = " + T.n + "/" + T.m + " = " + alpha().toFixed(2) + ".", { chainMark: { b: i, j: 0, cls: "done" } });
    c.at(alpha() > threshold() ? "rehash" : "rehash^").snap({}, "α = " + alpha().toFixed(2) + (alpha() > threshold() ? " is above " : " ≤ ") + "maxLoad = " + threshold() + (alpha() > threshold() ? (T.auto ? ": time to rehash." : ", but auto-rehash is off.") : ": no rehash needed."));
  }
  function chainSearch(c, k) {
    c.code(listing("get"));
    if (typeof k === "string") { c.at("hash").snap({}, "<b>get(" + fmtk(k) + ")</b>: compute hash(k) first."); traceHash(c, k, listing("get")); }
    const i = h1(k, T.m);
    c.at("hash").snap({ [i]: "active" }, "<b>get(" + fmtk(k) + ")</b>: " + hashNote(k) + ". Only bucket " + i + " can possibly hold it.");
    const chain = T.slots[i];
    for (let j = 0; j < chain.length; j++) {
      c.probes++;
      c.at("loop").snap({ [i]: "cmp" }, "Node " + j + " of the chain holds " + fmtk(chain[j]) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
      if (String(chain[j]) !== String(k)) c.at("found^").snap({ [i]: "cmp" }, fmtk(chain[j]) + " ≠ " + fmtk(k) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
      if (String(chain[j]) === String(k)) { c.at("found").snap({ [i]: "done" }, "<b>Found</b> after " + c.probes + " comparison(s). The expected cost is 1 + α/2, which is O(1) as long as α stays small.", { chainMark: { b: i, j: j, cls: "done" } }); return; }
    }
    c.at("loop").snap({ [i]: "cmp" }, chain.length ? "No more nodes in the chain." : "Bucket " + i + " is empty, so the loop body never runs.");
    c.at("miss").snap({ [i]: "swap" }, chain.length ? "End of the chain: <b>not found</b> after " + c.probes + " comparison(s)." : "Bucket " + i + " is empty, so <b>" + fmtk(k) + " is not in the table</b>.");
  }
  function chainDelete(c, k) {
    c.code(listing("remove"));
    if (typeof k === "string") { c.at("hash").snap({}, "<b>remove(" + fmtk(k) + ")</b>: compute hash(k) first."); traceHash(c, k, listing("remove")); }
    const i = h1(k, T.m);
    c.at("hash").snap({ [i]: "active" }, "<b>remove(" + fmtk(k) + ")</b>: hash to bucket " + i + ".");
    const chain = T.slots[i];
    for (let j = 0; j < chain.length; j++) {
      c.probes++;
      c.at("loop").snap({ [i]: "cmp" }, "Node " + j + " of the chain holds " + fmtk(chain[j]) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
      if (String(chain[j]) !== String(k)) c.at("found^").snap({ [i]: "cmp" }, fmtk(chain[j]) + " ≠ " + fmtk(k) + ".", { chainMark: { b: i, j: j, cls: "cmp" } });
      if (String(chain[j]) === String(k)) {
        chain.splice(j, 1);
        T.n--;
        c.at("found").snap({ [i]: "done" }, "Unlink it. Deleting from a chain is simple: <b>no tombstones needed</b>, because no other key's probe path runs through this node.");
        return;
      }
    }
    c.at("loop").snap({ [i]: "cmp" }, chain.length ? "No more nodes in the chain." : "Bucket " + i + " is empty, so the loop body never runs.");
    c.at("miss").snap({ [i]: "swap" }, "<b>" + fmtk(k) + "</b> is not in the table, nothing to delete.");
  }

  /* ---------------- open addressing ---------------- */
  function openInsert(c, k) {
    c.code(listing("put"));
    c.at("init").snap({}, "<b>put(" + fmtk(k) + ")</b>: " + introHash(k) + ". With open addressing every key lives in the table itself, so on a collision we <em>probe</em> for another slot.");
    let firstTomb = -1;
    for (let i = 0; i < T.m; i++) {
      const p = probeAt(k, i);
      c.probes++;
      c.at("loop").snap(firstTomb >= 0 ? { [firstTomb]: "visit" } : {}, "Probe number i = " + i + ".");
      if (i === 0 && typeof k === "string") { c.at("probe").snap({}, "The probe needs hash(k). Compute it once: Java caches a String's hash code, so later probes reuse it."); traceHash(c, k, listing("put")); }
      const cellIs = T.slots[p] === null ? "EMPTY" : T.slots[p] === TOMB ? "DELETED (a tombstone)" : "occupied by " + fmtk(T.slots[p]);
      c.at("probe").snap({ [p]: T.slots[p] == null || T.slots[p] === TOMB ? "active" : "cmp" }, probeFormula(k, i) + " → slot " + p + " is " + cellIs + ".");
      if (T.slots[p] === null) {
        const at = firstTomb >= 0 ? firstTomb : p;
        T.slots[at] = k;
        T.n++;
        c.at(["empty", "store"]).snap({ [at]: "done" }, "An EMPTY slot means the key cannot already be in the table. Store it at <b>" + at + "</b>" + (firstTomb >= 0 ? ", the first tombstone we passed, which is safe to reuse" : "") + ". Probes used: " + c.probes + ".");
        return;
      }
      if (T.slots[p] === TOMB) {
        const first = firstTomb < 0;
        if (first) firstTomb = p;
        c.at(["empty^", "tomb"]).snap({ [p]: "visit" }, "Not EMPTY but DELETED: a tombstone. " + (first ? "Remember slot " + p + " as a place we <em>could</em> use, but keep probing in case k is further along." : "An earlier tombstone (slot " + firstTomb + ") is already remembered, so just keep probing."));
        continue;
      }
      if (String(T.slots[p]) === String(k)) { c.at(["empty^", "tomb^", "dup"]).snap({ [p]: "done" }, "Not EMPTY, not DELETED, and it holds " + fmtk(k) + " itself: the key is already present, so put does nothing."); return; }
      c.at(["empty^", "tomb^", "dup^"]).snap({ [p]: "cmp" }, "Not EMPTY, not DELETED, and " + fmtk(T.slots[p]) + " ≠ " + fmtk(k) + ": a <b>collision</b>. Try the next probe.");
    }
    c.at("loop").snap({}, "i has reached m = " + T.m + ": every probe is used up.");
    c.at("full").snap({}, "Probed all " + T.m + " slots without finding room. " + (T.mode === "quad" ? "Quadratic probing only guarantees a free slot while α &lt; 0.5 and m is prime. This is that failure." : "The table is full."));
  }
  function openSearch(c, k) {
    c.code(listing("get"));
    c.snap({}, "<b>get(" + fmtk(k) + ")</b>: " + introHash(k) + ". Follow the <em>same probe sequence</em> that put would have used.");
    for (let i = 0; i < T.m; i++) {
      const p = probeAt(k, i);
      c.probes++;
      c.at("loop").snap({}, "i = " + i + ".");
      if (i === 0 && typeof k === "string") { c.at("probe").snap({}, "The probe needs hash(k). Compute it once: Java caches a String's hash code, so later probes reuse it."); traceHash(c, k, listing("get")); }
      c.at("probe").snap({ [p]: T.slots[p] == null ? "active" : "cmp" }, probeFormula(k, i) + " → slot " + p + ".");
      if (T.slots[p] === null) { c.at("empty").snap({ [p]: "swap" }, "An <b>EMPTY</b> slot ends the search: if the key existed, put would have placed it here. <b>Not found</b> after " + c.probes + " probes."); return; }
      if (T.slots[p] === TOMB) { c.at(["empty^", "tomb"]).snap({ [p]: "visit" }, "A tombstone means “something was deleted here, keep going”. It must <b>not</b> stop the search, or we would lose keys placed after it."); continue; }
      if (String(T.slots[p]) === String(k)) { c.at(["empty^", "tomb^", "found"]).snap({ [p]: "done" }, "<b>Found " + fmtk(k) + "</b> at slot " + p + " after " + c.probes + " probe(s)."); return; }
      c.at(["empty^", "tomb^", "found^"]).snap({ [p]: "cmp" }, fmtk(T.slots[p]) + " ≠ " + fmtk(k) + ", keep probing.");
    }
    c.at("loop").snap({}, "i has reached m = " + T.m + ": every slot has been probed.");
    c.at("miss").snap({}, "Wrapped all the way round without meeting an EMPTY slot: <b>not found</b>.");
  }
  function openDelete(c, k) {
    c.code(listing("remove"));
    c.snap({}, "<b>remove(" + fmtk(k) + ")</b>: find it first, along the probe sequence.");
    for (let i = 0; i < T.m; i++) {
      const p = probeAt(k, i);
      c.probes++;
      c.at("loop").snap({}, "i = " + i + ".");
      if (i === 0 && typeof k === "string") { c.at("probe").snap({}, "The probe needs hash(k). Compute it once: Java caches a String's hash code, so later probes reuse it."); traceHash(c, k, listing("remove")); }
      c.at("probe").snap({ [p]: "cmp" }, probeFormula(k, i) + " → slot " + p + ".");
      if (T.slots[p] === null) { c.at("empty").snap({ [p]: "swap" }, "EMPTY slot: <b>" + fmtk(k) + "</b> is not in the table."); return; }
      if (T.slots[p] !== TOMB && String(T.slots[p]) === String(k)) {
        T.slots[p] = TOMB;
        T.n--;
        c.at(["empty^", "found"]).snap({ [p]: "visit" }, "Found it. We cannot just make the slot EMPTY: that would cut the probe chain of any key that collided here and was placed further along. Instead mark it <b>DELETED</b> (☠), a tombstone. Searches pass through it, and put may reuse it.");
        return;
      }
      c.at(["empty^", "found^"]).snap({ [p]: "cmp" }, T.slots[p] === TOMB ? "A tombstone: not EMPTY, so keep going (it cannot be " + fmtk(k) + ")." : "Not EMPTY, and " + fmtk(T.slots[p]) + " ≠ " + fmtk(k) + ": keep probing.");
    }
    c.at("loop").snap({}, "i has reached m = " + T.m + ": every slot has been probed.");
    c.at("miss").snap({}, "<b>" + fmtk(k) + "</b> is not in the table, nothing to delete.");
  }

  /* ---------------- rehash ---------------- */
  function rehash(c, why) {
    c.code(listing("rehash"));
    const old = T.slots, oldM = T.m;
    const keys = [];
    old.forEach((s) => { if (Array.isArray(s)) s.forEach((k) => keys.push(k)); else if (s !== null && s !== TOMB) keys.push(s); });
    const nm = nextPrime(oldM * 2 + 1);
    c.at("alloc").snap({}, "<b>Rehash.</b> " + why + " Allocate a new table of size <b>" + nm + "</b> (the next prime after 2m + 1, so the modulo spreads keys well) and reinsert all " + keys.length + " keys.");
    fresh(nm);
    keys.forEach((k) => {
      c.at("loop").snap({}, "Next old key: " + fmtk(k) + ".");
      if (T.mode === "chain") { T.slots[h1(k, T.m)].unshift(k); T.n++; }
      else { for (let i = 0; i < T.m; i++) { const p = probeAt(k, i); if (T.slots[p] === null) { T.slots[p] = k; T.n++; break; } } }
      c.at("put").snap({ [h1(k, T.m)]: "done" }, "put(" + fmtk(k) + "): h(k) mod " + T.m + " = " + h1(k, T.m) + ". Every hash changes when m changes, so every key has to move. That is why rehashing costs O(n + m) time.");
    });
    c.at("loop").snap({}, "Rehash complete. α is back down to " + alpha().toFixed(2) + ". Because the table roughly doubles, rehashes are rare: most puts never trigger one, though the one that does costs O(n + m).");
  }

  /* ---------------- op driver ---------------- */
  function doOp(kind, k) {
    if (k === null) return;
    const c = Ctx(1400);
    if (kind === "insert") {
      if (T.mode === "chain") chainInsert(c, k); else openInsert(c, k);
      if (T.auto && alpha() > threshold()) rehash(c, "Load factor α = " + alpha().toFixed(2) + " has passed the " + threshold() + " limit" + (T.mode === "chain" ? " (chains are getting long)" : T.mode === "quad" ? " (past ½, quadratic probing could miss free slots)" : " (probe sequences are getting long)") + ".");
    } else if (kind === "search") {
      if (T.mode === "chain") chainSearch(c, k); else openSearch(c, k);
    } else if (kind === "delete") {
      if (T.mode === "chain") chainDelete(c, k); else openDelete(c, k);
    } else if (kind === "rehash") {
      /* each rehash roughly doubles m; past ~50 slots the table no longer fits on screen */
      if (T.m > 50) { D.toast("The table already has m = " + T.m + " slots. Another rehash would make it about " + (2 * T.m + 1) + ", too big to draw here.", true); return; }
      rehash(c, "Manual rehash requested.");
    }
    T.probesTotal += c.probes;
    T.opsTotal++;
    player.load(c.frames, true);
  }

  const fmtk = (k) => (typeof k === "number" ? k : '"' + k + '"');
  const WORDS = ["cat", "dog", "owl", "emu", "bee", "fox", "yak", "elk", "ram", "eel", "bat", "rat", "ape", "gnu", "pig", "hen", "cow", "ant", "bird", "fish", "frog", "duck", "lion", "wolf", "bear", "deer", "goat", "crab", "moth", "seal"];
  function parseKey(s) {
    s = String(s == null ? "" : s).trim();
    if (T.keyType === "str") {
      if (!s.length) return WORDS[D.randInt(0, WORDS.length - 1)];
      if (s.length > 16) { D.toast("Keep string keys to 16 characters so the hash steps stay readable.", true); return null; }
      return s;
    }
    if (!s.length) return D.randInt(1, 99);
    s = s.replace(/[−–]/g, "-");
    if (/^[-+]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[-+]?(\d+\.\d*|\.\d+)$/.test(s)) { D.toast("The keys are ints in this code (int k), so " + s + " can't be one. Negative keys like -17 are fine; switch “keys” to Strings for text.", true); return null; }
    D.toast("This table holds integer keys. Switch “keys” to Strings to use words like \"" + s.slice(0, 12) + "\".", true);
    return null;
  }

  /* ---------------- rendering ---------------- */
  function render(f) {
    const view = q("table-view");
    view.innerHTML = "";
    if (!f.slots) return;
    if (f.hc) {
      /* hash(s) in progress: each character with its code, the current one highlighted, and the running h */
      const box = D.el("div", { style: "display:flex;align-items:flex-end;gap:1.2rem;flex-wrap:wrap;margin-bottom:.9rem" });
      const chars = f.hc.s.split("");
      box.appendChild(D.cells(chars, {
        label: "hash(\"" + f.hc.s + "\"): characters and their codes",
        marks: chars.reduce((m, ch, i) => { m[i] = i < f.hc.i ? "visit" : i === f.hc.i ? "active" : ""; return m; }, {}),
        ptrs: chars.reduce((m, ch, i) => { m[i] = String(ch.charCodeAt(0)); return m; }, {}),
        index: false, w: 34, h: 34, roomBelow: true,
      }));
      box.appendChild(D.el("div", { class: "mono", style: "font-size:1.05rem;padding-bottom:1.4rem", html: "h = <b style='color:var(--c-" + (f.hc.done ? "done" : "active") + ")'>" + f.hc.h + "</b>" }));
      view.appendChild(box);
    }

    if (f.mode === "chain") {
      const wrap = D.el("div", { style: "display:flex;flex-direction:column;gap:5px" });
      f.slots.forEach((chain, i) => {
        const row = D.el("div", { style: "display:flex;align-items:center;gap:6px" });
        row.appendChild(D.el("div", {
          class: "cell " + (f.marks[i] || "") + (chain.length ? " filled" : " empty"),
          text: i, style: "min-width:34px;height:32px;font-size:.76rem",
        }));
        row.appendChild(D.el("span", { class: "muted mono", text: chain.length ? "→" : "→ ∅", style: "font-size:.8rem" }));
        chain.forEach((k, j) => {
          const mk = f.chainMark && f.chainMark.b === i && f.chainMark.j === j ? f.chainMark.cls : "";
          row.appendChild(D.el("div", { class: "cell filled " + mk, text: fmtk(k), style: "min-width:44px;height:32px;font-size:.76rem" }));
          if (j < chain.length - 1) row.appendChild(D.el("span", { class: "muted mono", text: "→", style: "font-size:.8rem" }));
        });
        wrap.appendChild(row);
      });
      view.appendChild(wrap);
    } else {
      const row = D.el("div", { class: "cells" });
      f.slots.forEach((s, i) => {
        const empty = s === null;
        const tomb = s === TOMB;
        const c = D.el("div", {
          class: "cell " + (f.marks[i] || "") + (empty ? " empty" : " filled") + (tomb ? " visit" : ""),
          text: empty ? "·" : tomb ? TOMB : fmtk(s),
          style: "min-width:48px;height:42px;font-size:.78rem",
        });
        c.appendChild(D.el("span", { class: "idx", text: i }));
        row.appendChild(c);
      });
      const holder = D.el("div", { style: "padding:1.25rem 0 .4rem" });
      holder.appendChild(row);
      view.appendChild(holder);
    }

  }

  function still(note) { const c = Ctx(); c.snap({}, note); player.load(c.frames, false); }

  /* ---------------- init ---------------- */
  const MODES = {
    chain: {
      label: "Separate chaining",
      blurb: "Each slot holds a <b>list</b> of every key that hashes there, so collisions never fight over a slot and α " +
        "can safely exceed 1. Cost is 1 + α/2 comparisons for a successful search. The price is a pointer per node and " +
        "worse cache behaviour than open addressing.",
      formula: "index = h(k) mod m, then walk that bucket's list",
    },
    linear: {
      label: "Linear probing",
      blurb: "On a collision try the very next slot, wrapping around. Cache-friendly and simple, but it suffers from " +
        "<b>primary clustering</b>: occupied runs merge into longer runs, and once α approaches 1 the expected probe " +
        "count explodes as ½(1 + 1/(1−α)²).",
      formula: "index = (h(k) + i) mod m   for i = 0, 1, 2, …",
    },
    quad: {
      label: "Quadratic probing",
      blurb: "Jump i² slots away instead of i, which breaks up the long runs that linear probing creates. It trades " +
        "primary clustering for <b>secondary clustering</b> (keys with the same h(k) still follow the same path) and it " +
        "is only guaranteed to find a free slot when m is prime and α &lt; ½.",
      formula: "index = (h(k) + i²) mod m   for i = 0, 1, 2, …",
    },
  };

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "chain": {
    "label": "Separate chaining",
    "items": [
     [
      706,
      "Design HashMap",
      "design-hashmap",
      "Easy",
      "Build it with an array of buckets: this tab."
     ],
     [
      705,
      "Design HashSet",
      "design-hashset",
      "Easy",
      "The same, keys only."
     ],
     [
      1,
      "Two Sum",
      "two-sum",
      "Easy",
      "The most famous use of a hash map."
     ],
     [
      242,
      "Valid Anagram",
      "valid-anagram",
      "Easy",
      "String keys: count characters."
     ],
     [
      49,
      "Group Anagrams",
      "group-anagrams",
      "Medium",
      "String keys: the sorted word as the key."
     ]
    ]
   },
   "linear": {
    "label": "Linear probing",
    "items": [
     [
      706,
      "Design HashMap",
      "design-hashmap",
      "Easy",
      "Build it with open addressing and tombstones."
     ],
     [
      217,
      "Contains Duplicate",
      "contains-duplicate",
      "Easy",
      "Membership tests in O(1) expected."
     ],
     [
      387,
      "First Unique Character in a String",
      "first-unique-character-in-a-string",
      "Easy",
      "Counting with a map."
     ],
     [
      128,
      "Longest Consecutive Sequence",
      "longest-consecutive-sequence",
      "Medium",
      "O(n) only because lookups are O(1)."
     ]
    ]
   },
   "quad": {
    "label": "Quadratic probing",
    "items": [
     [
      705,
      "Design HashSet",
      "design-hashset",
      "Easy",
      "Try quadratic probing with a prime table size."
     ],
     [
      205,
      "Isomorphic Strings",
      "isomorphic-strings",
      "Easy",
      "Two maps over string characters."
     ],
     [
      290,
      "Word Pattern",
      "word-pattern",
      "Easy",
      "String keys mapped both ways."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    dock = D.CodeDock("#code", CODE, { recv: "table" });
    player = new D.Player({ mount: "#player", render: render, code: dock });

    D.Tabs("#tabs", Object.keys(MODES).map((id) => ({ id: id, label: MODES[id].label })), (id) => {
      const keys = [];
      T.slots.forEach((s) => { if (Array.isArray(s)) s.forEach((k) => keys.push(k)); else if (s !== null && s !== TOMB) keys.push(s); });
      T.mode = id;
      fresh(T.m);
      keys.forEach((k) => {
        if (id === "chain") { T.slots[h1(k, T.m)].unshift(k); T.n++; }
        else { for (let i = 0; i < T.m; i++) { const p = probeAt(k, i); if (T.slots[p] === null) { T.slots[p] = k; T.n++; break; } } }
      });
      q("mode-blurb").innerHTML = MODES[id].blurb;
      q("mode-formula").textContent = MODES[id].formula;
      shareClass();
      dock.show(listing("put"));
      D.practiceShow(id);
      still("Switched to <b>" + MODES[id].label + "</b> and reinserted the " + keys.length + " existing key(s).");
    });

    D.Segmented("#keytype", [
      { id: "int", label: "Integers", desc: "int keys: h(k) = k" },
      { id: "str", label: "Strings", desc: "String keys: a polynomial hash turns the text into an int first" },
    ], (t) => {
      T.keyType = t;
      fresh(T.m); T.probesTotal = 0; T.opsTotal = 0;
      q("key").placeholder = t === "str" ? "cat" : "42";
      q("key").value = "";
      shareClass();
      dock.show(listing("put"));
      still(t === "str"
        ? "<b>String keys.</b> A string must become a number before it can pick a slot: every operation now calls <b>hash(s)</b> first, and keys are compared with equals(). The table was cleared, because it holds one kind of key."
        : "<b>Integer keys.</b> h(k) = k, so the slot is simply k mod m. The table was cleared.");
    }, "int");
    q("op-insert").addEventListener("click", () => doOp("insert", parseKey(q("key").value)));
    q("op-search").addEventListener("click", () => doOp("search", parseKey(q("key").value)));
    q("op-delete").addEventListener("click", () => doOp("delete", parseKey(q("key").value)));
    q("op-rehash").addEventListener("click", () => doOp("rehash"));
    q("auto").addEventListener("change", (e) => { T.auto = e.target.checked; });
    q("msize").addEventListener("change", (e) => {
      const m = D.clamp(D.readInt(e.target) || 11, 3, 31);
      e.target.value = m;
      fresh(m);
      T.probesTotal = 0; T.opsTotal = 0;
      still("New empty table with m = " + m + ". " + (isPrime(m) ? "m is prime: good." : "<b>m = " + m + " is not prime</b>; composite table sizes cluster badly, and quadratic probing can fail to find free slots."));
    });
    q("op-fill").addEventListener("click", () => {
      const c = Ctx(2000);
      const count = Math.max(3, Math.round(T.m * 0.55));
      const vals = T.keyType === "str" ? D.shuffled(WORDS).slice(0, count) : D.shuffled(D.randArray(count, 1, 99));
      fresh(T.m);
      c.snap({}, "Filling an empty table with " + vals.length + " random keys to α ≈ " + (vals.length / T.m).toFixed(2) + ".");
      vals.forEach((k) => { if (T.mode === "chain") chainInsert(c, k); else openInsert(c, k); });
      c.at(null).snap({}, "Done. Notice how the collisions " + (T.mode === "chain" ? "lengthen individual chains" : "push keys away from their home slot") + ".");
      player.load(c.frames, true);
    });
    q("op-clear").addEventListener("click", () => { fresh(T.m); T.probesTotal = 0; T.opsTotal = 0; still("Cleared."); });
    D.legend("#legend", [
      { color: "var(--c-active)", label: "home slot / free slot found" },
      { color: "var(--c-cmp)", label: "occupied: collision, keep probing" },
      { color: "var(--c-visit)", label: "tombstone (deleted)" },
      { color: "var(--c-done)", label: "stored / found" },
      { color: "var(--c-swap)", label: "not found" },
    ]);

    fresh(11);
    [23, 45, 12, 34, 56].forEach((k) => { T.slots[h1(k, 11)].unshift(k); T.n++; });
    still("A chaining table with m = 11 and 5 keys. Try inserting keys that collide, e.g. 12 and 23 both land in bucket 1.");
  });
})();
