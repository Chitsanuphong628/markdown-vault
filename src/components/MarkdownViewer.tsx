"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import hljs from "highlight.js";
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
import MermaidChart from "./MermaidChart";
import { Language, I18N_MAIN } from "@/lib/i18n";
import { parseNoteTheme, NOTE_THEMES } from "@/lib/noteTheme";

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
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children?: React.ReactNode;
}

function CodeBlock({ className, children, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;

  if (isInline) {
    return (
      <code className="bg-neutral-800/80 text-pink-400 font-mono text-[0.85em] px-1.5 py-0.5 rounded border border-neutral-700/50" {...props}>
        {children}
      </code>
    );
  }

  const rawCode = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";

  // If language is mermaid, render dynamic chart
  if (language === "mermaid") {
    return <MermaidChart chart={rawCode} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Perform Highlight.js colorization
  let highlightedHtml = "";
  if (language && hljs.getLanguage(language)) {
    try {
      highlightedHtml = hljs.highlight(rawCode, { language, ignoreIllegals: true }).value;
    } catch {
      highlightedHtml = hljs.highlightAuto(rawCode).value;
    }
  } else {
    try {
      highlightedHtml = hljs.highlightAuto(rawCode).value;
    } catch {
      highlightedHtml = rawCode;
    }
  }

  return (
    <div className="relative group my-5 rounded-2xl overflow-hidden border border-neutral-800 bg-[#1e1e2e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/90 border-b border-neutral-800/80 text-xs font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="uppercase tracking-wider font-semibold text-neutral-300 ml-2">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 text-xs cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>คัดลอก</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono">
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
    </div>
  );
}

export default function MarkdownViewer({ note, onUpdateContent, lang = "en" }: MarkdownViewerProps) {
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
  const { color, cleanContent } = useMemo(() => parseNoteTheme(content), [content]);
  const activeTheme = NOTE_THEMES[color] || NOTE_THEMES.default;

  // Reading time & word count statistics
  const stats = useMemo(() => {
    const trimmed = cleanContent.trim();
    const words = trimmed ? (trimmed.match(/\S+/g) || []).length : 0;
    const chars = trimmed.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [cleanContent]);

  // Extract headings for Table of Contents
  const headings = useMemo(() => {
    const lines = cleanContent.split("\n");
    const headingList: HeadingItem[] = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[#*`_~]/g, "");
        const id = text
          .toLowerCase()
          .replace(/[^\w\u0E00-\u0E7F\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");

        if (text && id) {
          headingList.push({ id, text, level });
        }
      }
    });

    return headingList;
  }, [content]);

  // Handle Precise Checkbox Toggle by Exact Line Number in AST
  const handleToggleExactLine = (lineNumber: number) => {
    const lines = content.split("\n");
    const targetIdx = lineNumber - 1;

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
  };

  // In-Document Search (Find Bar ⌘F) state
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const articleRef = useRef<HTMLElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<HTMLElement[]>([]);

  // Clear all highlights
  const clearHighlights = () => {
    if (!articleRef.current) return;
    const marks = articleRef.current.querySelectorAll("mark.nota-find-highlight");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      }
    });
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

  // Keyboard shortcut for Cmd/Ctrl + F, Escape, and custom toolbar event
  useEffect(() => {
    const handleOpenFind = () => {
      setIsFindOpen(true);
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
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
  }, [isFindOpen]);

  return (
    <div className={`flex-1 flex overflow-hidden min-h-0 relative ${activeTheme.editorBg} transition-colors duration-300`}>
      {/* Floating In-Document Find Bar (⌘F) */}
      {isFindOpen && (
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
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-9">
          {/* Document Header */}
          <div className="mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-400 mb-3">
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
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-100 leading-tight">
            {note.title}
          </h1>
        </div>

        {/* Markdown Render Area */}
        <article ref={articleRef} className="prose prose-invert prose-neutral max-w-none
          [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-neutral-800
          [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mt-8 [&>h2]:mb-3 [&>h2]:pb-1.5 [&>h2]:border-b [&>h2]:border-neutral-800/60
          [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-2
          [&>p]:text-neutral-300 [&>p]:leading-relaxed [&>p]:mb-4
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ul]:space-y-1.5 [&>ul]:text-neutral-300
          [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>ol]:space-y-1.5 [&>ol]:text-neutral-300
          [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-500/60 [&>blockquote]:pl-4 [&>blockquote]:py-1 [&>blockquote]:my-4 [&>blockquote]:text-neutral-400 [&>blockquote]:italic [&>blockquote]:bg-indigo-950/20 [&>blockquote]:rounded-r-lg
          [&>table]:w-full [&>table]:my-6 [&>table]:border-collapse [&>table]:border [&>table]:border-neutral-800
          [&_th]:border [&_th]:border-neutral-800 [&_th]:px-4 [&_th]:py-2.5 [&_th]:bg-neutral-900 [&_th]:text-neutral-200 [&_th]:text-left [&_th]:font-semibold
          [&_td]:border [&_td]:border-neutral-800 [&_td]:px-4 [&_td]:py-2 [&_td]:text-neutral-300
          [&>hr]:border-neutral-800 [&>hr]:my-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeSlug, rehypeKatex]}
            components={{
              code: CodeBlock,
              li: ({ node, children, className, ...props }: React.LiHTMLAttributes<HTMLLIElement> & { node?: { position?: { start?: { line?: number } } } }) => {
                const isTaskItem = className?.includes("task-list-item");
                const lineNumber = node?.position?.start?.line;

                if (isTaskItem && lineNumber) {
                  // Find checkbox inside children and clone it with proper lineNumber
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
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        </article>
        </div>
      </div>

      {/* Dynamic Table of Contents */}
      <TableOfContents headings={headings} lang={lang} />
    </div>
  );
}
