"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

export interface AccountSettingsCopy {
  profileInfoTitle: string;
  accountSessionDescription: string;
  nameLabel: string;
  emailLabel: string;
  unnamedUser: string;
  signOutSectionTitle: string;
  signOutSectionDesc: string;
  logoutConfirm: string;
  signOutBtn: string;
  deleteAccountSectionTitle: string;
  deleteAccountSectionDesc: string;
  deleteAccountBtn: string;
  typeToConfirm: string;
  toConfirmDeletion: string;
  confirmDeleteBtn: string;
  cancelActionBtn: string;
  confirmEmail: string;
  accountDeleteError: string;
  deletingAccount: string;
}

export default function AccountSettingsPanel({
  user,
  copy,
  onClose,
  onAccountDeleted,
  onLogout,
}: {
  user: { id: string; name: string; email: string };
  copy: AccountSettingsCopy;
  onClose: () => void;
  onAccountDeleted?: () => void;
  onLogout?: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  const deleteAccount = async () => {
    if (confirmText !== user.email) {
      setError(copy.confirmEmail);
      return;
    }

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/delete-account", { method: "DELETE" });
      if (!response.ok) throw new Error("account-delete");
      onAccountDeleted?.();
    } catch {
      setError(copy.accountDeleteError);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold text-neutral-100 mb-1">{copy.profileInfoTitle}</h3>
        <p className="text-sm text-neutral-400 leading-relaxed">{copy.accountSessionDescription}</p>
      </div>

      <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">{copy.nameLabel}</span>
            <span className="text-sm font-semibold text-neutral-200">{user.name || copy.unnamedUser}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-1">{copy.emailLabel}</span>
            <span className="text-sm font-semibold text-neutral-200 font-mono">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-neutral-200 mb-1">{copy.signOutSectionTitle}</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">{copy.signOutSectionDesc}</p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={() => {
              if (confirm(copy.logoutConfirm)) {
                onClose();
                onLogout();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>{copy.signOutBtn}</span>
          </button>
        )}
      </div>

      <div className="bg-neutral-950/40 border border-rose-900/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-rose-400 mb-1">{copy.deleteAccountSectionTitle}</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">{copy.deleteAccountSectionDesc}</p>
          </div>
          {!showDeleteConfirm && (
            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-colors shrink-0 cursor-pointer">
              {copy.deleteAccountBtn}
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="pt-4 border-t border-rose-950/60 space-y-3">
            <p className="text-xs text-neutral-300">
              {copy.typeToConfirm}{" "}
              <code className="font-mono text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/40">{user.email}</code>{" "}
              {copy.toConfirmDeletion}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={user.email}
                className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono outline-none"
              />
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={confirmText !== user.email || isDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:hover:bg-rose-600 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? copy.deletingAccount : copy.confirmDeleteBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText("");
                  setError("");
                }}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors shrink-0 cursor-pointer"
              >
                {copy.cancelActionBtn}
              </button>
            </div>
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
