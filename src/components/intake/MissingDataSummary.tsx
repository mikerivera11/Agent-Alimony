import type { MissingDataSummaryEntry } from "@/domain/intake";

import { secondaryButtonClasses } from "./fields/inputStyles";

interface MissingDataSummaryProps {
  entries: MissingDataSummaryEntry[];
  onEdit: (stepId: MissingDataSummaryEntry["stepId"]) => void;
}

/** Lists every topic that still has missing or invalid answers, with a way to jump back and fix it. */
export function MissingDataSummary({ entries, onEdit }: MissingDataSummaryProps) {
  if (entries.length === 0) {
    return (
      <p role="status" className="rounded-md border border-green-700 bg-green-50 px-4 py-3 text-green-900">
        Every topic looks complete. You can review your answers below before finishing.
      </p>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-md border-2 border-amber-700 bg-amber-50 p-4">
      <p className="font-semibold text-amber-950">
        {entries.length} topic{entries.length === 1 ? "" : "s"} still need{entries.length === 1 ? "s" : ""} a bit more
        information:
      </p>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.stepId} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-amber-950">
              {entry.title} — {entry.issues.length} item{entry.issues.length === 1 ? "" : "s"} to finish
            </span>
            <button type="button" onClick={() => onEdit(entry.stepId)} className={secondaryButtonClasses}>
              Finish {entry.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
