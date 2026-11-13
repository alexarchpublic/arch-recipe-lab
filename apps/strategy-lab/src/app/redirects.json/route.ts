// The old and short Strategy Lab addresses, with where each lands, under
// /strategy-lab (PRD 13, Redirects). They are this build's server redirects
// (next.config.mjs, lib/moved.ts), which archpublic.com's copy keeps as
// redirects. The case-studies repository reads this list too.
import { NextResponse } from "next/server";
import { PUBLIC_PATH } from "@/lib/env";
import { allMoved } from "@/lib/moved";

export const dynamic = "force-static";

export function GET() {
  const redirects = allMoved().map((m) => ({ from: `${PUBLIC_PATH}${m.from}`, to: `${PUBLIC_PATH}${m.to}` }));
  return NextResponse.json(
    { note: "Old Strategy Lab addresses and their targets. Any other /strategy-lab/recipes/<id> or /strategy-lab/strategy/<n> goes to /strategy-lab/strategies.", redirects },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
