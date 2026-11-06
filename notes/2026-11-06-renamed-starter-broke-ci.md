# A renamed starter program crashed the whole test run (2026-11-06)

- **Area:** testing / CI
- **Situation:** Commit `9817468` ("deleting unnecessary features") cut down and renamed the playground's starter
  programs. Graphs went from "BFS: shortest distances" and others to "graph: all functions", "BFS only" and
  "DFS only". The same commit updated most of the tests.
- **Problem:** One place was missed: the screenshot suite still asked for "BFS: shortest distances".
  `page.selectOption` waited 30 seconds for an option that would never exist, then threw. Because it threw
  instead of failing a check, the runner crashed before printing its summary. Since that commit, `npm test` has ended in a
  crash, and CI runs it on every push. (Not yet confirmed on GitHub: check the Actions tab for red runs since
  `9817468`. If they're there, that's part of the story.)
- **How it was found:** a full run in the background reported "exit code 0". That was the exit code of the `tail`
  the output was piped through, not of the tests. Reading the log showed a `TimeoutError` and no summary line.
- **Debugging detour:** the first guess was the Trees screenshot ("BST: iterative"), because it was the first
  playground screenshot. That starter loaded fine by hand. Running the suite on the original code (`git stash -u`)
  proved the crash was older than the day's changes, and matching the stack trace's line number to the source
  pointed at the Graphs screenshot.
- **Root cause:** a test that refers to content by its display name, with nothing tying the two together, plus a
  failure mode (timeout and throw) that stops everything after it.
- **Fix:** use the new name ("BFS only"). Before selecting, the screenshot helper now checks the starter exists, and
  a missing one fails one named check ("screenshot starter … exists") instead of crashing the run.
- **Lessons / interview angle:**
  - Make a test **fail, not crash**. One bad check should cost one line in the report, not the report.
  - **Check the exit code of the thing you ran.** `cmd | tail` reports `tail`'s exit code. Use `set -o pipefail` or
    read the summary line.
  - Read the stack trace's line number before guessing from the error message.
  - A red CI that nobody looks at is the same as no CI. Check the Actions tab after a big cleanup commit.
