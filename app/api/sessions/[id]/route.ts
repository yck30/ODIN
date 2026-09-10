import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode } from "@/lib/env";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { decryptNarrative } from "@/lib/crypto";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]
 * Re-opens a past session, decrypting raw_narrative server-side before return.
 * Protected by O.D.I.N. Access Passcode Gate (M2.5).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const candidatePasscode =
    req.headers.get("x-odin-access-passcode") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.cookies.get("odin_passcode")?.value ||
    req.nextUrl.searchParams.get("passcode");

  if (!verifyPasscode(candidatePasscode)) {
    return NextResponse.json(
      { error: "Access Denied: Invalid or missing O.D.I.N. Access Passcode." },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Session ID parameter is required." }, { status: 400 });
  }

  try {
    const serverClient = getServerSupabaseClient();
    const { data, error } = await serverClient
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error ? error.message : "Session not found." }, { status: 404 });
    }

    // Decrypt the app-layer encrypted narrative server-side
    let decryptedNarrative = "";
    if (data.raw_narrative_encrypted) {
      try {
        decryptedNarrative = decryptNarrative(data.raw_narrative_encrypted);
      } catch (decErr) {
        console.error("Narrative decryption error for session", id, decErr);
        decryptedNarrative = "[Decryption Error: Authentication tag or key mismatch]";
      }
    }

    // Fetch outcome if recorded (v1.2 Addendum)
    let outcomePayload = null;
    const { data: outcomeData } = await serverClient
      .from("session_outcomes")
      .select("id, status, narrative_encrypted, prompted_via, recorded_at, updated_at")
      .eq("session_id", id)
      .maybeSingle();

    if (outcomeData) {
      let decryptedOutcomeNarrative = null;
      if (outcomeData.narrative_encrypted) {
        try {
          decryptedOutcomeNarrative = decryptNarrative(outcomeData.narrative_encrypted);
        } catch (decErr) {
          console.error("Outcome narrative decryption error for session", id, decErr);
          decryptedOutcomeNarrative = "[Decryption Error]";
        }
      }
      outcomePayload = {
        id: outcomeData.id,
        status: outcomeData.status,
        narrative: decryptedOutcomeNarrative,
        prompted_via: outcomeData.prompted_via,
        recorded_at: outcomeData.recorded_at,
        updated_at: outcomeData.updated_at,
      };
    }

    const payload = {
      id: data.id,
      created_at: data.created_at,
      intake: {
        core_objectives: data.core_objectives,
        known_constraints: data.known_constraints,
        raw_narrative: decryptedNarrative,
      },
      outputs: {
        quant: data.quant_output,
        strategist: data.strategist_output,
        behaviorist: data.behaviorist_output,
        judge: data.judge_output,
      },
      outcome: outcomePayload,
      embedding_model: data.embedding_model,
    };

    return NextResponse.json({ status: "success", data: payload }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error retrieving session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/[id]
 * Hard deletes a session and its embedding permanently from Supabase (PRD §10 & FR-21).
 * Protected by O.D.I.N. Access Passcode Gate (M2.5).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const candidatePasscode =
    req.headers.get("x-odin-access-passcode") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.cookies.get("odin_passcode")?.value ||
    req.nextUrl.searchParams.get("passcode");

  if (!verifyPasscode(candidatePasscode)) {
    return NextResponse.json(
      { error: "Access Denied: Invalid or missing O.D.I.N. Access Passcode." },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Session ID parameter is required." }, { status: 400 });
  }

  try {
    const serverClient = getServerSupabaseClient();
    const { error } = await serverClient
      .from("sessions")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "success", message: `Session ${id} permanently deleted.`, deletedId: id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error deleting session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
