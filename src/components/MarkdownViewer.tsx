"use client";

import dynamic from "next/dynamic";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
import {
  Check,
  Copy,
  Calendar,
  Folder as FolderIcon,
  Clock,
  AlignLeft,
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import TableOfContents, { HeadingItem } from "./TableOfContents";
import { Language, I18N_DIAGRAM, I18N_MAIN } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import { parseNoteTheme, NOTE_THEMES } from "@/lib/noteTheme";
import { getShortcuts, matchesShortcut } from "@/lib/shortcuts";
import { GfmAlertMarkdownBlockquote } from "@/components/GfmAlertCard";

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

interface MarkdownViewerProps {
  note: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    folder?: { name: string } | null;
  };
  onUpdateContent?: (newContent: string) => Promise<void>;
  lang?: Language;
  showTitle?: boolean;
  preview?: boolean;
}

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

export default function MarkdownViewer({ note, onUpdateContent, lang = "en", showTitle = false, preview = false }: MarkdownViewerProps) {
  const t = I18N_MAIN[lang];
  // Synchronize internal content when note changes
  const [prevNoteId, setPrevNoteId] = useState(note.id);
  const [prevNoteContent, setPrevNoteContent] = useState(note.content);
  const [content, setContent] = useState(note.content);

  if (note.id !== prevNoteId || note.content !== prevNoteContent) {
    setPrevNoteId(note.id);
    setPrevNoteContent(note.content);
    setContent(note.content);
  }

  // Extract theme color and clean content without raw frontmatter
  const { color, cleanContent, lineOffset } = useMemo(() => parseNoteTheme(content), [content]);
  const activeTheme = NOTE_THEMES[color] || NOTE_THEMES.default;

  // Reading time & word count statistics
  const stats = useMemo(() => {
    const trimmed = cleanContent.trim();
    const words = trimmed ? (trimmed.match(/\S+/g) || []).length : 0;
    const chars = trimmed.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [cleanContent]);

  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  // Handle Precise Checkbox Toggle by Exact Line Number in AST
  const handleToggleExactLine = useCallback((lineNumber: number) => {
    const lines = content.split("\n");
    const targetIdx = lineNumber - 1 + lineOffset;

    if (targetIdx >= 0 && targetIdx < lines.length) {
      lines[targetIdx] = lines[targetIdx].replace(
        /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/,
        (match, prefix, check, suffix) => {
          const newCheck = check.toLowerCase() === "x" ? " " : "x";
          return `${prefix}${newCheck}${suffix}`;
        }
      );
    }

    const updated = lines.join("\n");
    setContent(updated);

    if (onUpdateContent) {
      onUpdateContent(updated);
    }
  }, [content, lineOffset, onUpdateContent]);

  // Memoized custom Markdown components
  const markdownComponents = useMemo(
    () => ({
      code: (props: CodeBlockProps) => <CodeBlock {...props} uiLanguage={lang} />,
      blockquote: ({ node, children, className, ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement> & {
        node?: { position?: { start?: { offset?: number }; end?: { offset?: number } } };
      }) => {
        return (
          <GfmAlertMarkdownBlockquote
            markdown={cleanContent}
            markdownNode={node}
            uiLanguage={lang}
            className={className}
            {...props}
          >
            {children}
          </GfmAlertMarkdownBlockquote>
        );
      },
      pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => {
        const child = React.Children.toArray(children)[0];
        if (React.isValidElement<CodeBlockProps>(child)) {
          return <CodeBlock block uiLanguage={lang} className={child.props.className}>{child.props.children}</CodeBlock>;
        }
        return <pre>{children}</pre>;
      },
      img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        // Remote images remain at their source; the note contains only the URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt || ""} loading="lazy" referrerPolicy="no-referrer" {...props} />
      ),
      li: ({
        node,
        children,
        className,
        ...props
      }: React.LiHTMLAttributes<HTMLLIElement> & {
        node?: { position?: { start?: { line?: number } } };
      }) => {
        const isTaskItem = className?.includes("task-list-item");
        const lineNumber = node?.position?.start?.line;

        if (isTaskItem && lineNumber && onUpdateContent && !preview) {
          const modifiedChildren = React.Children.map(children, (child) => {
            if (
              React.isValidElement(child) &&
              typeof child.props === "object" &&
              child.props !== null &&
              "type" in child.props &&
              (child.props as { type: string }).type === "checkbox"
            ) {
              const childProps = child.props as { checked?: boolean };
              return (
                <input
                  type="checkbox"
                  checked={Boolean(childProps.checked)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleExactLine(lineNumber);
                  }}
                  className="w-4 h-4 rounded border-neutral-700 text-indigo-600 bg-neutral-900 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer mr-2.5 align-middle accent-indigo-600 pointer-events-auto shrink-0"
                />
              );
            }
            return child;
          });

          return (
            <li
              className={`${className || ""} list-none -ml-5 flex items-center gap-1.5 py-1 cursor-pointer select-none`}
              onClick={() => handleToggleExactLine(lineNumber)}
              {...props}
            >
              {modifiedChildren}
            </li>
          );
        }

        return (
          <li className={className} {...props}>
            {children}
          </li>
        );
      },
    }),
    [cleanContent, handleToggleExactLine, lang, onUpdateContent, preview]
  );

  // Memoize ReactMarkdown rendering output so in-document search never triggers expensive re-parsing
  const renderedMarkdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={markdownComponents}
      >
        {cleanContent}
      </ReactMarkdown>
    ),
    [cleanContent, markdownComponents]
  );

  // In-Document Search (Find Bar ⌘F) state
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const articleRef = useRef<HTMLElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (preview || !articleRef.current) return;
    setHeadings(Array.from(articleRef.current.querySelectorAll("h1[id], h2[id], h3[id]")).map(element => ({
      id: element.id,
      text: element.textContent || "",
      level: Number(element.tagName.slice(1)),
    })));
  }, [cleanContent, preview]);

  // Clear all highlights
  const clearHighlights = () => {
    if (!articleRef.current) return;
    try {
      const marks = articleRef.current.querySelectorAll("mark.nota-find-highlight");
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent && parent.contains(mark)) {
          parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
          parent.normalize();
        }
      });
    } catch (err) {
      console.warn("clearHighlights DOM cleanup warning:", err);
    }
    matchesRef.current = [];
    setTotalMatches(0);
    setCurrentMatchIndex(0);
  };

  // Scroll to active match
  const scrollToMatch = (index: number) => {
    const marks = matchesRef.current;
    if (marks.length === 0 || index < 0 || index >= marks.length) return;

    marks.forEach((m, idx) => {
      if (idx === index) {
        m.classList.add("nota-find-active");
        m.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        m.classList.remove("nota-find-active");
      }
    });
  };

  // Highlight matches using TreeWalker
  useEffect(() => {
    const query = findQuery.trim();
    if (!isFindOpen || !query || !articleRef.current) {
      clearHighlights();
      return;
    }

    clearHighlights();

    const root = articleRef.current;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.textContent || !node.textContent.toLowerCase().includes(query.toLowerCase())) {
            return NodeFilter.FILTER_REJECT;
          }
          let parent = node.parentElement;
          while (parent && parent !== root) {
            const tag = parent.tagName.toLowerCase();
            // Skip code, script, style, and already highlighted marks
            if (tag === "code" || tag === "pre" || tag === "mark" || tag === "svg") {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    const createdMarks: HTMLElement[] = [];
    const lowerQuery = query.toLowerCase();

    textNodes.forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;

      const text = node.nodeValue || "";
      const lowerText = text.toLowerCase();
      let startIndex = 0;
      let matchIdx = lowerText.indexOf(lowerQuery, startIndex);

      if (matchIdx === -1) return;

      const fragment = document.createDocumentFragment();

      while (matchIdx !== -1) {
        if (matchIdx > startIndex) {
          fragment.appendChild(document.createTextNode(text.substring(startIndex, matchIdx)));
        }

        const mark = document.createElement("mark");
        mark.className = "nota-find-highlight";
        mark.textContent = text.substring(matchIdx, matchIdx + query.length);
        fragment.appendChild(mark);
        createdMarks.push(mark);

        startIndex = matchIdx + query.length;
        matchIdx = lowerText.indexOf(lowerQuery, startIndex);
      }

      if (startIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(startIndex)));
      }

      parent.replaceChild(fragment, node);
    });

    matchesRef.current = createdMarks;
    setTotalMatches(createdMarks.length);
    setCurrentMatchIndex(createdMarks.length > 0 ? 1 : 0);

    if (createdMarks.length > 0) {
      createdMarks[0].classList.add("nota-find-active");
      createdMarks[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [findQuery, isFindOpen, content, note.id]);

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    const nextIdx = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(nextIdx - 1);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    const prevIdx = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(prevIdx - 1);
  };

  const [findShortcut, setFindShortcut] = useState(() => getShortcuts().findInNote);

  useEffect(() => {
    const handleSync = () => setFindShortcut(getShortcuts().findInNote);
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  // Keyboard shortcut for Find in note, Escape, and custom toolbar event
  useEffect(() => {
    if (preview) return;
    const handleOpenFind = () => {
      setIsFindOpen(true);
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, findShortcut)) {
        e.preventDefault();
        handleOpenFind();
      } else if (e.key === "Escape" && isFindOpen) {
        e.preventDefault();
        setIsFindOpen(false);
        setFindQuery("");
        clearHighlights();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("nota:open-find", handleOpenFind);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("nota:open-find", handleOpenFind);
    };
  }, [isFindOpen, findShortcut, preview]);

  return (
    <div className={`flex-1 flex overflow-hidden min-h-0 relative ${activeTheme.editorBg} transition-colors duration-300`}>
      {/* Floating In-Document Find Bar */}
      {isFindOpen && !preview && (
        <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-6 z-30 bg-neutral-900 border border-neutral-750 shadow-2xl rounded-xl p-2 flex flex-wrap items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
          <div className="relative flex items-center w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 pointer-events-none" />
            <input
              ref={findInputRef}
              type="text"
              placeholder={t.findPlaceholder}
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevMatch();
                  } else {
                    handleNextMatch();
                  }
                }
              }}
              className="w-full sm:w-60 bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-neutral-100 text-xs placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Matches Counter */}
          <span className="text-[11px] font-mono text-neutral-400 min-w-[3.5rem] text-center select-none">
            {findQuery.trim()
              ? totalMatches > 0
                ? `${currentMatchIndex}/${totalMatches}`
                : t.noMatches
              : ""}
          </span>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Navigation Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handlePrevMatch}
              disabled={totalMatches === 0}
              title={t.prevMatch}
              className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={totalMatches === 0}
              title={t.nextMatch}
              className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              setIsFindOpen(false);
              setFindQuery("");
              clearHighlights();
            }}
            title={t.closeFind}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer ml-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Reading & Article Scroll Area */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className={`max-w-4xl mx-auto ${preview ? "px-4 py-4 sm:px-6 sm:py-6" : "px-4 py-6 sm:px-8 sm:py-9"}`}>
          {/* Document Header */}
          {!preview && <div className="mb-6 sm:mb-8 pb-4 sm:pb-5 border-b border-neutral-800/80">
            <div className={`flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-400 ${showTitle ? "mb-3" : ""}`}>
              {note.folder && (
                <span className="flex items-center gap-1.5 bg-neutral-800/80 px-2.5 py-1 rounded-md text-neutral-300 font-medium border border-neutral-700/50">
                  <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
                  {note.folder.name}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  {t.lastUpdatedLabel}:{" "}
                  {new Date(note.updatedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-700 hidden sm:inline-block" />
              <span className="flex items-center gap-1.5 text-neutral-400">
                <AlignLeft className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  {stats.words.toLocaleString()} {t.wordsLabel} ({stats.chars.toLocaleString()} {t.charsLabel})
                </span>
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-700 hidden sm:inline-block" />
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  ~{stats.readTimeMinutes} {t.readTimeLabel}
                </span>
              </span>
            </div>
            {showTitle && (
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-100 leading-tight">
                {note.title}
              </h1>
            )}
          </div>}

        {/* Markdown Render Area */}
        <article ref={articleRef} className="nota-markdown">
          {renderedMarkdown}
        </article>
        </div>
      </div>

      {/* Dynamic Table of Contents */}
      {!preview && <TableOfContents headings={headings} lang={lang} />}
    </div>
  );
}
