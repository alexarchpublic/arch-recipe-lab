"use client";
// "Tell me when new strategies publish", by asset class (S5).
import { useState } from "react";
import { track } from "@/lib/analytics";
import { writeVisitor } from "@/lib/visitor";
import { assetClassLabel } from "@/lib/strategies";
import { sendLead } from "./api";
import { Button, Check, Input } from "./ui";

export function AlertCapture({ defaultClasses = [], consentText, privacyUrl, dark = false }: { defaultClasses?: string[]; consentText: string; privacyUrl: string; dark?: boolean }) {
  const [classes, setClasses] = useState<string[]>(defaultClasses.length ? defaultClasses : ["Equities", "ETFs", "Crypto"]);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const toggle = (c: string) => setClasses((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  if (state === "done") {
    return <p className={`text-sm font-semibold ${dark ? "text-white" : ""}`} role="status">Done. We'll email you when a new {classes.map(assetClassLabel).join(", ").toLowerCase()} strategy publishes.</p>;
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
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Asset classes</legend>
        {["Equities", "ETFs", "Crypto"].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={classes.includes(c)}
            onClick={() => toggle(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              classes.includes(c) ? "border-primary bg-primary text-primary-foreground" : dark ? "border-white/30 text-white" : "border-border-strong text-foreground"
            }`}
          >
            {assetClassLabel(c)}
          </button>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" required placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:max-w-xs" />
        <Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Email me new strategies"}</Button>
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <div className={dark ? "[&_span]:text-white/70" : ""}>
        <Check checked={consent} onChange={setConsent}>
          {consentText}{" "}
          <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
        </Check>
      </div>
      {error && <p className="text-sm font-semibold text-loss" role="alert">{error}</p>}
    </form>
  );
}
