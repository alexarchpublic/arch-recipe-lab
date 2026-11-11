// Strategy Lab's marketing-owned copy, layout and switches (PRD S12, A10, C5).
// Shared by the public site, which reads it, and the admin console, which edits it.
//
// Stored in public.site_content as one JSON object per key and set in the
// admin console by approvers and marketing editors; changes show without a
// deploy. The defaults below stand for any key or field not set. Figures are
// never stored here: the database refuses a value that names a figure field,
// and every number on the site comes from the published strategy.

export type SectionId = "finder" | "library" | "top" | "how" | "proof" | "clients" | "book";
export const ALL_SECTIONS: SectionId[] = ["finder", "library", "top", "how", "proof", "clients", "book"];

export interface ProofItem {
  quote?: string;
  name?: string;
  role?: string;
  /** A case study page or article. */
  href?: string;
  title?: string;
  /** Strategies the case study uses, by slug (S17). */
  strategies?: string[];
}

export interface HomeContent {
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    /** Slug of the strategy shown in the hero. Empty: the highest return. */
    featured: string;
  };
  trust: {
    custody: string;
    exchanges: string[];
    exchangesNote: string;
    /** Who runs the demo, by name (design principle 4). */
    demoBy: string;
  };
  sections: SectionId[];
  /** Top strategies, by slug, in order. Empty: ranked by return. */
  featured: string[];
  top: { title: string; subtitle: string };
  how: { title: string; steps: Array<{ title: string; body: string }>; videoUrl: string; videoLabel: string };
  proof: { title: string; items: ProofItem[] };
  clients: { title: string; body: string; bullets: string[] };
  book: { title: string; body: string };
}

export interface ActionsContent {
  bookDemo: string;
  startFree: string;
  startFreeUrl: string;
  signIn: string;
  signInUrl: string;
  privacyUrl: string;
}

export interface BookingContent {
  /** The HubSpot meeting link. The owner supplies the final one (PRD 14). */
  meetingUrl: string;
  /** The stated sales response time (S11). Hidden while empty. */
  responseTime: string;
  confirmationNote: string;
  /** The settings label on every strategy page (S12, experiment 4). */
  settingsLabel: string;
  consentMarketing: string;
  consentCalls: string;
  collectionNotice: string;
}

export interface SiteConfig {
  /** C5: each can be switched off by configuration. */
  finder: boolean;
  accountSize: boolean;
  emailMeThis: boolean;
  alerts: boolean;
  /** C5: public fields to hide, by store field name. */
  hiddenFields: string[];
  /** Strategy pages show the "how it trades" block only with research's text (S13). */
  requireNarrative: boolean;
}

export interface PartnerContent {
  slug: string;
  name: string;
  partnerId: string;
  headline: string;
  subhead: string;
  logoUrl: string;
  featured: string[];
  seo: { title: string; description: string };
}

export interface SiteContent {
  home: HomeContent;
  actions: ActionsContent;
  booking: BookingContent;
  config: SiteConfig;
  partners: Record<string, PartnerContent>;
}

