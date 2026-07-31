import type { ConfirmedFactEntry } from "@/domain/package";

interface ConfirmedFactsPanelProps {
  entries: readonly ConfirmedFactEntry[];
}

/**
 * Groups every confirmed fact that fed the calculations by intake section,
 * and shows its provenance so the reader can trace each number back to
 * something they entered themselves — never a guess or a default.
 */
export function ConfirmedFactsPanel({ entries }: ConfirmedFactsPanelProps) {
  const bySection = new Map<string, { title: string; entries: ConfirmedFactEntry[] }>();
  for (const entry of entries) {
    const bucket = bySection.get(entry.sectionId) ?? { title: entry.sectionTitle, entries: [] };
    bucket.entries.push(entry);
    bySection.set(entry.sectionId, bucket);
  }

  if (bySection.size === 0) {
    return <p className="text-ink-muted">No confirmed facts are available yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(bySection.values()).map(({ title, entries: sectionEntries }) => (
        <div key={title} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{title} confirmed facts</caption>
            <tbody>
              {sectionEntries.map((entry) => (
                <tr key={`${entry.sectionId}-${entry.label}`} className="border-b border-border">
                  <th scope="row" className="w-1/2 py-1.5 pr-3 font-medium text-ink-muted">
                    {entry.label}
                  </th>
                  <td className="py-1.5 text-ink">
                    {entry.value}
                    <span className="ml-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
                      {entry.provenance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
