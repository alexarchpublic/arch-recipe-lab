// Disclaimer wording (PRD C2): stored in the database, set in the admin
// console, read by both front ends. Counsel's text goes live without a deploy.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DISCLAIMER, type DisclosureKey } from "@core";

export interface Disclosure {
  key: DisclosureKey;
  body: string;
  updated_at: string | null;
  updated_by?: string | null;
}

const QUERY_KEY = ["disclosures"] as const;

export async function fetchDisclosures(): Promise<Disclosure[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  // public.disclosures arrives with migration 20261112000001; until then the
  // query fails and the slot shows the default wording.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("disclosures").select("key, body, updated_at");
  if (error) throw error;
  return (data ?? []) as Disclosure[];
}

export function useDisclosures() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchDisclosures, staleTime: 10 * 60 * 1000, retry: false });
}

/** The wording for one slot, or the default until it loads. */
export function useDisclaimer(key: DisclosureKey = "results"): string {
  const { data } = useDisclosures();
  return data?.find((d) => d.key === key)?.body?.trim() || DEFAULT_DISCLAIMER;
}

/** Admin console: approvers and marketing editors set the wording. */
export async function setDisclosure(key: DisclosureKey, body: string): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_set_disclosure", { p_key: key, p_body: body });
  if (error) throw error;
}

export function useInvalidateDisclosures() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY });
}
