"use client";

import { useEffect, useState } from "react";
import { ListCollapse } from "lucide-react";
import { Language } from "@/lib/i18n";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: HeadingItem[];
  lang?: Language;
}

export default function TableOfContents({ headings, lang = "en" }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -60% 0%" }
    );

    headings.forEach((heading) => {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="w-64 shrink-0 hidden xl:flex flex-col pl-6 pr-3 py-6 border-l border-neutral-800/60 bg-neutral-950/20 overflow-y-auto">
      <div className="text-sm">
        <div className="flex items-center gap-2 font-semibold text-neutral-400 mb-3.5 text-[11px] uppercase tracking-wider sticky top-0 bg-neutral-950/20 backdrop-blur-xs py-1">
          <ListCollapse className="w-3.5 h-3.5 text-indigo-400" />
          <span>{lang === "th" ? "สารบัญหัวข้อ (TOC)" : "Table of Contents"}</span>
        </div>
        <nav className="space-y-1.5 border-l border-neutral-800">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            return (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(heading.id)?.scrollIntoView({
                    behavior: "smooth",
                  });
                  setActiveId(heading.id);
                }}
                className={`block transition-all border-l-2 -ml-[2px] py-0.5 leading-snug ${
                  heading.level === 1
                    ? "pl-3 font-medium text-xs"
                    : heading.level === 2
                    ? "pl-5 text-xs"
                    : "pl-7 text-xs text-neutral-500"
                } ${
                  isActive
                    ? "border-indigo-500 text-indigo-400 font-semibold"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {heading.text}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
