"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  X,
  Cpu,
  User,
  Globe,
  Database,
  Keyboard,
  RotateCcw,
} from "lucide-react";
import { I18N_MAIN } from "@/modules/app-shell/shared";
import type { Language } from "@/shared/language";
import { McpSettingsPanel } from "@/modules/mcp/client";
import { AccountSettingsPanel } from "@/modules/identity/client";
import {
  DEFAULT_SHORTCUTS,
  ShortcutActionId,
  getShortcuts,
  saveShortcut,
  resetShortcuts,
  formatComboDisplay,
  eventToKeyCombo,
} from "../shortcuts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string };
  notes?: Array<{ id: string; title: string; folderId: string | null }>;
  folders?: Array<{ id: string; name: string }>;
  renderNotesExport?: ReactNode;
  onAccountDeleted?: () => void;
  onLogout?: () => void;
  lang?: Language;
  setLang?: (lang: Language) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  notes = [],
  folders = [],
  renderNotesExport,
  onAccountDeleted,
  onLogout,
  lang = "en",
  setLang,
}: SettingsModalProps) {
  const t = I18N_MAIN[lang] || I18N_MAIN.en;
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts" | "account" | "data" | "mcp">("general");

  // Keyboard shortcuts state
  const [shortcuts, setShortcuts] = useState<Record<ShortcutActionId, string>>(() => getShortcuts());
  const [recordingActionId, setRecordingActionId] = useState<ShortcutActionId | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Synchronize shortcuts from storage on open or custom event
  useEffect(() => {
    const handleSync = () => setShortcuts(getShortcuts());
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  // Listen for key recording when customizing a shortcut
  useEffect(() => {
    if (!isOpen || !recordingActionId) return;

    const handleRecordKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingActionId(null);
        setConflictWarning(null);
        return;
      }

      const combo = eventToKeyCombo(e);
      if (!combo) return; // User pressed only modifier key (e.g. Cmd alone)

      // Conflict detection
      const conflictingId = (Object.keys(shortcuts) as ShortcutActionId[]).find(
        (id) => id !== recordingActionId && shortcuts[id] === combo
      );

      if (conflictingId) {
        const meta = DEFAULT_SHORTCUTS[conflictingId];
        const actionLabel = meta.label[lang] || meta.label.en;
        setConflictWarning(`${t.shortcutsConflict} "${actionLabel}"`);
      } else {
        setConflictWarning(null);
      }

      saveShortcut(recordingActionId, combo);
      setShortcuts(getShortcuts());
      setRecordingActionId(null);
    };

    window.addEventListener("keydown", handleRecordKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleRecordKey, { capture: true });
    };
  }, [isOpen, recordingActionId, shortcuts, lang, t]);

  // Close on Escape key (only when NOT recording a shortcut)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (recordingActionId) {
          // Handled by key recorder
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, recordingActionId]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-[620px] sm:max-w-4xl bg-neutral-900 border-0 sm:border border-neutral-800 rounded-none sm:rounded-xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[90vh] cursor-default font-sans antialiased text-neutral-200"
      >
        {/* Top Bar (Height 56px, 8pt alignment) */}
        <div className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between bg-neutral-900 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base tracking-tight text-neutral-100">
              {t.settingsTitle}
            </h2>
            <kbd className="hidden sm:inline-block text-[11px] text-neutral-400 font-mono bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeBtn}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Navigation Sidebar (Width 224px / 28x8pt) */}
          <aside className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-neutral-800 bg-neutral-950/60 p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible shrink-0">
            <div className="hidden sm:block text-[11px] font-medium uppercase tracking-wider text-neutral-400 px-3 py-2">
              {t.tabPreferences}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "general"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabGeneral}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shortcuts")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "shortcuts"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Keyboard className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabShortcuts}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "account"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <User className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabAccount}</span>
            </button>

            <div className="hidden sm:block text-[11px] font-medium uppercase tracking-wider text-neutral-400 px-3 pt-4 pb-2">
              {t.tabDataGroup}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "data"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Database className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabVault}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mcp")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none text-left w-max shrink-0 whitespace-nowrap sm:w-full ${
                activeTab === "mcp"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
            >
              <Cpu className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{t.tabMcp}</span>
            </button>
          </aside>

          {/* Right Content View (Padding 24px / 3x8pt, Spacing 24px) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "general" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    {t.langPrefTitle}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {t.langPrefDesc}
                  </p>
                </div>

                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-300">
                    {t.interfaceLanguage}
                  </span>
                  <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-700 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLang && setLang("en")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        lang === "en"
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang && setLang("th")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        lang === "th"
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      ภาษาไทย
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "shortcuts" && (
              <div className="space-y-6 max-w-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-100 mb-1">
                      {t.shortcutsTitle}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {t.shortcutsDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetShortcuts();
                      setShortcuts(getShortcuts());
                      setConflictWarning(null);
                      setRecordingActionId(null);
                    }}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium border border-neutral-700/60 transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.shortcutsResetBtn}</span>
                  </button>
                </div>

                {conflictWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between animate-in fade-in">
                    <span>{conflictWarning}</span>
                    <button
                      type="button"
                      onClick={() => setConflictWarning(null)}
                      className="text-amber-400 hover:text-amber-200 font-semibold ml-2 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl divide-y divide-neutral-800/80 overflow-hidden">
                  {(Object.keys(DEFAULT_SHORTCUTS) as ShortcutActionId[]).map((actionId) => {
                    const meta = DEFAULT_SHORTCUTS[actionId];
                    const isRecording = recordingActionId === actionId;
                    const currentCombo = shortcuts[actionId] || meta.defaultKey;
                    const displayCombo = formatComboDisplay(currentCombo);

                    return (
                      <div
                        key={actionId}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                          isRecording ? "bg-indigo-950/20" : "hover:bg-neutral-900/40"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-neutral-200">
                            {meta.label[lang] || meta.label.en}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {meta.desc[lang] || meta.desc.en}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          {isRecording ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/50 rounded-lg text-xs font-mono text-indigo-300 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                                {t.shortcutsRecording}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRecordingActionId(null)}
                                className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                              >
                                {t.shortcutsCancelRecord}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <kbd className="px-2.5 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-mono font-medium text-neutral-200 shadow-xs min-w-[50px] text-center tracking-wide">
                                {displayCombo}
                              </kbd>
                              <button
                                type="button"
                                onClick={() => {
                                  setConflictWarning(null);
                                  setRecordingActionId(actionId);
                                }}
                                className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              >
                                {t.shortcutsChangeBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 px-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-neutral-600" />
                  <span>{t.shortcutsModifierHint}</span>
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <AccountSettingsPanel
                user={user}
                onClose={onClose}
                onLogout={onLogout}
                onAccountDeleted={onAccountDeleted}
                copy={{
                  profileInfoTitle: t.profileInfoTitle,
                  accountSessionDescription: t.accountSessionDescription,
                  nameLabel: t.nameLabel,
                  emailLabel: t.emailLabel,
                  unnamedUser: t.unnamedUser,
                  signOutSectionTitle: t.signOutSectionTitle,
                  signOutSectionDesc: t.signOutSectionDesc,
                  logoutConfirm: t.logoutConfirm,
                  signOutBtn: t.signOutBtn,
                  deleteAccountSectionTitle: t.deleteAccountSectionTitle,
                  deleteAccountSectionDesc: t.deleteAccountSectionDesc,
                  deleteAccountBtn: t.deleteAccountBtn,
                  typeToConfirm: t.typeToConfirm,
                  toConfirmDeletion: t.toConfirmDeletion,
                  confirmDeleteBtn: t.confirmDeleteBtn,
                  cancelActionBtn: t.cancelActionBtn,
                  confirmEmail: t.confirmEmail,
                  accountDeleteError: t.accountDeleteError,
                  deletingAccount: t.deletingAccount,
                }}
              />
            )}

            <div className={activeTab === "data" ? "space-y-6 max-w-2xl" : "hidden"}>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-1">
                    {t.tabVault}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {t.storedNotesDescription}
                  </p>
                </div>

                {/* Storage Stats Grid (8pt Grid) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-950/40 border border-neutral-800 rounded-xl">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                      {t.totalDocsLabel}
                    </span>
                    <span className="text-2xl font-bold font-mono text-neutral-100">
                      {notes.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-neutral-950/40 border border-neutral-800 rounded-xl">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">
                      {t.totalFoldersLabel}
                    </span>
                    <span className="text-2xl font-bold font-mono text-neutral-100">
                      {folders.length.toLocaleString()}
                    </span>
                  </div>
                </div>

                {renderNotesExport}
            </div>

            <div className={activeTab === "mcp" ? "" : "hidden"}>
              <McpSettingsPanel lang={lang} isActive={activeTab === "mcp"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
