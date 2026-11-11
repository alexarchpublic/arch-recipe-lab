"use client";
// The link around a whole chart: opens the full-size image in a new tab and
// records chart_opened (redesign PRD section 8). No lightbox.
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function ChartLink({ href, slug, placement, label, children }: { href: string; slug: string; placement: string; label: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block" aria-label={label} onClick={() => track("chart_opened", { slug, placement })}>
      {children}
    </a>
  );
}
