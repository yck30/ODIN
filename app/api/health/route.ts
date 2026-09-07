import { NextResponse } from "next/server";
import { getEnvDiagnostics } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const diagnostics = getEnvDiagnostics();
    const isHealthy = diagnostics.gemini.configured;

    return NextResponse.json(
      {
        status: isHealthy ? "operational" : "degraded",
        service: "O.D.I.N. Cognitive Infrastructure",
        version: "1.2.0-phase2-m1",
        uptimeSeconds: Math.floor(process.uptime()),
        diagnostics,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal health probe failure",
      },
      { status: 500 }
    );
  }
}
