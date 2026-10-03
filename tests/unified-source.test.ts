import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import { history, undo, redo } from "@codemirror/commands";
import { markdownSource, sourceHistory, getMarkdownSource, replaceMarkdownSource } from "../src/modules/content/client/markdownSource";

function editor(source: string) {
  let state = EditorState.create({ doc: source.replace(/\r\n?|\n/g, "\n"), extensions: [markdownSource(source), history(), sourceHistory] });
  return { get state() { return state; }, dispatch: (transaction: ReturnType<EditorState["update"]>) => { state = transaction.state; } };
}

test("editing and undo preserve untouched mixed line endings and frontmatter", () => {
  const original = "---\r\ncolor: sage\nextra: keep\r\n---\r\n\n#   เดิม\r\n\r\n```ts\nconst  x = 1;\r\n```\n";
  const view = editor(original);
  assert.equal(getMarkdownSource(view.state), original);
  const from = view.state.doc.toString().indexOf("เดิม");
  view.dispatch(view.state.update({ changes: { from, to: from + 4, insert: "ใหม่" } }));
  assert.equal(getMarkdownSource(view.state), original.replace("เดิม", "ใหม่"));
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), original);
  assert.equal(redo(view), true);
  assert.equal(getMarkdownSource(view.state), original.replace("เดิม", "ใหม่"));
});

test("undo restores a deleted CRLF and keeps external theme updates", () => {
  const view = editor("---\r\ncolor: sage\r\n---\r\n\r\nfirst\r\nsecond\n");
  const from = view.state.doc.toString().indexOf("first") + 5;
  view.dispatch(view.state.update({ changes: { from, to: from + 1, insert: " " } }));
  view.dispatch(replaceMarkdownSource(view.state, getMarkdownSource(view.state).replace("sage", "ocean")));
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), "---\r\ncolor: ocean\r\n---\r\n\r\nfirst\r\nsecond\n");
});

test("joined typing undo restores raw source and view-only updates do not modify it", () => {
  const original = "one\r\ntwo\nthree\r\n";
  const view = editor(original);
  view.dispatch(view.state.update({ changes: { from: 1, insert: "A" }, userEvent: "input.type" }));
  view.dispatch(view.state.update({ changes: { from: 2, insert: "B" }, userEvent: "input.type" }));
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), original);
  view.dispatch(view.state.update({ selection: { anchor: 5 } }));
  assert.equal(getMarkdownSource(view.state), original);
});

test("undo after separated external edits preserves intervening mixed line endings", () => {
  const original = "a\r\nb\nc\r\nd\n";
  const view = editor(original);
  view.dispatch(view.state.update({ changes: { from: view.state.doc.length, insert: "X" } }));
  view.dispatch(replaceMarkdownSource(view.state, getMarkdownSource(view.state).replace("a", "A").replace("d", "D")));
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), "A\r\nb\nc\r\nD\n");
});

test("joined deletions restore exact mixed newlines", () => {
  const original = "a\r\n\nb\r\nc";
  const view = editor(original);
  view.dispatch(view.state.update({ changes: { from: 1, to: 2 }, userEvent: "delete.backward" }));
  view.dispatch(view.state.update({ changes: { from: 1, to: 2 }, userEvent: "delete.backward" }));
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), original);
  assert.equal(redo(view), true);
  assert.equal(getMarkdownSource(view.state), "ab\r\nc");
});

test("undo does not transfer a transient newline spelling to another surviving line", () => {
  const original = "a\r\nb\nc\r\nd\n";
  const view = editor(original);
  view.dispatch(view.state.update({ changes: { from: 4, to: 7, insert: "\n" }, userEvent: "input.type" }));
  view.dispatch(view.state.update({ changes: { from: 5, insert: "Q\nR" }, userEvent: "input.type" }));
  view.dispatch(view.state.update({ changes: { from: 6, to: 7 }, userEvent: "delete.backward" }));
  while (undo(view)) { /* Undo all adjacent typing groups. */ }
  assert.equal(getMarkdownSource(view.state), original);
});

test("deleting between lone CR and LF keeps two logical newlines and exact undo", () => {
  const original = "a\rb\nc";
  const view = editor(original);
  view.dispatch(view.state.update({ changes: { from: 2, to: 3 } }));
  assert.equal(view.state.doc.toString(), "a\n\nc");
  assert.equal(getMarkdownSource(view.state).replace(/\r\n?|\n/g, "\n"), view.state.doc.toString());
  const edited = getMarkdownSource(view.state);
  assert.equal(undo(view), true);
  assert.equal(getMarkdownSource(view.state), original);
  assert.equal(redo(view), true);
  assert.equal(getMarkdownSource(view.state), edited);
});

test("undo restores newline spellings before resolving new CR/LF adjacency", () => {
  const short = editor("a\nc\r\r\n");
  short.dispatch(short.state.update({ changes: { from: 4, to: 5, insert: "Q" } }));
  assert.equal(undo(short), true);
  assert.equal(getMarkdownSource(short.state), "a\nc\r\r\n");
  const original = "a\r\nb\nc\rd\r\ne\nf\r\ng";
  const view = editor(original);
  for (const changes of [
    { from: 6, to: 13, insert: "\n" },
    { from: 1, to: 1, insert: "Q\nR" },
    { from: 2, to: 5, insert: "" },
    { from: 0, to: 3, insert: "\n" },
    { from: 4, to: 5, insert: "Q\nR" },
  ]) view.dispatch(view.state.update({ changes, userEvent: changes.insert ? "input.type" : "delete.backward" }));
  const edited = getMarkdownSource(view.state);
  while (undo(view)) { /* Exhaust grouped edits. */ }
  assert.equal(getMarkdownSource(view.state), original);
  while (redo(view)) { /* Replay grouped edits. */ }
  assert.equal(getMarkdownSource(view.state), edited);
});

test("mixed-line-ending source survives deterministic edit sequences and undo/redo", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const original = seed % 2 ? "a\r\nb\nc\r\nd\n" : "a\rb\nc\r\nd\n";
    const view = editor(original);
    let random = seed;
    const next = () => { random = (random * 1664525 + 1013904223) >>> 0; return random; };
    for (let edit = 0; edit < 12; edit++) {
      const from = next() % (view.state.doc.length + 1);
      const to = from + next() % (view.state.doc.length - from + 1);
      const insert = ["", "x", "\n", "Q\nR"][next() % 4];
      view.dispatch(view.state.update({ changes: { from, to, insert }, userEvent: "input.type" }));
      assert.equal(getMarkdownSource(view.state).replace(/\r\n?|\n/g, "\n"), view.state.doc.toString(), `source mapping seed ${seed} edit ${edit}`);
    }
    const edited = getMarkdownSource(view.state);
    while (undo(view)) { /* Exhaust the public undo history. */ }
    assert.equal(getMarkdownSource(view.state), original, `undo seed ${seed}`);
    while (redo(view)) { /* Replay the public redo history. */ }
    assert.equal(getMarkdownSource(view.state), edited, `redo seed ${seed}`);
  }
});
