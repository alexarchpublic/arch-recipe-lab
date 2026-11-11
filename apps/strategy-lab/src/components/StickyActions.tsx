"use client";
// Both actions always in reach on a phone (S1). The bar is fixed to the
// bottom; the cookie banner sits above it, and pages leave room for it.
import { BookDemoButton, StartFreeLink } from "./Booking";

export function StickyActions({ strategy, source }: { strategy?: string; source: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:hidden" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
      <div className="flex gap-2">
        <BookDemoButton strategy={strategy} source={`${source}:sticky`} className="flex-1 !px-3" />
        <StartFreeLink strategy={strategy} source={`${source}:sticky`} className="flex-1 !px-3" />
      </div>
    </div>
  );
}
