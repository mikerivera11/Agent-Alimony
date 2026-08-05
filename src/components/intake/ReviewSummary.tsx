import { INTAKE_STEPS, type IntakeDraftData, type IntakeStepId } from "@/domain/intake";

import { secondaryButtonClasses } from "./fields/inputStyles";

interface ReviewSummaryProps {
  data: IntakeDraftData;
  applicableStepIds: IntakeStepId[];
  onEdit: (stepId: IntakeStepId) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const MONEY_KEY_PATTERN = /monthly|value|income|cost|tax|contribution|premium|dues|support/i;

function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  return spaced.trim();
}

function formatPrimitive(key: string, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "Not answered yet";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return MONEY_KEY_PATTERN.test(key) ? currencyFormatter.format(value) : String(value);
  }
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return String(value);
}

interface Entry {
  label: string;
  value: string;
}

function flattenPerson(prefix: string, obj: Record<string, unknown>): Entry[] {
  return Object.entries(obj).map(([key, value]) => ({
    label: `${prefix} ${humanizeKey(key).toLowerCase()}`,
    value: formatPrimitive(key, value),
  }));
}

function buildEntries(stepId: IntakeStepId, data: Record<string, unknown>): Entry[] {
  if (stepId === "children") {
    const children = (data.children as { nameOrInitials?: string; dateOfBirth?: string; hasSpecialNeeds?: string }[]) ?? [];
    const entries: Entry[] = [
      { label: "Has shared minor children", value: formatPrimitive("hasChildren", data.hasChildren) },
    ];
    children.forEach((child, index) => {
      entries.push({
        label: `Child ${index + 1}`,
        value: `${child.nameOrInitials || "Not answered yet"}, born ${child.dateOfBirth || "unknown"}${
          child.hasSpecialNeeds === "yes" ? " (has special needs)" : ""
        }`,
      });
    });
    return entries;
  }

  if (stepId === "income" || stepId === "deductions") {
    const self = (data.self as Record<string, unknown>) ?? {};
    const spouse = (data.spouse as Record<string, unknown>) ?? {};
    const entries = [...flattenPerson("Your", self), ...flattenPerson("Spouse's", spouse)];
    if (stepId === "income" && data.incomeNotes) {
      entries.push({ label: "Income notes", value: String(data.incomeNotes) });
    }
    return entries;
  }

  if (stepId === "assetsDebts") {
    const items = (data.items as
      | { label?: string; type?: string; value?: number; classification?: string; excludedByWrittenAgreement?: boolean }[]
      | undefined) ?? [];
    const entries: Entry[] = [];
    if (items.length === 0) {
      entries.push({ label: "Assets & debts", value: "No items added yet" });
    } else {
      items.forEach((item, index) => {
        const amount = typeof item.value === "number" ? currencyFormatter.format(item.value) : "unknown";
        const kind = item.type === "liability" ? "debt" : "asset";
        const excluded = item.excludedByWrittenAgreement ? ", excluded by agreement" : "";
        entries.push({
          label: `Item ${index + 1}`,
          value: `${item.label || "Untitled"} — ${amount} ${kind} (${item.classification ?? "unclassified"}${excluded})`,
        });
      });
    }
    entries.push({
      label: "Written agreement confirmed",
      value: formatPrimitive("writtenAgreementConfirmed", data.writtenAgreementConfirmed),
    });
    entries.push({
      label: "Unequal distribution requested",
      value: formatPrimitive("unequalDistributionRequested", data.unequalDistributionRequested),
    });
    entries.push({
      label: "Dissipation claim present",
      value: formatPrimitive("dissipationClaimPresent", data.dissipationClaimPresent),
    });
    entries.push({
      label: "Nonmarital mortgage paydown claim present",
      value: formatPrimitive("nonmaritalMortgagePaydownClaimPresent", data.nonmaritalMortgagePaydownClaimPresent),
    });
    entries.push({
      label: "Other support obligations",
      value: formatPrimitive("hasOtherSupportObligations", data.hasOtherSupportObligations),
    });
    if (data.otherSupportObligationsDetails) {
      entries.push({ label: "Other support details", value: String(data.otherSupportObligationsDetails) });
    }
    entries.push({
      label: "Suspects hidden or unknown assets",
      value: formatPrimitive("hasHiddenOrUnknownAssets", data.hasHiddenOrUnknownAssets),
    });
    entries.push({
      label: "Complex business interests",
      value: formatPrimitive("hasComplexBusinessInterests", data.hasComplexBusinessInterests),
    });
    return entries;
  }

  return Object.entries(data)
    .filter(([key]) => key !== "children")
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatPrimitive(key, value) }));
}

function StepSummarySection({
  stepId,
  data,
  onEdit,
}: {
  stepId: IntakeStepId;
  data: Record<string, unknown>;
  onEdit: (stepId: IntakeStepId) => void;
}) {
  const title = INTAKE_STEPS[stepId].title;
  const entries = buildEntries(stepId, data);

  return (
    <section aria-labelledby={`review-heading-${stepId}`} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`review-heading-${stepId}`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <button type="button" onClick={() => onEdit(stepId)} className={secondaryButtonClasses}>
          Edit {title}
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.label} className="flex flex-col gap-0.5">
            <dt className="text-sm font-medium capitalize text-ink-subtle">{entry.label}</dt>
            <dd className="text-base text-ink">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Read-only summary of every applicable topic, with an edit link back into the wizard for each. */
export function ReviewSummary({ data, applicableStepIds, onEdit }: ReviewSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      {applicableStepIds.map((stepId) => (
        <StepSummarySection
          key={stepId}
          stepId={stepId}
          // Defensive as well as normalised on load: a summary is the wrong
          // place to take down the page over a step with nothing saved in it.
          data={(data[stepId] ?? {}) as Record<string, unknown>}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
