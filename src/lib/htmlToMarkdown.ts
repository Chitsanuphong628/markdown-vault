import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

type HtmlNode = DefaultTreeAdapterTypes.ChildNode;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const EMPTY_TAGS = new Set(["div", "section", "article", "main", "aside", "span"]);
const INLINE_MARKS: Record<string, string> = {
  b: "**",
  strong: "**",
  em: "*",
  i: "*",
  del: "~~",
  s: "~~",
  strike: "~~",
};

function isSafeLinkUrl(value: string): boolean {
  try {
    const protocol = new URL(value, "https://nota.invalid").protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:";
  } catch {
    return false;
  }
}

function attrsOf(element: HtmlElement): Map<string, string> {
  return new Map(element.attrs.map(attribute => [attribute.name, attribute.value]));
}

function onlyAttributes(element: HtmlElement, allowed: string[] = []): boolean {
  const names = new Set(allowed);
  return element.attrs.every(attribute => names.has(attribute.name));
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*{}\[\]()#+\-.!_<>|~$])/g, "\\$1");
}

function escapeDestination(value: string): string {
  return value.replace(/>/g, "%3E");
}

function childrenOf(element: HtmlElement): HtmlNode[] {
  return element.childNodes;
}

function renderCodeFence(source: string, language = ""): string {
  const longestBacktickRun = Math.max(0, ...Array.from(source.matchAll(/`+/g), match => match[0].length));
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  const code = source.replace(/^\n+|\n+$/g, "");
  return `${fence}${language}\n${code}\n${fence}\n\n`;
}

function plainText(nodes: HtmlNode[]): string | null {
  let result = "";
  for (const node of nodes) {
    if (node.nodeName === "#text") {
      result += (node as DefaultTreeAdapterTypes.TextNode).value;
      continue;
    }
    if (node.nodeName.startsWith("#")) return null;
    const element = node as HtmlElement;
    if (element.tagName === "br") {
      result += "\n";
      continue;
    }
    const nested = plainText(childrenOf(element));
    if (nested === null) return null;
    result += nested;
  }
  return result;
}

function renderTable(element: HtmlElement): string | null {
  if (!onlyAttributes(element)) return null;
  const rows: Array<Array<{ content: string; header: boolean; align: string | null }>> = [];
  const collectRows = (container: HtmlElement): boolean => {
    for (const child of container.childNodes) {
      if (child.nodeName === "#text" && !(child as DefaultTreeAdapterTypes.TextNode).value.trim()) continue;
      if (child.nodeName.startsWith("#")) return false;
      const childElement = child as HtmlElement;
      if (childElement.tagName === "tr") {
        if (!onlyAttributes(childElement)) return false;
        const cells: Array<{ content: string; header: boolean; align: string | null }> = [];
        for (const cellNode of childElement.childNodes) {
          if (cellNode.nodeName === "#text" && !(cellNode as DefaultTreeAdapterTypes.TextNode).value.trim()) continue;
          if (cellNode.nodeName.startsWith("#")) return false;
          const cell = cellNode as HtmlElement;
          if (cell.tagName !== "th" && cell.tagName !== "td") return false;
          if (!onlyAttributes(cell, ["align"])) return false;
          const alignValue = attrsOf(cell).get("align")?.toLowerCase() || null;
          const align = alignValue && ["left", "center", "right"].includes(alignValue) ? alignValue : null;
          if (alignValue && !align) return false;
          const content = renderNodes(childrenOf(cell));
          if (content === null || /\r?\n/.test(content)) return false;
          cells.push({ content: content.trim().replace(/(?<!\\)\|/g, "\\|"), header: cell.tagName === "th", align });
        }
        if (!cells.length) return false;
        rows.push(cells);
      } else if (["thead", "tbody", "tfoot"].includes(childElement.tagName) && onlyAttributes(childElement)) {
        if (!collectRows(childElement)) return false;
      } else {
        return false;
      }
    }
    return true;
  };

  if (!collectRows(element) || !rows.length) return null;
  const width = rows[0]!.length;
  if (rows.some(row => row.length !== width)) return null;
  const headerRow = rows[0]!;
  if (!headerRow.every(cell => cell.header)) return null;
  if (rows.slice(1).some(row => row.some(cell => cell.header))) return null;
  const bodyRows = rows.slice(1);
  const alignments = headerRow.map((cell, index) => {
    const align = cell.align || rows.flatMap(row => row[index] ? [row[index]!.align] : []).find(Boolean) || null;
    return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
  });
  const formatRow = (row: typeof headerRow) => `| ${row.map(cell => cell.content).join(" | ")} |`;
  return `${[
    formatRow(headerRow),
    `| ${alignments.join(" | ")} |`,
    ...bodyRows.map(formatRow),
  ].join("\n")}\n\n`;
}

function renderList(element: HtmlElement, indent: string): string | null {
  const ordered = element.tagName === "ol";
  if (!onlyAttributes(element, ordered ? ["start"] : [])) return null;
  const rawStart = attrsOf(element).get("start");
  const start = rawStart === undefined ? 1 : Number(rawStart);
  if (ordered && (!Number.isInteger(start) || start < 1)) return null;
  const items: HtmlElement[] = [];
  for (const child of element.childNodes) {
    if (child.nodeName === "#text" && !(child as DefaultTreeAdapterTypes.TextNode).value.trim()) continue;
    if (child.nodeName !== "li") return null;
    const item = child as HtmlElement;
    if (!onlyAttributes(item)) return null;
    items.push(item);
  }
  if (!items.length) return null;

  const lines: string[] = [];
  for (const [index, item] of items.entries()) {
    const nestedLists: HtmlElement[] = [];
    const itemContentNodes: HtmlNode[] = [];
    for (const child of item.childNodes) {
      if (child.nodeName === "ul" || child.nodeName === "ol") nestedLists.push(child as HtmlElement);
      else itemContentNodes.push(child);
    }
    const content = renderNodes(itemContentNodes);
    if (content === null || (!content.trim() && !nestedLists.length)) return null;
    const marker = ordered ? `${start + index}.` : "-";
    const prefix = `${indent}${marker} `;
    if (content.trim()) {
      const contentLines = content.trim().split("\n");
      lines.push(`${prefix}${contentLines.join(`\n${" ".repeat(prefix.length)}`)}`);
    } else {
      lines.push(prefix.trimEnd());
    }
    for (const nested of nestedLists) {
      const nestedMarkdown = renderList(nested, `${indent}${" ".repeat(marker.length + 1)}`);
      if (nestedMarkdown === null) return null;
      lines.push(nestedMarkdown.trimEnd());
    }
  }
  return `${lines.join("\n")}\n\n`;
}

function renderElement(element: HtmlElement): string | null {
  const tag = element.tagName;
  const attrs = attrsOf(element);
  const children = childrenOf(element);

  if (tag === "br") return onlyAttributes(element) ? "  \n" : null;
  if (tag === "hr") return onlyAttributes(element) ? "---\n\n" : null;
  if (tag === "img") {
    if (!onlyAttributes(element, ["src", "alt", "title"])) return null;
    const src = attrs.get("src") || "";
    if (!src || !/^https?:/i.test(src) || !isSafeLinkUrl(src)) return null;
    const alt = (attrs.get("alt") || "").replace(/([\\\[\]])/g, "\\$1");
    const title = attrs.get("title");
    return `![${alt}](<${escapeDestination(src)}>${title ? ` ${JSON.stringify(title)}` : ""})`;
  }
  if (tag === "a") {
    if (!onlyAttributes(element, ["href", "title"])) return null;
    const href = attrs.get("href") || "";
    if (!href || !isSafeLinkUrl(href)) return null;
    const label = renderNodes(children);
    if (label === null || /\r?\n/.test(label)) return null;
    const title = attrs.get("title");
    return `[${label}](<${escapeDestination(href)}>${title ? ` ${JSON.stringify(title)}` : ""})`;
  }
  if (tag === "code") {
    if (!onlyAttributes(element)) return null;
    const code = plainText(children);
    if (code === null) return null;
    const fence = "`".repeat(Math.max(1, ...Array.from(code.matchAll(/`+/g), match => match[0].length + 1)));
    const padding = code.startsWith("`") || code.endsWith("`") ? " " : "";
    return `${fence}${padding}${code}${padding}${fence}`;
  }
  if (tag === "pre") {
    if (!onlyAttributes(element)) return null;
    const codeElement = children.find(child => child.nodeName === "code") as HtmlElement | undefined;
    if (children.some(child => child !== codeElement && child.nodeName !== "#text")) return null;
    if (codeElement && !onlyAttributes(codeElement, ["class"])) return null;
    const code = plainText(codeElement ? childrenOf(codeElement) : children);
    if (code === null) return null;
    const languageClass = codeElement ? attrsOf(codeElement).get("class") || "" : "";
    if (languageClass && !/^language-[\w+#.-]+$/.test(languageClass)) return null;
    const language = /^language-([\w+#.-]+)$/.exec(languageClass)?.[1] || "";
    return renderCodeFence(code, language);
  }
  if (tag === "table") return renderTable(element);
  if (tag === "ul" || tag === "ol") return renderList(element, "");
  if (tag === "blockquote") {
    if (!onlyAttributes(element)) return null;
    const content = renderNodes(children);
    if (content === null) return null;
    return `${content.trim().split("\n").map(line => line ? `> ${line}` : ">").join("\n")}\n\n`;
  }
  if (/^h[1-6]$/.test(tag)) {
    if (!onlyAttributes(element)) return null;
    const content = renderNodes(children);
    if (content === null || /\r?\n/.test(content)) return null;
    return `${"#".repeat(Number(tag.slice(1)))} ${content.trim()}\n\n`;
  }
  if (tag === "p") {
    if (!onlyAttributes(element)) return null;
    const content = renderNodes(children);
    if (content === null) return null;
    return `${content.trim()}\n\n`;
  }
  if (INLINE_MARKS[tag]) {
    if (!onlyAttributes(element)) return null;
    const content = renderNodes(children);
    return content === null ? null : `${INLINE_MARKS[tag]}${content}${INLINE_MARKS[tag]}`;
  }
  if (EMPTY_TAGS.has(tag)) {
    if (!onlyAttributes(element)) return null;
    const content = renderNodes(children);
    if (content === null) return null;
    return tag === "span" ? content : `${content.trim()}\n\n`;
  }
  return null;
}

function renderNodes(nodes: HtmlNode[]): string | null {
  let result = "";
  for (const node of nodes) {
    if (node.nodeName === "#text") {
      result += escapeMarkdownText((node as DefaultTreeAdapterTypes.TextNode).value);
    } else if (node.nodeName.startsWith("#")) {
      return null;
    } else {
      const rendered = renderElement(node as HtmlElement);
      if (rendered === null) return null;
      result += rendered;
    }
  }
  return result;
}

/** Converts HTML with direct Markdown equivalents. Unknown semantics stay untouched. */
export function convertHtmlToMarkdown(source: string): string | null {
  try {
    const fragment = parseFragment(source);
    const converted = renderNodes(fragment.childNodes)?.trim();
    return converted || null;
  } catch {
    return null;
  }
}
