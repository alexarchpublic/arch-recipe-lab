// The old and short Strategy Lab addresses, with where each should land, for
// archpublic.com's page engine. On archpublic.com the site is a saved copy,
// so the redirects in app/recipes and app/strategy do not run there: an
// address the copy does not hold opens the landing page. This list lets the
// engine send each one to the right page instead (PRD 13, Redirects).
// Paths are the public ones, under /strategy-lab.
import { NextResponse } from "next/server";
import { getStrategies } from "@/lib/data";
import { PUBLIC_PATH } from "@/lib/env";

export const revalidate = 120;

export async function GET() {
  const all = await getStrategies();
  const at = (path: string) => `${PUBLIC_PATH}${path}`;
  const redirects = [
    { from: at("/recipes"), to: at("/strategies") },
    ...all.map((s) => ({ from: at(`/recipes/${s.id}`), to: at(`/${s.slug}`) })),
    ...all.filter((s) => s.display_number != null).map((s) => ({ from: at(`/strategy/${s.display_number}`), to: at(`/${s.slug}`) })),
  ];
  return NextResponse.json(
    { note: "Permanent redirects for archpublic.com. Any other /strategy-lab/recipes/<id> or /strategy-lab/strategy/<n> goes to /strategy-lab/strategies.", redirects },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
