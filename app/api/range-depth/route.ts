import { NextResponse } from "next/server";

/** @deprecated Dashboard reads RPC data directly in the browser. */
export async function GET() {
  return NextResponse.json(
    { error: "Range-depth API is deprecated; use the frontend RPC data source." },
    { status: 410 },
  );
}
