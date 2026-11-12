/**
 * True when the page runs inside archpublic.com's frame rather than on its own
 * address. archpublic.com serves Strategy Lab as a saved copy in a frame, and
 * the main site around it owns consent, analytics and downloads.
 */
export function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
