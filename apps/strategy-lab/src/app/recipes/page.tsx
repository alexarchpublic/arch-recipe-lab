import { permanentRedirect } from "next/navigation";

/** The old list address (PRD 13, Redirects). */
export default function OldList() {
  permanentRedirect("/strategies");
}
