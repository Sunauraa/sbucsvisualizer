# A rate limit that lived in one server's memory (2026-11-06)

- **Area:** API design / serverless
- **Situation:** The optional "Ask AI" tutor (`archive/ai-tutor/api/tutor.js`) ran on one shared free API key. To
  stop one student using up everyone's quota, it allowed 8 questions a minute per IP.
- **Problem:** Found in a design review, not in production. The counter was a `Map` in the function's memory.
  Serverless platforms run many copies of a function and throw them away when idle, so each copy kept its own
  count. The real limit was 8 × (number of warm copies), and a cold start reset it. `hits.clear()` at 5,000 entries
  also reset every visitor at once.
- **Root cause:** writing server code as if there were one long-running server. In serverless, memory is per
  instance and short-lived, so anything that must be shared (counters, sessions, caches) needs a shared store.
- **Fix (planned, in the archive README):** a shared counter in Redis or Vercel KV, or the platform's own rate
  limiting at the edge. The tutor was archived before this was built.
- **Lesson / interview angle:** "Where does this state live, and how many copies of it are there?" is the first
  question for any serverless design. It's also a good opening into distributed rate limiting (token bucket vs
  sliding window, and why a shared store is needed).
