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
      <div
        style={{ position: "relative", display: "inline-block" }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          type="button"
          disabled
          aria-label={`${label} voice dictation unavailable in this browser`}
          className="hud-button"
          style={{
            minHeight: "32px",
            padding: "0.25rem 0.65rem",
            fontSize: "0.72rem",
            opacity: 0.5,
            cursor: "not-allowed",
            color: "var(--text-muted)",
            borderColor: "rgba(255, 255, 255, 0.08)",
            background: "rgba(10, 16, 32, 0.5)",
          }}
        >
          <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          <span style={{ fontSize: "0.7rem" }}>Voice N/A</span>
        </button>
        {showTooltip && (
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 6px)",
              zIndex: 30,
              width: "200px",
              padding: "0.4rem 0.6rem",
              fontSize: "0.7rem",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              background: "rgba(8, 14, 30, 0.96)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "6px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              pointerEvents: "none",
            }}
          >
            Web Speech API not supported in this browser; typed input active (FR-14 fallback).
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      {isListening && (
        <span
          className="font-mono"
          style={{
            fontSize: "0.75rem",
            color: "var(--accent-cyan)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <span className="pulse-dot cyan" />
          {statusText || "Listening…"}
        </span>
      )}

      {interimTranscript && isListening && (
        <span
          className="font-mono"
          style={{
            fontSize: "0.72rem",
            color: "rgba(0, 240, 255, 0.7)",
            fontStyle: "italic",
            maxWidth: "180px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          &quot;{interimTranscript}&quot;
        </span>
      )}

      <div className="sonic-radar-container">
        {isListening && <span className="sonic-radar-ring" />}
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={isListening ? `Stop recording ${label}` : `Dictate ${label} by voice`}
          className={`hud-button ${isListening ? "hud-button-primary" : ""}`}
          style={{
            minHeight: "34px",
            padding: "0.3rem 0.8rem",
            fontSize: "0.75rem",
            ...(isListening
              ? {
                  borderColor: "var(--accent-cyan)",
                  color: "#ffffff",
                  boxShadow: "var(--glow-cyan-sm)",
                  transform: "scale(1.03)",
                }
              : {}),
          }}
        >
          <svg
            style={{ width: "14px", height: "14px" }}
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
          <span>{isListening ? "STOP" : "VOICE INPUT"}</span>
        </button>
      </div>

      {error && (
        <div
          className="font-mono"
          style={{
            fontSize: "0.7rem",
            color: "#fda4af",
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid var(--accent-rose)",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
