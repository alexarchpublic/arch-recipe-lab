// Older links: every address the old Strategy Lab used, and the short
// /strategy/<number> links, each to its hand-off page. Linked from the footer
// so archpublic.com's page engine, which finds pages by following links,
// captures every hand-off page (PRD 13, Redirects).
import { allMoved } from "@/lib/moved";
import { canonicalUrl } from "@/lib/env";

export const revalidate = 120;

export const metadata = {
  title: "Older Strategy Lab links",
  alternates: { canonical: canonicalUrl("/older-links") },
  robots: { index: false, follow: true },
};

export default async function OlderLinks() {
  const moved = await allMoved().catch(() => []);
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
