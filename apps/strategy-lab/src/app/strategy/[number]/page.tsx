// /strategy-lab/strategy/<number>: a strategy by its number, the address case
// studies link to. Numbers never change (PRD 5), so the link survives a new
// slug. A strategy not on the public list goes to the list.
import { permanentRedirect, redirect } from "next/navigation";
import { getStrategies } from "@/lib/data";

export const revalidate = 120;

export default async function ByNumber({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const all = await getStrategies().catch(() => []);
  const hit = /^\d{1,5}$/.test(number) ? all.find((s) => String(s.display_number) === number) : undefined;
  // Keep the campaign tags the case study added.
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  const q = qs.toString() ? `?${qs}` : "";
  if (hit) permanentRedirect(`/${hit.slug}${q}`);
  redirect(`/strategies${q}`);
}
