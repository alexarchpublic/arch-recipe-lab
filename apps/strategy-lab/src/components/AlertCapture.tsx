"use client";
// "Tell me when new strategies publish", by asset class (S5).
import { useState } from "react";
import { track } from "@/lib/analytics";
import { writeVisitor } from "@/lib/visitor";
import { assetClassLabel } from "@/lib/strategies";
import { sendLead } from "./api";
import { Button, Check, Input } from "./ui";

export function AlertCapture({ defaultClasses = [], consentText, privacyUrl, dark = false, id = "alerts" }: { defaultClasses?: string[]; consentText: string; privacyUrl: string; dark?: boolean; id?: string }) {
  const fieldId = `alert-email-${id}`;
  const [classes, setClasses] = useState<string[]>(defaultClasses.length ? defaultClasses : ["Equities", "ETFs", "Crypto"]);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const toggle = (c: string) => setClasses((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  if (state === "done") {
    const names = classes.map((c) => (c === "Equities" ? "stock" : c === "ETFs" ? "ETF" : c.toLowerCase()));
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
    return <p className={`text-sm font-semibold ${dark ? "text-white" : "text-navy"}`} role="status">Done. We'll email you when a new {list} strategy publishes.</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!classes.length) return setError("Choose at least one.");
        if (!consent) return setError("Tick the box so we can email you.");
        setState("busy");
        const r = await sendLead({ kind: "alert", email, alertAssetClasses: classes, consentMarketing: consent, website });
        if (!r.ok) {
          setState("idle");
          return setError(r.error ?? "Please try again.");
        }
        writeVisitor({ identified: true });
        track("alert_subscribed", { asset_classes: classes.join(",") });
        setState("done");
      }}
    >
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="sr-only">Asset classes</legend>
        {["Equities", "ETFs", "Crypto"].map((c) => (
          <label key={c} className={`inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold ${dark ? "text-white" : "text-navy"}`}>
            <input type="checkbox" checked={classes.includes(c)} onChange={() => toggle(c)} className="h-[18px] w-[18px] accent-[hsl(var(--primary))]" />
            {assetClassLabel(c)}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={fieldId} className={`block text-[13px] font-bold ${dark ? "text-white" : "text-navy"}`}>Email</label>
        <Input id={fieldId} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <div className={dark ? "[&_span]:text-white/70" : ""}>
        <Check checked={consent} onChange={setConsent}>
          {consentText}{" "}
          <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
        </Check>
      </div>
      <Button type="submit" variant="secondary" disabled={state === "busy"} className="min-h-[48px] w-full text-[15px]">
        {state === "busy" ? "Saving…" : "Email me new strategies"}
      </Button>
      {error && <p className="text-sm font-semibold text-loss" role="alert">{error}</p>}
    </form>
  );
}
