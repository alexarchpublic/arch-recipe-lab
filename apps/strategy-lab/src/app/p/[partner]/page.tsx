// Co-branded partner landing pages (S12), set up by marketing in the admin
// console with no deploy. Every capture from here carries the partner.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerMark } from "@/components/PartnerMark";
import { BookSection, ClientsSection, FinderSection, Hero, HowSection, TopSection } from "@/components/Sections";
import { StickyActions } from "@/components/StickyActions";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import { canonicalUrl } from "@/lib/env";
import { heroStrategy, pickBySlug } from "@/lib/strategies";

export const revalidate = 120;
export const dynamicParams = true;

type Props = { params: Promise<{ partner: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { partner } = await params;
  const p = (await getSiteContent()).partners[partner];
  if (!p) return { title: "Not found · Strategy Lab", robots: { index: false } };
  return { title: p.seo.title, description: p.seo.description, alternates: { canonical: canonicalUrl(`/p/${p.slug}`) } };
}

export default async function PartnerPage({ params }: Props) {
  const { partner } = await params;
  const [strategies, content, disclaimer] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer()]);
  const p = content.partners[partner];
  if (!p) notFound();
  const hero = pickBySlug(strategies, p.featured)[0] ?? heroStrategy(strategies, content.home.hero.featured);
  return (
    <>
      <PartnerMark partnerId={p.partnerId} />
      {p.logoUrl && (
        <div className="border-b border-white/10 bg-navy">
          <div className="container flex items-center gap-3 py-3 text-sm text-white/80">
            <img src={p.logoUrl} alt={p.name} className="h-7 w-auto" />
            <span>Arch Public Strategy Lab, with {p.name}</span>
          </div>
        </div>
      )}
      <Hero home={content.home} hero={hero} disclaimer={disclaimer} scale={content.config.accountSize} eyebrow={`Strategy Lab · ${p.name}`} headline={p.headline} subhead={p.subhead} />
      <FinderSection strategies={strategies} content={content} disclaimer={disclaimer} />
      <TopSection strategies={strategies} content={content} disclaimer={disclaimer} featured={p.featured.length ? p.featured : undefined} />
      <HowSection home={content.home} />
      <ClientsSection home={content.home} />
      <BookSection home={content.home} content={content} />
      <StickyActions source={`partner:${p.slug}`} />
    </>
  );
}
