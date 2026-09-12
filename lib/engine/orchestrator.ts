import { GoogleGenAI, type Schema } from "@google/genai";
import type {
  DecisionIntake,
  QuantOutput,
  StrategistOutput,
  BehavioristOutput,
  JudgeOutput,
  PastContextItem,
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
 * Defaults to 'gemini-3.5-flash-lite' for robust free-tier throughput and high RPM limits.
 * If GEMINI_MODEL specifies a deprecated model (e.g. gemini-2.5-flash or gemini-1.5-flash),
 * it automatically maps to 'gemini-3.5-flash-lite'.
 */
export function getActiveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (!envModel || envModel.includes("gemini-2.5") || envModel.includes("gemini-1.5")) {
    return "gemini-3.5-flash-lite";
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
 * Robust execution wrapper with exponential backoff, seamless free-tier model failover,
 * and live cooldown progress reporting.
 */
async function callGeminiWithRetry<T>(
  ai: GoogleGenAI,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: Schema,
  maxRetries = 3,
  onStatusUpdate?: (statusMessage: string) => void
): Promise<{ data: T; modelUsed: string }> {
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

      return { data: JSON.parse(responseText) as T, modelUsed: currentModel };
    } catch (err: unknown) {
      lastError = err;
      const errString = String(err);

      // 1. If upstream API indicates model is deprecated or not available, failover to gemini-3.5-flash-lite
      if (
        errString.includes("no longer available") ||
        (errString.includes("404") && currentModel !== "gemini-3.5-flash-lite")
      ) {
        console.warn(
          `[O.D.I.N. Engine] Model '${currentModel}' unavailable. Switching to 'gemini-3.5-flash-lite' and retrying immediately...`
        );
        onStatusUpdate?.(`Model ${currentModel} unavailable. Switching to gemini-3.5-flash-lite...`);
        currentModel = "gemini-3.5-flash-lite";
        continue;
      }

      // 2. Handle rate limits and quota exhaustion
      const isRateLimitOrUnavailable =
        errString.includes("429") ||
        errString.includes("RESOURCE_EXHAUSTED") ||
        errString.includes("503") ||
        errString.includes("UNAVAILABLE") ||
        errString.toLowerCase().includes("quota exceeded");

      if (isRateLimitOrUnavailable) {
        // If 3.6-flash hit free-tier quota (often capped at 20 req/day by Google), seamlessly failover to 3.5-flash-lite
        if (currentModel !== "gemini-3.5-flash-lite") {
          console.warn(
            `[O.D.I.N. Engine] Free-tier quota hit on '${currentModel}'. Seamlessly failing over to high-throughput 'gemini-3.5-flash-lite'...`
          );
          onStatusUpdate?.(`Quota limit reached on ${currentModel}. Auto-switching to gemini-3.5-flash-lite...`);
          currentModel = "gemini-3.5-flash-lite";
          continue;
        }

        if (attempt < maxRetries) {
          // Extract server-mandated retry delay if provided by Google API
          const retryMatch =
            errString.match(/retry in ([\d\.]+)s/i) ||
            errString.match(/"retryDelay":\s*"(\d+)s"/i);
          const serverDelaySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;

          // If Google requires waiting > 65s, fail with clean explanation
          if (serverDelaySec && serverDelaySec > 65) {
            throw new Error(
              `Google Gemini API free-tier window active. Please retry in ${serverDelaySec} seconds.`
            );
          }

          const backoffSec = serverDelaySec || Math.min(Math.pow(2, attempt + 1) + 2, 30);
          console.warn(
            `[O.D.I.N. Engine] Rate limit cooldown active (attempt ${attempt + 1}/${maxRetries}). Pacing for ${backoffSec}s...`
          );

          // Paced sleep with real-time status reporting every 2 seconds
          for (let remaining = backoffSec; remaining > 0; remaining -= 2) {
            onStatusUpdate?.(
              `Rate-limit pacing active: Auto-resuming in ${remaining}s (attempt ${attempt + 1}/${maxRetries})...`
            );
            await sleep(Math.min(2000, remaining * 1000));
          }

          continue;
        }
      }

      throw err;
    }
  }

  throw lastError;
}

export async function runQuant(
  ai: GoogleGenAI,
  intake: DecisionIntake,
  onStatusUpdate?: (msg: string) => void
): Promise<{ output: QuantOutput; modelUsed: string }> {
  const prompt = formatPersonaIntakePrompt(intake);
  const result = await callGeminiWithRetry<QuantOutput>(
    ai,
    QUANT_SYSTEM_PROMPT,
    prompt,
    QUANT_SCHEMA,
    3,
    onStatusUpdate
  );
  return { output: result.data, modelUsed: result.modelUsed };
}

