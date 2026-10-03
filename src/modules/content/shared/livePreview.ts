import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Root, RootContent, PhrasingContent, ListItem } from "mdast";
import type { Node, Parent } from "unist";
import { parseNoteTheme } from "./noteTheme";
import { parseGfmAlert } from "./gfmAlerts";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
export interface PreviewRange { from: number; to: number; }
export interface PreviewBlock extends PreviewRange { node: RootContent; widget: boolean; }
export interface PreviewInline extends PreviewRange { node: PhrasingContent; }
export interface PreviewStyle extends PreviewRange { className: string; hide?: PreviewRange[]; line?: boolean; replacement?: string; }
export interface PreviewTask extends PreviewRange { marker: number; checked: boolean; }
export interface LivePreviewDocument {
  source: string;
  tree: Root;
  frontmatterEnd: number;
  context: RootContent[];
  contextKey: string;
  footnoteNumbers: Map<string, number>;
  blocks: PreviewBlock[];
  inline: PreviewInline[];
  styles: PreviewStyle[];
  tasks: PreviewTask[];
}

function children(node: Node): Node[] { return "children" in node ? (node as Parent).children : []; }
function range(node: Node): PreviewRange { return { from: node.position?.start.offset ?? 0, to: node.position?.end.offset ?? 0 }; }

export function previewIsActive(range: PreviewRange, selections: readonly PreviewRange[]): boolean {
  return selections.some(selection => selection.from <= range.to && selection.to >= range.from);
}

export function parseLivePreview(source: string): LivePreviewDocument {
  const { cleanContent, lineOffset } = parseNoteTheme(source);
  const frontmatterEnd = source.length - cleanContent.length;
  const tree = parser.parse(cleanContent);
  const shift = (node: Node) => {
    if (node.position) {
      for (const point of [node.position.start, node.position.end]) {
        if (point.offset !== undefined) point.offset += frontmatterEnd;
        point.line += lineOffset;
      }
    }
    children(node).forEach(shift);
  };
  shift(tree);
  const result: LivePreviewDocument = { source, tree, frontmatterEnd, context: [], contextKey: "", footnoteNumbers: new Map(), blocks: [], inline: [], styles: [], tasks: [] };
  result.context = tree.children.filter(node => node.type === "definition" || node.type === "footnoteDefinition");
  const numberFootnotes = (node: Node) => {
    if (node.type === "footnoteReference") {
      const identifier = (node as Extract<PhrasingContent, { type: "footnoteReference" }>).identifier;
      if (!result.footnoteNumbers.has(identifier)) result.footnoteNumbers.set(identifier, result.footnoteNumbers.size + 1);
    }
    children(node).forEach(numberFootnotes);
  };
  numberFootnotes(tree);
  result.contextKey = result.context.map(node => source.slice(range(node).from, range(node).to)).join("\n") + JSON.stringify([...result.footnoteNumbers]);
  for (const node of tree.children) {
    const { from, to } = range(node);
    const isImage = node.type === "paragraph" && node.children.length === 1 && ["image", "imageReference"].includes(node.children[0].type);
    const widget = ["table", "math", "code", "thematicBreak", "footnoteDefinition"].includes(node.type) || isImage || (node.type === "blockquote" && Boolean(parseGfmAlert(source.slice(from, to))));
    result.blocks.push({ from, to, node, widget });
    if (widget) continue;
    const visit = (current: Node) => {
      const bounds = range(current);
      const text = source.slice(bounds.from, bounds.to);
      if (["image", "imageReference", "link", "linkReference", "inlineMath", "footnoteReference"].includes(current.type)) {
        result.inline.push({ ...bounds, node: current as PhrasingContent });
        return;
      }
      if (["strong", "emphasis", "delete", "inlineCode"].includes(current.type)) {
        const nested = children(current);
        const width = current.type === "inlineCode" ? (text.match(/^`+/)?.[0].length ?? 1) : current.type === "strong" || current.type === "delete" ? 2 : 1;
        const innerStart = nested[0]?.position?.start.offset ?? bounds.from + width;
        const innerEnd = nested.at(-1)?.position?.end.offset ?? bounds.to - width;
        result.styles.push({ ...bounds, className: `cm-md-${current.type}`, hide: [{ from: bounds.from, to: innerStart }, { from: innerEnd, to: bounds.to }] });
      }
      if (current.type === "heading") {
        const heading = current as Extract<RootContent, { type: "heading" }>;
        const marker = text.match(/^#{1,6}[\t ]+/);
        result.styles.push({ ...bounds, className: `cm-md-heading cm-md-h${heading.depth}`, line: true, hide: marker ? [{ from: bounds.from, to: bounds.from + marker[0].length }] : [] });
      }
      if (current.type === "blockquote") result.styles.push({ ...bounds, className: "cm-md-quote", line: true });
      if (current.type === "listItem") {
        const item = current as ListItem;
        const marker = /^(\s*)([-*+]|\d+[.)])([\t ]+)/.exec(text);
        if (marker && /^[-*+]$/.test(marker[2])) result.styles.push({ from: bounds.from + marker[1].length, to: bounds.from + marker[0].length, className: "cm-md-list-marker", replacement: "• " });
        if (typeof item.checked === "boolean") {
          const match = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/.exec(text);
          if (match) result.tasks.push({ from: bounds.from + match[1].length, to: bounds.from + match[0].length, marker: bounds.from + match[1].length + 1, checked: item.checked });
        }
      }
      children(current).forEach(visit);
    };
    visit(node);
  }
  return result;
}

export function previewFragment(document: LivePreviewDocument, node: RootContent | PhrasingContent): Root {
  const block = document.blocks.find(item => item.node === node);
  const content: RootContent = block ? block.node : { type: "paragraph", children: [node as PhrasingContent] };
  return { type: "root", children: [content, ...document.context.filter(item => item !== content)] };
}
