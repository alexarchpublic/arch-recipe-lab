// Older links: every address the old Strategy Lab used, and the short
// /strategy/<number> links, each a server redirect to the strategy's page
// (next.config.mjs). Linked from the footer with a plain link, because
// archpublic.com's page engine finds addresses only by following links: an old
// address no page links to is never kept as a redirect (PRD 13, Redirects).
// The list is the one this build redirects (lib/moved.ts).
import { allMoved } from "@/lib/moved";
import { canonicalUrl } from "@/lib/env";

export const dynamic = "force-static";

export const metadata = {
  title: "Older Strategy Lab links",
  alternates: { canonical: canonicalUrl("/older-links") },
  robots: { index: false, follow: true },
};

export default function OlderLinks() {
  const moved = allMoved();
  return (
    <section className="container py-12">
      <h1 className="text-2xl font-extrabold">Older Strategy Lab links</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Addresses from the earlier Strategy Lab, and short links by strategy number. Each one opens the strategy&apos;s current page.
      </p>
      <ul className="mt-6 grid gap-1 text-sm sm:grid-cols-2">
        {moved.map((m) => (
          <li key={m.from}>
            <a className="text-primary hover:underline" href={m.from}>
              {m.from}
            </a>{" "}
            <span className="text-muted-foreground">· {m.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
