// Strategies, How it works, Client sign-in, Start free, Book a demo (PRD 5, 9).
import Link from "next/link";
import type { ActionsContent } from "@/lib/content";
import { BookDemoButton, StartFreeLink } from "./Booking";

export function Header({ actions, partnerName, partnerLogo }: { actions: ActionsContent; partnerName?: string; partnerLogo?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-navy text-white">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Strategy Lab home">
          <img src="/strategy-lab/logo-white.png" alt="Arch Public" width={123} height={30} className="h-7 w-auto" />
          <span className="hidden border-l border-white/25 pl-3 text-sm font-bold tracking-wide sm:inline">Strategy Lab</span>
          {partnerName && (
            <span className="hidden items-center gap-2 border-l border-white/25 pl-3 text-sm font-semibold md:flex">
              {partnerLogo ? (
                <img src={partnerLogo} alt={partnerName} className="h-6 w-auto" />
              ) : (
                `with ${partnerName}`
              )}
            </span>
          )}
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold" aria-label="Main">
          <Link href="/strategies" className="hidden rounded-full px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white md:inline-flex">
            Strategies
          </Link>
          <Link href="/#how" className="hidden rounded-full px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white lg:inline-flex">
            How it works
          </Link>
          <a href={actions.signInUrl} className="hidden rounded-full px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white lg:inline-flex">
            {actions.signIn}
          </a>
          <StartFreeLink source="header" variant="onDark" className="hidden !py-2 sm:inline-flex" />
          <BookDemoButton source="header" className="!py-2" />
        </nav>
      </div>
    </header>
  );
}
