// Strategy Lab's copy, layout, featured strategies, partner pages and switches
// (PRD S12, A10, C5). Approvers and marketing editors change them here and
// Strategy Lab shows the change without a deploy. Figures are never stored here.
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface SiteContentRow {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

const QUERY_KEY = ["site-content"] as const;

export async function fetchSiteContent(): Promise<SiteContentRow[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  // public.site_content arrives with migration 20261113000001.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("site_content").select("key, value, updated_at").order("key");
  if (error) throw error;
  return (data ?? []) as SiteContentRow[];
}

export function useSiteContent(enabled = true) {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchSiteContent, enabled, retry: false });
}

export function useInvalidateSiteContent() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY });
}

/** Sets one key, or removes it with null. */
export async function setSiteContent(key: string, value: Record<string, unknown> | null): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_set_site_content", { p_key: key, p_value: value });
  if (error) throw error;
}
