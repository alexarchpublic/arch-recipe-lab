// Strategy Lab home (PRD 9; redesign PRD section 4). The hero first, then the
// sections in the order marketing sets (S12): by default read, top, size, how,
// clients, book.
import { BookSection, ClientsSection, FinderSection, Hero, HowSection, LibrarySection, ProofSection, ReadSection, SizeSection, TopSection } from "@/components/Sections";
import { StickyActions } from "@/components/StickyActions";
import { studyLinks } from "@/lib/caseStudies";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import type { ProofItem } from "@/lib/content";
import { heroStrategy } from "@/lib/strategies";

export const revalidate = 120;

export default async function Home() {
  const [strategies, content, disclaimer] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer()]);
  // Case studies that use a published strategy, newest first.
  const studyMap = new Map<string, ProofItem & { published: string }>();
  for (const s of strategies) {
    for (const l of studyLinks(s)) {
      const item = studyMap.get(l.slug) ?? { title: l.title, href: l.studyUrl, strategies: [], published: l.published ?? "" };
      if (!item.strategies!.includes(s.slug)) item.strategies!.push(s.slug);
      studyMap.set(l.slug, item);
    }
  }
  const studies = [...studyMap.values()].sort((a, b) => b.published.localeCompare(a.published));
  const home = content.home;
  const hero = heroStrategy(strategies, home.hero.featured);
  const blocks: Record<string, React.ReactNode> = {
    read: <ReadSection key="read" home={home} />,
    size: <SizeSection key="size" home={home} hero={hero} content={content} />,
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
      <Hero home={home} hero={hero} count={strategies.length} />
      {home.sections.map((id) => blocks[id])}
      <StickyActions source="home" />
    </>
  );
}
