# Quiz me and Why? (archived)

The **Quiz me** and **Why?** buttons under every player were removed on 2026-11-16 to keep the module pages
simpler. Their scripts were moved here, out of the deployment (`.vercelignore` lists `archive`):

- `quiz.js`: "Quiz me" stops before some steps and asks what happens next. Its answers were counted in the
  progress map; `account.js` now drops old `quiz` counts when it syncs.
- `tutor.js`: "Why?" explains the line that just ran, from the notes in `why-data.js`.
- `why-data.js`: a hand-written explanation for every anchored code line.

The players still have the hooks these used (`DSA.playerAddons`, `player.gate`), and the playground still sets
`whyLine` on its frames.

## Bringing it back

1. `git mv archive/quiz-and-why/{quiz,tutor,why-data}.js assets/js/`
2. Add `<script src="../assets/js/tutor.js"></script>` and `<script src="../assets/js/quiz.js"></script>` after
   the module's own script on each `cse214/*.html` page, list both in `ASSETS` in `sw.js`, and run
   `node tools/stamp.mjs`.
3. Bring back the `.quiz-*`, `.why-code` and `.ask-*` styles, the "Quiz correct" column of the progress map,
   and the `quiz`, `why` and `tutor` test suites from git history (the commit that added this file).