export const DEFAULT_CONTENT: Omit<SiteContent, "partners"> = {
  home: {
    seo: {
      title: "Strategy Lab · Algorithm strategies for stocks, ETFs and crypto | Arch Public",
      description:
        "Browse Arch Public's algorithm strategies across stocks, ETFs and crypto, with backtested results, how each one trades, and what it would have done at your account size.",
    },
    hero: {
      eyebrow: "Arch Public Strategy Lab",
      headline: "Great investing isn't about being smart. It's about not being emotional.",
      subhead:
        "Algorithm strategies for stocks, ETFs and crypto, with the results of every backtest and how each one trades. See any of them at your own account size.",
      featured: "",
    },
    trust: {
      custody: "Your assets stay in your own exchange or brokerage account.",
      exchanges: ["Coinbase", "Kraken", "Gemini", "OKX", "Robinhood", "tastytrade"],
      exchangesNote: "Strategies run through TradingView on the account you already use.",
      demoBy: "",
    },
    sections: ALL_SECTIONS,
    featured: [],
    top: { title: "Top strategies", subtitle: "Ranked by return over each strategy's own test period." },
    how: {
      title: "How it works",
      steps: [
        { title: "Connect", body: "Link the exchange or brokerage account you already use. Your assets never leave it." },
        { title: "Choose", body: "Pick strategies from the library and size them to the capital you plan to trade." },
        { title: "Run", body: "The algorithm trades by its rules, without emotion. You can see and change every setting." },
      ],
      videoUrl: "",
      videoLabel: "Watch the walkthrough",
    },
    proof: { title: "Clients and case studies", items: [] },
    clients: {
      title: "Strategy Lab Pro comes with every client account",
      body: "Every Arch Public account includes Strategy Lab Pro, the free tier too. It is where you get the exact settings and put a strategy to work.",
      bullets: [
        "The exact settings of every strategy, sized to your capital",
        "Portfolios that combine strategies, saved for later",
        "Guided setup in TradingView, with a copy button on every value",
        "A note when a strategy you hold is updated",
      ],
    },
    book: {
      title: "See it working with your capital",
      body: "A 30-minute demo, live, with the assets you trade and the account size you have in mind.",
    },
  },
  actions: {
    bookDemo: "Book a demo",
    startFree: "Start free",
    startFreeUrl: "https://archpublic.com/start",
    signIn: "Client sign-in",
    signInUrl: "https://archpublic.com/login",
    privacyUrl: "https://archpublic.com/privacy",
  },
  booking: {
    meetingUrl: "https://meetings.hubspot.com/done/arch-public-demo-strategy-lab",
    responseTime: "",
    confirmationNote: "You'll get a calendar invitation and a reminder before the call. Each email has a link to reschedule.",
    settingsLabel: "Exact settings come with every client account, the free tier included, in Strategy Lab Pro.",
    consentMarketing: "Email me about new strategies and Arch Public news. Unsubscribe at any time.",
    consentCalls: "You may call or text me about my demo.",
    collectionNotice:
      "We attach the strategies you looked at and your earlier visits to this site to your contact record, so the person you speak to can prepare.",
  },
  config: {
    finder: true,
    accountSize: true,
    emailMeThis: true,
    alerts: true,
    hiddenFields: [],
    requireNarrative: false,
  },
};

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Deep merge where arrays and scalars replace, and wrong types are ignored. */
export function mergeDeep<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return base;
  const out: Json = { ...(base as Json) };
  for (const [k, v] of Object.entries(over)) {
    if (!(k in out) || v === null || v === undefined) continue;
    const b = out[k];
    if (isObj(b)) out[k] = mergeDeep(b, v);
    else if (Array.isArray(b)) out[k] = Array.isArray(v) ? v : b;
    else if (typeof b === typeof v) out[k] = v;
  }
  return out as T;
}

export function mergeSiteContent(rows: Array<{ key: string; value: Json }>): SiteContent {
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? {};
  const homeRow = get("home");
  const home = mergeDeep(DEFAULT_CONTENT.home, homeRow);
  home.sections = (home.sections ?? []).filter((s): s is SectionId => ALL_SECTIONS.includes(s as SectionId));
  const bookingRow = get("booking");
  const partners: Record<string, PartnerContent> = {};
  for (const r of rows) {
    if (!r.key.startsWith("partner:")) continue;
    const slug = r.key.slice("partner:".length);
    const v = r.value;
    const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
    const name = str("name") || slug;
    partners[slug] = {
      slug,
      name,
      partnerId: str("partner_id") || str("partnerId") || slug,
      headline: str("headline") || `Strategy Lab for ${name} members`,
      subhead: str("subhead") || DEFAULT_CONTENT.home.hero.subhead,
      logoUrl: str("logo_url") || str("logoUrl"),
      featured: Array.isArray(v.featured) ? (v.featured as unknown[]).filter((x): x is string => typeof x === "string") : [],
      seo: {
        title: (isObj(v.seo) && typeof v.seo.title === "string" && v.seo.title) || `Strategy Lab with ${name} | Arch Public`,
        description: (isObj(v.seo) && typeof v.seo.description === "string" && v.seo.description) || DEFAULT_CONTENT.home.seo.description,
      },
    };
  }
  return {
    home,
    actions: mergeDeep(DEFAULT_CONTENT.actions, isObj(homeRow.actions) ? homeRow.actions : {}),
    booking: mergeDeep(DEFAULT_CONTENT.booking, bookingRow),
    config: mergeDeep(DEFAULT_CONTENT.config, get("config")),
    partners,
  };
}
