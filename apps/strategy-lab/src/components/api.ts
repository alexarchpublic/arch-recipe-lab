"use client";
import { touchText, readVisitor } from "@/lib/visitor";

export const BASE = "/strategy-lab";

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
  consentMarketing?: boolean;
  consentCalls?: boolean;
  meetingStart?: string;
  website?: string;
}

/** Sends a capture with everything the visitor has done here (S2, S3). */
export async function sendLead(input: LeadInput): Promise<{ ok: boolean; error?: string }> {
  const v = readVisitor();
  const body = {
    ...input,
    accountSize: input.accountSize ?? v.accountSize ?? v.finder?.accountSize ?? null,
    exchange: input.exchange || v.finder?.exchange || "",
    goal: v.finder?.goal ?? "",
    assetClass: v.finder?.assetClass ?? "",
    asset: v.finder?.asset ?? "",
    viewed: v.viewed.slice(0, 5),
    firstTouch: touchText(v.firstTouch),
    lastTouch: touchText(v.lastTouch),
    partner: v.partner,
    pageUri: window.location.href,
    pageName: document.title,
  };
  try {
    const res = await fetch(`${BASE}/api/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: !!json.ok, error: json.error };
  } catch {
    return { ok: false, error: "No connection. Please try again." };
  }
}
