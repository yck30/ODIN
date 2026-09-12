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
      <div
        className="hud-card"
        style={{
          padding: "0.85rem 1.1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        <span className="font-mono">Audio Readout: Web Speech API unsupported on this browser (typed-only fallback active).</span>
        <span className="status-pill warning">FR-14 Fallback</span>
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
    <div
      className="hud-card"
      style={{
        padding: "1rem 1.25rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        border: "1px solid var(--border-medium)",
        boxShadow: isSpeaking && !isPaused ? "var(--glow-cyan-sm)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1 1 280px" }}>
        {/* Animated Cybernetic Spectrum Visualizer / Speaker */}
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            background: "rgba(0, 240, 255, 0.08)",
            border: "1px solid var(--border-medium)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isSpeaking && !isPaused ? "var(--glow-cyan-sm)" : "none",
            flexShrink: 0,
          }}
        >
          {isSpeaking && !isPaused ? (
            <div className="eq-spectrum">
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
            </div>
          ) : (
            <svg style={{ width: "18px", height: "18px", color: "var(--accent-cyan)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </div>

        <div>
          <div className="font-mono" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span>O.D.I.N. TACTICAL VOICE READBACK</span>
            {isSpeaking && !isPaused && (
              <span className="status-pill cyan" style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem" }}>
                TRANSMITTING
              </span>
            )}
            {isPaused && (
              <span className="status-pill warning" style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem" }}>
                PAUSED
              </span>
            )}
          </div>
          <p className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            {isSpeaking
              ? isPaused
                ? "Audio playback suspended. Click resume to continue."
                : "Reading Judge synthesis and 3 sequenced next actions via Web Speech API."
              : "Synthesize First Principles verdict & tactical action sequence."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={handleToggle}
          className={`hud-button ${isSpeaking && !isPaused ? "hud-button-primary" : ""}`}
          style={{ minHeight: "38px" }}
        >
          {isSpeaking && !isPaused ? (
            <>
              <svg style={{ width: "14px", height: "14px" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              <span>Pause Readout</span>
            </>
          ) : isPaused ? (
            <>
              <svg style={{ width: "14px", height: "14px" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Resume Readout</span>
            </>
          ) : (
            <>
              <svg style={{ width: "14px", height: "14px" }} fill="currentColor" viewBox="0 0 24 24">
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
            className="hud-button hud-button-danger"
            style={{ minHeight: "38px", padding: "0.6rem 0.8rem" }}
            title="Stop audio readout"
          >
            <svg style={{ width: "14px", height: "14px" }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
