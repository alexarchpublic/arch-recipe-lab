// A plain link in place of next/link. On archpublic.com the site is a saved
// copy with no server behind it, so Next's prefetching and client-side
// navigation only produced failed requests (the page engine's capture report
// counted 127); every move between pages is a full page load there anyway.
import type { AnchorHTMLAttributes } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean };

export default function Link({ prefetch: _prefetch, scroll: _scroll, ...rest }: Props) {
  return <a {...rest} />;
}
