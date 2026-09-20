"use client";

import { useEffect, useState } from "react";
import { ListCollapse } from "lucide-react";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: HeadingItem[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
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
    <div className="w-64 shrink-0 hidden xl:block pl-6 pr-2 py-4">
      <div className="sticky top-20 text-sm">
        <div className="flex items-center gap-2 font-semibold text-neutral-400 mb-3 text-xs uppercase tracking-wider">
          <ListCollapse className="w-4 h-4" />
          <span>สารบัญหัวข้อ (TOC)</span>
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
    </div>
  );
}
