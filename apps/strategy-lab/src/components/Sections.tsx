// Home page sections (redesign PRD section 4). Order and copy come from site
// content (S12), where marketing can override them; figures come from the
// published strategies. The hero always renders first.
import Link from "@/components/Link";
import { type PublicStrategy, DisclaimerSlot, basisLabel, formatMoney, formatSignedPercent, formatTestWindow, heroCaseLine } from "@core";
import type { HomeContent, ProofItem, SiteContent } from "@/lib/content";
import { assetClassLabel, chartFields, classCounts, librarySummary, topStrategies } from "@/lib/strategies";
import { AccountSize } from "./AccountSize";
import { AlertCapture } from "./AlertCapture";
import { ClassChips } from "./ClassChips";
import { BookDemoButton, BookingFlow, StartFreeLink } from "./Booking";
import { ArrowDown, ArrowRight, ArrowUp, HeroChart } from "./Chart";
import { ComparisonBars } from "./ComparisonBars";
import { EmailMeThis } from "./EmailMeThis";
import { Finder } from "./Finder";
import { ResultsBlock } from "./ResultsBlock";
import { StrategyCard } from "./StrategyCard";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function SectionHead({ id, eyebrow, title, sub, dark = false, className = "" }: { id: string; eyebrow?: string; title: string; sub?: string; dark?: boolean; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <p className={dark ? "kicker !text-on-navy" : "kicker"}>{eyebrow}</p>}
      <h2 id={id} className={`section-title mt-3 max-w-[760px] ${dark ? "!text-white" : ""}`}>{title}</h2>
      {sub && <p className={`mt-3 max-w-[620px] text-lg leading-relaxed ${dark ? "text-white/[0.82]" : "text-ink"}`}>{sub}</p>}
    </div>
  );
}

function Tick() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-bar-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** "Strategy #74 · INTC · 1 Week chart" */
export function strategyLine(s: PublicStrategy): string {
  return `Strategy #${s.display_number} · ${s.asset}${s.time_frame ? ` · ${s.time_frame} chart` : ""}`;
}

