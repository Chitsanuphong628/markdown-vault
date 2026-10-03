"use client";

import dynamic from "next/dynamic";
import React, { useMemo, useState } from "react";
import type { Root as MarkdownRoot, RootContent } from "mdast";
import type { Root as HtmlRoot } from "hast";
import type { Plugin, PluggableList } from "unified";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import cpp from "highlight.js/lib/languages/cpp";
import "highlight.js/styles/atom-one-dark.css";
import { Check, Copy } from "lucide-react";
import { I18N_DIAGRAM, isSafeImageUrl, isSafeNoteLink, parseGfmAlert } from "@/modules/content/shared";
import type { Language } from "@/shared/language";
import { useLanguagePreference } from "@/modules/app-shell/client";
import { GfmAlertCard } from "./GfmAlertCard";

// Register core languages for high performance & minimal bundle size
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);

// Hoist plugins to avoid recreating arrays and recompiling pipeline on every render
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeSlug, rehypeKatex];

function DiagramLoading() {
  const [lang] = useLanguagePreference();
  return (
    <div role="status" aria-label={lang === "th" ? "กำลังโหลดแผนภาพ" : "Loading diagram"} className="h-44 my-4 flex items-center justify-center bg-neutral-900/60 rounded-xl border border-neutral-800">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Lazy-load MermaidChart so the large Mermaid bundle is only fetched when a diagram exists.
const MermaidChart = dynamic(() => import("./MermaidChart"), {
  ssr: false,
  loading: () => <DiagramLoading />,
});

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children?: React.ReactNode;
  block?: boolean;
  uiLanguage?: Language;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

const highlightCache = new Map<string, string>();
const MAX_HIGHLIGHT_CACHE_ENTRIES = 500;

function getHighlightedSnippet(rawCode: string, language: string): string {
  const cacheKey = `${language}:${rawCode}`;
  const hit = highlightCache.get(cacheKey);
  if (hit !== undefined) return hit;

  let highlighted = "";
  if (language && hljs.getLanguage(language)) {
    try {
      highlighted = hljs.highlight(rawCode, { language, ignoreIllegals: true }).value;
    } catch {
      highlighted = hljs.highlightAuto(rawCode).value;
    }
  } else {
    try {
      highlighted = hljs.highlightAuto(rawCode).value;
    } catch {
      highlighted = escapeHtml(rawCode);
    }
  }

  if (highlightCache.size >= MAX_HIGHLIGHT_CACHE_ENTRIES) {
    const oldestKey = highlightCache.keys().next().value;
    if (oldestKey) highlightCache.delete(oldestKey);
  }
  highlightCache.set(cacheKey, highlighted);
  return highlighted;
}

function CodeBlock({ className, children, block = false, uiLanguage = "en", ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const isInline = !block;
  const rawCode = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  const isMermaid = !isInline && language === "mermaid";
  const diagramText = I18N_DIAGRAM[uiLanguage];

  // Perform Highlight.js colorization (cached for 0ms re-renders)
  const highlightedHtml = useMemo(() => {
    if (isInline || isMermaid) return "";
    return getHighlightedSnippet(rawCode, language);
  }, [isInline, isMermaid, rawCode, language]);

  if (isInline) {
    return (
      <code className="bg-neutral-800/80 text-pink-400 font-mono text-[0.85em] px-1.5 py-0.5 rounded border border-neutral-700/50" {...props}>
        {children}
      </code>
    );
  }

  // If language is mermaid, render dynamic chart
  if (isMermaid) {
    return <MermaidChart lang={uiLanguage} chart={rawCode} />;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="relative group my-5 overflow-hidden rounded-md border border-neutral-800 bg-[#15171d]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 text-xs font-mono text-neutral-400">
        <span className="uppercase tracking-wider font-semibold text-neutral-300">{language}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          title={copyFailed ? diagramText.copyFailed : copied ? diagramText.copied : diagramText.copy}
          aria-label={copyFailed ? diagramText.copyFailed : copied ? diagramText.copied : diagramText.copy}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 text-xs cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{diagramText.copied}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{diagramText.copy}</span>
            </>
          )}
        </button>
      </div>
      {copyFailed && <span role="status" className="sr-only">{diagramText.copyFailed}</span>}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono">
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
    </div>
  );
}

export interface MarkdownContentProps {
  /** Full source corresponding to AST offsets, even when rendering one block. */
  markdown: string;
  lang: Language;
  /** Selected nodes plus definitions from the full document. Never mutated. */
  tree?: MarkdownRoot;
  onToggleTask?: (markerOffset: number, checked: boolean) => void;
  /** Fragment widgets omit generated footnote appendices by default. */
  showFootnoteAppendix?: boolean;
  footnoteNumbers?: ReadonlyMap<string, number>;
}

// ReactMarkdown still creates a parser; an empty input makes parsing O(1) for
// prepared fragments. The cached AST supplies full-note reference context.
const usePreparedTree: Plugin<[MarkdownRoot | undefined], MarkdownRoot> = (prepared) => () => (
  prepared ? structuredClone(prepared) : undefined
);

const stripAlertMarkers: Plugin<[], MarkdownRoot> = () => (tree) => {
  function visit(node: MarkdownRoot | RootContent): void {
    if (node.type === "blockquote") {
      const first = node.children[0];
      const text = first?.type === "paragraph" ? first.children[0] : undefined;
      if (text?.type === "text" && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/i.test(text.value)) {
        text.value = text.value.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n)?/i, "");
        if (!text.value && first?.type === "paragraph") first.children.shift();
        if (first?.type === "paragraph" && first.children.length === 0) node.children.shift();
      }
    }
    if ("children" in node) {
      for (const child of node.children) visit(child as RootContent);
    }
  }
  visit(tree);
};

