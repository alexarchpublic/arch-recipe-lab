// Names and addresses (PRD section 5 and the rename checklist in section 13).
//
// The Pro address used to be hard-coded in seven places. It is one setting
// now, because the dev team chooses Pro's final address at the login move.
// Override it with PRO_SITE_URL (server) or VITE_PRO_SITE_URL (browser build).

const fromEnv = (): string | undefined => {
  try {
    // Edge functions and Node.
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const v = p?.env?.PRO_SITE_URL || p?.env?.VITE_PRO_SITE_URL;
    if (v) return v;
  } catch {
    // no process in the browser
  }
  try {
    // Vite replaces import.meta.env at build time.
    const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PRO_SITE_URL;
    if (v) return v;
  } catch {
    // not built by Vite
  }
  return undefined;
};

export const DEFAULT_PRO_SITE_URL = "https://recipes.archpublic.com";
export const PRO_SITE_URL = (fromEnv() ?? DEFAULT_PRO_SITE_URL).replace(/\/+$/, "");

export const PRO_NAME = "Strategy Lab Pro";
export const PUBLIC_NAME = "Strategy Lab";
export const COMPANY_NAME = "Arch Public";
export const COMPANY_URL = "https://archpublic.com";

/** Arch Public's concierge service, linked from every apply step (P19). */
export const CONCIERGE_URL = "https://archpublic.com/concierge/";

/** The product walkthrough. Recorded under the old name; a new recording is on the rename checklist. */
export const WALKTHROUGH_VIDEO_URL = "https://youtu.be/f_HjWioMlF8";

/** A strategy's page in Pro. Numbers never change: clients name TradingView setups after them. */
export function proStrategyPath(displayNumber: number): string {
  return `/strategy/${displayNumber}`;
}

export function proStrategyUrl(displayNumber: number, origin: string = PRO_SITE_URL): string {
  return `${origin.replace(/\/+$/, "")}${proStrategyPath(displayNumber)}`;
}
