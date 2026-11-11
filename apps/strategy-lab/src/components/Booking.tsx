"use client";
// Book a demo, in place (S1, S2, S11, S14). Step one asks who the visitor is
// and their account size once, prefilled from what they already entered, and
// sends it to HubSpot with the strategy in view and the strategies viewed.
// Step two is the HubSpot scheduler, prefilled. Step three confirms, lists
// what they looked at and offers a calendar hold.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { ACCOUNT_SIZE_RANGES, rangeFor } from "@/lib/strategies";
import { readVisitor, writeVisitor } from "@/lib/visitor";
import type { BookingContent, ActionsContent } from "@/lib/content";
import { sendLead } from "./api";
import { Button, Check, Field, Input, Select } from "./ui";

export interface BookingSettings {
  booking: BookingContent;
  actions: ActionsContent;
  exchanges: string[];
  /** slug -> "#41 NVDA Accumulation", for the confirmation. */
  names: Record<string, string>;
}

interface OpenOptions {
  strategy?: string;
  source: string;
}

const Ctx = createContext<{ open: (o: OpenOptions) => void; settings: BookingSettings } | null>(null);

export function useBooking() {
  const c = useContext(Ctx);
  if (!c) throw new Error("BookingProvider missing");
  return c;
}

export function BookingProvider({ settings, children }: { settings: BookingSettings; children: ReactNode }) {
  const [opts, setOpts] = useState<OpenOptions | null>(null);
  const open = useCallback((o: OpenOptions) => {
    track("booking_opened", { strategy: o.strategy ?? null, source: o.source, viewed: readVisitor().viewed.length });
    setOpts(o);
  }, []);
  const value = useMemo(() => ({ open, settings }), [open, settings]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {opts && <BookingDialog onClose={() => setOpts(null)} strategy={opts.strategy} source={opts.source} />}
    </Ctx.Provider>
  );
}

function BookingDialog({ onClose, strategy, source }: { onClose: () => void; strategy?: string; source: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="booking-title"
      className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-card p-0 backdrop:bg-navy/60 sm:m-auto sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-lg sm:shadow-lg"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p id="booking-title" className="text-base font-extrabold">Book a demo</p>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <BookingFlow strategy={strategy} source={source} />
        </div>
      </div>
    </dialog>
  );
}

type Step = "form" | "schedule" | "done";

interface MeetingPayload {
  start?: string;
  end?: string;
}

function readMeeting(data: unknown): MeetingPayload | null {
  const d = data as { meetingBookSucceeded?: boolean; meetingsPayload?: { bookingResponse?: { postResponse?: { timerange?: { start?: number | string; end?: number | string } }; event?: { dateTime?: number | string; duration?: number } } } };
  if (!d || typeof d !== "object" || !d.meetingBookSucceeded) return null;
  const br = d.meetingsPayload?.bookingResponse;
  const tr = br?.postResponse?.timerange;
  const iso = (v: number | string | undefined) => (v === undefined ? undefined : new Date(typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v).toISOString());
  const start = iso(tr?.start ?? br?.event?.dateTime);
  const end = iso(tr?.end) ?? (start && br?.event?.duration ? new Date(new Date(start).getTime() + br.event.duration).toISOString() : undefined);
  return { start, end };
}

