// The figures a public page prints, read back from its own HTML (R5, D8). The
// admin console calls this after a publish and compares the result with the
// version it just published; scripts/parity-pages.mjs does the same daily.
// Public: it returns only what the public page already shows.
import { NextResponse } from "next/server";
import { parsePageFigures } from "@core";
import { BASE_PATH, PRO_ORIGINS } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (PRO_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /\.vercel\.app$/.test(new URL(origin || "http://x").hostname)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.json({ error: "slug required" }, { status: 400, headers });
  // Read the page as a visitor would, from this deployment.
  const page = `${url.origin}${BASE_PATH}/${slug}`;
  const res = await fetch(page, { cache: "no-store", headers: { "user-agent": "strategy-lab-page-check" } });
  const html = res.ok ? await res.text() : "";
  return NextResponse.json({ page, status: res.status, blocks: parsePageFigures(html), at: new Date().toISOString() }, { headers });
}
