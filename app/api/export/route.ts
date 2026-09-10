import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode } from "@/lib/env";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { decryptNarrative } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/export
 * Exports one session or the full decision history as plain JSON (PRD §10 & FR-25).
 * 
 * Query Parameters:
 * - id: string (optional) -> Export a single session
 * - decrypt: "true" | "false" (optional) -> If true, decrypts raw_narrative server-side for human-readable portability.
 * 
 * Protected by O.D.I.N. Access Passcode Gate (M2.5).
 */
export async function GET(req: NextRequest) {
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

  const sessionId = req.nextUrl.searchParams.get("id");
  const shouldDecrypt = req.nextUrl.searchParams.get("decrypt") === "true";

  try {
    const serverClient = getServerSupabaseClient();
    let query = serverClient.from("sessions").select("*").order("created_at", { ascending: false });

    if (sessionId) {
      query = query.eq("id", sessionId) as any;
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (sessionId && (!data || data.length === 0)) {
      return NextResponse.json({ error: `Session ${sessionId} not found.` }, { status: 404 });
    }

    const sessionIds = (data || []).map((row: any) => row.id);
    const outcomesBySession = new Map<string, any>();

    if (sessionIds.length > 0) {
      const { data: outcomes } = await serverClient
        .from("session_outcomes")
        .select("session_id, status, narrative_encrypted, prompted_via, recorded_at")
        .in("session_id", sessionIds);

      if (outcomes) {
        for (const outcome of outcomes) {
          let outcomeNarrativeValue: string | null = null;
          let outcomeEncryptedString = "";
          if (outcome.narrative_encrypted) {
            if (typeof outcome.narrative_encrypted === "string") {
              outcomeEncryptedString = outcome.narrative_encrypted;
            } else if (Buffer.isBuffer(outcome.narrative_encrypted)) {
              outcomeEncryptedString = `\\x${outcome.narrative_encrypted.toString("hex")}`;
            }
          }

          if (shouldDecrypt && outcomeEncryptedString) {
            try {
              outcomeNarrativeValue = decryptNarrative(outcomeEncryptedString);
            } catch {
              outcomeNarrativeValue = "[Decryption Failed: Key Mismatch]";
            }
          }

          outcomesBySession.set(outcome.session_id, {
            status: outcome.status,
            prompted_via: outcome.prompted_via,
            recorded_at: outcome.recorded_at,
            ...(shouldDecrypt
              ? { narrative: outcomeNarrativeValue }
              : { narrative_encrypted: outcomeEncryptedString || null }),
          });
        }
      }
    }

    // Format into standard export shape independent of Supabase internal column layout
    const formattedSessions = (data || []).map((row: any) => {
      let narrativeValue: string | null = null;
      let rawEncryptedString = "";

      if (row.raw_narrative_encrypted) {
        if (typeof row.raw_narrative_encrypted === "string") {
          rawEncryptedString = row.raw_narrative_encrypted;
        } else if (Buffer.isBuffer(row.raw_narrative_encrypted)) {
          rawEncryptedString = `\\x${row.raw_narrative_encrypted.toString("hex")}`;
        }
      }

      if (shouldDecrypt && rawEncryptedString) {
        try {
          narrativeValue = decryptNarrative(rawEncryptedString);
        } catch {
          narrativeValue = "[Decryption Failed: Key Mismatch]";
        }
      }

      return {
        id: row.id,
        created_at: row.created_at,
        core_objectives: row.core_objectives,
        known_constraints: row.known_constraints,
        ...(shouldDecrypt
          ? { raw_narrative: narrativeValue }
          : { raw_narrative_encrypted: rawEncryptedString }),
        outputs: {
          quant: row.quant_output,
          strategist: row.strategist_output,
          behaviorist: row.behaviorist_output,
          judge: row.judge_output,
        },
        outcome: outcomesBySession.get(row.id) || null,
        metadata: {
          system: "O.D.I.N. Decision Support System",
          version: "1.2.0",
          embedding_model: row.embedding_model,
        },
      };
    });

    const exportPayload = {
      export_timestamp: new Date().toISOString(),
      format_version: "1.2.0",
      is_decrypted: shouldDecrypt,
      total_records: formattedSessions.length,
      sessions: sessionId ? formattedSessions[0] : formattedSessions,
    };

    const filename = sessionId
      ? `odin-session-${sessionId.slice(0, 8)}-${shouldDecrypt ? "decrypted" : "backup"}.json`
      : `odin-case-history-${shouldDecrypt ? "decrypted" : "backup"}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error generating export";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
