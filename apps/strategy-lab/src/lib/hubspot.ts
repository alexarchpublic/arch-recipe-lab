// Captures reach HubSpot through one Strategy Lab form (section 9, "What is
// collected"). The form must hold these fields as hidden fields; a field the
// form lacks is dropped and the rest still land (docs/PHASE3.md lists them).
import {
  HUBSPOT_CALLS_SUBSCRIPTION_ID,
  HUBSPOT_FORM_GUID,
  HUBSPOT_MARKETING_SUBSCRIPTION_ID,
  HUBSPOT_PORTAL_ID,
} from "./env";

export type HubSpotFields = Record<string, string | number | boolean | null | undefined>;

export interface HubSpotContext {
  hutk?: string;
  pageUri?: string;
  pageName?: string;
  ipAddress?: string;
}

export interface HubSpotConsent {
  marketing: boolean;
  calls: boolean;
  marketingText: string;
  callsText: string;
  processText: string;
}

export interface HubSpotResult {
  status: "ok" | "not_configured" | "error";
  detail?: string;
  dropped?: string[];
}

export function hubspotConfigured(): boolean {
  return !!HUBSPOT_FORM_GUID;
}

export async function submitToHubSpot(fields: HubSpotFields, context: HubSpotContext, consent: HubSpotConsent): Promise<HubSpotResult> {
  if (!HUBSPOT_FORM_GUID) return { status: "not_configured" };
  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`;
  let list = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([name, value]) => ({ objectTypeId: "0-1", name, value: String(value) }));

  const communications = [
    HUBSPOT_MARKETING_SUBSCRIPTION_ID && {
      value: consent.marketing,
      subscriptionTypeId: Number(HUBSPOT_MARKETING_SUBSCRIPTION_ID),
      text: consent.marketingText,
    },
    HUBSPOT_CALLS_SUBSCRIPTION_ID && {
      value: consent.calls,
      subscriptionTypeId: Number(HUBSPOT_CALLS_SUBSCRIPTION_ID),
      text: consent.callsText,
    },
  ].filter(Boolean);

  const body = (fieldsList: typeof list) => ({
    submittedAt: Date.now(),
    fields: fieldsList,
    context: Object.fromEntries(Object.entries(context).filter(([, v]) => !!v)),
    legalConsentOptions: {
      consent: { consentToProcess: true, text: consent.processText, communications },
    },
  });

  const dropped: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(list)),
      cache: "no-store",
    });
    if (res.ok) return { status: "ok", dropped: dropped.length ? dropped : undefined };
    const text = await res.text().catch(() => "");
    // Drop fields the form does not define and try again.
    const missing = [...text.matchAll(/fields\.([a-z0-9_]+)/gi)].map((m) => m[1]);
    const notInForm = /FIELD_NOT_IN_FORM_DEFINITION/i.test(text) ? missing : [];
    if (notInForm.length && attempt < 2) {
      dropped.push(...notInForm);
      list = list.filter((f) => !notInForm.includes(f.name));
      continue;
    }
    return { status: "error", detail: `HTTP ${res.status} ${text.slice(0, 300)}`, dropped };
  }
  return { status: "error", detail: "gave up after dropping fields", dropped };
}