function icsFor(m: MeetingPayload, url: string): string | null {
  if (!m.start) return null;
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = m.end ?? new Date(new Date(m.start).getTime() + 30 * 60_000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arch Public//Strategy Lab//EN",
    "BEGIN:VEVENT",
    `UID:${fmt(m.start)}-strategy-lab@archpublic.com`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(m.start)}`,
    `DTEND:${fmt(end)}`,
    "SUMMARY:Arch Public demo",
    `DESCRIPTION:Your Arch Public demo. Strategies you looked at: ${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function BookingFlow({ strategy, source, inline = false }: { strategy?: string; source: string; inline?: boolean }) {
  const { settings } = useBooking();
  const { booking, exchanges, names } = settings;
  const [step, setStep] = useState<Step>("form");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [range, setRange] = useState("");
  const [exchange, setExchange] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentCalls, setConsentCalls] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [meeting, setMeeting] = useState<MeetingPayload | null>(null);
  const [viewed, setViewed] = useState<string[]>([]);

  useEffect(() => {
    const v = readVisitor();
    setRange(rangeFor(v.accountSize ?? v.finder?.accountSize ?? null));
    setExchange(v.finder?.exchange ?? "");
    setViewed(v.viewed.slice(0, 5));
  }, []);

  useEffect(() => {
    if (step !== "schedule") return;
    const onMessage = (e: MessageEvent) => {
      if (!/hubspot\.com$/.test(new URL(e.origin).hostname)) return;
      const m = readMeeting(e.data);
      if (!m) return;
      setMeeting(m);
      setStep("done");
      track("booking_completed", { strategy: strategy ?? null, source });
      void sendLead({ kind: "booking_completed", email, firstName: first, lastName: last, strategyInView: strategy, meetingStart: m.start });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [step, email, first, last, strategy, source]);

  const submit = async () => {
    setError("");
    if (!first.trim() || !email.trim()) return setError("Enter your name and email.");
    if (!range) return setError("Choose the account size you have in mind.");
    setBusy(true);
    const r = await sendLead({
      kind: "booking_started",
      email,
      firstName: first,
      lastName: last,
      accountSizeRange: range,
      exchange,
      strategyInView: strategy,
      consentMarketing,
      consentCalls,
      website,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong. Please try again.");
    writeVisitor({ identified: true });
    track("booking_form_submitted", { strategy: strategy ?? null, source, account_size_range: range });
    setStep("schedule");
  };

  if (step === "schedule") {
    const u = new URL(booking.meetingUrl);
    u.searchParams.set("embed", "true");
    u.searchParams.set("firstName", first);
    if (last) u.searchParams.set("lastName", last);
    u.searchParams.set("email", email);
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pick a time that suits you. It takes about 30 minutes.</p>
        <iframe title="Choose a time for your demo" src={u.toString()} className="h-[680px] w-full rounded-md border border-border bg-card" />
      </div>
    );
  }

  if (step === "done") {
    const ics = meeting ? icsFor(meeting, typeof window !== "undefined" ? window.location.href : "") : null;
    return (
      <div className="space-y-4" role="status">
        <div>
          <p className="text-lg font-extrabold">You're booked.</p>
          {meeting?.start && (
            <p className="text-sm text-muted-foreground">
              {new Date(meeting.start).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        <p className="text-sm">{booking.confirmationNote}</p>
        {booking.responseTime && <p className="text-sm text-muted-foreground">{booking.responseTime}</p>}
        {viewed.length > 0 && (
          <div>
            <p className="eyebrow mb-1">We'll have these ready</p>
            <ul className="space-y-1 text-sm">
              {viewed.map((slug) => (
                <li key={slug}>
                  <a className="font-semibold text-primary hover:underline" href={`/strategy-lab/${slug}`}>
                    {names[slug] ?? slug}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ics && (
          <a href={ics} download="arch-public-demo.ics" className="inline-flex text-sm font-semibold text-primary hover:underline">
            Add a hold to your calendar
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className={`space-y-3 ${inline ? "" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {strategy && names[strategy] && (
        <p className="rounded-md bg-chip px-3 py-2 text-xs font-semibold text-navy">About {names[strategy]}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required />
        </Field>
        <Field label="Last name">
          <Input autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
        </Field>
      </div>
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account size you have in mind">
          <Select value={range} onChange={(e) => setRange(e.target.value)} required>
            <option value="">Choose…</option>
            {ACCOUNT_SIZE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Exchange or brokerage">
          <Select value={exchange} onChange={(e) => setExchange(e.target.value)}>
            <option value="">Not sure yet</option>
            {exchanges.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            <option value="Other">Other</option>
          </Select>
        </Field>
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <div className="space-y-2 pt-1">
        <Check checked={consentMarketing} onChange={setConsentMarketing}>{booking.consentMarketing}</Check>
        <Check checked={consentCalls} onChange={setConsentCalls}>{booking.consentCalls}</Check>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {booking.collectionNotice}{" "}
        <a className="underline" href={settings.actions.privacyUrl} target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </p>
      {error && <p className="text-sm font-semibold text-loss" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : "Choose a time"}
      </Button>
    </form>
  );
}

export function BookDemoButton({ strategy, source, className = "", variant = "primary", children }: { strategy?: string; source: string; className?: string; variant?: "primary" | "secondary" | "onDark"; children?: ReactNode }) {
  const { open, settings } = useBooking();
  return (
    <Button variant={variant} className={className} onClick={() => open({ strategy, source })}>
      {children ?? settings.actions.bookDemo}
    </Button>
  );
}

export function StartFreeLink({ source, strategy, className = "", variant = "secondary" }: { source: string; strategy?: string; className?: string; variant?: "primary" | "secondary" | "onDark" }) {
  const { settings } = useBooking();
  const cls = {
    primary: "bg-primary text-primary-foreground border-transparent hover:brightness-110",
    secondary: "border-border-strong bg-card text-foreground hover:border-primary hover:text-primary",
    onDark: "border-white/30 text-white hover:bg-white/10",
  }[variant];
  return (
    <a
      href={settings.actions.startFreeUrl}
      onClick={() => track("start_free_clicked", { source, strategy: strategy ?? null })}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cls} ${className}`}
    >
      {settings.actions.startFree}
    </a>
  );
}
