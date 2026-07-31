import Link from "next/link";

import { secondaryButtonClasses } from "@/components/intake";

/** Shown when no reviewed intake snapshot has been saved yet. */
export function ResultsEmptyState() {
  return (
    <div role="status" className="flex flex-col items-start gap-4 rounded-lg border-2 border-slate-300 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-950">No reviewed intake found yet</h2>
      <p className="text-slate-700">
        This page shows an estimate built from a completed and reviewed intake. Finish the guided intake and
        confirm your review to see child support and alimony estimates here.
      </p>
      <Link href="/intake" className={secondaryButtonClasses}>
        Go to guided intake
      </Link>
    </div>
  );
}
