// The old list address (PRD 13, Redirects). A page rather than a redirect: see components/Moved.
import { Moved } from "@/components/Moved";
import { movedMetadata, oldList } from "@/lib/moved";

export const metadata = movedMetadata(oldList());

export default function OldList() {
  const t = oldList();
  return <Moved to={t.to} label={t.label} />;
}
