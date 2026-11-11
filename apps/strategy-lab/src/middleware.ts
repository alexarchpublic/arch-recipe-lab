// S18: search sees one copy. Pages served at archpublic.com/strategy-lab (by
// the owner's rewrite) are indexable; the same pages at the app's own Vercel
// address carry noindex. A proxy passes the visitor's host in
// x-forwarded-host; set INDEX_ALL_HOSTS=1 if the proxy in use does not.
import { NextResponse, type NextRequest } from "next/server";

const CANONICAL = (process.env.CANONICAL_HOSTS ?? "archpublic.com,www.archpublic.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  if (process.env.INDEX_ALL_HOSTS === "1") return res;
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")]
    .flatMap((h) => (h ?? "").split(","))
    .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
  if (!hosts.some((h) => CANONICAL.includes(h))) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
