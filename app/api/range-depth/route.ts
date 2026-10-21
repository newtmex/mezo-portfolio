import { NextResponse } from "next/server";

import { PAIRS } from "@/lib/config";
import {
  buildManagerRangeDepthReport,
  buildPoolRangeDepthReport,
} from "@/lib/report/build-report";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "An error occurred while loading range-depth data.";

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("pool");
    if (key) {
      if (!PAIRS.some((pair) => pair.key === key)) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
      }
      return NextResponse.json(await buildPoolRangeDepthReport(key as (typeof PAIRS)[number]["key"]));
    }
    return NextResponse.json(await buildManagerRangeDepthReport());
  } catch (error) {
    console.error("[api/range-depth] Report generation failed", {
      error,
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
