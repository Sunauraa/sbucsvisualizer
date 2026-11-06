# Ask AI tutor (archived)

The optional "Ask AI" box under **Why?** was switched off on 2026-11-06 and its Vercel Function moved here, out of
the deployment (`.vercelignore` lists `archive`). It is kept so it can come back if the project gets funding for a
paid AI provider.

What still runs without it: the **Why?** panel and every saved explanation (`assets/js/tutor.js`,
`assets/js/why-data.js`). The page asks `GET api/tutor` whether the tutor is on, gets a 404, and shows no question box.

## Bringing it back

1. `git mv archive/ai-tutor/api api`
2. Put the function's settings back in `vercel.json`, at the top level:
   ```json
   "functions": { "api/tutor.js": { "maxDuration": 10 } }
   ```
   (Vercel refuses to deploy if `functions` names a file that does not exist, which is why it was removed.)
3. In Vercel, under **Settings → Environment Variables**, set `AI_API_KEY` (and optionally `AI_BASE_URL`,
   `AI_MODEL`: any OpenAI-compatible provider), then redeploy.
4. `cd tests && npm test -- tutor`. The full tutor suite runs again by itself once `api/tutor.js` exists.

## Fix before relying on it

- **The rate limit is per instance.** `hits` is a `Map` in one function instance's memory. Vercel runs several
  instances and recycles them, so "8 questions a minute" does not hold across them, and `hits.clear()` at 5,000
  entries resets everyone at once. Move the counter to a shared store (Upstash Redis, Vercel KV) or a Vercel
  Firewall rate-limit rule.
- **Requests without an `Origin` header pass `sameSite()`.** A script outside a browser can spend the quota. The
  shared limit is the real fix.
- **Cache answers.** Many students ask the same question on the same step: key on
  `hash(page, step, normalised question)` and answer repeats from the cache.
- **Backup provider and streaming.** On a 429 or 5xx, try a second provider before giving up, and stream the answer
  so it appears while it is being written.
