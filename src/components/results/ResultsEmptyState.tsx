import Link from "next/link";

import { Card, buttonClasses } from "@/components/ui";

/** Shown when no reviewed intake snapshot has been saved yet. */
export function ResultsEmptyState() {
  return (
    <Card as="div" role="status" padding="lg" className="flex flex-col items-start gap-4">
      <h2 className="text-xl font-semibold text-ink">No reviewed intake found yet</h2>
      <p className="text-ink-muted">
        This page shows an estimate built from a completed and reviewed intake. Finish the guided intake and
        confirm your review to see child support and alimony estimates here.
      </p>
      <Link href="/intake" className={buttonClasses("secondary", "md")}>
        Go to guided intake
      </Link>
    </Card>
  );
}
