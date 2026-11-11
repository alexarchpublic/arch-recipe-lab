// Strategy Lab Pro's frame: Strategies, Portfolios, What's new, Help (PRD 5).
// No marketing links except the logo; no lead forms (P2, section 10).
import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { CONCIERGE_URL, COMPANY_URL, PRO_NAME } from "@core";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePreferences } from "@/hooks/usePreferences";
import { touchVisit } from "@/data/preferences";
import { useWhatsNew } from "@/hooks/useWhatsNew";

/** The notice for the rename, shown until dismissed (PRD 13, client communication). */
export const RENAME_NOTICE_ID = "rename-2026-11";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${PRO_NAME}` : `${PRO_NAME} · Arch Public`;
  }, [title]);
}

function NavItem({ to, children, badge }: { to: string; children: ReactNode; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-bold transition-colors",
          isActive ? "bg-white/[0.12] text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white",
        )
      }
    >
      {children}
      {badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold leading-5 text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function ProLayout({ children, title }: { children: ReactNode; title?: string }) {
  usePageTitle(title);
  const { active } = usePortfolio();
  const { isDismissed, dismiss } = usePreferences();
  const { count: newCount } = useWhatsNew();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    touchVisit();
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-navy">
        <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2 text-white">
            <span className="text-xl font-extrabold tracking-[-0.02em] md:text-2xl">Strategy Lab</span>
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em]">Pro</span>
          </Link>
          <nav aria-label="Strategy Lab Pro" className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1">
            <NavItem to="/">Strategies</NavItem>
            <NavItem to="/portfolios" badge={active?.positions.length || undefined}>
              Portfolios
            </NavItem>
            <NavItem to="/whats-new" badge={newCount || undefined}>
              What's new
            </NavItem>
            <NavItem to="/help">Help</NavItem>
          </nav>
          <a href={COMPANY_URL} target="_blank" rel="noreferrer" className="ml-auto shrink-0">
            <img src="/APLogo.png" alt="Arch Public" className="h-7 w-auto" />
          </a>
        </div>
      </header>

      {!isDismissed(RENAME_NOTICE_ID) && (
        <div className="border-b border-primary/20 bg-primary/[0.06]">
          <div className="container mx-auto flex items-start gap-3 px-4 py-2.5 text-sm">
            <p className="flex-1">
              <strong>Recipe Lab is now Strategy Lab Pro.</strong> Same address, same strategies and numbers, nothing to sign
              in to. Your saved portfolio is under Portfolios, and each strategy now has its own page with a guided apply.{" "}
              <Link to="/help#whats-changed" className="font-semibold text-primary underline-offset-2 hover:underline">
                What moved
              </Link>
              {" · "}
              <a href={CONCIERGE_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">
                Ask concierge
              </a>
            </p>
            <button
              type="button"
              onClick={() => dismiss(RENAME_NOTICE_ID)}
              className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto flex-1 px-4 py-6 md:py-8">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Arch Public is a software provider, not a broker-dealer or investment adviser. We never take custody of your
            assets. Trading involves risk, including loss of principal. Not investment advice. Past and backtested
            performance does not guarantee future results.
          </p>
          <div className="flex shrink-0 items-center gap-4 text-xs font-semibold text-muted-foreground">
            <a href={CONCIERGE_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Concierge
            </a>
            <Link to="/admin" className="hover:text-foreground">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
