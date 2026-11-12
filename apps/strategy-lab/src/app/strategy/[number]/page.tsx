// /strategy-lab/strategy/<number>: a strategy by its number, the address case
// studies link to. Numbers never change (PRD 5), so the link survives a new
// slug. A strategy not on the public list goes to the list. A page rather
// than a redirect: see components/Moved.
import { Moved } from "@/components/Moved";
import { byNumber, movedMetadata } from "@/lib/moved";

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  return movedMetadata(await byNumber((await params).number));
}

export default async function ByNumber({ params }: { params: Promise<{ number: string }> }) {
  const t = await byNumber((await params).number);
  return <Moved to={t.to} label={t.label} />;
}
