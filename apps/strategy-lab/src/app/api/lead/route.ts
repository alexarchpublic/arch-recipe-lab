// Every capture on the public site (S2 to S5, S14): booking, new-strategy
// alerts and "email me this". Each is forwarded to HubSpot and recorded in the
// store with the outcome, so nothing is lost while the HubSpot form is set up.
import { NextResponse } from "next/server";
import {
  displayCagr,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  formatTestWindow,
  scaledResults,
  vsBuyHold,
  vsDca,
  type PublicStrategy,
} from "@core";
import { getSiteContent, getStrategies } from "@/lib/data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, canonicalUrl } from "@/lib/env";
import { type HubSpotFields, submitToHubSpot } from "@/lib/hubspot";
import { ACCOUNT_SIZE_RANGES, assetClassLabel, focusLabel, rangeFor } from "@/lib/strategies";

export const dynamic = "force-dynamic";

const KINDS = ["booking_started", "booking_completed", "alert", "email_me_this"] as const;
type Kind = (typeof KINDS)[number];

interface LeadBody {
  kind: Kind;
  email: string;
  firstName?: string;
  lastName?: string;
  accountSize?: number | null;
  accountSizeRange?: string;
  exchange?: string;
  goal?: string;
  assetClass?: string;
  asset?: string;
  alertAssetClasses?: string[];
  strategyInView?: string;
  viewed?: string[];
  firstTouch?: string;
  lastTouch?: string;
  partner?: string;
  consentMarketing?: boolean;
  consentCalls?: boolean;
  pageUri?: string;
  pageName?: string;
  meetingStart?: string;
  website?: string; // honeypot
}

const clip = (v: unknown, n = 200): string => (typeof v === "string" ? v.trim().slice(0, n) : "");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function strategyName(s: PublicStrategy): string {
  return `#${s.display_number} ${s.short_name} (${s.asset})`;
}

/** The figures an "email me this" request carries, formatted by the shared package (R3). */
function figuresText(s: PublicStrategy, capital: number | null): string {
  const scaled = scaledResults(s, capital ?? s.starting_capital);
  const cagr = displayCagr(s);
  const bh = vsBuyHold(s);
  const dca = vsDca(s);
  const lines = [
    `${s.title}: #${s.display_number} ${s.short_name}, ${s.asset}`,
    `Backtested results, ${formatTestWindow(s)}`,
    `Starting with ${formatMoney(scaled.beginning)}: ending value ${formatMoney(scaled.ending)}, net profit ${formatSignedCurrency(Math.round(scaled.netProfit))}`,
    scaled.cashProfit !== null ? `Cash profit ${formatSignedCurrency(Math.round(scaled.cashProfit))}` : "",
    scaled.assetQty !== null ? `Asset accumulated ${formatQuantity(scaled.assetQty, s.asset_class)} ${s.asset}` : "",
    `Return ${formatSignedPercent(s.return_pct)}${cagr !== null ? `, CAGR ${formatPercent(cagr)}` : ""}`,
    bh !== null ? `Against buy and hold ${formatSignedPercent(bh)}` : "",
    dca !== null ? `Against buying monthly (DCA) ${formatSignedPercent(dca)}` : "",
    canonicalUrl(`/${s.slug}`),
  ];
  return lines.filter(Boolean).join("\n");
}

