"use client";

import React from "react";
import { Menu } from "lucide-react";
import { I18N_MAIN, type Language } from "@/lib/i18n";

export function NoteContentSkeleton({ onOpenMobile, lang = "en" }: { onOpenMobile?: () => void; lang?: Language } = {}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d0e] relative overflow-hidden animate-pulse">
      {/* Top Toolbar Skeleton */}
      <div className="h-14 border-b border-neutral-800/80 px-3 sm:px-6 flex items-center justify-between bg-neutral-900/40 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 truncate min-w-0">
          {onOpenMobile && (
            <button
              type="button"
              onClick={onOpenMobile}
              className="md:hidden p-1.5 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 rounded-lg transition-colors cursor-pointer shrink-0"
              title={I18N_MAIN[lang].openNotes}
              aria-label={I18N_MAIN[lang].openNotes}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-neutral-800/90 border border-neutral-700/50 shrink-0" />
          <div className="h-6 w-44 sm:w-64 bg-neutral-800/80 rounded-lg" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="h-7 w-14 sm:w-16 bg-neutral-800/70 rounded-md" />
          <div className="h-7 w-16 sm:w-20 bg-neutral-800/70 rounded-md" />
        </div>
      </div>

      {/* Note Body Skeleton */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Title & Metadata row */}
        <div className="space-y-3 pb-2">
          <div className="h-8 sm:h-10 w-2/3 bg-neutral-800/90 rounded-xl" />
          <div className="flex items-center gap-4 pt-1">
            <div className="h-3.5 w-24 bg-neutral-800/60 rounded" />
            <div className="h-3.5 w-28 bg-neutral-800/60 rounded" />
            <div className="h-3.5 w-16 bg-neutral-800/60 rounded" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-800/60 my-4" />

        {/* Paragraph 1 */}
        <div className="space-y-2.5">
          <div className="h-4 w-full bg-neutral-800/70 rounded" />
          <div className="h-4 w-11/12 bg-neutral-800/70 rounded" />
          <div className="h-4 w-4/5 bg-neutral-800/70 rounded" />
        </div>

        {/* Section Heading */}
        <div className="h-6 w-1/3 bg-neutral-800/80 rounded-lg pt-2" />

        {/* Code block skeleton */}
        <div className="rounded-2xl overflow-hidden border border-neutral-800/80 bg-[#1e1e2e]/60 shadow-lg p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 inline-block" />
            </div>
            <div className="h-3 w-12 bg-neutral-800 rounded" />
          </div>
          <div className="h-3 w-3/4 bg-neutral-800/50 rounded pt-1" />
          <div className="h-3 w-1/2 bg-neutral-800/50 rounded" />
          <div className="h-3 w-2/3 bg-neutral-800/50 rounded" />
        </div>

        {/* Paragraph 2 */}
        <div className="space-y-2.5">
          <div className="h-4 w-full bg-neutral-800/70 rounded" />
          <div className="h-4 w-5/6 bg-neutral-800/70 rounded" />
          <div className="h-4 w-3/5 bg-neutral-800/70 rounded" />
        </div>
      </div>
    </div>
  );
}

export function AppLayoutSkeleton({ lang = "en" }: { lang?: Language } = {}) {
  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-200 flex overflow-hidden font-sans antialiased">
      {/* Sidebar Skeleton */}
      <aside className="w-64 sm:w-72 bg-neutral-900/60 border-r border-neutral-800/80 flex flex-col shrink-0 animate-pulse">
        {/* Brand Header */}
        <div className="h-14 border-b border-neutral-800/80 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/30" />
            <div className="h-5 w-20 bg-neutral-800/90 rounded-md" />
          </div>
          <div className="w-6 h-6 rounded-lg bg-neutral-800/60" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="px-3 pt-3">
          <div className="h-9 w-full bg-neutral-800/50 rounded-xl border border-neutral-800/80" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="p-3 grid grid-cols-2 gap-2">
          <div className="h-8 bg-neutral-800/60 rounded-xl" />
          <div className="h-8 bg-neutral-800/60 rounded-xl" />
        </div>

        {/* Nav Items Skeleton */}
        <div className="flex-1 px-3 space-y-4 overflow-hidden">
          <div className="space-y-2">
            <div className="h-2.5 w-16 bg-neutral-800/50 rounded ml-1" />
            <div className="h-8 w-full bg-neutral-800/60 rounded-lg" />
            <div className="h-8 w-full bg-neutral-800/40 rounded-lg" />
          </div>

          <div className="space-y-2 pt-2">
            <div className="h-2.5 w-20 bg-neutral-800/50 rounded ml-1" />
            <div className="h-8 w-full bg-neutral-800/70 rounded-lg" />
            <div className="h-8 w-full bg-neutral-800/40 rounded-lg" />
            <div className="h-8 w-full bg-neutral-800/30 rounded-lg" />
          </div>
        </div>

        {/* Footer User Info Skeleton */}
        <div className="h-14 border-t border-neutral-800/80 p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-800/80" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 bg-neutral-800/90 rounded" />
            <div className="h-2.5 w-32 bg-neutral-800/50 rounded" />
          </div>
        </div>
      </aside>

      {/* Main Note Area Skeleton */}
      <NoteContentSkeleton lang={lang} />
    </div>
  );
}
