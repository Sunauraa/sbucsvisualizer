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
        let deco = Decoration.none, effects = [];
        if (line >= 1 && line <= doc.lines) {
          const l = doc.line(line);
          deco = Decoration.set([Decoration.line({ class: "cm-" + (kind || "run") + "-line" }).range(l.from)]);
          effects.push(EditorView.scrollIntoView(l.from, { y: "nearest" }));
        }
        view.dispatch({ effects: [setMark.of(deco), ...effects] });
      },
    };
  },
};
