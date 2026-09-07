import { GoogleGenAI, type Schema } from "@google/genai";
import type {
  DecisionIntake,
  QuantOutput,
  StrategistOutput,
  BehavioristOutput,
  JudgeOutput,
  FullAnalysisResult,
} from "./types";
import {
  QUANT_SCHEMA,
  STRATEGIST_SCHEMA,
  BEHAVIORIST_SCHEMA,
  JUDGE_SCHEMA,
} from "./schemas";
import {
  QUANT_SYSTEM_PROMPT,
  STRATEGIST_SYSTEM_PROMPT,
  BEHAVIORIST_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
  formatPersonaIntakePrompt,
  formatJudgePrompt,
} from "./prompts";

/**
 * Resolves and normalizes the active Gemini model.
 * If GEMINI_MODEL is unset or specifies a deprecated model (e.g. gemini-2.5-flash or gemini-1.5-flash),
 * it automatically maps to the active standard: gemini-3.6-flash.
 */
export function getActiveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (!envModel || envModel.includes("gemini-2.5") || envModel.includes("gemini-1.5")) {
    return "gemini-3.6-flash";
  }
  return envModel;
}

export const PINNED_GEMINI_MODEL = getActiveGeminiModel();

/**
 * Progress update callback signature
 */
export type ProgressCallback = (step: number, totalSteps: number, statusMessage: string) => void;

/**
 * Sleep helper for rate-limit pacing and backoff retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Robust execution wrapper with exponential backoff and automatic deprecated model upgrade
 */
async function callGeminiWithRetry<T>(
  ai: GoogleGenAI,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Schema,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  let currentModel = getActiveGeminiModel();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2, // Low temperature for deterministic analysis
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned an empty response body.");
      }

      return JSON.parse(responseText) as T;
    } catch (err: unknown) {
      lastError = err;
      const errString = String(err);

      // If the upstream API indicates model is deprecated or not available, automatically switch to gemini-3.6-flash
      if (errString.includes("no longer available") || (errString.includes("404") && currentModel !== "gemini-3.6-flash")) {
        console.warn(`[O.D.I.N. Engine] Model '${currentModel}' unavailable. Upgrading to 'gemini-3.6-flash' and retrying immediately...`);
        currentModel = "gemini-3.6-flash";
        continue;
      }

      const isRateLimitOrUnavailable =
        errString.includes("429") ||
        errString.includes("RESOURCE_EXHAUSTED") ||
        errString.includes("503") ||
        errString.includes("UNAVAILABLE");

      if (isRateLimitOrUnavailable && attempt < maxRetries) {
        const backoffSec = Math.pow(2, attempt + 2) + 1; // 5s, 9s, 17s
        console.warn(`[O.D.I.N. Engine] Rate limit hit (attempt ${attempt + 1}/${maxRetries}). Retrying in ${backoffSec}s...`);
        await sleep(backoffSec * 1000);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

export async function runQuant(ai: GoogleGenAI, intake: DecisionIntake): Promise<QuantOutput> {
  const prompt = formatPersonaIntakePrompt(intake);
  return callGeminiWithRetry<QuantOutput>(ai, QUANT_SYSTEM_PROMPT, prompt, QUANT_SCHEMA);
}

export async function runStrategist(ai: GoogleGenAI, intake: DecisionIntake): Promise<StrategistOutput> {
  const prompt = formatPersonaIntakePrompt(intake);
  return callGeminiWithRetry<StrategistOutput>(ai, STRATEGIST_SYSTEM_PROMPT, prompt, STRATEGIST_SCHEMA);
}

export async function runBehaviorist(ai: GoogleGenAI, intake: DecisionIntake): Promise<BehavioristOutput> {
  const prompt = formatPersonaIntakePrompt(intake);
  return callGeminiWithRetry<BehavioristOutput>(ai, BEHAVIORIST_SYSTEM_PROMPT, prompt, BEHAVIORIST_SCHEMA);
}

export async function runJudge(
  ai: GoogleGenAI,
  quant: QuantOutput,
  strat: StrategistOutput,
  behav: BehavioristOutput
): Promise<JudgeOutput> {
  const prompt = formatJudgePrompt(quant, strat, behav);
  return callGeminiWithRetry<JudgeOutput>(ai, JUDGE_SYSTEM_PROMPT, prompt, JUDGE_SCHEMA);
}

/**
 * Executes the complete 4-persona sequential cognitive engine.
 * Sequenced with gentle 2-second pacing pauses to respect free-tier RPM limits.
 */
export async function executeSequentialAnalysis(
  intake: DecisionIntake,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<FullAnalysisResult> {
  const startTime = Date.now();
  const ai = new GoogleGenAI({ apiKey });

  // 1. The Quant
  onProgress?.(1, 4, "The Quant is estimating expected values and probability trees...");
  const quant = await runQuant(ai, intake);
  await sleep(2000); // Pacing delay

  // 2. The Strategist
  onProgress?.(2, 4, "The Strategist is evaluating reversibility and adversarial moves...");
  const strategist = await runStrategist(ai, intake);
  await sleep(2000); // Pacing delay

  // 3. The Behaviorist
  onProgress?.(3, 4, "The Behaviorist is auditing cognitive biases and psychological blind spots...");
  const behaviorist = await runBehaviorist(ai, intake);
  await sleep(2000); // Pacing delay

  // 4. The Judge
  onProgress?.(4, 4, "The Judge is synthesizing first principles and arbitrating next actions...");
  const judge = await runJudge(ai, quant, strategist, behaviorist);

  const totalDurationMs = Date.now() - startTime;

  return {
    intake,
    quant,
    strategist,
    behaviorist,
    judge,
    metadata: {
      model: getActiveGeminiModel(),
      timestamp: new Date().toISOString(),
      totalDurationMs,
    },
  };
}
