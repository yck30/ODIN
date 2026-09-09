"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API interface declarations for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  statusText: string;
  interimTranscript: string;
  startListening: (onFinalTranscript: (text: string) => void) => void;
  stopListening: () => void;
  error: string | null;
}

/**
 * Hook providing browser-native SpeechRecognition for voice intake.
 * Adheres to PRD §21.2 verbatim status strings:
 * - "Listening…"
 * - "Transcribing…"
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onFinalCallbackRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setStatusText("Listening…");
        setError(null);
      };

      recognition.onresult = (event: any) => {
        setStatusText("Transcribing…");
        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript;
          } else {
            interim += transcript;
          }
        }

        setInterimTranscript(interim);

        if (finalChunk && onFinalCallbackRef.current) {
          onFinalCallbackRef.current(finalChunk.trim());
          setStatusText("Listening…");
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("SpeechRecognition error:", event.error);
        if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please allow microphone access.");
        } else if (event.error === "no-speech") {
          // Expected on quiet periods; ignore
        } else {
          setError(`Voice input error: ${event.error}`);
        }
        setStatusText("");
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setStatusText("");
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // cleanup
        }
      }
    };
  }, []);

  const startListening = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      if (!recognitionRef.current) {
        setError("Speech recognition not supported in this browser.");
        return;
      }
      onFinalCallbackRef.current = onFinalTranscript;
      try {
        setError(null);
        setInterimTranscript("");
        recognitionRef.current.start();
      } catch (err: any) {
        // If already started, stop and restart
        if (err.name === "InvalidStateError") {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error(e);
            }
          }, 200);
        } else {
          setError(err.message || "Failed to start microphone.");
        }
      }
    },
    []
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setStatusText("");
    setInterimTranscript("");
  }, []);

  return {
    isSupported,
    isListening,
    statusText,
    interimTranscript,
    startListening,
    stopListening,
    error,
  };
}
