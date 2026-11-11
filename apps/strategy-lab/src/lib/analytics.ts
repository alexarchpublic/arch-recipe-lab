"use client";
// Strategy Lab events (section 12), sent to one GA4 property after consent.
// HubSpot's tracking code (also after consent) records page views, which
// attach to the contact once the visitor identifies themselves.

type Params = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    _hsq?: unknown[];
  }
}

export type StrategyLabEvent =
  | "strategy_viewed"
  | "finder_completed"
  | "account_size_used"
  | "alert_subscribed"
  | "settings_label_clicked"
  | "booking_opened"
  | "booking_form_submitted"
  | "booking_completed"
  | "start_free_clicked"
  | "email_me_this_sent";

export function track(event: StrategyLabEvent, params: Params = {}): void {
  try {
    window.gtag?.("event", event, params);
  } catch {
    // analytics never breaks the page
  }
}

const CONSENT_KEY = "strategy-lab:consent:v1";
export type Consent = "granted" | "denied" | null;

export function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(v: Exclude<Consent, null>): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
  } catch {
    // not remembered in private mode
  }
  window.dispatchEvent(new CustomEvent("strategy-lab:consent", { detail: v }));
}
