"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  currentSpeechText: string;
  speakText: (text: string) => void;
  speakJudgeVerdict: (synthesis: string, nextActions: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * Hook providing browser-native SpeechSynthesis for reading out Judge verdicts (FR-13).
 * Pitch & Rate tuned to match the tactical command HUD aesthetic.
 */
export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSpeechText, setCurrentSpeechText] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      if (!synthRef.current) return;
      const voices = synthRef.current.getVoices();
      if (voices.length === 0) return;

      // Prefer sophisticated English voice (UK, Ireland, or robotic/neutral US)
      const preferred =
        voices.find((v) => v.lang.includes("en-GB") && v.name.toLowerCase().includes("male")) ||
        voices.find((v) => v.name.includes("Google UK English")) ||
        voices.find((v) => v.name.includes("Daniel") || v.name.includes("Ryan")) ||
        voices.find((v) => v.lang.startsWith("en-GB")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      setSelectedVoice(preferred || null);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSpeechText("");
  }, []);

  const pause = useCallback(() => {
    if (synthRef.current && isSpeaking && !isPaused) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const speakText = useCallback(
    (text: string) => {
      if (!synthRef.current || !text) return;

      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 1.02; // Clean, measured pace
      utterance.pitch = 0.96; // Slightly grounded tone

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setCurrentSpeechText(text);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentSpeechText("");
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis utterance error:", e);
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentSpeechText("");
      };

      synthRef.current.speak(utterance);
    },
    [selectedVoice]
  );

  const speakJudgeVerdict = useCallback(
    (synthesis: string, nextActions: string[]) => {
      // Build sequenced script per PRD FR-13:
      // "SpeechSynthesis reads back at least the Judge's synthesis and next_3_actions."
      const cleanSynthesis = synthesis
        .replace(/[#*_`]/g, "") // Strip markdown formatting
        .trim();

      const actionsText = nextActions
        .map((act, i) => `Action ${i + 1}: ${act.replace(/[#*_`]/g, "").trim()}.`)
        .join(" ");

      const fullScript = `First Principles Verdict and Synthesis. ${cleanSynthesis}. Sequenced Next Three Actions. ${actionsText}`;
      speakText(fullScript);
    },
    [speakText]
  );

  return {
    isSupported,
    isSpeaking,
    isPaused,
    currentSpeechText,
    speakText,
    speakJudgeVerdict,
    pause,
    resume,
    stop,
  };
}
