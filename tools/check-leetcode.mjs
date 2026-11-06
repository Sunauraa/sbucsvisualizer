/* ============================================================
   check-leetcode.mjs: checks every "Practice on LeetCode" problem against LeetCode.

     node tools/check-leetcode.mjs

   For each problem in each module's PRACTICE list it asks LeetCode's public API for the
   problem at that slug and checks the number, the title, the difficulty, and that it is
   free (not Premium). Exit 1 on any mismatch. Needs the network, so it is not part of
   npm test; run it after adding problems. No dependencies.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = ["arrays", "recursion", "stacks", "trees", "pq", "hashtables", "graphs", "sorting"];

/** the PRACTICE object literal in a module file (plain JSON-style data, so it is read, not run) */
export function practiceOf(mod) {
  const src = fs.readFileSync(path.join(ROOT, "assets/js", mod + ".js"), "utf8");
  const at = src.indexOf("const PRACTICE = ");
  if (at < 0) return {};
  let i = src.indexOf("{", at), depth = 0, k = i;
  for (; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) break; }
  return JSON.parse(src.slice(i, k + 1));
}

async function lookup(slug) {
  const r = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://leetcode.com" },
    body: JSON.stringify({ query: "query q($s:String!){question(titleSlug:$s){questionFrontendId title difficulty isPaidOnly}}", variables: { s: slug } }),
  });
  return (await r.json()).data?.question || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seen = new Map(), problems = [];
  for (const mod of MODULES) for (const [part, v] of Object.entries(practiceOf(mod))) {
    for (const [num, title, slug, diff] of v.items) problems.push({ where: mod + "/" + part, num, title, slug, diff });
  }
  const bad = [];
  for (const p of problems) {
    if (!seen.has(p.slug)) { seen.set(p.slug, await lookup(p.slug)); await new Promise((r) => setTimeout(r, 200)); }
    const q = seen.get(p.slug);
    const got = q && [+q.questionFrontendId, q.title, q.difficulty];
    if (!q) bad.push(p.where + ": " + p.slug + " was not found");
    else if (q.isPaidOnly) bad.push(p.where + ": " + p.slug + " is Premium");
    else if (got[0] !== p.num || got[1] !== p.title || got[2] !== p.diff) bad.push(p.where + ": " + p.slug + " is " + got.join(" / ") + ", listed as " + [p.num, p.title, p.diff].join(" / "));
  }
  console.log(problems.length + " problems (" + seen.size + " distinct) checked against LeetCode.");
  if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
  console.log("All found, free, and listed with the right number, title and difficulty.");
}
