# Caching and offline support (2026-11-06)

Adding long-lived browser caching and a service worker so the site loads instantly on repeat visits and works
without wifi. Four problems came up. The third is the best interview story.

---

## 1. Scripts loaded later had no version, so a long cache would have kept old copies

- **Area:** caching
- **Situation:** Pages load assets as `core.js?v=<version>`. The plan was to tell browsers to keep `/assets/*` for two
  weeks, which is only safe if every asset URL changes when the file changes.
- **Problem:** Before turning it on, I searched for every place an asset URL is built. Four were bare:
  `why-data.js` (`tutor.js`), the growth chart's Web Worker, the Java runner's Web Worker, and `404.html`'s
  stylesheet. Only the editor and starter programs copied the version.
- **Root cause:** The version lived only in the HTML `<script>` tags. Code that loaded files later built URLs by hand,
  and each file did it differently, or not at all.
- **Fix:** one helper, `DSA.asset(path)` in `core.js`, which reads the version from `core.js`'s own URL. Every lazy
  load uses it.
- **Guard:** the `prod` test watches every request a page makes, workers included, while it runs every feature, and
  fails if any `/assets/` request lacks the current version.
- **Lesson:** a cache rule is only as safe as its least careful caller. Put the rule in one function, then test the
  network traffic, not the code.

## 2. The version was a date typed by hand, and forgetting it would now be permanent

- **Area:** deploy / caching
- **Problem:** The README said "after every update, bump the version" with a `sed` and today's date. With a
  10-minute browser cache, forgetting meant 10 minutes of trouble. With a two-week cache plus an offline copy,
  forgetting means students run old scripts indefinitely.
- **Root cause:** a manual release step guarding something that had become much more important.
- **Fix:** `tools/stamp.mjs` makes the version a hash of everything under `assets/` plus `sw.js`. It only changes
  when those files do, so repeat visitors keep their cache across deploys that don't touch assets.
- **Guard:** `npm test` (and CI) fails if any page carries a stale version.
- **Lesson:** when you raise the stakes of a step, automate it or check it.

## 3. The offline test passed while the browser was still online

- **Area:** testing
- **Situation:** The new `offline` suite used Playwright's `context.setOffline(true)` and then checked that pages
  still loaded from the service worker's saved copy. Everything passed except one check: an address that was never
  saved should show "You are offline".
- **Problem:** That page showed the server's **404** instead. A 404 can't come from an offline server, so the
  network was still up.
- **Root cause:** `setOffline` emulates offline for the page, but the service worker's own `fetch()` calls still
  reached the network. The other "offline" checks had passed because they were online.
- **Fix:** the suite starts its own server and goes offline by shutting it down (`close()` plus
  `closeAllConnections()`). With that change, all twelve checks pass with no network.
- **Lesson:** a passing test proves nothing until you've seen it fail for the right reason. The one failing check
  showed that the passing ones weren't testing anything. Ask "how would this test know if I were wrong?"

## 4. An async wait that returned immediately

- **Area:** testing
- **Problem:** "A new version deletes the old saved copy" failed, showing both caches still there.
- **Root cause:** `page.waitForFunction(async () => …)`. An async function returns a Promise, a Promise is truthy,
  so the wait ended on the first poll before the new worker had activated.
- **Fix:** an explicit polling loop that awaits the value.
- **Lesson:** know what your wait primitive treats as "done". The same bug shows up as `if (asyncCheck())`
  anywhere.

## Design trade-offs worth explaining

- **Pages network-first, assets cache-first.** Pages have no version in their URL, so they must check the server or
  a deploy would never show. Versioned assets can't change at their address, so asking the network is waste.
- **3.5 s page timeout.** Slow lecture-hall wifi is worse than none, because a plain network-first strategy waits
  forever. After 3.5 s the saved copy is shown and the fresh one still updates the cache in the background.
- **Heavy tools aren't precached.** The editor, Java runner and starter programs (~600 KB) are saved the first time
  they're opened, so a student on mobile data doesn't pay for features they never use.
- **Off on localhost.** With content-hashed versions, a long cache and cache-first assets, edits during development
  would be invisible. The dev server drops the cache header and the service worker skips `localhost`. Tests use
  `127.0.0.1`, so they still exercise it.
