# Stories to write up

These rules in the main README read like lessons from real bugs. Only you know what happened, so the story is yours
to fill in. When you remember one, move it into a dated note using the template in [README.md](README.md).

- [ ] **"A value never disappears between two steps."** Renderers decide which slots are live from the data, not from
  a size counter that the code updates a line later. *Did values flicker out mid-animation? On which structure?*
- [ ] **`Rec.at()` persists, so a summary frame must call `.at(null)`.** *Did a "done" frame keep highlighting the last
  line?*
- [ ] **Anchors (`@@name`) instead of line numbers for code highlighting.** "So the languages never need index maps."
  *Did pseudocode and Java highlights drift apart when a listing was edited?* A good design-decision story.
- [ ] **"A new page running next to an old cached `core.js` breaks."** *What broke for real on GitHub Pages?* This is
  the earlier version of note 2 in [the caching note](2026-11-06-caching-and-offline.md).
- [ ] **The Java playground never uses `eval`** and runs in a Web Worker with a time limit and bounded recording.
  *Did an infinite loop or a 20,000-node list freeze the tab before this?*
- [ ] **Recording every frame up front instead of animating live.** *Did you start with live animation and switch?*
  Why stepping backwards made you change it is a strong architecture answer.
- [ ] **The "jvm" test compares the playground's output with real `javac` + `java`.** *What did it catch in the
  interpreter?*
- [ ] **"Deleting unnecessary features" (commits 9817468, 1f72bd3).** *What did you cut, and why?* Saying what you
  chose not to build is a strong interview answer.
