// Strategies, How to read a chart, How it works, Client sign-in, Start free,
// Book a demo (PRD 5, 9; redesign PRD section 4). Links hide under 860px;
// both buttons stay at every width.
import Link from "next/link";
import type { ActionsContent } from "@/lib/content";
import { BookDemoButton, StartFreeLink } from "./Booking";

const navLink = "inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-white/85 hover:bg-white/10 hover:text-white xl:px-3.5";

export function Header({ actions, partnerName, partnerLogo }: { actions: ActionsContent; partnerName?: string; partnerLogo?: string }) {
  return (
    <header data-theme="navy" className="sticky top-0 z-30 border-b border-white/10 bg-navy text-white">
      <div className="container flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:min-h-[72px] sm:gap-x-4">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Strategy Lab home">
          <img src="/logo-white.png" alt="Arch Public" width={123} height={30} className="h-6 w-auto sm:h-[30px]" />
          <span className="hidden border-l border-white/25 pl-3 text-sm font-bold tracking-[0.02em] sm:inline nav:hidden xl:inline">Strategy Lab</span>
          {partnerName && (
            <span className="hidden items-center gap-2 border-l border-white/25 pl-3 text-sm font-semibold md:flex">
              {partnerLogo ? <img src={partnerLogo} alt={partnerName} className="h-6 w-auto" /> : `with ${partnerName}`}
            </span>
          )}
        </Link>
        <nav className="ml-auto hidden items-center gap-1 text-sm font-semibold nav:flex" aria-label="Main">
          <Link href="/strategies" className={navLink}>Strategies</Link>
          <Link href="/#read" className={navLink}>How to read a chart</Link>
          <Link href="/#how" className={navLink}>How it works</Link>
          <a href={actions.signInUrl} className={navLink}>{actions.signIn}</a>
        </nav>
        <div className="ml-auto flex shrink-0 gap-2 nav:ml-0">
          <StartFreeLink source="header" variant="onDark" className="!px-3.5 sm:!px-[18px]" />
          <BookDemoButton source="header" className="!px-3.5 sm:!px-[18px]" />
        </div>
      </div>
    </header>
  );
}
