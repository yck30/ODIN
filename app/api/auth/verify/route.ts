import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let candidate = req.headers.get("x-odin-access-passcode");

    if (!candidate) {
      const body = await req.json().catch(() => ({}));
      candidate = body.passcode;
    }

    const isValid = verifyPasscode(candidate);

    if (!isValid) {
      return NextResponse.json(
        {
          valid: false,
          error: "ACCESS DENIED: Invalid passcode. Security clearance rejected.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        message: "CLEARANCE GRANTED: Terminal access authorized.",
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Verification probe failed.",
      },
      { status: 500 }
    );
  }
}
