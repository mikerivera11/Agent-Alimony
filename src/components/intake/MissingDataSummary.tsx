import type { MissingDataSummaryEntry } from "@/domain/intake";

import { Alert, Button } from "@/components/ui";

interface MissingDataSummaryProps {
  entries: MissingDataSummaryEntry[];
  onEdit: (stepId: MissingDataSummaryEntry["stepId"]) => void;
}

/** Lists every topic that still has missing or invalid answers, with a way to jump back and fix it. */
export function MissingDataSummary({ entries, onEdit }: MissingDataSummaryProps) {
  if (entries.length === 0) {
    return (
      <Alert variant="success" role="status">
        Every topic looks complete. You can review your answers below before finishing.
      </Alert>
    );
  }

  return (
    <Alert
      variant="warning"
      role="alert"
      title={`${entries.length} topic${entries.length === 1 ? "" : "s"} still need${
        entries.length === 1 ? "s" : ""
      } a bit more information:`}
    >
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.stepId} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {entry.title} — {entry.issues.length} item{entry.issues.length === 1 ? "" : "s"} to finish
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(entry.stepId)}>
              Finish {entry.title}
            </Button>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
