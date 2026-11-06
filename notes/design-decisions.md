# System design decisions, and why

Each decision below is tied to who uses the site and what it is for. If you can't say which audience need a choice
serves, it shouldn't be there. Each entry is written so it can be defended in an interview: what was chosen, why,
what else was considered, what it costs, and what would prove it wrong.

## Who it's for, and what it must do

| | |
|---|---|
| **Users** | Undergraduates in CSE 214 learning data structures in Java. Mostly on laptops and phones, often on crowded campus wifi or mobile data, and in heavy bursts the week before an exam. Some use shared lab computers. |
| **Maintainer** | One student, part time. No ops team, no budget, no on-call. |
| **Goals** (from the README) | 1. Costs nothing to run. 2. No build step: runs from Vercel, GitHub Pages, or a folder. 3. Information first and accessible. 4. Works when the network doesn't. 5. Private: works without an account; if a student signs in, only their progress is stored, and only they can read it. |

These numbers come up repeatedly below (measured 2026-11-06): pages plus their scripts are **787 KB raw / 219 KB
gzipped**. The heavy tools (editor, Java runner, starter programs, Why? notes, growth worker) are **571 KB / 173 KB**.

---

## 1. A static site on a CDN, with no backend

- **Choice:** plain HTML, CSS and JS files served by Vercel's CDN. Every algorithm runs in the student's browser.
- **Why:** goals 1, 2 and 5, and the exam-week traffic pattern. A CDN serves a static file to 10 or 10,000 students
  at the same cost (zero on the free tier), with nothing to scale, patch or wake up for.
- **Considered:** a server-rendered app, or an API that runs the algorithms. Both add a server to pay for and keep
  alive. Recording frames in the browser is also *better* for learning: stepping backwards and scrubbing are free
  because the whole run is already recorded.
- **Cost:** anything that needs shared state (accounts, sync, class-wide statistics) needs a backend added later.
- **Wrong if:** students need their work on several devices. They do: decision 7 adds sync without giving up
  the rest.

## 2. Versioned asset URLs, cached for two weeks

- **Choice:** every asset is loaded as `file.js?v=<hash>`, and `/assets/*` is sent with
  `Cache-Control: public, max-age=1209600, immutable`. Pages and `sw.js` are checked with the server on every visit.
- **Why:** repeat visits (the normal case: students come back every week) download nothing. Pages are always
  checked, so a fix reaches every student on their next page load.
- **Why two weeks and not a year:** the version is the safety net, but if it is ever wrong, the damage for browsers
  without the offline copy is capped at two weeks, about one assignment cycle. What two weeks costs instead of a
  year is one 219 KB re-download every two weeks, which is nothing.
- **Considered:** no cache header (Vercel's default: every file re-checked on every load, about 7 round trips that
  return "not modified"). That's slow on bad wifi for no benefit.
- **Wrong if:** an asset is ever loaded without the version. The `prod` test watches every request a page makes,
  workers included, to catch exactly that.

## 3. The version is a content hash, stamped by hand and checked by the tests

- **Choice:** `node tools/stamp.mjs` hashes `assets/` and `sw.js` and writes the hash into every page.
  `npm test` fails while it's stale.
- **Why:** goal 2 rules out a bundler. A hash beats the old hand-typed date because it only changes when files do,
  so students keep their cache across deploys that only touch HTML.
- **Considered:** a Vercel build command that stamps the git SHA. It's automatic, but it adds a build step, and the
  folder and GitHub Pages copies wouldn't get it.
- **Cost / open risk:** Vercel deploys on push even if CI fails, so a forgotten stamp can still reach students. The
  cheapest fix that fits a solo maintainer is a pre-commit hook (`.githooks/pre-commit` running
  `node tools/stamp.mjs --check`, turned on once with `git config core.hooksPath .githooks`). **Not done yet.**

## 4. An offline copy (service worker)

- **Choice:** `sw.js` saves every page and the scripts they load on the first visit, and the heavy tools the first
  time each is used. Pages: network first, falling back to the saved copy after 3.5 s. Versioned assets: saved copy
  first. `/api/`: never touched.
- **Why:** goal 4 and this audience's networks. Lecture-hall wifi is often slow rather than down, and plain network
  first would hang on it, hence the 3.5 s timeout. Studying on a train or in a basement library should still work.
- **Why precache all eight modules but not the tools:** 219 KB gzipped once, after the page has loaded, so it never
  slows the first view, and it means the night-before-the-exam page works offline even if it was never opened. The
  tools are 173 KB more that many students never open, so they wait. On mobile data, you pay for what you use.
- **Considered:** caching only pages already visited (less download, but offline breaks for the module you need);
  precaching everything (simpler, but makes every visitor pay for the editor).
- **Cost:** service-worker bugs persist in students' browsers. Mitigations: `sw.js` is never cached, so a fixed
  version replaces a broken one on the next visit; each version has its own cache and old ones are deleted; it is
  off on `localhost` so development isn't confusing. The `offline` test really shuts the server down to prove it
  works.

## 5. Every box except the visualizer starts hidden

- **Choice:** the growth chart, Study notes and each box inside them start collapsed to their headings. A student
  opens what they want, and the site remembers it per page.
- **Why:** a newcomer should see the thing that makes this site different, the animation, before anything else.
  It's the same idea as the code dock starting collapsed. The visible headings work as a table of contents.
- **Accessibility and goal 3:** each heading stays visible with a real `<button>` (`aria-expanded`,
  `aria-label="Show Cheat sheet"`). Without JavaScript nothing collapses, and printing shows every box.
- **Bonus:** the growth chart runs a 10,000-element benchmark. It now starts only when its box is opened, which
  saves battery on phones for the many students who never look at it.