/** Basis pill, test window and starting capital: the line beside every result (C1, C3). */
export function BasisWindowLine({ s, tested = false, className = "" }: { s: PublicStrategy; tested?: boolean; className?: string }) {
  return (
    <p className={`text-[13px] leading-normal text-ink-muted ${className}`} data-disclosure="results">
      <span data-disclosure="basis" data-basis={s.basis} className="mr-1 inline-block rounded-full bg-tint px-2 py-0.5 text-xs font-bold text-tint-ink">
        {basisLabel(s).replace(/ results$/, "")}
      </span>{" "}
      <span data-field="test_window">{formatTestWindow(s)}</span> · {tested ? "tested at " : ""}
      <span data-field="starting_capital" data-raw={s.starting_capital}>{formatMoney(s.starting_capital)}</span> starting capital
    </p>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function Hero({
  home,
  hero,
  count,
  eyebrow,
  headline,
  subhead,
  source = "hero",
}: {
  home: HomeContent;
  hero: PublicStrategy | null;
  count: number;
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  source?: string;
}) {
  const line = hero ? heroCaseLine(home, hero.slug) ?? hero.title : null;
  return (
    <section id="top" data-theme="navy" className="bg-navy pt-14 text-white md:pt-[72px]">
      <div className="container">
        <div className="flex flex-wrap items-end gap-12">
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="kicker !text-on-navy">{eyebrow ?? home.hero.eyebrow}</p>
            <h1 className="mt-4 text-[clamp(40px,5.4vw,76px)] font-black leading-none tracking-[-0.025em] text-white">{headline ?? home.hero.headline}</h1>
            <p className="mt-6 max-w-[560px] text-[19px] leading-[1.55] text-white/[0.82]">{subhead ?? home.hero.subhead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BookDemoButton source={source} className="!min-h-[52px] !px-[26px] !text-base" />
              <Link
                href="/strategies"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-white/[0.28] px-[26px] text-base font-extrabold text-white transition hover:bg-white/10"
              >
                Browse all {count} strategies
                <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </div>

          {hero && (
            <div className="min-w-0 flex-[1_1_400px] rounded-lg bg-card p-6 text-foreground shadow-float sm:p-7" data-results={hero.id} data-version={`v${hero.version_number}`} data-slug={hero.slug}>
              <p className="kicker">{strategyLine(hero)}</p>
              <p className="mt-3 text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-navy sm:text-[26px]">
                <Link href={`/${hero.slug}`} className="hover:text-primary">{line}</Link>
              </p>
              <div className="mt-5">
                <ComparisonBars strategy={hero} variant="hero" oneBenchmark mainLabel="Strategy" />
              </div>
              <BasisWindowLine s={hero} className="mt-[18px]" />
            </div>
          )}
        </div>
        {hero && <HeroChart s={chartFields(hero)} />}
        {(!hero || !hero.chart_url) && <div className="h-14 md:h-[72px]" />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How to read a chart (read)
// ---------------------------------------------------------------------------

const READ_ICONS = [
  { box: "bg-tint text-primary", icon: <ArrowUp className="h-6 w-6" /> },
  { box: "bg-icon-sell-bg text-icon-sell", icon: <ArrowDown className="h-6 w-6" /> },
  {
    box: "bg-market-rising-bg text-gain",
    icon: (
      <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16h4" />
        <path d="M7 11h12" />
      </svg>
    ),
  },
];

export function ReadSection({ home }: { home: HomeContent }) {
  const r = home.read;
  if (!r.items.length) return null;
  return (
    <section id="read" className="section-pad bg-card" aria-labelledby="read-h">
      <div className="container">
        <SectionHead id="read-h" eyebrow={r.eyebrow} title={r.title} />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {r.items.map((item, i) => {
            const ic = READ_ICONS[i % READ_ICONS.length];
            return (
              <div key={item.title} className="min-w-0 rounded-lg border border-line p-7">
                <div className={`flex h-12 w-12 items-center justify-center rounded-md ${ic.box}`}>{ic.icon}</div>
                <h3 className="mt-5 text-[22px] font-extrabold leading-tight text-navy">{item.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The library (top)
// ---------------------------------------------------------------------------

export function TopSection({ strategies, content, disclaimer, featured }: { strategies: PublicStrategy[]; content: SiteContent; disclaimer: string | null; featured?: string[] }) {
  const top = topStrategies(strategies, featured ?? content.home.featured, 6);
  const t = content.home.top;
  return (
    <section id="strategies" className="section-pad border-y border-line bg-surface" aria-labelledby="top-h">
      <div className="container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead id="top-h" eyebrow={t.eyebrow} title={t.title} sub={t.subtitle} className="min-w-0 flex-[1_1_520px]" />
          <ClassChips counts={classCounts(strategies)} page="home" />
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((s) => (
            <StrategyCard key={s.id} strategy={s} hidden={content.config.hiddenFields} marketTag={content.marketTags[s.slug]} />
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <DisclaimerSlot text={disclaimer} className="!text-[13px] !text-ink-muted" />
          <Link
            href="/strategies"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-navy px-[22px] text-[15px] font-extrabold text-white transition hover:brightness-125"
          >
            See all {strategies.length} strategies
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Your numbers (size)
// ---------------------------------------------------------------------------

export function SizeSection({ home, hero, content }: { home: HomeContent; hero: PublicStrategy | null; content: SiteContent }) {
  if (!content.config.accountSize || !hero) return null;
  const sz = home.size;
  return (
    <section id="size" className="section-pad bg-card" aria-labelledby="size-h">
      <div className="container flex flex-wrap items-center gap-12">
        <div className="min-w-0 flex-[1_1_440px]">
          <p className="kicker">{sz.eyebrow}</p>
          <h2 id="size-h" className="section-title mt-3">{sz.title}</h2>
          {sz.body.map((p) => (
            <p key={p} className="mt-4 max-w-[520px] text-lg leading-relaxed text-ink">{p}</p>
          ))}
        </div>
        <div className="min-w-0 flex-[1_1_440px] rounded-lg border border-line p-6 shadow-panel sm:p-7">
          <AccountSize strategy={hero.slug} variant="large" />
          <p className="mt-5 text-[13px] font-bold text-ink-muted">
            Strategy #{hero.display_number} · {hero.title}
          </p>
          <div className="mt-3">
            <ResultsBlock strategy={hero} hidden={content.config.hiddenFields} variant="size" scale />
          </div>
          {content.config.emailMeThis && (
            <div className="mt-5 border-t border-line pt-5">
              <EmailMeThis strategy={hero} consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} source="size" />
            </div>
          )}
          <BasisWindowLine s={hero} tested className="mt-3.5 !text-xs" />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works (how)
// ---------------------------------------------------------------------------

export function HowSection({ home }: { home: HomeContent }) {
  return (
    <section id="how" className="section-pad border-t border-line bg-surface" aria-labelledby="how-h">
      <div className="container">
        <SectionHead id="how-h" eyebrow={home.how.eyebrow} title={home.how.title} />
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {home.how.steps.map((step, i) => (
            <li key={step.title} className="min-w-0 rounded-lg border border-line bg-card p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-mono text-base font-semibold text-white">{i + 1}</span>
              <h3 className="mt-5 text-[22px] font-extrabold text-navy">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[15px] leading-relaxed text-ink">
          {home.trust.custody} Works with {home.trust.exchanges.join(", ").replace(/, ([^,]*)$/, " and $1")}. {home.trust.exchangesNote}
        </p>
        {home.how.videoUrl && (
          <a href={home.how.videoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-extrabold text-primary hover:underline">
            {home.how.videoLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Strategy Lab Pro (clients)
// ---------------------------------------------------------------------------

export function ClientsSection({ home }: { home: HomeContent }) {
  return (
    <section data-theme="navy" className="section-pad bg-navy text-white" aria-labelledby="clients-h">
      <div className="container flex flex-wrap items-center gap-12">
        <div className="min-w-0 flex-[1_1_480px]">
          <SectionHead id="clients-h" eyebrow={home.clients.eyebrow} title={home.clients.title} dark />
          <p className="mt-4 max-w-[540px] text-lg leading-relaxed text-white/[0.82]">{home.clients.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <StartFreeLink source="clients" variant="primary" className="!min-h-[52px] !px-[26px] !text-base" />
            <BookDemoButton source="clients" variant="onDark" className="!min-h-[52px] !px-[26px] !text-base" />
          </div>
        </div>
        <ul className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          {home.clients.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3.5 rounded-md border border-white/[0.14] px-5 py-[18px] text-base leading-normal text-white">
              <Tick />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Book a demo (book)
// ---------------------------------------------------------------------------

export function BookSection({ home, content, source = "book-section" }: { home: HomeContent; content: SiteContent; source?: string }) {
  return (
    <section id="book" className="section-pad bg-card" aria-labelledby="book-h">
      <div className="container flex flex-wrap items-stretch gap-6">
        <div className="min-w-0 flex-[3_1_480px] rounded-lg border border-line p-6 shadow-panel sm:p-10">
          <h2 id="book-h" className="text-[clamp(28px,3vw,40px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-navy">{home.book.title}</h2>
          {home.trust.demoBy && <p className="mt-2 text-[15px] font-semibold text-ink-muted">{home.trust.demoBy}</p>}
          <p className="mt-3.5 max-w-[520px] text-lg leading-relaxed text-ink">{home.book.body}</p>
          <div className="mt-7">
            <BookingFlow source={source} inline />
          </div>
        </div>
        {content.config.alerts && (
          <div className="min-w-0 flex-[2_1_320px] rounded-lg border border-line bg-surface p-6 sm:p-8">
            <h3 className="text-[22px] font-extrabold text-navy">Not ready for a call?</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">Get an email when a new strategy publishes in the asset classes you follow.</p>
            <div className="mt-4">
              <AlertCapture consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sections kept as valid ids, outside the default order (finder, library, proof)
// ---------------------------------------------------------------------------

export function FinderSection({ strategies, content, disclaimer }: { strategies: PublicStrategy[]; content: SiteContent; disclaimer: string | null }) {
  if (!content.config.finder) return null;
  return (
    <section className="section-pad bg-card" aria-labelledby="finder-h">
      <div className="container">
        <SectionHead id="finder-h" eyebrow="Strategy finder" title="Find a strategy for what you want" sub="Answer four questions and see the strategies that match, at your account size." />
        <div className="mt-10">
          <Finder strategies={strategies} exchanges={content.home.trust.exchanges} disclaimer={disclaimer} hidden={content.config.hiddenFields} scale={content.config.accountSize} />
        </div>
      </div>
    </section>
  );
}

export function LibrarySection({ strategies, disclaimer }: { strategies: PublicStrategy[]; disclaimer: string | null }) {
  const summary = librarySummary(strategies);
  const assets = new Set(strategies.map((s) => s.asset)).size;
  return (
    <section className="section-pad border-y border-line bg-surface" aria-labelledby="library-h">
      <div className="container">
        <SectionHead id="library-h" eyebrow="The library" title="The library at a glance" sub={`${strategies.length} published strategies across ${assets} assets.`} />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {summary.map((c) => (
            <Link key={c.assetClass} href={`/strategies?class=${c.assetClass}`} className="min-w-0 rounded-lg border border-line bg-card p-7 shadow-card transition hover:shadow-card-hover">
              <p className="kicker">{assetClassLabel(c.assetClass)}</p>
              <p className="mt-2 text-3xl font-extrabold text-navy">
                {c.count}
                <span className="ml-1 text-base font-semibold text-ink-muted">strategies · {c.assets} assets</span>
              </p>
              {c.leader && (
                <div className="mt-3 text-sm" data-results={c.leader.id} data-version={`v${c.leader.version_number}`}>
                  <span className="text-ink-muted">Leading: </span>
                  <span className="font-semibold text-navy">{c.leader.short_name}</span>{" "}
                  <span className="font-mono font-semibold text-gain" data-field="return_pct" data-raw={c.leader.return_pct}>{formatSignedPercent(c.leader.return_pct)}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
        <DisclaimerSlot text={disclaimer} className="mt-6 !text-[13px] !text-ink-muted" />
      </div>
    </section>
  );
}

export function ProofSection({ home, strategies, studies = [] }: { home: HomeContent; strategies: PublicStrategy[]; studies?: ProofItem[] }) {
  // Marketing's proof items when set; otherwise the latest case studies, each with the strategies it uses (S17).
  const set = home.proof.items.filter((i) => i.quote || i.title);
  const items = set.length ? set : studies.slice(0, 3);
  if (!items.length) return null;
  const bySlug = new Map(strategies.map((s) => [s.slug, s]));
  return (
    <section className="section-pad bg-card" aria-labelledby="proof-h">
      <div className="container">
        <SectionHead id="proof-h" eyebrow="Case studies" title={home.proof.title} />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <figure key={i} className="flex min-w-0 flex-col rounded-lg border border-line bg-card p-7">
              {item.title && <p className="text-lg font-extrabold text-navy">{item.title}</p>}
              {item.quote && <blockquote className="mt-2 flex-1 text-base text-ink">“{item.quote}”</blockquote>}
              {(item.name || item.role) && <figcaption className="mt-3 text-[13px] text-ink-muted">{[item.name, item.role].filter(Boolean).join(", ")}</figcaption>}
              {(item.strategies ?? []).length > 0 && (
                <p className="mt-3 text-[13px] text-ink">
                  Uses{" "}
                  {(item.strategies ?? []).map((slug, j) => {
                    const s = bySlug.get(slug);
                    return s ? (
                      <span key={slug}>
                        {j > 0 && ", "}
                        <Link href={`/${slug}`} className="font-semibold text-primary hover:underline">{s.short_name}</Link>
                      </span>
                    ) : null;
                  })}
                </p>
              )}
              {item.href && (
                <a href={item.href} className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-extrabold text-primary hover:underline">
                  Read the case study
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
