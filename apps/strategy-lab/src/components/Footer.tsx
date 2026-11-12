// Logo, disclaimer (from public.disclosures), links (redesign PRD section 4).
import Link from "@/components/Link";
import { DEFAULT_DISCLAIMER } from "@core";
import type { ActionsContent } from "@/lib/content";

const footLink = "inline-flex min-h-[44px] items-center text-white hover:underline";

export function Footer({ actions, disclaimer }: { actions: ActionsContent; disclaimer: string | null }) {
  return (
    <footer data-theme="navy" className="bg-navy-deep pb-28 pt-12 text-white/[0.78] sm:pb-12">
      <div className="container flex flex-wrap items-center justify-between gap-6">
        <img src="/logo-white.png" alt="Arch Public" width={115} height={28} className="h-7 w-auto" />
        <p className="min-w-0 flex-[1_1_360px] text-[13px] leading-relaxed" data-disclosure="disclaimer">
          {disclaimer?.trim() || DEFAULT_DISCLAIMER} Figures come from TradingView backtests over each strategy&apos;s own test period. © {new Date().getFullYear()} Arch Public.
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold" aria-label="Footer">
          <Link href="/strategies" className={footLink}>Strategies</Link>
          <a href="https://archpublic.com/case-studies" className={footLink}>Case studies</a>
          <a href={actions.signInUrl} className={footLink}>{actions.signIn}</a>
          <a href={actions.privacyUrl} className={footLink}>Privacy</a>
          <a href="https://archpublic.com/terms" className={footLink}>Terms</a>
          <Link href="/older-links" className={footLink}>Older links</Link>
        </nav>
      </div>
    </footer>
  );
}
