import { createElement, useLayoutEffect } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import { Facet, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import type { RootContent, PhrasingContent } from "mdast";
import { parseLivePreview, previewFragment, previewIsActive, type LivePreviewDocument, type PreviewRange } from "../shared/livePreview";
import type { Language } from "@/shared/language";
import { MarkdownContent } from "./components/MarkdownContent";

export const setSourceView = StateEffect.define<boolean>();
export const sourceViewField = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) => transaction.effects.reduce((current, effect) => effect.is(setSourceView) ? effect.value : current, value),
});
const parsedDocument = StateEffect.define<LivePreviewDocument>();
const roots = new WeakMap<HTMLElement, ReactRoot>();

function PreviewContent({ document, node, view, start }: { document: LivePreviewDocument; node: RootContent | PhrasingContent; view: EditorView; start: () => number }) {
  useLayoutEffect(() => { view.requestMeasure(); });
  const from = node.position?.start.offset ?? 0;
  const renderer = createElement(MarkdownContent, {
    markdown: document.source,
    lang: view.state.facet(previewLanguage),
    tree: node.type === "footnoteDefinition" ? { type: "root", children: [...node.children, ...document.context] } : previewFragment(document, node),
    showFootnoteAppendix: false,
    footnoteNumbers: document.footnoteNumbers,
    onToggleTask: (marker: number, checked: boolean) => {
      const position = start() + marker - from;
      view.dispatch({ changes: { from: position, to: position + 1, insert: checked ? "x" : " " }, userEvent: "input" });
    },
  });
  return node.type === "footnoteDefinition"
    ? createElement("div", { className: "cm-md-footnote" }, createElement("span", { className: "cm-md-footnote-label" }, `[${document.footnoteNumbers.get(node.identifier) ?? node.label ?? node.identifier}] `), renderer)
    : renderer;
}

const previewLanguage = Facet.define<Language, Language>({ combine: values => values[0] ?? "en" });

class MarkdownWidget extends WidgetType {
  private readonly content: string;
  private readonly context: string;
  constructor(private readonly document: LivePreviewDocument, private readonly node: RootContent | PhrasingContent, private readonly block: boolean, private readonly language: Language) {
    super();
    this.content = document.source.slice(node.position?.start.offset, node.position?.end.offset);
    this.context = document.contextKey;
  }
  eq(other: MarkdownWidget) { return this.content === other.content && this.context === other.context && this.block === other.block && this.language === other.language; }
  toDOM(view: EditorView): HTMLElement {
    const dom = window.document.createElement(this.block ? "div" : "span");
    dom.className = `nota-markdown cm-md-widget ${this.block ? "cm-md-block" : "cm-md-inline-widget"}`;
    dom.setAttribute("role", "button");
    dom.setAttribute("tabindex", "0");
    dom.setAttribute("aria-label", view.state.facet(previewLanguage) === "th" ? "แก้ Markdown ของส่วนนี้" : "Edit this Markdown block");
    const position = () => view.posAtDOM(dom);
    const edit = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button,input")) return;
      if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey) && target instanceof Element && target.closest("a[href]")) return;
      event.preventDefault();
      const from = Math.min(view.state.doc.length, position());
      view.dispatch({ selection: { anchor: from }, scrollIntoView: true });
      view.focus();
    };
    dom.addEventListener("click", edit);
    dom.addEventListener("keydown", event => { if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) edit(event); });
    if (this.node.type === "footnoteReference") {
      const sup = window.document.createElement("sup");
      sup.textContent = String(this.document.footnoteNumbers.get(this.node.identifier) ?? this.node.label ?? this.node.identifier);
      dom.title = this.content;
      dom.appendChild(sup);
      return dom;
    }
    const root = createRoot(dom);
    roots.set(dom, root);
    root.render(createElement(PreviewContent, { document: this.document, node: this.node, view, start: position }));
    return dom;
  }
  destroy(dom: HTMLElement) { const root = roots.get(dom); if (root) queueMicrotask(() => root.unmount()); roots.delete(dom); }
  ignoreEvent() { return true; }
}

class TextWidget extends WidgetType {
  constructor(private readonly text: string) { super(); }
  eq(other: TextWidget) { return this.text === other.text; }
  toDOM() { const span = window.document.createElement("span"); span.textContent = this.text; return span; }
  ignoreEvent() { return false; }
}

