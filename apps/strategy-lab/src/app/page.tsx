// Strategy Lab home (PRD 9). Blocks in the order marketing sets (S12).
import { BookSection, ClientsSection, FinderSection, Hero, HowSection, LibrarySection, ProofSection, TopSection } from "@/components/Sections";
import { StickyActions } from "@/components/StickyActions";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import { heroStrategy } from "@/lib/strategies";

export const revalidate = 120;

export default async function Home() {
  const [strategies, content, disclaimer] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer()]);
  const home = content.home;
  const hero = heroStrategy(strategies, home.hero.featured);
  const blocks: Record<string, React.ReactNode> = {
    finder: <FinderSection key="finder" strategies={strategies} content={content} disclaimer={disclaimer} />,
    library: <LibrarySection key="library" strategies={strategies} disclaimer={disclaimer} />,
    top: <TopSection key="top" strategies={strategies} content={content} disclaimer={disclaimer} />,
    how: <HowSection key="how" home={home} />,
    proof: <ProofSection key="proof" home={home} strategies={strategies} />,
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
