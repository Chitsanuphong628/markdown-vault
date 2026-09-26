"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { I18N_MAIN, Language } from "@/lib/i18n";
import { getShortcuts, matchesShortcut, formatComboDisplay } from "@/lib/shortcuts";

interface VoiceDictationButtonProps {
  lang: Language;
  onTranscript: (text: string) => void;
  className?: string;
}

export default function VoiceDictationButton({
  lang,
  onTranscript,
  className = "",
}: VoiceDictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [speechError, setSpeechError] = useState("");
  const t = I18N_MAIN[lang];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    // Check if SpeechRecognition is available in window
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === "th" ? "th-TH" : "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalStr += transcript;
        } else {
          interimStr += transcript;
        }
      }

      if (finalStr.trim()) {
        onTranscriptRef.current(finalStr.trim());
      }
      setInterimText(interimStr);
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? t.voicePermissionError
          : event.error === "audio-capture"
            ? t.voiceMicError
            : event.error === "network"
              ? t.voiceNetworkError
              : t.voiceStartError;
        setSpeechError(message);
      }
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore cleanup stop errors
      }
    };
  }, [lang, t]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText("");
    } else {
      try {
        setSpeechError("");
        recognitionRef.current.lang = lang === "th" ? "th-TH" : "en-US";
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
        setSpeechError(t.voiceStartError);
      }
    }
  }, [isListening, lang, t]);

  const [voiceShortcut, setVoiceShortcut] = useState(() => getShortcuts().voice);

  useEffect(() => {
    const handleSync = () => setVoiceShortcut(getShortcuts().voice);
    window.addEventListener("nota:shortcuts-changed", handleSync);
    return () => window.removeEventListener("nota:shortcuts-changed", handleSync);
  }, []);

  useEffect(() => {
    const handleEditorVoiceCommand = () => toggleListening();
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCustomMatch = matchesShortcut(e, voiceShortcut);
      const isCmdJ = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j";

      if (isCustomMatch || isCmdJ) {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener("nota:trigger-voice", handleEditorVoiceCommand);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("nota:trigger-voice", handleEditorVoiceCommand);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleListening, voiceShortcut]);

  if (!isSupported) {
    return null; // Graceful degradation on unsupported browsers
  }

  const displayKey = formatComboDisplay(voiceShortcut) || "⌥Space";
  const label = isListening ? t.listening : t.voiceNote;
  const shortcutHint = `${displayKey} ${lang === "th" ? "หรือ" : "or"} ⌘J`;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        title={`${label} (${shortcutHint})`}
        aria-label={label}
        aria-pressed={isListening}
        className={`flex h-10 w-10 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer sm:w-auto sm:px-3 ${
          isListening
            ? "bg-rose-500/15 text-rose-300 border border-rose-500/40"
            : "bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50"
        } ${className}`}
      >
        {isListening ? (
          <>
            <span className="flex h-2 w-2 rounded-full bg-rose-400 sm:hidden" aria-hidden="true" />
            <MicOff className="hidden h-3.5 w-3.5 text-rose-400 sm:block" />
            <span className="text-rose-300">{label}</span>
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 text-neutral-400" />
            <span className="hidden sm:inline">{label}</span>
          </>
        )}
      </button>

      {/* Floating Interim transcription preview */}
      {isListening && interimText && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] max-w-sm rounded-lg border border-rose-500/40 bg-neutral-900 p-2.5 text-xs italic text-rose-200 shadow-xl">
          <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold uppercase tracking-wider mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            {t.transcribing}
          </div>
          &ldquo;{interimText}&rdquo;
        </div>
      )}
      {speechError && <span role="alert" className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-rose-500/40 bg-neutral-900 p-2.5 text-xs text-rose-200 shadow-xl">{speechError}</span>}
    </div>
  );
}
