"use client";
// "Email me this" (S4): sends the figures at the visitor's account size and
// captures the contact.
import { useState } from "react";
import { formatMoney } from "@core";
import { track } from "@/lib/analytics";
import { writeVisitor } from "@/lib/visitor";
import { sendLead } from "./api";
import { Button, Check, Input } from "./ui";
import { useVisitor } from "./useVisitor";

export function EmailMeThis({
  slug,
  startingCapital,
  consentText,
  privacyUrl,
  source = "strategy",
  boxed = false,
}: {
  slug: string;
  startingCapital: number;
  consentText: string;
  privacyUrl: string;
  /** Where the form sits, for analytics only (redesign PRD section 8). */
  source?: string;
  /** Strategy page: in its own bordered box. */
  boxed?: boolean;
}) {
  const v = useVisitor();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const amount = v?.accountSize ?? startingCapital;

  const fieldId = `email-figures-${source}`;
  const box = boxed ? "rounded-lg border border-line px-6 py-5" : "";
  if (state === "done") return <p className={`text-sm font-semibold text-navy ${box}`} role="status">On its way to {email}.</p>;
  return (
    <form
      className={`space-y-2.5 ${box}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setState("busy");
        const r = await sendLead({ kind: "email_me_this", email, strategyInView: slug, accountSize: amount, consentMarketing: consent, website });
        if (!r.ok) {
          setState("idle");
          return setError(r.error ?? "Please try again.");
        }
        writeVisitor({ identified: true });
        track("email_me_this_sent", { strategy: slug, amount: Math.round(amount), source });
        setState("done");
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-[1_1_220px]">
          <label htmlFor={fieldId} className={`block text-navy ${boxed ? "text-sm font-extrabold" : "text-[13px] font-bold"}`}>
            Email me these figures
          </label>
          <Input id={fieldId} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
        </div>
        <Button type="submit" disabled={state === "busy"} className="min-h-[48px] px-5 text-[15px]">
          {state === "busy" ? "Sending…" : "Send"}
        </Button>
      </div>
      <p className="text-xs text-ink-muted">We'll email this strategy's results at {formatMoney(amount)}.</p>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <Check checked={consent} onChange={setConsent}>
        {consentText}{" "}
        <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
      </Check>
      {error && <p className="text-sm font-semibold text-loss" role="alert">{error}</p>}
    </form>
  );
}
