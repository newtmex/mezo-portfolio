import { NextResponse } from "next/server";

import { PAIRS } from "@/lib/config";
import {
  buildManagerRangeDepthReport,
  buildPoolRangeDepthReport,
} from "@/lib/report/build-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("pool");
    if (key) {
      if (!PAIRS.some((pair) => pair.key === key)) {
        return NextResponse.json({ error: `Unknown pool key: ${key}` }, { status: 400 });
      }
      return NextResponse.json(await buildPoolRangeDepthReport(key as (typeof PAIRS)[number]["key"]));
    }
    return NextResponse.json(await buildManagerRangeDepthReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown range-depth error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
