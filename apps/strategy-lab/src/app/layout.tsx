import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Mulish } from "next/font/google";
import "./globals.css";
import { BookingProvider } from "@/components/Booking";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Tracking } from "@/components/Tracking";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import { CANONICAL_ORIGIN, GA4_ID, HUBSPOT_PORTAL_ID, canonicalUrl } from "@/lib/env";
import { strategyName } from "@/lib/figures";

const sans = Mulish({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    metadataBase: new URL(CANONICAL_ORIGIN),
    title: content.home.seo.title,
    description: content.home.seo.description,
    alternates: { canonical: canonicalUrl("/") },
    icons: { icon: "/favicon.png" },
    openGraph: { siteName: "Arch Public Strategy Lab", type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#0B1656", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [content, disclaimer, strategies] = await Promise.all([getSiteContent(), getDisclaimer(), getStrategies().catch(() => [])]);
  const names = Object.fromEntries(strategies.map((s) => [s.slug, strategyName(s)]));
  const assets = Object.fromEntries(strategies.map((s) => [s.slug, [s.asset, s.asset_class] as [string, string]]));
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <BookingProvider settings={{ booking: content.booking, actions: content.actions, exchanges: content.home.trust.exchanges, names, assets }}>
          <Header actions={content.actions} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer actions={content.actions} disclaimer={disclaimer} />
          <Tracking ga4Id={GA4_ID} hubspotPortalId={HUBSPOT_PORTAL_ID} privacyUrl={content.actions.privacyUrl} />
        </BookingProvider>
      </body>
    </html>
  );
}
