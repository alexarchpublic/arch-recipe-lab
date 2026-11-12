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
import { inFrame } from "@/lib/frame";
import { publicPageUrl } from "@/lib/hubspot";
import { sendLead, type LeadSettings } from "./api";
import { Button, Check, Field, Input, Select } from "./ui";

export interface BookingSettings {
  booking: BookingContent;
  actions: ActionsContent;
  exchanges: string[];
  /** slug -> "#41 NVDA Accumulation (NVDA)", for the confirmation and captures. */
  names: Record<string, string>;
  /** slug -> [asset, asset class], for captures. */
  assets: Record<string, [string, string]>;
}

/** What sendLead needs, from the settings every page carries. */
export function useLeadSettings(): LeadSettings {
  const { settings } = useBooking();
  return useMemo(
    () => ({
      names: settings.names,
      assets: settings.assets,
      consentMarketingText: settings.booking.consentMarketing,
      processText: settings.booking.collectionNotice,
    }),
    [settings],
  );
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

const MEETINGS_LOADER = "https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js";

/**
 * HubSpot's own scheduler embed: a `meetings-iframe-container` with the link
 * in `data-src`, filled by HubSpot's loader. archpublic.com's page engine
 * knows this shape: it lets the loader and calendar through, relays a
 * completed booking to the main site, and shows a "pick a time" card to a
 * visitor who has opted out of third parties (a bare iframe of ours would be
 * blank for them). The loader fills containers present when it runs, so it is
 * added after the container renders.
 */
function Scheduler({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || host.querySelector("iframe")) return;
    const script = document.createElement("script");
    script.src = MEETINGS_LOADER;
    script.async = true;
    host.after(script);
    return () => script.remove();
  }, [src]);
  return <div ref={ref} className="meetings-iframe-container min-h-[680px] w-full" data-src={src} />;
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
  const lead = useLeadSettings();
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
      void sendLead({ kind: "booking_completed", email, firstName: first, lastName: last, strategyInView: strategy, meetingStart: m.start }, lead);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [step, email, first, last, strategy, source, lead]);

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
    }, lead);
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
        <Scheduler src={u.toString()} />
      </div>
    );
  }

  if (step === "done") {
    // The page engine's frame cannot download files, and HubSpot's own invite
    // already carries the meeting, so the calendar hold is offered only here.
    const framed = typeof window !== "undefined" && inFrame();
    const ics = meeting && !framed ? icsFor(meeting, publicPageUrl()) : null;
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
                  <a className="font-semibold text-primary hover:underline" href={`/${slug}`}>
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
          <Input name="firstname" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required />
        </Field>
        <Field label="Last name">
          <Input name="lastname" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
        </Field>
      </div>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account size you have in mind">
          <Select name="account_size_range" value={range} onChange={(e) => setRange(e.target.value)} required>
            <option value="">Choose…</option>
            {ACCOUNT_SIZE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Exchange or brokerage">
          <Select name="exchange" value={exchange} onChange={(e) => setExchange(e.target.value)}>
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
        <Check name="consent_marketing" checked={consentMarketing} onChange={setConsentMarketing}>{booking.consentMarketing}</Check>
        <Check name="consent_calls" checked={consentCalls} onChange={setConsentCalls}>{booking.consentCalls}</Check>
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

export function StartFreeLink({ source, strategy, className = "", variant = "secondary" }: { source: string; strategy?: string; className?: string; variant?: "primary" | "secondary" | "onDark" | "white" }) {
  const { settings } = useBooking();
  const cls = {
    primary: "bg-primary text-primary-foreground border-transparent hover:brightness-110",
    secondary: "border-line-strong bg-card text-navy hover:border-navy",
    onDark: "border-white/[0.28] text-white hover:bg-white/10",
    white: "border-transparent bg-white text-navy hover:bg-tint",
  }[variant];
  return (
    <a
      href={settings.actions.startFreeUrl}
      onClick={() => track("start_free_clicked", { source, strategy: strategy ?? null })}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border px-5 text-sm font-extrabold transition ${cls} ${className}`}
    >
      {settings.actions.startFree}
    </a>
  );
}
