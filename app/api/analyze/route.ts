import { NextRequest, NextResponse } from "next/server";
import { executeSequentialAnalysis } from "@/lib/engine/orchestrator";
import { verifyPasscode } from "@/lib/env";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { encryptNarrativeToHex } from "@/lib/crypto";
import { generateEmbedding } from "@/lib/embeddings";
import { findSimilarPastDecisions } from "@/lib/recall";
import type { DecisionIntake, FullAnalysisResult } from "@/lib/engine/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s timeout for Vercel functions

interface IntakeRequestBody {
  core_objectives?: string;
  known_constraints?: string;
  raw_narrative?: string;
  stream?: boolean;
  passcode?: string;
}

/**
 * Input sanitization and bounds enforcement
 */
function validateIntake(body: IntakeRequestBody): { valid: true; intake: DecisionIntake } | { valid: false; error: string } {
  const objectives = body.core_objectives?.trim();
  const constraints = body.known_constraints?.trim();
  const narrative = body.raw_narrative?.trim();

  if (!objectives || objectives.length < 5) {
    return { valid: false, error: "core_objectives must be at least 5 characters long." };
  }
  if (objectives.length > 2000) {
    return { valid: false, error: "core_objectives exceeds the 2,000 character limit." };
  }

  if (!constraints || constraints.length < 5) {
    return { valid: false, error: "known_constraints must be at least 5 characters long." };
  }
  if (constraints.length > 2000) {
    return { valid: false, error: "known_constraints exceeds the 2,000 character limit." };
  }

  if (!narrative || narrative.length < 10) {
    return { valid: false, error: "raw_narrative must be at least 10 characters long." };
  }
  if (narrative.length > 10000) {
    return { valid: false, error: "raw_narrative exceeds the 10,000 character limit." };
  }

  return {
    valid: true,
    intake: {
      core_objectives: objectives,
      known_constraints: constraints,
      raw_narrative: narrative,
    },
  };
}

export async function POST(req: NextRequest) {
  // 1. Quota & Access Gate: Verify Access Passcode
  const candidatePasscode =
    req.headers.get("x-odin-access-passcode") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.cookies.get("odin_passcode")?.value ||
    req.nextUrl.searchParams.get("passcode");

  let body: IntakeRequestBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const effectivePasscode = candidatePasscode || body.passcode;
  if (!verifyPasscode(effectivePasscode)) {
    return NextResponse.json(
      {
        error: "Access Denied: Invalid or missing O.D.I.N. Access Passcode. Unauthorized traffic is prohibited from invoking the reasoning engine.",
      },
      { status: 401 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server Configuration Error: GEMINI_API_KEY is not configured on the host." },
      { status: 500 }
    );
  }

  const validation = validateIntake(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const wantsStreaming =
    body.stream === true ||
    req.headers.get("accept")?.includes("text/event-stream") ||
    req.nextUrl.searchParams.get("stream") === "true";

/**
 * Persists a completed session to Supabase with app-layer encryption and embedding.
 * Enforces PRD privacy boundaries: narrative is encrypted with AES-256-GCM before write;
 * only the Judge's synthesis is embedded into pgvector.
 */
async function persistSessionIfConfigured(
  intake: DecisionIntake,
  result: FullAnalysisResult,
  apiKey: string
): Promise<string | null> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const encryptionKey = process.env.APP_ENCRYPTION_KEY?.trim();

  if (!supabaseUrl || !serviceKey || !encryptionKey) {
    return null;
  }

  try {
    const persistPromise = (async () => {
      const serverClient = getServerSupabaseClient();
      const encryptedHex = encryptNarrativeToHex(intake.raw_narrative);

      // Strict privacy boundary (PRD §10): embed Judge synthesis, never raw_narrative
      const { embedding, model } = await generateEmbedding(result.judge.synthesis, apiKey);

      const { data, error } = await serverClient
        .from("sessions")
        .insert({
          core_objectives: intake.core_objectives,
          known_constraints: intake.known_constraints,
          raw_narrative_encrypted: encryptedHex,
          quant_output: result.quant,
          strategist_output: result.strategist,
          behaviorist_output: result.behaviorist,
          judge_output: result.judge,
          narrative_embedding: embedding,
          embedding_model: model,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("Supabase session persistence warning (skipped):", error.message);
        return null;
      }

      return data?.id || null;
    })();

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn("Supabase session persistence timed out after 5s (skipped to preserve client response).");
        resolve(null);
      }, 5000)
    );

    return await Promise.race([persistPromise, timeoutPromise]);
  } catch (err: unknown) {
    console.warn("Supabase persistence notice:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

  if (wantsStreaming) {
    // SSE Stream Response for real-time progressive status in UI
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Cross-session semantic recall query (Milestone 5.5 / FR-22)
          sendEvent("progress", { step: 0, totalSteps: 4, message: "Cross-referencing memory archive for past decision patterns..." });
          const pastContext = await findSimilarPastDecisions(
            validation.intake.core_objectives,
            validation.intake.known_constraints,
            apiKey
          );

          if (pastContext.length > 0) {
            sendEvent("progress", {
              step: 0,
              totalSteps: 4,
              message: `Retrieved ${pastContext.length} relevant past decision pattern(s) for Judge context.`,
            });
          }

          const result = await executeSequentialAnalysis(
            validation.intake,
            apiKey,
            (step, totalSteps, message) => {
              sendEvent("progress", { step, totalSteps, message });
            },
            pastContext
          );

          sendEvent("progress", { step: 4, totalSteps: 4, message: "Persisting encrypted decision session..." });
          const sessionId = await persistSessionIfConfigured(validation.intake, result, apiKey);

          sendEvent("complete", { ...result, sessionId });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Cognitive engine failure";
          sendEvent("error", { message: errorMessage });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Standard JSON response
  try {
    const pastContext = await findSimilarPastDecisions(
      validation.intake.core_objectives,
      validation.intake.known_constraints,
      apiKey
    );
    const result = await executeSequentialAnalysis(validation.intake, apiKey, undefined, pastContext);
    const sessionId = await persistSessionIfConfigured(validation.intake, result, apiKey);
    return NextResponse.json({ status: "success", data: result, sessionId }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Cognitive engine execution failure";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
