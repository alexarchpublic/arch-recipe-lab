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

export function EmailMeThis({ slug, startingCapital, consentText, privacyUrl }: { slug: string; startingCapital: number; consentText: string; privacyUrl: string }) {
  const v = useVisitor();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const amount = v?.accountSize ?? startingCapital;

  if (state === "done") return <p className="text-sm font-semibold" role="status">On its way to {email}.</p>;
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Email me these figures
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
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
        track("email_me_this_sent", { strategy: slug, amount: Math.round(amount) });
        setState("done");
      }}
    >
      <p className="text-xs text-muted-foreground">We'll email this strategy's results at {formatMoney(amount)}.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" required placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:max-w-xs" />
        <Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send"}</Button>
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <Check checked={consent} onChange={setConsent}>
        {consentText}{" "}
        <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
      </Check>
      {error && <p className="text-sm font-semibold text-loss" role="alert">{error}</p>}
    </form>
  );
}
