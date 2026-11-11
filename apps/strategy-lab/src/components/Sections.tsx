// Landing page blocks (PRD 9, "Landing page, top to bottom"). Order and copy
// come from site content (S12); figures from the published strategies.
import Link from "next/link";
import { type PublicStrategy, ResultsDisclosure, formatSignedPercent } from "@core";
import type { HomeContent, SiteContent } from "@/lib/content";
import { assetClassLabel, librarySummary, topStrategies } from "@/lib/strategies";
import { AlertCapture } from "./AlertCapture";
import { BookDemoButton, BookingFlow, StartFreeLink } from "./Booking";
import { ComparisonBars } from "./ComparisonBars";
import { Finder } from "./Finder";
import { ResultsBlock } from "./ResultsBlock";
import { Chip, StrategyCard } from "./StrategyCard";

export function Hero({ home, hero, disclaimer, scale, eyebrow, headline, subhead }: { home: HomeContent; hero: PublicStrategy | null; disclaimer: string | null; scale: boolean; eyebrow?: string; headline?: string; subhead?: string }) {
  return (
    <section className="bg-navy text-white">
      <div className="container grid gap-10 py-12 md:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{eyebrow ?? home.hero.eyebrow}</p>
          <h1 className="mt-3 text-4xl leading-[1.08] sm:text-5xl">{headline ?? home.hero.headline}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">{subhead ?? home.hero.subhead}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <BookDemoButton source="hero" className="!px-6 !py-3 !text-base" />
            <StartFreeLink source="hero" variant="onDark" className="!px-6 !py-3 !text-base" />
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
            <li className="flex gap-2"><Tick />{home.trust.custody}</li>
            {home.trust.demoBy && <li className="flex gap-2"><Tick />{home.trust.demoBy}</li>}
            <li className="flex gap-2 sm:col-span-2"><Tick />
              <span>Works with {home.trust.exchanges.join(", ")}. {home.trust.exchangesNote}</span>
            </li>
          </ul>
        </div>
        {hero && (
          <div className="rounded-lg bg-card p-5 text-foreground shadow-lg">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow mr-1">Leading strategy</span>
              <Chip>{hero.asset}</Chip>
              <Chip>{assetClassLabel(hero.asset_class)}</Chip>
            </div>
            <Link href={`/${hero.slug}`} className="mt-2 block text-xl font-extrabold leading-snug hover:text-primary">{hero.title}</Link>
            <div className="mt-4">
              <ComparisonBars strategy={hero} />
            </div>
            <div className="mt-4">
              <ResultsBlock strategy={hero} disclaimer={disclaimer} variant="card" scale={scale} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Tick() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SectionHead({ id, title, sub, action }: { id: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-2xl sm:text-3xl">{title}</h2>
        {sub && <p className="mt-1 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function FinderSection({ strategies, content, disclaimer }: { strategies: PublicStrategy[]; content: SiteContent; disclaimer: string | null }) {
  if (!content.config.finder) return null;
  return (
    <section className="container py-12" aria-labelledby="finder-h">
      <SectionHead id="finder-h" title="Find a strategy for what you want" sub="Answer four questions and see the strategies that match, at your account size." />
      <Finder strategies={strategies} exchanges={content.home.trust.exchanges} disclaimer={disclaimer} hidden={content.config.hiddenFields} scale={content.config.accountSize} />
    </section>
  );
}

export function LibrarySection({ strategies, disclaimer }: { strategies: PublicStrategy[]; disclaimer: string | null }) {
  const summary = librarySummary(strategies);
  const assets = new Set(strategies.map((s) => s.asset)).size;
  return (
    <section className="border-y border-border bg-card" aria-labelledby="library-h">
      <div className="container py-12">
        <SectionHead
          id="library-h"
          title="The library at a glance"
          sub={`${strategies.length} published strategies across ${assets} assets.`}
          action={<Link href="/strategies" className="text-sm font-bold text-primary hover:underline">Browse all →</Link>}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {summary.map((c) => (
            <Link key={c.assetClass} href={`/strategies?class=${c.assetClass}`} className="rounded-lg border border-border p-5 transition hover:border-primary hover:shadow-md">
              <p className="eyebrow">{assetClassLabel(c.assetClass)}</p>
              <p className="mt-1 text-3xl font-extrabold">{c.count}<span className="ml-1 text-base font-semibold text-muted-foreground">strategies · {c.assets} assets</span></p>
              {c.leader && (
                <div className="mt-3 text-sm" data-results={c.leader.id} data-version={`v${c.leader.version_number}`}>
                  <span className="text-muted-foreground">Leading: </span>
                  <span className="font-semibold">{c.leader.short_name}</span>{" "}
                  <span className="font-mono font-semibold text-gain" data-field="return_pct" data-raw={c.leader.return_pct}>{formatSignedPercent(c.leader.return_pct)}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
        {summary[0]?.leader && (
          <ResultsDisclosure strategy={summary[0].leader} disclaimer={disclaimer} compact className="mt-4" />
        )}
      </div>
    </section>
  );
}

export function TopSection({ strategies, content, disclaimer, featured }: { strategies: PublicStrategy[]; content: SiteContent; disclaimer: string | null; featured?: string[] }) {
  const top = topStrategies(strategies, featured ?? content.home.featured, 6);
  return (
    <section className="container py-12" aria-labelledby="top-h">
      <SectionHead id="top-h" title={content.home.top.title} sub={content.home.top.subtitle} action={<Link href="/strategies" className="text-sm font-bold text-primary hover:underline">See all {strategies.length} →</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((s) => (
          <StrategyCard key={s.id} strategy={s} disclaimer={disclaimer} hidden={content.config.hiddenFields} scale={content.config.accountSize} />
        ))}
      </div>
    </section>
  );
}

export function HowSection({ home }: { home: HomeContent }) {
  return (
    <section id="how" className="border-y border-border bg-card" aria-labelledby="how-h">
      <div className="container py-12">
        <SectionHead id="how-h" title={home.how.title} />
        <ol className="grid gap-4 md:grid-cols-3">
          {home.how.steps.map((step, i) => (
            <li key={step.title} className="rounded-lg border border-border p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{i + 1}</span>
              <p className="mt-3 text-lg font-extrabold">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        {home.how.videoUrl && (
          <a href={home.how.videoUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-bold text-primary hover:underline">
            {home.how.videoLabel} →
          </a>
        )}
      </div>
    </section>
  );
}

export function ProofSection({ home, strategies }: { home: HomeContent; strategies: PublicStrategy[] }) {
  const items = home.proof.items.filter((i) => i.quote || i.title);
  if (!items.length) return null;
  const bySlug = new Map(strategies.map((s) => [s.slug, s]));
  return (
    <section className="container py-12" aria-labelledby="proof-h">
      <SectionHead id="proof-h" title={home.proof.title} />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, i) => (
          <figure key={i} className="flex flex-col rounded-lg border border-border bg-card p-5">
            {item.title && <p className="text-base font-extrabold">{item.title}</p>}
            {item.quote && <blockquote className="mt-2 flex-1 text-sm">“{item.quote}”</blockquote>}
            {(item.name || item.role) && <figcaption className="mt-3 text-xs text-muted-foreground">{[item.name, item.role].filter(Boolean).join(", ")}</figcaption>}
            {(item.strategies ?? []).length > 0 && (
              <p className="mt-3 text-xs">
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
            {item.href && <a href={item.href} className="mt-3 text-sm font-bold text-primary hover:underline">Read the case study →</a>}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function ClientsSection({ home }: { home: HomeContent }) {
  return (
    <section className="bg-navy text-white" aria-labelledby="clients-h">
      <div className="container grid gap-8 py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 id="clients-h" className="text-2xl sm:text-3xl">{home.clients.title}</h2>
          <p className="mt-3 text-white/80">{home.clients.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StartFreeLink source="clients" variant="primary" />
            <BookDemoButton source="clients" variant="onDark" />
          </div>
        </div>
        <ul className="grid gap-3">
          {home.clients.bullets.map((b) => (
            <li key={b} className="flex gap-3 rounded-md bg-white/5 p-3 text-sm"><Tick />{b}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BookSection({ home, content }: { home: HomeContent; content: SiteContent }) {
  return (
    <section id="book" className="container py-12" aria-labelledby="book-h">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 id="book-h" className="text-2xl">{home.book.title}</h2>
          <p className="mt-1 text-muted-foreground">{home.book.body}</p>
          <div className="mt-5">
            <BookingFlow source="book-section" inline />
          </div>
        </div>
        {content.config.alerts && (
          <div className="rounded-lg border border-border bg-muted p-6">
            <h2 className="text-xl">Not ready for a call?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Get an email when a new strategy publishes in the asset classes you follow.</p>
            <div className="mt-4">
              <AlertCapture consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
