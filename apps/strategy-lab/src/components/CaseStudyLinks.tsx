// "This strategy comes from a case study" on a strategy page (auto-ingestion
// LK2, LK5). The origin study first; others as "Also featured in". The case
// study tells the story; the figures here are the store's current version.
import type { StudyLink } from "@/lib/caseStudies";

export function CaseStudyLinks({ links, short }: { links: StudyLink[]; short: string }) {
  if (!links.length) return null;
  const [first, ...rest] = links;
  return (
    <section aria-labelledby="case-h" className="rounded-lg border border-line bg-card p-6 shadow-card" data-case-studies={links.length}>
      <p className="kicker">From the case study</p>
      <h2 id="case-h" className="mt-2 text-xl font-extrabold leading-snug text-navy">
        <a href={first.url} className="hover:text-primary" data-case-study={first.slug}>{first.title}</a>
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        {first.scenario ? <>{short} is the scenario “{first.scenario}”.</> : <>{short} comes from this case study.</>} Read how it played out, chart by chart.
      </p>
      <a href={first.url} className="mt-3 inline-flex min-h-[44px] items-center text-[15px] font-extrabold text-primary hover:underline">Read the case study →</a>
      {rest.length > 0 && (
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="font-bold text-navy">Also featured in</p>
          <ul className="mt-1 space-y-1">
            {rest.map((l) => (
              <li key={l.url}>
                <a href={l.url} className="font-semibold text-primary hover:underline" data-case-study={l.slug}>{l.title}</a>
                {l.scenario && <span className="text-muted-foreground"> · “{l.scenario}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">The case study is dated; the results above are this strategy&apos;s published version.</p>
    </section>
  );
}
