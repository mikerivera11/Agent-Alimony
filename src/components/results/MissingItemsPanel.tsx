import type { MappingIssue, MappingIssueSeverity } from "@/domain/integration";

interface MissingItemsPanelProps {
  issues: readonly MappingIssue[];
}

const SEVERITY_STYLES: Record<MappingIssueSeverity, string> = {
  blocking: "border-red-800 bg-red-50 text-red-950",
  warning: "border-amber-700 bg-amber-50 text-amber-950",
  info: "border-slate-400 bg-slate-50 text-slate-900",
};

const SEVERITY_LABELS: Record<MappingIssueSeverity, string> = {
  blocking: "Blocks a calculation",
  warning: "Needs attention",
  info: "For your information",
};

/**
 * Surfaces every typed mapping/ruleset gap instead of silently guessing —
 * including ambiguous deductions, unsplit prepayments, and the alimony
 * ruleset's "needs an explicit recipient" issue.
 */
export function MissingItemsPanel({ issues }: MissingItemsPanelProps) {
  if (issues.length === 0) {
    return (
      <p role="status" className="rounded-md border border-green-700 bg-green-50 px-4 py-3 text-green-900">
        No missing or unsupported items were found for the facts you entered.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {issues.map((issue) => (
        <li
          key={issue.code}
          role={issue.severity === "blocking" ? "alert" : undefined}
          className={`rounded-md border-2 p-3 ${SEVERITY_STYLES[issue.severity]}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide">{SEVERITY_LABELS[issue.severity]}</p>
          <p className="font-medium">{issue.message}</p>
          <p className="text-xs opacity-75">Code: {issue.code}</p>
        </li>
      ))}
    </ul>
  );
}
