// Called by the admin console right after a publish, an archive or a content
// change, so the public pages update at once rather than at the next timed
// refresh (R4, A8), and by the case study pipeline after it publishes (PB3).
// The caller must be signed in with a role on the admin list: the caller
// sends its own session token and this route asks the store which role it has.
//
// The old addresses are server redirects fixed at build (next.config.mjs), so
// a refresh cannot add one. When the store's list differs from this build's
// (a strategy published, retired or given a new page address), the route
// starts a new production deploy through the Vercel deploy hook in
// STRATEGY_LAB_DEPLOY_HOOK (PRD 13, Redirects). Refresh archpublic.com's copy
// only once that deploy is live.
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PRO_ORIGINS, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { CONTENT_TAG, STRATEGIES_TAG } from "@/lib/data";
import { allMoved } from "@/lib/moved";
import { movedKey, readMoved } from "@/lib/moved-list.mjs";

/** Starts a deploy when the old addresses in the store differ from this build's. */
async function deployIfMoved(): Promise<string> {
  try {
    const live = await readMoved(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (movedKey(live) === movedKey(allMoved())) return "not needed";
    const hook = process.env.STRATEGY_LAB_DEPLOY_HOOK?.trim();
    if (!hook) return "needed, but STRATEGY_LAB_DEPLOY_HOOK is not set";
    const res = await fetch(hook, { method: "POST", cache: "no-store" });
    return res.ok ? "started" : `failed: HTTP ${res.status}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export const dynamic = "force-dynamic";

/** Roles that may refresh the pages: the three people roles and the pipeline. */
const REFRESH_ROLES: unknown[] = ["editor", "approver", "marketing_editor", "pipeline"];

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = PRO_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /\.vercel\.app$/.test(new URL(origin || "http://x").hostname);
  return allowed
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", Vary: "Origin" }
    : {};
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = cors(request);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_URL) return NextResponse.json({ ok: false, error: "Sign in to the admin console." }, { status: 401, headers });
  const check = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_role`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const role = check.ok ? await check.json().catch(() => null) : null;
  if (!REFRESH_ROLES.includes(role)) return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403, headers });

  let what: { scope?: "strategies" | "content" | "all" } = {};
  try {
    what = await request.json();
  } catch {
    // no body: refresh everything
  }
  if (what.scope !== "content") revalidateTag(STRATEGIES_TAG);
  if (what.scope !== "strategies") revalidateTag(CONTENT_TAG);
  revalidatePath("/", "layout");
  const deploy = what.scope === "content" ? "not needed" : await deployIfMoved();
  return NextResponse.json({ ok: true, at: new Date().toISOString(), deploy }, { headers });
}
