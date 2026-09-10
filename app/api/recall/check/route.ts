import { NextRequest, NextResponse } from "next/server";
import { findSimilarPastDecisions } from "@/lib/recall";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/recall/check
 * Lightweight pre-check ahead of synthesis to detect if high-similarity precedent
 * exists without a recorded outcome (PRD v1.2 FR-27 Opportunistic Capture).
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ pendingPrecedent: null }, { status: 200 });
    }

    const body = await req.json();
    const objectives: string = body.core_objectives?.trim() || "";
    const constraints: string = body.known_constraints?.trim() || "";

    if (!objectives || objectives.length < 5) {
      return NextResponse.json({ pendingPrecedent: null }, { status: 200 });
    }

    // Query semantic recall
    const matches = await findSimilarPastDecisions(objectives, constraints, apiKey, 0.65, 1);
    if (!matches || matches.length === 0) {
      return NextResponse.json({ pendingPrecedent: null }, { status: 200 });
    }

    const topMatch = matches[0];
    // If top match already has an outcome, do not trigger opportunistic capture
    if (topMatch.outcome !== null && topMatch.outcome !== undefined) {
      return NextResponse.json({ pendingPrecedent: null }, { status: 200 });
    }

    // Fetch original session core_objectives headline for clear context in UI
    const supabase = getServerSupabaseClient();
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("core_objectives")
      .eq("id", topMatch.id)
      .maybeSingle();

    return NextResponse.json({
      pendingPrecedent: {
        id: topMatch.id,
        date: topMatch.date,
        core_objectives: sessionData?.core_objectives || "Prior historical decision",
        synthesis: topMatch.synthesis,
        similarity: topMatch.similarity,
      },
    });
  } catch (err: unknown) {
    console.warn("[Recall Check] Notice: Opportunistic pre-check skipped:", err);
    return NextResponse.json({ pendingPrecedent: null }, { status: 200 });
  }
}
