"use client";

import { useState, useRef } from "react";
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle, Loader2, Database } from "lucide-react";
import { Language, I18N_MAIN } from "@/lib/i18n";
import { convertFileToMarkdown } from "@/lib/dataIngest";

const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".csv", ".tsv", ".json"];

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    file.type === "text/markdown" ||
    file.type === "text/csv" ||
    file.type === "application/json"
  );
}

interface DropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: { id: string; name: string }[];
  currentFolderId: string | null;
  onSuccess: () => void;
  lang?: Language;
}

export default function DropzoneModal({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onSuccess,
  lang = "en",
}: DropzoneModalProps) {
  const t = I18N_MAIN[lang];
  const [selectedFolder, setSelectedFolder] = useState<string>(currentFolderId || "");
  const [isDragging, setIsDragging] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter(isSupportedFile);
      setFilesToUpload((prev) => [...prev, ...validFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files).filter(isSupportedFile);
      setFilesToUpload((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFilesToUpload((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    setUploadStatus(null);

    try {
      for (const file of filesToUpload) {
        // Convert CSV, TSV, JSON, or MD to clean Markdown
        const { title, markdown } = await convertFileToMarkdown(file);

        await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content: markdown,
            folderId: selectedFolder || null,
          }),
        });
      }

      setFilesToUpload([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setUploadStatus("เกิดข้อผิดพลาดในการอัปโหลดไฟล์: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-neutral-100">{t.importModalTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Target Folder Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              {t.targetFolderLabel}
            </label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t.rootFolderOption}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                : "border-neutral-800 hover:border-neutral-700 bg-neutral-950/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".md,.markdown,.csv,.tsv,.json,text/markdown,text/csv,application/json"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-neutral-200 mb-1 text-center">
              {t.dragDropBoxTitle}
            </p>
            <p className="text-xs text-neutral-500 text-center">{t.dragDropBoxSub}</p>
          </div>

          {/* File List */}
          {filesToUpload.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-400">
                {t.selectedFilesTitle}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {filesToUpload.map((file, idx) => {
                  const isData = file.name.match(/\.(csv|tsv|json)$/i);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-neutral-950/80 px-3 py-2 rounded-lg border border-neutral-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isData ? (
                          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                        <span className="truncate text-neutral-300">{file.name}</span>
                        <span className="text-neutral-500 shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        className="text-neutral-500 hover:text-rose-400 p-1 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {uploadStatus && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950/60 border-t border-neutral-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            {t.cancelBtn}
          </button>
          <button
            onClick={handleStartUpload}
            disabled={filesToUpload.length === 0 || uploading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.importing}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {t.importAllBtn(filesToUpload.length)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
