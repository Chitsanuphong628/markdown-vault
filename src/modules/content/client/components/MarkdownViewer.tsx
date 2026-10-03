"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Calendar, Folder as FolderIcon, Clock, AlignLeft, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import TableOfContents, { type HeadingItem } from "./TableOfContents";
import { getShortcuts, matchesShortcut } from "@/modules/app-shell/client";
import { I18N_MAIN } from "@/modules/app-shell/shared";
import { parseNoteTheme, NOTE_THEMES } from "@/modules/content/shared";
import type { Language } from "@/shared/language";
import { MarkdownContent } from "./MarkdownContent";

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

  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const handleToggleTask = useCallback((markerOffset: number, checked: boolean) => {
    // The renderer reports an offset into cleanContent. Replace only the marker,
    // preserving line endings and every unrelated character in the original note.
    const cleanStart = content.length - cleanContent.length;
    const offset = cleanStart + markerOffset;
    if (content[offset] !== " " && !/[xX]/.test(content[offset] || "")) return;
    const updated = content.slice(0, offset) + (checked ? "x" : " ") + content.slice(offset + 1);
    setContent(updated);
    void onUpdateContent?.(updated);
  }, [content, cleanContent, onUpdateContent]);

  const renderedMarkdown = useMemo(() => (
    <MarkdownContent
      markdown={cleanContent}
      lang={lang}
      onToggleTask={onUpdateContent && !preview ? handleToggleTask : undefined}
      showFootnoteAppendix
    />
  ), [cleanContent, lang, onUpdateContent, preview, handleToggleTask]);

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
