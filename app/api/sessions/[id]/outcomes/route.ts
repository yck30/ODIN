import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { encryptNarrativeToHex, decryptNarrative } from "@/lib/crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = ["followed_path", "deviated", "still_deciding"] as const;
type OutcomeStatus = (typeof VALID_STATUSES)[number];

const VALID_PROMPTED_VIA = ["opportunistic", "manual"] as const;
type PromptedVia = (typeof VALID_PROMPTED_VIA)[number];

/**
 * Validates the request security passcode against ODIN_ACCESS_PASSCODE.
 */
function isAuthorized(req: NextRequest, bodyPasscode?: string): boolean {
  const serverPasscode = process.env.ODIN_ACCESS_PASSCODE?.trim();
  if (!serverPasscode) return true; // Gate disabled if not set

  const headerPasscode = req.headers.get("x-odin-access-passcode")?.trim();
  const queryPasscode = req.nextUrl.searchParams.get("passcode")?.trim();

  return (
    headerPasscode === serverPasscode ||
    queryPasscode === serverPasscode ||
    bodyPasscode?.trim() === serverPasscode
  );
}

/**
 * POST /api/sessions/[id]/outcomes
 * Upserts a real-world outcome record for a given session.
 * Encrypts sensitive reflection narratives server-side with AES-256-GCM.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID in request." }, { status: 400 });
    }

    const body = await req.json();
    if (!isAuthorized(req, body.passcode)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing Security Clearance Passcode." },
        { status: 401 }
      );
    }

    const status: OutcomeStatus = body.status;
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const promptedVia: PromptedVia = body.prompted_via || "manual";
    if (!VALID_PROMPTED_VIA.includes(promptedVia)) {
      return NextResponse.json(
        {
          error: `Invalid prompted_via. Must be one of: ${VALID_PROMPTED_VIA.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const rawNarrative: string = body.narrative?.trim() || "";
    const encryptedNarrativeHex = rawNarrative ? encryptNarrativeToHex(rawNarrative) : null;

    const supabase = getServerSupabaseClient();

    // Verify parent session exists
    const { data: parentSession, error: parentCheckError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (parentCheckError || !parentSession) {
      return NextResponse.json(
        { error: "Parent decision session not found in archive." },
        { status: 404 }
      );
    }

    // Upsert outcome on session_id conflict
    const { data: outcomeRow, error: upsertError } = await supabase
      .from("session_outcomes")
      .upsert(
        {
          session_id: sessionId,
          status,
          narrative_encrypted: encryptedNarrativeHex,
          prompted_via: promptedVia,
        },
        { onConflict: "session_id" }
      )
      .select("id, session_id, status, prompted_via, recorded_at, updated_at")
      .single();

    if (upsertError || !outcomeRow) {
      console.error("[Outcomes API] Upsert failure:", upsertError);
      return NextResponse.json(
        { error: `Failed to record outcome: ${upsertError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      outcome: {
        id: outcomeRow.id,
        session_id: outcomeRow.session_id,
        status: outcomeRow.status,
        narrative: rawNarrative || null,
        prompted_via: outcomeRow.prompted_via,
        recorded_at: outcomeRow.recorded_at,
        updated_at: outcomeRow.updated_at,
      },
    });
  } catch (err: unknown) {
    console.error("[Outcomes API POST] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sessions/[id]/outcomes
 * Retrieves the recorded outcome for a session, decrypting the reflection narrative server-side.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID in request." }, { status: 400 });
    }

    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing Security Clearance Passcode." },
        { status: 401 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("session_outcomes")
      .select("id, session_id, status, narrative_encrypted, prompted_via, recorded_at, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[Outcomes API GET] Retrieval error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ outcome: null });
    }

    let decryptedNarrative: string | null = null;
    if (data.narrative_encrypted) {
      try {
        decryptedNarrative = decryptNarrative(data.narrative_encrypted);
      } catch (decryptErr) {
        console.error("[Outcomes API GET] Narrative decryption failure:", decryptErr);
        decryptedNarrative = "[DECRYPTION_ERROR]";
      }
    }

    return NextResponse.json({
      outcome: {
        id: data.id,
        session_id: data.session_id,
        status: data.status,
        narrative: decryptedNarrative,
        prompted_via: data.prompted_via,
        recorded_at: data.recorded_at,
        updated_at: data.updated_at,
      },
    });
  } catch (err: unknown) {
    console.error("[Outcomes API GET] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
