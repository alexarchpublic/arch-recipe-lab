// The old strategy addresses, /strategy-lab/recipes/<record-id> (PRD 13,
// Redirects). The record ids match the store for the 53 shared strategies;
// the six that existed only on the old site go to the list.
import { permanentRedirect } from "next/navigation";
import { getStrategies } from "@/lib/data";

export const revalidate = 120;

export default async function OldStrategy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await getStrategies().catch(() => []);
  const byId = all.find((s) => s.id === id);
  const byNumber = /^\d+$/.test(id) ? all.find((s) => String(s.display_number) === id) : undefined;
  const hit = byId ?? byNumber;
  permanentRedirect(hit ? `/${hit.slug}` : "/strategies");
}
