"use client";
// What a visitor has done on Strategy Lab, kept in their browser until they
// identify themselves, then sent with the capture (S2, S3). Nothing here is
// sent anywhere on its own.

export interface Touch {
  source: string; // utm_source, or the referring host, or "direct"
  medium: string;
  campaign: string;
  landing: string;
  at: string;
}

export interface FinderAnswers {
  assetClass: string; // "Equities" | "ETFs" | "Crypto" | ""
  asset: string;
  goal: string; // a focus value, or ""
  exchange: string;
  accountSize: number | null;
}

export interface VisitorState {
  viewed: string[]; // slugs, most recent first
  finder: FinderAnswers | null;
  accountSize: number | null;
  firstTouch: Touch | null;
  lastTouch: Touch | null;
  partner: string;
  identified: boolean;
}

const KEY = "strategy-lab:visitor:v1";
const EMPTY: VisitorState = { viewed: [], finder: null, accountSize: null, firstTouch: null, lastTouch: null, partner: "", identified: false };

export function readVisitor(): VisitorState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<VisitorState>) };
  } catch {
    return { ...EMPTY };
  }
}

const listeners = new Set<(s: VisitorState) => void>();

export function writeVisitor(patch: Partial<VisitorState> | ((s: VisitorState) => Partial<VisitorState>)): VisitorState {
  const cur = readVisitor();
  const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: the session still works, it is just not remembered
  }
  listeners.forEach((l) => l(next));
  return next;
}

export function subscribeVisitor(fn: (s: VisitorState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recordView(slug: string): void {
  writeVisitor((s) => ({ viewed: [slug, ...s.viewed.filter((v) => v !== slug)].slice(0, 20) }));
}

/** First and last touch, and a partner from ?partner= (S2). */
export function recordTouch(partnerFromPage = ""): void {
  const url = new URL(window.location.href);
  const p = url.searchParams;
  const ref = document.referrer ? new URL(document.referrer).hostname : "";
  const internal = !ref || /(^|\.)archpublic\.com$/.test(ref) || ref === window.location.hostname;
  const utm = p.get("utm_source");
  const partner = partnerFromPage || p.get("partner") || p.get("ref") || "";
  if (!utm && internal && !partner) {
    writeVisitor((s) => (s.firstTouch ? {} : { firstTouch: touchOf("direct", "", "", url) }));
    return;
  }
  const t = touchOf(utm || ref || "partner", p.get("utm_medium") || (utm ? "" : "referral"), p.get("utm_campaign") || "", url);
  writeVisitor((s) => ({ firstTouch: s.firstTouch ?? t, lastTouch: t, partner: partner || s.partner }));
}

function touchOf(source: string, medium: string, campaign: string, url: URL): Touch {
  return { source, medium, campaign, landing: url.pathname, at: new Date().toISOString() };
}

export const touchText = (t: Touch | null): string =>
  t ? [t.source, t.medium, t.campaign].filter(Boolean).join(" / ") + ` (${t.landing}, ${t.at.slice(0, 10)})` : "";
