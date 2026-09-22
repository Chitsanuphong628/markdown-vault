"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Sparkles, Loader2, Check } from "lucide-react";
import { Language } from "@/lib/i18n";

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
  }, [lang]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText("");
    } else {
      try {
        recognitionRef.current.lang = lang === "th" ? "th-TH" : "en-US";
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }
    }
  }, [isListening, lang]);

  useEffect(() => {
    const handleEditorVoiceCommand = () => toggleListening();
    window.addEventListener("nota:trigger-voice", handleEditorVoiceCommand);
    return () => window.removeEventListener("nota:trigger-voice", handleEditorVoiceCommand);
  }, [toggleListening]);

  if (!isSupported) {
    return null; // Graceful degradation on unsupported browsers
  }

  const label = lang === "th" ? (isListening ? "กำลังฟัง..." : "จดด้วยเสียง") : (isListening ? "Listening..." : "Voice Note");

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        title={lang === "th" ? "จดโน้ตด้วยเสียง (Voice Dictation)" : "Voice Dictation"}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
          isListening
            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm animate-pulse"
            : "bg-neutral-800/90 hover:bg-neutral-700/80 text-neutral-300 border border-neutral-700/50"
        } ${className}`}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <MicOff className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300">{label}</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200" />
            <span className="hidden sm:inline">{label}</span>
          </>
        )}
      </button>

      {/* Floating Interim transcription preview */}
      {isListening && interimText && (
        <div className="absolute top-full mt-2 left-0 z-50 min-w-[220px] max-w-sm bg-neutral-900/95 border border-rose-500/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-xs text-rose-200 italic animate-in fade-in">
          <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            {lang === "th" ? "กำลังประมวลผลคำพูด..." : "Transcribing..."}
          </div>
          &ldquo;{interimText}&rdquo;
        </div>
      )}
    </div>
  );
}
