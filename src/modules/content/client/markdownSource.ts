import { Annotation, EditorState, Facet, MapMode, StateEffect, StateField, Transaction, type ChangeSet } from "@codemirror/state";
import { invertedEffects } from "@codemirror/commands";

interface SourceDocument {
  raw: string;
  normalized: string;
  offsets: number[];
  lineBreak: string;
}

function sourceDocument(raw: string): SourceDocument {
  const offsets = [0];
  const text: string[] = [];
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index];
    if (character === "\r") {
      if (raw[index + 1] === "\n") index++;
      text.push("\n");
    } else {
      text.push(character);
    }
    offsets.push(index + 1);
  }
  return { raw, normalized: text.join(""), offsets, lineBreak: raw.match(/\r\n|\r|\n/)?.[0] ?? "\n" };
}

function sourceTokens(source: SourceDocument): string[] {
  return source.offsets.slice(0, -1).map((offset, at) => source.raw.slice(offset, source.offsets[at + 1]));
}

function patchSourceTokens(source: SourceDocument, changes: ChangeSet): string[] {
  const tokens: string[] = [];
  const appendOriginal = (from: number, to: number) => {
    for (let at = from; at < to; at++) tokens.push(source.raw.slice(source.offsets[at], source.offsets[at + 1]));
  };
  let previous = 0;
  changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    appendOriginal(previous, from);
    for (const character of inserted.toString().split("")) tokens.push(character === "\n" ? source.lineBreak : character);
    previous = to;
  });
  appendOriginal(previous, source.normalized.length);
  return tokens;
}

function sourceFromTokens(tokens: string[]): SourceDocument {
  // A newly adjacent lone CR and LF must stay two logical line breaks. Use
  // CRLF for the first token; history restores its original spelling on undo.
  for (let at = 1; at < tokens.length; at++) {
    if (tokens[at - 1] === "\r" && tokens[at] === "\n") tokens[at - 1] = "\r\n";
  }
  return sourceDocument(tokens.join(""));
}

export function minimalTextChange(before: string, after: string): { from: number; to: number; insert: string } {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > from && newEnd > from && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  return { from, to: oldEnd, insert: after.slice(from, newEnd) };
}

export const externalSourceUpdate = Annotation.define<boolean>();
const restoreSource = StateEffect.define<string>();
interface OriginalLineBreak { at: number; raw: string; }
const restoreLineBreak = StateEffect.define<OriginalLineBreak>({
  map: (value, changes) => {
    const at = changes.mapPos(value.at, 1, MapMode.TrackAfter);
    return at === null ? undefined : { ...value, at };
  },
});
const initialSource = Facet.define<string, string>({ combine: values => values[0] ?? "" });

export const markdownSourceField = StateField.define<SourceDocument>({
  create: state => sourceDocument(state.facet(initialSource)),
  update(source, transaction) {
    if (!transaction.docChanged && !transaction.effects.some(effect => effect.is(restoreSource) || effect.is(restoreLineBreak))) return source;
    let tokens = transaction.docChanged ? patchSourceTokens(source, transaction.changes) : sourceTokens(source);
    for (const effect of transaction.effects) {
      if (!effect.is(restoreSource)) continue;
      tokens = sourceTokens(sourceDocument(effect.value));
    }
    for (const effect of transaction.effects) {
      if (effect.is(restoreLineBreak) && /^(?:\r\n?|\n)$/.test(tokens[effect.value.at] ?? "")) tokens[effect.value.at] = effect.value.raw;
    }
    return sourceFromTokens(tokens);
  },
});

export function markdownSource(raw: string) { return [initialSource.of(raw), markdownSourceField]; }
export function getMarkdownSource(state: EditorState): string { return state.field(markdownSourceField).raw; }
// CodeMirror already records inverse text changes. Only the exact spelling of
// deleted line breaks needs an additional, position-mapped history effect.
export const sourceHistory = invertedEffects.of(transaction => {
  if (!transaction.docChanged) return [];
  const source = transaction.startState.field(markdownSourceField);
  const updated = transaction.state.field(markdownSourceField);
  const effects: StateEffect<OriginalLineBreak>[] = [];
  for (let at = 0; at < source.normalized.length; at++) {
    if (source.normalized[at] !== "\n") continue;
    const raw = source.raw.slice(source.offsets[at], source.offsets[at + 1]);
    const mapped = transaction.changes.mapPos(at, 1, MapMode.TrackAfter);
    if (mapped === null || updated.raw.slice(updated.offsets[mapped], updated.offsets[mapped + 1]) !== raw) {
      effects.push(restoreLineBreak.of({ at, raw }));
    }
  }
  return effects;
});

export function replaceMarkdownSource(state: EditorState, raw: string) {
  const source = sourceDocument(raw);
  return state.update({
    changes: minimalTextChange(state.doc.toString(), source.normalized),
    effects: restoreSource.of(raw),
    annotations: [Transaction.addToHistory.of(false), externalSourceUpdate.of(true)],
  });
}
