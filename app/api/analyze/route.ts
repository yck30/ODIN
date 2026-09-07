import { NextRequest, NextResponse } from "next/server";
import { executeSequentialAnalysis } from "@/lib/engine/orchestrator";
import { verifyPasscode } from "@/lib/env";
import type { DecisionIntake } from "@/lib/engine/types";

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

  if (wantsStreaming) {
    // SSE Stream Response for real-time progressive status in UI
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await executeSequentialAnalysis(
            validation.intake,
            apiKey,
            (step, totalSteps, message) => {
              sendEvent("progress", { step, totalSteps, message });
            }
          );

          sendEvent("complete", result);
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
      },
    });
  }

  // Standard JSON response
  try {
    const result = await executeSequentialAnalysis(validation.intake, apiKey);
    return NextResponse.json({ status: "success", data: result }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Cognitive engine execution failure";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