export async function runStrategist(
  ai: GoogleGenAI,
  intake: DecisionIntake,
  onStatusUpdate?: (msg: string) => void
): Promise<{ output: StrategistOutput; modelUsed: string }> {
  const prompt = formatPersonaIntakePrompt(intake);
  const result = await callGeminiWithRetry<StrategistOutput>(
    ai,
    STRATEGIST_SYSTEM_PROMPT,
    prompt,
    STRATEGIST_SCHEMA,
    3,
    onStatusUpdate
  );
  return { output: result.data, modelUsed: result.modelUsed };
}

export async function runBehaviorist(
  ai: GoogleGenAI,
  intake: DecisionIntake,
  onStatusUpdate?: (msg: string) => void
): Promise<{ output: BehavioristOutput; modelUsed: string }> {
  const prompt = formatPersonaIntakePrompt(intake);
  const result = await callGeminiWithRetry<BehavioristOutput>(
    ai,
    BEHAVIORIST_SYSTEM_PROMPT,
    prompt,
    BEHAVIORIST_SCHEMA,
    3,
    onStatusUpdate
  );
  return { output: result.data, modelUsed: result.modelUsed };
}

export async function runJudge(
  ai: GoogleGenAI,
  quant: QuantOutput,
  strat: StrategistOutput,
  behav: BehavioristOutput,
  pastContext?: PastContextItem[],
  onStatusUpdate?: (msg: string) => void
): Promise<{ output: JudgeOutput; modelUsed: string }> {
  const prompt = formatJudgePrompt(quant, strat, behav, pastContext);
  const result = await callGeminiWithRetry<JudgeOutput>(
    ai,
    JUDGE_SYSTEM_PROMPT,
    prompt,
    JUDGE_SCHEMA,
    3,
    onStatusUpdate
  );
  return { output: result.data, modelUsed: result.modelUsed };
}

/**
 * Executes the complete 4-persona sequential cognitive engine.
 * Includes gentle 1.2s inter-stage pacing to prevent free-tier burst RPM saturation.
 *
 * FR-23 Strict Persona Independence Rule:
 * pastContext is passed ONLY to runJudge, never to runQuant, runStrategist, or runBehaviorist.
 */
export async function executeSequentialAnalysis(
  intake: DecisionIntake,
  apiKey: string,
  onProgress?: ProgressCallback,
  pastContext?: PastContextItem[]
): Promise<FullAnalysisResult> {
  const startTime = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  let effectiveModel = getActiveGeminiModel();

  // 1. The Quant (Persona Independence Preserved: No pastContext)
  onProgress?.(1, 4, "The Quant is estimating expected values and probability trees...");
  const quantRes = await runQuant(ai, intake, (status) => onProgress?.(1, 4, status));
  effectiveModel = quantRes.modelUsed;

  // Gentle 1s inter-stage pacing to preserve free-tier burst RPM allowance
  await sleep(1000);

  // 2. The Strategist (Persona Independence Preserved: No pastContext)
  onProgress?.(2, 4, "The Strategist is evaluating reversibility and adversarial moves...");
  const stratRes = await runStrategist(ai, intake, (status) => onProgress?.(2, 4, status));
  effectiveModel = stratRes.modelUsed;

  await sleep(1000);

  // 3. The Behaviorist (Persona Independence Preserved: No pastContext)
  onProgress?.(3, 4, "The Behaviorist is auditing cognitive biases and psychological blind spots...");
  const behavRes = await runBehaviorist(ai, intake, (status) => onProgress?.(3, 4, status));
  effectiveModel = behavRes.modelUsed;

  await sleep(1000);

  // 4. The Judge (Arbitration synthesis with optional past_context)
  onProgress?.(4, 4, "The Judge is synthesizing first principles and cross-referencing past patterns...");
  const judgeRes = await runJudge(ai, quantRes.output, stratRes.output, behavRes.output, pastContext, (status) => onProgress?.(4, 4, status));
  effectiveModel = judgeRes.modelUsed;

  const totalDurationMs = Date.now() - startTime;

  return {
    intake,
    quant: quantRes.output,
    strategist: stratRes.output,
    behaviorist: behavRes.output,
    judge: judgeRes.output,
    metadata: {
      model: effectiveModel,
      timestamp: new Date().toISOString(),
      totalDurationMs,
    },
  };
}
