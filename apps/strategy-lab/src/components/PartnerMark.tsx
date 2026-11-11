"use client";
import { useEffect } from "react";
import { writeVisitor } from "@/lib/visitor";

/** A partner landing page tags the visitor, so every capture carries the partner (S2). */
export function PartnerMark({ partnerId }: { partnerId: string }) {
  useEffect(() => {
    writeVisitor({ partner: partnerId });
  }, [partnerId]);
  return null;
}
