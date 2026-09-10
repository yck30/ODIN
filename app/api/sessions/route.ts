import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode } from "@/lib/env";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions
 * Returns a list of past sessions (summary metadata only, no sensitive raw narrative).
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

  try {
    const serverClient = getServerSupabaseClient();
    const { data, error } = await serverClient
      .from("sessions")
      .select("id, created_at, core_objectives, known_constraints, judge_output, session_outcomes(status, prompted_via)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format safe summary response for UI case history list
    const sessions = (data || []).map((row: any) => {
      // session_outcomes may be returned as single object or array depending on PostgREST relation
      const outcomeData = Array.isArray(row.session_outcomes)
        ? row.session_outcomes[0]
        : row.session_outcomes;

      return {
        id: row.id,
        created_at: row.created_at,
        core_objectives: row.core_objectives,
        known_constraints: row.known_constraints,
        recommended_path: row.judge_output?.recommended_path || "Synthesis Available",
        outcome_status: outcomeData?.status || null,
        prompted_via: outcomeData?.prompted_via || null,
      };
    });

    return NextResponse.json({ status: "success", sessions }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query sessions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
