// "This strategy comes from a case study" on a strategy page (S17). The case
// study tells the story; the figures here are the store's current version.
import type { StudyLink } from "@/lib/caseStudies";

export function CaseStudyLinks({ links, short }: { links: StudyLink[]; short: string }) {
  if (!links.length) return null;
  const [first, ...rest] = links;
  return (
    <section aria-labelledby="case-h" className="rounded-lg border border-line bg-card p-6 shadow-card">
      <p className="kicker">Case study</p>
      <h2 id="case-h" className="mt-2 text-xl font-extrabold leading-snug text-navy">
        <a href={first.url} className="hover:text-primary">{first.title}</a>
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        {short} is the scenario “{first.scenario}”{first.window ? `, ${first.window}` : ""}. Read how it played out, chart by chart.
      </p>
      <a href={first.url} className="mt-3 inline-flex min-h-[44px] items-center text-[15px] font-extrabold text-primary hover:underline">Read the case study →</a>
      {rest.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          {rest.map((l) => (
            <li key={l.url}>
              Also in <a href={l.url} className="font-semibold text-primary hover:underline">{l.title}</a>
              <span className="text-muted-foreground"> · “{l.scenario}”</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">The case study is dated; the results above are this strategy&apos;s published version.</p>
    </section>
  );
}
