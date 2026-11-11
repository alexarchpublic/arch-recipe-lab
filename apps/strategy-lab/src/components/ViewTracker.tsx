"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { recordView } from "@/lib/visitor";

/** Records a strategy view in the browser and as an event (S2, section 12). */
export function ViewTracker({ slug, id, version, assetClass }: { slug: string; id: string; version: number; assetClass: string }) {
  useEffect(() => {
    recordView(slug);
    track("strategy_viewed", { strategy_id: id, strategy: slug, version, asset_class: assetClass, referrer: document.referrer || null });
  }, [slug, id, version, assetClass]);
  return null;
}