const omitFootnoteAppendix: Plugin<[], HtmlRoot> = () => (tree) => {
  tree.children = tree.children.filter(node => !(node.type === "element" && node.properties.dataFootnotes));
};

/** Resolve the exact character inside `[ ]`, including numbered/nested tasks. */
export function getTaskMarkerOffset(markdown: string, itemOffset: number): number | null {
  const lineEnd = markdown.indexOf("\n", itemOffset);
  const line = markdown.slice(itemOffset, lineEnd < 0 ? undefined : lineEnd);
  const match = /^(?:[-+*]|\d+[.)])\s+\[([ xX])\](?:\s|$)/.exec(line);
  if (!match) return null;
  return itemOffset + match[0].indexOf("[") + 1;
}

export function MarkdownContent({ markdown, lang, tree, onToggleTask, showFootnoteAppendix = !tree, footnoteNumbers }: MarkdownContentProps) {
  const remarkPlugins = useMemo<PluggableList>(() => (
    [...REMARK_PLUGINS, [usePreparedTree, tree], stripAlertMarkers]
  ), [tree]);
  const rehypePlugins = useMemo<PluggableList>(() => (
    showFootnoteAppendix ? REHYPE_PLUGINS : [...REHYPE_PLUGINS, omitFootnoteAppendix]
  ), [showFootnoteAppendix]);
  const components = useMemo<Components>(() => ({
    a: ({ node, href, children, ...props }) => {
      if (footnoteNumbers && node?.properties?.dataFootnoteRef) {
        const identifier = decodeURIComponent((href ?? "").replace(/^#user-content-fn-/, ""));
        return <span title={`[^${identifier}]`}>{footnoteNumbers.get(identifier) ?? children}</span>;
      }
      return <a {...props} href={href}>{children}</a>;
    },
    code: ({ node, ...props }) => {
      void node;
      return <CodeBlock {...props} uiLanguage={lang} />;
    },
    blockquote: ({ node, children, ...props }) => {
      const start = node?.position?.start.offset;
      const end = node?.position?.end.offset;
      const alert = typeof start === "number" && typeof end === "number"
        ? parseGfmAlert(markdown.slice(start, end)) : null;
      return alert
        ? <GfmAlertCard type={alert.type} body={alert.body} lang={lang}>{children}</GfmAlertCard>
        : <blockquote {...props}>{children}</blockquote>;
    },
    pre: ({ children }) => {
      const child = React.Children.toArray(children)[0];
      return React.isValidElement<CodeBlockProps>(child)
        ? <CodeBlock block uiLanguage={lang} className={child.props.className}>{child.props.children}</CodeBlock>
        : <pre>{children}</pre>;
    },
    img: ({ node, alt, src, ...props }) => {
      void node;
      return typeof src === "string" && isSafeImageUrl(src)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img {...props} src={src} alt={alt || ""} loading="lazy" referrerPolicy="no-referrer" />
        : <span className="nota-unsafe-image">{alt || ""}</span>;
    },
    li: ({ node, children, className, ...props }) => {
      const itemOffset = node?.position?.start.offset;
      const markerOffset = className?.includes("task-list-item") && typeof itemOffset === "number"
        ? getTaskMarkerOffset(markdown, itemOffset) : null;
      if (markerOffset === null || !onToggleTask) return <li className={className} {...props}>{children}</li>;
      const replaceTaskInputs = (items: React.ReactNode): React.ReactNode => React.Children.map(items, child => {
        if (!React.isValidElement<{ type?: string; checked?: boolean; children?: React.ReactNode }>(child)) return child;
        // Loose list checkboxes live inside a paragraph; nested lists own their
        // own item callbacks and must not inherit this item's marker offset.
        if (child.type === "ul" || child.type === "ol") return child;
        if (child.props.type !== "checkbox") {
          return child.props.children
            ? React.cloneElement(child, { children: replaceTaskInputs(child.props.children) }) : child;
        }
        return (
          <input
            type="checkbox"
            checked={Boolean(child.props.checked)}
            aria-label={lang === "th" ? "ทำเครื่องหมายรายการ" : "Toggle task"}
            onClick={event => event.stopPropagation()}
            onChange={event => {
              event.stopPropagation();
              onToggleTask(markerOffset, event.currentTarget.checked);
            }}
            className="w-4 h-4 rounded border-neutral-700 text-indigo-600 bg-neutral-900 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer mr-2.5 align-middle accent-indigo-600 pointer-events-auto shrink-0"
          />
        );
      });
      return <li className={`${className || ""} list-none -ml-5 flex items-center gap-1.5 py-1`} {...props}>{replaceTaskInputs(children)}</li>;
    },
  }), [lang, markdown, onToggleTask, footnoteNumbers]);

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
      urlTransform={(url, key) => key === "src"
        ? isSafeImageUrl(url) ? url : ""
        : isSafeNoteLink(url) ? url : ""}
    >
      {tree ? "" : markdown}
    </ReactMarkdown>
  );
}
