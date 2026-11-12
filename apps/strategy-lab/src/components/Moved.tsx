"use client";
// An old Strategy Lab address, kept as a small page that sends the visitor on
// (PRD 13, Redirects). archpublic.com serves a saved copy of this site, which
// cannot answer with a redirect, so each old address is captured as this page
// instead. Inside archpublic.com's frame the link is clicked for the visitor:
// the page engine handles a link click like any other, keeping the visitor's
// privacy choice and moving the address bar to the new page. On the site's
// own Vercel address it simply replaces the location. Anywhere else (the page
// engine taking its pictures) it stays put, and the link is there to follow.
import { useEffect, useRef } from "react";
import { inFrame } from "@/lib/frame";

function framedByArchPublic(): boolean {
  const origins = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (!origins || origins.length === 0) return true; // Firefox has no ancestorOrigins
  return Array.from({ length: origins.length }, (_, i) => origins.item(i) ?? "").some((o) => /^https:\/\/(www\.)?archpublic\.com$/.test(o));
}

export function Moved({ to, label }: { to: string; label: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const a = link.current;
    if (!a) return;
    // Keep campaign tags the old link carried (utm_*, partner).
    if (window.location.search) a.setAttribute("href", `${to}${window.location.search}`);
    if (inFrame()) {
      if (framedByArchPublic()) a.click();
    } else if (/(\.vercel\.app|^localhost)$/.test(window.location.hostname)) {
      window.location.replace(a.href);
    }
  }, [to]);
  return (
    <section className="container py-16">
      <p className="eyebrow mb-2">This page has moved</p>
      <h1 className="text-2xl font-extrabold">
        <a ref={link} href={to} className="text-primary hover:underline">
          {label}
        </a>
      </h1>
    </section>
  );
}
