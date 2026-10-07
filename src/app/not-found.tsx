import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-safe flex min-h-[60dvh] flex-col items-center justify-center pt-[var(--safe-top)] text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 font-semibold text-accent">
        Go to Library
      </Link>
    </div>
  );
}
