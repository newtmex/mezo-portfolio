import { NextResponse } from "next/server";

import { buildBasePoolReport } from "@/lib/report/base-pool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buildBasePoolReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Base pool error";
    console.error("[api/base-pool] Report generation failed", { message, error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
