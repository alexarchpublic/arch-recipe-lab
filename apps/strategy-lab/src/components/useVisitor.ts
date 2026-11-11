"use client";
import { useEffect, useState } from "react";
import { type VisitorState, readVisitor, subscribeVisitor } from "@/lib/visitor";

/** The visitor's state, after hydration. Before it, null: pages render the stored figures. */
export function useVisitor(): VisitorState | null {
  const [state, setState] = useState<VisitorState | null>(null);
  useEffect(() => {
    setState(readVisitor());
    return subscribeVisitor(setState);
  }, []);
  return state;
}
