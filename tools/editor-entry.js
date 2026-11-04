/* The code editor for the playground: CodeMirror 6, built once into assets/vendor/editor.js
   so the site itself still has no build step. Rebuild with: cd tools && npm i && npm run build:editor */
import { EditorState, StateEffect, StateField, Prec } from "@codemirror/state";
import { EditorView, Decoration, keymap, lineNumbers, drawSelection, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { java } from "@codemirror/lang-java";
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/* the same colours as the listings in the code dock */
const colours = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.typeName, t.bool, t.null, t.self], color: "#1d4ed8" },
  { tag: [t.string, t.character], color: "#047857" },
  { tag: t.number, color: "#b45309" },
  { tag: [t.lineComment, t.blockComment], color: "#6b7280", fontStyle: "italic" },
]);

const setMark = StateEffect.define();
const marks = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) if (e.is(setMark)) value = e.value;
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* Keep a line in sight by scrolling the editor's own box. EditorView.scrollIntoView won't do:
   it also scrolls the page to reach the line, which moved the reader's screen on every step. */
const FOLLOW_MARGIN = 24;
const followKey = {};
function follow(view, pos) {
  view.requestMeasure({
    key: followKey,
    read(v) {
      const block = v.lineBlockAt(pos), box = v.scrollDOM, pad = v.documentPadding.top;
      return { top: block.top + pad, bottom: block.bottom + pad, scroll: box.scrollTop, height: box.clientHeight };
    },
    write(m, v) {
      if (m.top - FOLLOW_MARGIN < m.scroll) v.scrollDOM.scrollTop = Math.max(0, m.top - FOLLOW_MARGIN);
      else if (m.bottom + FOLLOW_MARGIN > m.scroll + m.height) v.scrollDOM.scrollTop = m.bottom + FOLLOW_MARGIN - m.height;
    },
  });
}

window.DSAEditor = {
  create(parent, doc, onChange, onRun) {
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          lineNumbers(), highlightActiveLineGutter(), history(), drawSelection(), indentOnInput(), bracketMatching(),
          java(), syntaxHighlighting(colours), marks, EditorState.tabSize.of(2),
          Prec.high(keymap.of([{ key: "Mod-Enter", run: () => { onRun && onRun(); return true; } }])),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ "aria-label": "Java code" }),
          EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); }),
        ],
      }),
    });
    return {
      get value() { return view.state.doc.toString(); },
      set value(s) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s } }); },
      /** Highlight one line (1-based), or none. kind: "run" or "err". */
      mark(line, kind) {
        const doc = view.state.doc;
        const valid = line >= 1 && line <= doc.lines;
        let deco = Decoration.none;
        if (valid) deco = Decoration.set([Decoration.line({ class: "cm-" + (kind || "run") + "-line" }).range(doc.line(line).from)]);
        view.dispatch({ effects: setMark.of(deco) });
        if (valid) follow(view, doc.line(line).from);
      },
    };
  },
};
