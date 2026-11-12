"use client";
// Captures go from the visitor's browser straight to HubSpot's form submission
// address, with no server of ours in between. archpublic.com serves a saved
// copy of these pages with no server behind it, so a capture that went through
// an API route of ours failed there with "Please try again". The case studies
// pages send their form the same way.
//
// The address is written out in full on purpose: the saved copy has to see it
// to let it through. Portal 43848678 is Arch Public's, and the form is
// "Strategy Lab capture". Both ids are public (any HubSpot embed shows them).

export const HUBSPOT_SUBMIT_URL =
  "https://api.hsforms.com/submissions/v3/integration/submit/43848678/33d0daae-18d3-41fd-b77f-51dc3acaa22b";

/** The "Marketing Information" subscription type the marketing consent line maps to. */
const MARKETING_SUBSCRIPTION_ID = 226456374;

export type HubSpotFields = Record<string, string | number | boolean | null | undefined>;

export interface HubSpotConsent {
  marketing: boolean;
  marketingText: string;
  processText: string;
}

export interface HubSpotResult {
  ok: boolean;
  detail?: string;
  dropped?: string[];
}

function cookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export async function submitToHubSpot(fields: HubSpotFields, consent: HubSpotConsent): Promise<HubSpotResult> {
  let list = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([name, value]) => ({ objectTypeId: "0-1", name, value: String(value) }));

  const context = Object.fromEntries(
    Object.entries({ hutk: cookie("hubspotutk"), pageUri: window.location.href, pageName: document.title }).filter(([, v]) => !!v),
  );
  const legalConsentOptions = {
    consent: {
      consentToProcess: true,
      text: consent.processText,
      communications: [{ value: consent.marketing, subscriptionTypeId: MARKETING_SUBSCRIPTION_ID, text: consent.marketingText }],
    },
  };

  const dropped: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(HUBSPOT_SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedAt: Date.now(), fields: list, context, legalConsentOptions }),
      });
    } catch {
      return { ok: false, detail: "network" };
    }
    if (res.ok) return { ok: true, dropped: dropped.length ? dropped : undefined };
    const text = await res.text().catch(() => "");
    // A field the form does not define fails the whole send: drop it and try again.
    const notInForm = /FIELD_NOT_IN_FORM_DEFINITION/i.test(text) ? [...text.matchAll(/fields\.([a-z0-9_]+)/gi)].map((m) => m[1]) : [];
    if (notInForm.length && attempt < 2) {
      dropped.push(...notInForm);
      list = list.filter((f) => !notInForm.includes(f.name));
      continue;
    }
    return { ok: false, detail: `HTTP ${res.status} ${text.slice(0, 300)}`, dropped };
  }
  return { ok: false, detail: "gave up after dropping fields", dropped };
}
