import Link from "@/components/Link";

export default function NotFound() {
  return (
    <div className="container py-20 text-center">
      <h1 className="text-3xl">That page is not here</h1>
      <p className="mt-2 text-muted-foreground">The strategy may have moved or been retired.</p>
      <Link href="/strategies" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
        See all strategies
      </Link>
    </div>
  );
}
