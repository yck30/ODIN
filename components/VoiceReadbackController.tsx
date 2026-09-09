"use client";

import React from "react";
import { useSpeechSynthesis } from "@/lib/voice/useSpeechSynthesis";

interface VoiceReadbackControllerProps {
  synthesis: string;
  nextActions: string[];
}

export default function VoiceReadbackController({ synthesis, nextActions }: VoiceReadbackControllerProps) {
  const { isSupported, isSpeaking, isPaused, speakJudgeVerdict, pause, resume, stop } = useSpeechSynthesis();

  if (!isSupported) {
    return (
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-500 flex items-center justify-between">
        <span>Audio Readout: Web Speech API unsupported on this browser (typed-only fallback active).</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-600 border border-slate-700/60 px-1.5 py-0.5 rounded">
          FR-14 Fallback
        </span>
      </div>
    );
  }

  const handleToggle = () => {
    if (isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      speakJudgeVerdict(synthesis, nextActions);
    }
  };

  return (
    <div className="p-3.5 bg-slate-950/80 border border-cyan-500/30 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.12)] flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Equalizer / Speaker Icon */}
        <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
          {isSpeaking && !isPaused ? (
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-1 bg-cyan-400 animate-[eqBar1_0.8s_ease-in-out_infinite] rounded-full h-3"></span>
              <span className="w-1 bg-cyan-300 animate-[eqBar2_0.6s_ease-in-out_infinite] rounded-full h-4"></span>
              <span className="w-1 bg-cyan-400 animate-[eqBar3_0.9s_ease-in-out_infinite] rounded-full h-2"></span>
              <span className="w-1 bg-cyan-300 animate-[eqBar1_0.7s_ease-in-out_infinite] rounded-full h-3.5"></span>
            </div>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </div>

        <div>
          <div className="text-xs font-mono font-semibold text-cyan-200 tracking-wide flex items-center gap-2">
            JARVIS VOICE ARBITRATION READBACK
            {isSpeaking && !isPaused && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 animate-pulse">
                TRANSMITTING
              </span>
            )}
            {isPaused && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-900/60 text-amber-300 border border-amber-500/40">
                PAUSED
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            {isSpeaking
              ? isPaused
                ? "Audio playback suspended. Click resume to continue."
                : "Reading Judge synthesis and 3 sequenced next actions via Web Speech API."
              : "Vocalize First Principles verdict & tactical action sequence."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200 flex items-center gap-2 border ${
            isSpeaking && !isPaused
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              : "bg-cyan-950/60 border-cyan-500/50 hover:bg-cyan-900/70 text-cyan-300 hover:border-cyan-400"
          } active:scale-95 cursor-pointer`}
        >
          {isSpeaking && !isPaused ? (
            <>
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              <span>Pause Readout</span>
            </>
          ) : isPaused ? (
            <>
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Resume Readout</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Vocalize Verdict</span>
            </>
          )}
        </button>

        {isSpeaking && (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop audio readback"
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-900 border border-slate-700 hover:border-red-500/60 text-slate-400 hover:text-red-300 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
