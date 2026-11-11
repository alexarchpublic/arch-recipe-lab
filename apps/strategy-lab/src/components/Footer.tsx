import Link from "next/link";
import { DEFAULT_DISCLAIMER } from "@core";
import type { ActionsContent } from "@/lib/content";

export function Footer({ actions, disclaimer }: { actions: ActionsContent; disclaimer: string | null }) {
  return (
    <footer className="mt-16 bg-navy pb-24 pt-10 text-white/80 sm:pb-10">
      <div className="container grid gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <img src="/strategy-lab/logo-white.png" alt="Arch Public" width={123} height={30} className="h-7 w-auto" />
          <p className="text-sm">Strategy Lab shows Arch Public's algorithm strategies, with the result of every backtest and how each one trades.</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm" aria-label="Footer">
          <Link href="/strategies" className="hover:text-white">Strategies</Link>
          <a href="https://archpublic.com/case-studies" className="hover:text-white">Case studies</a>
          <a href={actions.startFreeUrl} className="hover:text-white">{actions.startFree}</a>
          <a href={actions.signInUrl} className="hover:text-white">{actions.signIn}</a>
          <a href={actions.privacyUrl} className="hover:text-white">Privacy</a>
          <a href="https://archpublic.com/terms" className="hover:text-white">Terms</a>
        </nav>
        <p className="text-xs leading-relaxed text-white/60" data-disclosure="disclaimer">
          {disclaimer?.trim() || DEFAULT_DISCLAIMER} © {new Date().getFullYear()} Arch Public.
        </p>
      </div>
    </footer>
  );
}