class TaskWidget extends WidgetType {
  constructor(private readonly checked: boolean, private readonly language: Language) { super(); }
  eq(other: TaskWidget) { return this.checked === other.checked && this.language === other.language; }
  toDOM(view: EditorView) {
    const input = window.document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.setAttribute("aria-label", view.state.facet(previewLanguage) === "th" ? "ทำรายการเสร็จแล้ว" : "Task completed");
    input.className = "cm-md-task";
    input.addEventListener("change", () => {
      const marker = view.posAtDOM(input) + 1;
      view.dispatch({ changes: { from: marker, to: marker + 1, insert: input.checked ? "x" : " " }, userEvent: "input" });
    });
    return input;
  }
  ignoreEvent() { return true; }
}

function activeLines(state: EditorState): PreviewRange[] {
  return state.selection.ranges.map(selection => ({ from: state.doc.lineAt(selection.from).from, to: state.doc.lineAt(selection.to).to }));
}

function decorations(document: LivePreviewDocument, state: EditorState): DecorationSet {
  if (state.field(sourceViewField)) return Decoration.none;
  const active = activeLines(state);
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const replace = (bounds: PreviewRange, decoration: Decoration) => {
    if (bounds.from < bounds.to) ranges.push(decoration.range(bounds.from, bounds.to));
  };
  if (document.frontmatterEnd) replace({ from: 0, to: document.frontmatterEnd }, Decoration.replace({ block: true }));
  for (const block of document.blocks) {
    if (block.widget && !previewIsActive(block, active)) replace(block, Decoration.replace({ widget: new MarkdownWidget(document, block.node, true, state.facet(previewLanguage)), block: true }));
  }
  for (const item of document.inline) {
    if (!previewIsActive(item, active)) replace(item, Decoration.replace({ widget: new MarkdownWidget(document, item.node, false, state.facet(previewLanguage)) }));
  }
  for (const item of document.styles) {
    if (item.replacement) {
      if (!previewIsActive(item, active)) replace(item, Decoration.replace({ widget: new TextWidget(item.replacement) }));
      continue;
    }
    if (item.line) {
      for (let line = state.doc.lineAt(item.from); line.from <= item.to;) {
        ranges.push(Decoration.line({ class: item.className }).range(line.from));
        if (line.number >= state.doc.lines) break;
        line = state.doc.line(line.number + 1);
      }
    } else replace(item, Decoration.mark({ class: item.className }));
    if (!previewIsActive(item, active)) for (const hidden of item.hide ?? []) replace(hidden, Decoration.replace({}));
  }
  for (const task of document.tasks) if (!previewIsActive(task, active)) replace(task, Decoration.replace({ widget: new TaskWidget(task.checked, state.facet(previewLanguage)) }));
  return Decoration.set(ranges, true);
}

interface PreviewState { document: LivePreviewDocument; decorations: DecorationSet; dirty: boolean; }
function revealActiveSource(set: DecorationSet, active: PreviewRange[]): DecorationSet {
  return set.update({ filter: (from, to, decoration) =>
    Boolean(decoration.spec.class || (decoration.spec.block && !decoration.spec.widget)) ||
    !previewIsActive({ from, to }, active),
  });
}
const previewField = StateField.define<PreviewState>({
  create(state) {
    const document = parseLivePreview(state.doc.toString());
    return { document, decorations: decorations(document, state), dirty: false };
  },
  update(value, transaction) {
    const parsed = transaction.effects.find(effect => effect.is(parsedDocument));
    if (parsed?.is(parsedDocument)) return { document: parsed.value, decorations: decorations(parsed.value, transaction.state), dirty: false };
    if (transaction.docChanged) {
      const active = activeLines(transaction.state);
      return { ...value, dirty: true, decorations: revealActiveSource(value.decorations.map(transaction.changes), active) };
    }
    if (transaction.selection || transaction.reconfigured || transaction.effects.some(effect => effect.is(setSourceView))) {
      if (transaction.state.field(sourceViewField)) return { ...value, decorations: Decoration.none };
      if (!value.dirty) return { ...value, decorations: decorations(value.document, transaction.state) };
      const active = activeLines(transaction.state);
      return { ...value, decorations: revealActiveSource(value.decorations, active) };
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
});

const parsing = ViewPlugin.fromClass(class {
  timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly view: EditorView) {}
  update(update: { docChanged: boolean }) {
    if (!update.docChanged) return;
    clearTimeout(this.timer);
    const parse = () => {
      if (this.view.composing) { this.timer = setTimeout(parse, 150); return; }
      this.view.dispatch({ effects: parsedDocument.of(parseLivePreview(this.view.state.doc.toString())) });
    };
    this.timer = setTimeout(parse, 150);
  }
  destroy() { clearTimeout(this.timer); }
});

export function livePreview(lang: Language): Extension { return [previewLanguage.of(lang), sourceViewField, previewField, parsing]; }
