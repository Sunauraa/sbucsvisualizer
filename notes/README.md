# Build notes: mistakes, problems and fixes

A log of what went wrong while building this site and what was learned. Not deployed (`.vercelignore`).

Interviewers ask "tell me about a bug you're proud of fixing", "a time you were wrong", "a design decision you'd
change". Each entry here is written so it can be told in about two minutes, STAR style.

## How to add an entry

Write it the day it happens, while the details are fresh. Copy this:

```md
## <one-line title: what broke, in plain words>

- **Date:** YYYY-MM-DD
- **Area:** caching / testing / UI / Java interpreter / deploy / ...
- **Situation:** what I was building and why it mattered.
- **Problem:** what went wrong, and how I noticed (a test, a user, a screenshot, luck).
- **Root cause:** the real reason, one level deeper than the symptom.
- **Fix:** what I changed. Link the commit.
- **Guard:** what now stops it coming back (a test, a check, a rule in the README).
- **Lesson / interview angle:** the one sentence I'd say out loud.
```

Tip: commit messages like "changes" or "more" make it hard to find these stories later. A message that says what
broke and why ("Version lazy-loaded scripts so the long cache can't serve old copies") becomes the note's first
draft.

## Index

| Date | Note | Topic |
|---|---|---|
| 2026-11-06 | [Caching and offline](2026-11-06-caching-and-offline.md) | unversioned lazy loads, a version you could forget, a test that wasn't offline, an async wait that never waited |
| 2026-11-06 | [Serverless rate limiting](2026-11-06-serverless-rate-limit.md) | a rate limit stored in one instance's memory |
| 2026-11-06 | [A renamed starter broke CI](2026-11-06-renamed-starter-broke-ci.md) | a missed rename, a crash instead of a failure, an exit code that lied |
| 2026-11-06 | [Short pages made the page jump](2026-11-06-short-page-scroll-jump.md) | a caption that shrank, a forced layout that broke animations, ResizeObserver |
| — | [System design decisions, and why](design-decisions.md) | every choice tied to the audience, with alternatives, costs and open risks |
| — | [Stories to write up](to-write-up.md) | rules in the README that look like old bugs; fill in the story |
