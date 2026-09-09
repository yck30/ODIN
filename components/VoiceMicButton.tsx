"use client";

import React, { useState } from "react";
import { useSpeechRecognition } from "@/lib/voice/useSpeechRecognition";

interface VoiceMicButtonProps {
  label: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceMicButton({ label, onTranscript, disabled = false }: VoiceMicButtonProps) {
  const { isSupported, isListening, statusText, interimTranscript, startListening, stopListening, error } =
    useSpeechRecognition();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || !isSupported) return;

    if (isListening) {
      stopListening();
    } else {
      startListening((finalText) => {
        onTranscript(finalText);
      });
    }
  };

  if (!isSupported) {
    return (
      <div className="relative inline-block" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
        <button
          type="button"
          disabled
          aria-label={`${label} voice dictation unavailable in this browser`}
          className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800/40 text-slate-500 border border-slate-700/50 cursor-not-allowed flex items-center gap-1.5 opacity-60"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          <span className="hidden sm:inline">Voice N/A</span>
        </button>
        {showTooltip && (
          <div className="absolute right-0 bottom-full mb-1 z-30 w-48 px-2 py-1 text-[10px] font-mono text-slate-300 bg-slate-900/95 border border-slate-700 rounded shadow-lg backdrop-blur-md pointer-events-none">
            Web Speech API not supported in this browser; typed input active (FR-14 fallback).
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      {isListening && (
        <span className="text-xs font-mono text-cyan-400 animate-pulse flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block"></span>
          {statusText || "Listening…"}
        </span>
      )}

      {interimTranscript && isListening && (
        <span className="hidden md:inline-block max-w-[180px] truncate text-[11px] font-mono text-cyan-300/70 italic">
          &quot;{interimTranscript}&quot;
        </span>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={isListening ? `Stop recording ${label}` : `Dictate ${label} by voice`}
        className={`px-2.5 py-1 text-xs font-mono rounded transition-all duration-200 flex items-center gap-1.5 border ${
          isListening
            ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)] scale-105"
            : "bg-slate-900/80 border-slate-700 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
      >
        <svg
          className={`w-3.5 h-3.5 ${isListening ? "text-cyan-400 animate-bounce" : "text-slate-400 group-hover:text-cyan-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span>{isListening ? "Stop" : "Dictate"}</span>
      </button>

      {error && (
        <div className="text-[10px] font-mono text-red-400 bg-red-950/60 border border-red-800/80 px-2 py-0.5 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
