"use client";
// Every capture on the public site (S2 to S5, S14): booking, new-strategy
// alerts and "email me this". The browser builds the HubSpot fields from what
// the visitor did here and sends them straight to HubSpot (lib/hubspot.ts).
import { ACCOUNT_SIZE_RANGES, assetClassLabel, focusLabel, rangeFor } from "@/lib/strategies";
import { submitToHubSpot, type HubSpotFields } from "@/lib/hubspot";
import { touchText, readVisitor } from "@/lib/visitor";

export interface LeadInput {
  kind: "booking_started" | "booking_completed" | "alert" | "email_me_this";
  email: string;
  firstName?: string;
  lastName?: string;
  accountSize?: number | null;
  accountSizeRange?: string;
  exchange?: string;
  alertAssetClasses?: string[];
  strategyInView?: string;
  /** "Email me this": the figures text (lib/figures.ts). */
  figures?: string;
  consentCalls?: boolean;
  meetingStart?: string;
  website?: string;
}

/** What a capture needs from the page: published strategies and the consent wording. */
export interface LeadSettings {
  /** slug -> "#41 NVDA Accumulation (NVDA)" */
  names: Record<string, string>;
  /** slug -> [asset, asset class] */
  assets: Record<string, [string, string]>;
  consentMarketingText: string;
  processText: string;
}

const clip = (v: unknown, n = 200): string => (typeof v === "string" ? v.trim().slice(0, n) : "");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sends a capture with everything the visitor has done here (S2, S3). */
export async function sendLead(input: LeadInput, settings: LeadSettings): Promise<{ ok: boolean; error?: string }> {
  if (input.website) return { ok: true }; // a bot filled the hidden field
  const email = clip(input.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  const v = readVisitor();
  const known = (slug: string | undefined) => !!slug && slug in settings.names;
  const inView = known(input.strategyInView) ? input.strategyInView! : "";
  if (input.kind === "email_me_this" && (!inView || !input.figures)) return { ok: false, error: "That strategy is not published." };
  const viewed = v.viewed.filter(known).slice(0, 5);

  const size = input.accountSize ?? v.accountSize ?? v.finder?.accountSize ?? null;
  const accountSize = typeof size === "number" && size > 0 && size < 1e10 ? Math.round(size) : null;
  const range = ACCOUNT_SIZE_RANGES.find((r) => r.id === input.accountSizeRange)?.id ?? rangeFor(accountSize);
  const rangeLabel = ACCOUNT_SIZE_RANGES.find((r) => r.id === range)?.label ?? "";
  const alertClasses = (input.alertAssetClasses ?? []).filter((c) => ["Equities", "ETFs", "Crypto"].includes(c));
  const interestClasses = [...new Set([v.finder?.assetClass ?? "", ...alertClasses, ...viewed.map((s) => settings.assets[s]?.[1] ?? "")].filter(Boolean))];
  const interestAssets = [...new Set([v.finder?.asset ?? "", ...viewed.map((s) => settings.assets[s]?.[0] ?? "")].filter(Boolean))];
  const goal = clip(v.finder?.goal, 40);

  const fields: HubSpotFields = {
    email,
    firstname: clip(input.firstName, 80),
    lastname: clip(input.lastName, 80),
    purchasing_power: accountSize ?? undefined,
    sl_partner: clip(v.partner, 80),
    equitiesetf_algo_interest: interestClasses.some((c) => c === "Equities" || c === "ETFs") ? "true" : undefined,
    sl_capture_kind: input.kind,
    sl_account_size_range: rangeLabel,
    sl_goal: goal ? focusLabel(goal) : "",
    sl_exchange: clip(input.exchange || v.finder?.exchange, 60),
    sl_asset_interest: [...interestClasses.map(assetClassLabel), ...interestAssets].join(", "),
    sl_strategy_in_view: inView ? settings.names[inView] : "",
    sl_strategies_viewed: viewed.map((s) => settings.names[s]).join("; "),
    sl_first_touch: clip(touchText(v.firstTouch), 300),
    sl_last_touch: clip(touchText(v.lastTouch), 300),
    sl_alert_asset_classes: alertClasses.map(assetClassLabel).join(", "),
    sl_email_me_this: input.kind === "email_me_this" ? input.figures : "",
    sl_meeting_start: clip(input.meetingStart, 40),
    sl_consent_calls: input.consentCalls ? "true" : "false",
  };

  const r = await submitToHubSpot(fields, {
    // Every capture opts in to marketing; the forms say so in a notice (fixes PRD, fix 6, Alex 13 Nov).
    marketing: true,
    marketingText: settings.consentMarketingText,
    processText: settings.processText,
  });
  if (!r.ok) {
    console.warn("Strategy Lab capture did not reach HubSpot", input.kind, r.detail);
    return { ok: false, error: r.detail === "network" ? "No connection. Please try again." : "We could not save that. Please try again." };
  }
  return { ok: true };
}
