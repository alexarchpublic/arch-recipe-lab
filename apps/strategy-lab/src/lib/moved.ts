// The old Strategy Lab addresses as this build redirects them (PRD 13,
// Redirects). next.config.mjs makes the list once, at build, from the store
// (lib/moved-list.mjs): it becomes the server redirects, and reaches the pages
// here as MOVED_LIST. The "Older links" page, /redirects.json and
// api/revalidate read it from here, so a link never points at an old address
// this build has no redirect for. A strategy published after the build joins
// the list at the next deploy, which api/revalidate starts.
import type { Moved } from "./moved-list.mjs";

export type { Moved };

/** Every old address with its target, as this build redirects them. */
export function allMoved(): Moved[] {
  try {
    return JSON.parse(process.env.MOVED_LIST || "[]") as Moved[];
  } catch {
    return [];
  }
}