- **Cost:** less discoverable. A student who never opens Study notes never sees the LeetCode list, and the list
  inside it takes two clicks. **How to tell:** if feedback says "I didn't know there were practice problems", open
  Study notes by default and keep only the inner boxes closed.

## 6. LeetCode practice: free problems only, checked against LeetCode

- **Choice:** 221 problems (182 distinct) across 41 tabs, each chosen for what that tab animates. All free.
  `node tools/check-leetcode.mjs` re-checks every number, title, difficulty and free status against LeetCode's API.
- **Why:** many students don't have Premium, and a link that hits a paywall is a dead end. Problems are matched to
  the *tab*, not just the module. For example, "Complete Binary Tree Inserter" goes under the tree-based heap,
  because inserting at the next free spot is exactly what that animation shows.
- **Cost:** LeetCode can rename problems or make them Premium. The checker needs the network, so it isn't in
  `npm test`. Run it each term.

## 7. Accounts and sync: optional login, progress on every computer

- **What students get:** a **progress map** (per module: tabs opened, operations run, quiz answers, LeetCode solved,
  notes), a **LeetCode status** on every practice problem (To do / Solved / Revisit), and **notes pinned to a step**.
  Signing in is optional, but these features exist only for signed-in students. Signed out, the site is exactly as
  before. Everything syncs, so a student who starts on a laptop and continues on a library computer sees the same
  progress.
- **Notes pinned to a step:** a note keeps the recorded steps around the moment it was written (up to about 24 KB),
  so opening it on any computer shows that exact frame and lets the student step around it. Only small details (tab,
  title, step) sync to every computer; the steps themselves load when a note is opened. That keeps every computer's
  copy small.
- **Architecture:** the site stays static. The browser talks directly to a hosted backend (Postgres + login, for
  example Supabase) over plain `fetch`, so there's no server of our own, no SDK and no build step. Each student can
  only read and write their own rows, enforced in the database with row-level security. The browser's key is public
  by design, and the database rules are what protect the data.
- **Local first:** every change is saved on the device at once and sent to the server in the background. So
  ticking "Solved" is instant, works offline (decision 4), and syncs when the network returns. Conflicts are rare
  (one student, one record at a time): the latest change to a record wins.
- **Data kept to a minimum:** an account id, an email, progress records and problem statuses. Nothing else. A
  "Delete my account" button removes it all.
- **School computers:** "Keep me signed in on this computer" is ticked by default (the usual case is a student's own
  laptop). Unticked, the session lives only until the browser closes. Signing out removes the session and the local
  copy.
- **Built without an SDK:** Google sign-in uses OAuth with PKCE, and the database is plain REST, both through
  `fetch`. That keeps goal 2 (no build step) and adds about 25 KB of our own code instead of a vendored library.
- **How it's tested:** `tests/fake-supabase.mjs` stands in for Supabase (sign-in with a real PKCE check, "own rows
  only", "newest wins") so the browser flow is tested on every push. The SQL itself is checked only for syntax
  (Postgres's parser via pglast). Its rules are proven on the real project during setup (`supabase/SETUP.md`).
- **Cost:** stays free on Supabase's free tier (50,000 monthly active users, 500 MB database). The catch is that free
  projects are **paused after a week without database activity**, and restoring one by hand is manual. The
  requirement is **no manual upkeep**, so:
  - **Keep-alive on Vercel Cron, not GitHub Actions.** GitHub switches off scheduled workflows in a public repo after
    60 days without a commit, so a summer break would silently stop the job and need a manual re-enable. Vercel Cron
    is free on Hobby (once a day, timing within the hour) and has no such rule. Supabase's docs list "making API
    calls to your project" as activity, so a daily job running a few real queries counts.
  - **Self-healing:** if the project is paused anyway, the same daily job calls Supabase's Management API
    (`POST /v1/projects/{ref}/restore`) with a narrowly scoped token kept in Vercel's environment variables. The worst
    case becomes about a day of no sync (pages still work, and progress saved on the device catches up), not a
    manual fix. Test this once at setup by pausing the project on purpose.
  - **Sign-in emails need their own sender.** Supabase's built-in email only sends to the project's own team, 2 per
    hour, and is "not meant for production", so email-link sign-in needs a free email provider (one more account,
    set up once). Google sign-in needs no email at all. (Firebase was ruled out partly here: its free plan allows 5
    sign-in-link emails a day.)
  - **What can't be promised:** a free tier's rules can change (Vercel already says Cron Jobs will move to
    "Schedules"). The only setup that can never pause is Supabase's paid plan.
- **Considered:** our own API server (something to host, pay for and secure: against goals 1 and 2); device-only
  storage (no sync, which is the whole point); a Google Sheet (no per-student security).
- **Decided:** Supabase; Google sign-in only (Supabase's built-in email can't send sign-in links to students, and a
  separate email service would be one more thing to keep working); features only for signed-in students.

## 8. The AI tutor: archived

- **Choice:** the Ask AI function moved to `archive/ai-tutor/`, out of the deployment. Why? still works fully from
  saved explanations.
- **Why:** a shared free API key fails under exactly this audience's traffic pattern (everyone asks the night
  before the exam), and its per-instance rate limit didn't really limit anything (see the serverless note). Sending
  student questions to a third party also weakens goal 5. It comes back if there's funding, and the archive README
  lists what to fix first.

---

## Open risks, in order

1. **A forgotten version stamp can still deploy** (decision 3). Fix: the pre-commit hook. About 10 minutes.
2. **Hidden-by-default may hide the practice lists too well** (decision 5). Watch feedback.
3. **LeetCode data drifts over time** (decision 6). Run the checker each term.
4. **Accounts add the site's first personal data** (decision 7). Keep it minimal, and ship "Delete my account"
   with the first version.
