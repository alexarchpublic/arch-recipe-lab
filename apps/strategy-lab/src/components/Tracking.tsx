"use client";
// Consent first (section 12, C4): GA4 and HubSpot's tracking code load only
// after the visitor accepts. Advertising pixels are not loaded on Strategy Lab
// pages at all. The banner sits above the phone's sticky actions (S1), and on
// wider screens bottom-left, clear of archpublic.com's call bubble (bottom-right).
import { useEffect, useState } from "react";
import Script from "next/script";
import { type Consent, readConsent, writeConsent } from "@/lib/analytics";
import { recordTouch } from "@/lib/visitor";
import { inFrame } from "@/lib/frame";

export function Tracking({ ga4Id, hubspotPortalId, privacyUrl, partner = "" }: { ga4Id: string; hubspotPortalId: string; privacyUrl: string; partner?: string }) {
  const [consent, setConsent] = useState<Consent | "unknown">("unknown");
  // On archpublic.com the page runs inside the main site's frame, and the main
  // site owns consent and analytics (one banner, one GA4 count). The frame's
  // policy refuses these scripts anyway, so a banner here would ask for a
  // choice that changes nothing. Touches are still recorded for captures.
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    setFramed(inFrame());
    setConsent(readConsent());
    recordTouch(partner);
    const on = (e: Event) => setConsent((e as CustomEvent).detail as Consent);
    window.addEventListener("strategy-lab:consent", on);
    return () => window.removeEventListener("strategy-lab:consent", on);
  }, [partner]);

  if (framed) return null;
  return (
    <>
      {consent === "granted" && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4Id}');`}
          </Script>
          <Script id="hs-script-loader" src={`https://js.hs-scripts.com/${hubspotPortalId}.js`} strategy="afterInteractive" />
        </>
      )}
      {consent === null && (
        <div
          role="region"
          aria-label="Cookie choice"
          className="fixed inset-x-0 bottom-[72px] z-40 mx-3 rounded-lg border border-border bg-card p-4 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:mx-0 sm:max-w-sm"
        >
          <p className="text-sm">
            We use cookies to understand how Strategy Lab is used and to attach your visit to your contact record if you get in touch.{" "}
            <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" onClick={() => writeConsent("granted")}>
              Accept
            </button>
            <button type="button" className="rounded-full border border-border-strong px-4 py-2 text-xs font-bold" onClick={() => writeConsent("denied")}>
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
}
