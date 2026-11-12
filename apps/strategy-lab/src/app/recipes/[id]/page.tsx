// The old strategy addresses, /strategy-lab/recipes/<record-id> (PRD 13,
// Redirects). The record ids match the store for the shared strategies; any
// other goes to the list. A page rather than a redirect: see components/Moved.
import { Moved } from "@/components/Moved";
import { movedMetadata, oldRecipe } from "@/lib/moved";

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return movedMetadata(await oldRecipe((await params).id));
}

export default async function OldStrategy({ params }: { params: Promise<{ id: string }> }) {
  const t = await oldRecipe((await params).id);
  return <Moved to={t.to} label={t.label} />;
}
