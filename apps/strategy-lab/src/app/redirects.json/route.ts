// The old and short Strategy Lab addresses, with where each lands, under
// /strategy-lab (PRD 13, Redirects). archpublic.com reaches them as captured
// hand-off pages (components/Moved); this list is for anyone who wants real
// redirects instead.
import { NextResponse } from "next/server";
import { PUBLIC_PATH } from "@/lib/env";
import { allMoved } from "@/lib/moved";

export const revalidate = 120;

export async function GET() {
  const redirects = (await allMoved()).map((m) => ({ from: `${PUBLIC_PATH}${m.from}`, to: `${PUBLIC_PATH}${m.to}` }));
  return NextResponse.json(
    { note: "Old Strategy Lab addresses and their targets. Any other /strategy-lab/recipes/<id> or /strategy-lab/strategy/<n> goes to /strategy-lab/strategies.", redirects },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
