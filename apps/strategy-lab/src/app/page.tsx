// Strategy Lab home (PRD 9). Blocks in the order marketing sets (S12).
import { BookSection, ClientsSection, FinderSection, Hero, HowSection, LibrarySection, ProofSection, TopSection } from "@/components/Sections";
import { StickyActions } from "@/components/StickyActions";
import { getCaseStudyLinks } from "@/lib/caseStudies";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import type { ProofItem } from "@/lib/content";
import { heroStrategy } from "@/lib/strategies";

export const revalidate = 120;

export default async function Home() {
  const [strategies, content, disclaimer, links] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer(), getCaseStudyLinks()]);
  // Case studies that use a published strategy, newest first.
  const byNumber = new Map(strategies.map((s) => [s.display_number, s.slug]));
  const studyMap = new Map<string, ProofItem & { published: string }>();
  for (const [n, list] of links) {
    const slug = byNumber.get(n);
    if (!slug) continue;
    for (const l of list) {
      const item = studyMap.get(l.slug) ?? { title: l.title, href: l.studyUrl, strategies: [], published: l.published };
      if (!item.strategies!.includes(slug)) item.strategies!.push(slug);
      studyMap.set(l.slug, item);
    }
  }
  const studies = [...studyMap.values()].sort((a, b) => b.published.localeCompare(a.published));
  const home = content.home;
  const hero = heroStrategy(strategies, home.hero.featured);
  const blocks: Record<string, React.ReactNode> = {
    finder: <FinderSection key="finder" strategies={strategies} content={content} disclaimer={disclaimer} />,
    library: <LibrarySection key="library" strategies={strategies} disclaimer={disclaimer} />,
    top: <TopSection key="top" strategies={strategies} content={content} disclaimer={disclaimer} />,
    how: <HowSection key="how" home={home} />,
    proof: <ProofSection key="proof" home={home} strategies={strategies} studies={studies} />,
    clients: <ClientsSection key="clients" home={home} />,
    book: <BookSection key="book" home={home} content={content} />,
  };
  return (
    <>
      <Hero home={home} hero={hero} disclaimer={disclaimer} scale={content.config.accountSize} />
      {home.sections.map((id) => blocks[id])}
      <StickyActions source="home" />
    </>
  );
}
