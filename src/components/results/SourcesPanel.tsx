import type { RulesetVerification } from "@/domain/package";
import type { StatutoryCitation } from "@/domain/rules";

interface SourcesPanelProps {
  sources: readonly StatutoryCitation[];
  verifications: readonly RulesetVerification[];
  assumptions: readonly string[];
}

/** Statutory citations, ruleset source-verification dates, and the assumptions behind every figure. */
export function SourcesPanel({ sources, verifications, assumptions }: SourcesPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Statutory citations</h3>
        <ul className="list-disc pl-6 text-slate-800">
          {sources.map((source) => (
            <li key={source.citation}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline">
                  {source.citation}
                </a>
              ) : (
                <span className="font-medium">{source.citation}</span>
              )}
              {source.title ? ` — ${source.title}` : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-950">Ruleset &amp; source verification dates</h3>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Ruleset verification dates</caption>
          <thead>
            <tr className="border-b-2 border-slate-300 text-xs uppercase tracking-wide text-slate-600">
              <th scope="col" className="py-1.5 pr-3">
                Ruleset
              </th>
              <th scope="col" className="py-1.5 pr-3">
                Effective date
              </th>
              <th scope="col" className="py-1.5">
                Source last verified
              </th>
            </tr>
          </thead>
          <tbody>
            {verifications.map((verification) => (
              <tr key={verification.rulesetId} className="border-b border-slate-200">
                <td className="py-1.5 pr-3 text-slate-950">
                  {verification.jurisdiction} {verification.topic} ({verification.statutoryCompilation})
                </td>
                <td className="py-1.5 pr-3 text-slate-800">{verification.effectiveDate}</td>
                <td className="py-1.5 text-slate-800">
                  {verification.sourceUrl ? (
                    <a href={verification.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                      {verification.sourceVerifiedAt}
                    </a>
                  ) : (
                    verification.sourceVerifiedAt
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-950">Assumptions behind these figures</h3>
        <ul className="list-disc pl-6 text-slate-800">
          {assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