async function recordLead(kind: Kind, email: string, payload: Record<string, unknown>, hubspotStatus: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_lead`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_email: email, p_payload: payload, p_hubspot_status: hubspotStatus }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: LeadBody;
  try {
    body = (await request.json()) as LeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (body.website) return NextResponse.json({ ok: true }); // a bot filled the hidden field
  const kind = KINDS.find((k) => k === body.kind);
  const email = clip(body.email, 254).toLowerCase();
  if (!kind) return NextResponse.json({ ok: false, error: "Unknown request." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });

  const [all, content] = await Promise.all([getStrategies().catch(() => [] as PublicStrategy[]), getSiteContent()]);
  const bySlug = new Map(all.map((s) => [s.slug, s]));
  const inView = body.strategyInView ? bySlug.get(clip(body.strategyInView)) ?? null : null;
  const viewed = (Array.isArray(body.viewed) ? body.viewed : [])
    .map((v) => bySlug.get(clip(v)))
    .filter((s): s is PublicStrategy => !!s)
    .slice(0, 5);
  const accountSize = typeof body.accountSize === "number" && body.accountSize > 0 && body.accountSize < 1e10 ? Math.round(body.accountSize) : null;
  const range = ACCOUNT_SIZE_RANGES.find((r) => r.id === body.accountSizeRange)?.id ?? rangeFor(accountSize);
  const rangeLabel = ACCOUNT_SIZE_RANGES.find((r) => r.id === range)?.label ?? "";
  const alertClasses = (Array.isArray(body.alertAssetClasses) ? body.alertAssetClasses : [])
    .map((c) => clip(c, 20))
    .filter((c) => ["Equities", "ETFs", "Crypto"].includes(c));
  const interestClasses = [...new Set([clip(body.assetClass, 20), ...alertClasses, ...viewed.map((s) => s.asset_class)].filter(Boolean))];
  const interestAssets = [...new Set([clip(body.asset, 20), ...viewed.map((s) => s.asset)].filter(Boolean))];

  if (kind === "email_me_this" && !inView) {
    return NextResponse.json({ ok: false, error: "That strategy is not published." }, { status: 400 });
  }
  const emailFigures = kind === "email_me_this" && inView ? figuresText(inView, accountSize) : "";

  const fields: HubSpotFields = {
    email,
    firstname: clip(body.firstName, 80),
    lastname: clip(body.lastName, 80),
    purchasing_power: accountSize ?? undefined,
    partner_name: clip(body.partner, 80),
    equitiesetf_algo_interest: interestClasses.some((c) => c === "Equities" || c === "ETFs") ? "true" : undefined,
    sl_capture_kind: kind,
    sl_account_size_range: rangeLabel,
    sl_goal: body.goal ? focusLabel(clip(body.goal, 40)) : "",
    sl_exchange: clip(body.exchange, 60),
    sl_asset_interest: [...interestClasses.map(assetClassLabel), ...interestAssets].join(", "),
    sl_strategy_in_view: inView ? strategyName(inView) : "",
    sl_strategies_viewed: viewed.map(strategyName).join("; "),
    sl_first_touch: clip(body.firstTouch, 300),
    sl_last_touch: clip(body.lastTouch, 300),
    sl_alert_asset_classes: alertClasses.map(assetClassLabel).join(", "),
    sl_email_me_this: emailFigures,
    sl_meeting_start: clip(body.meetingStart, 40),
    sl_consent_calls: body.consentCalls ? "true" : "false",
  };

  const hutk = request.headers.get("cookie")?.match(/(?:^|;\s*)hubspotutk=([^;]+)/)?.[1];
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const hs = await submitToHubSpot(
    fields,
    { hutk, pageUri: clip(body.pageUri, 500), pageName: clip(body.pageName, 200), ipAddress: ip },
    {
      marketing: !!body.consentMarketing,
      calls: !!body.consentCalls,
      marketingText: content.booking.consentMarketing,
      callsText: content.booking.consentCalls,
      processText: content.booking.collectionNotice,
    },
  );
  const hubspotStatus = hs.status === "ok" ? (hs.dropped?.length ? `ok; dropped ${hs.dropped.join(",")}` : "ok") : `${hs.status}${hs.detail ? `: ${hs.detail}` : ""}`;
  const stored = await recordLead(kind, email, { ...fields, page: clip(body.pageUri, 500) }, hubspotStatus);

  if (hs.status === "error" && !stored) {
    console.error("lead lost", kind, hubspotStatus);
    return NextResponse.json({ ok: false, error: "We could not save that. Please try again." }, { status: 502 });
  }
  if (hs.status !== "ok") console.warn("lead not in HubSpot", kind, hubspotStatus);
  return NextResponse.json({ ok: true });
}
