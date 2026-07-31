import type { EscalationAssessment } from "@/domain/intake";

interface AttorneyEscalationNoticeProps {
  assessment: EscalationAssessment;
}

/** Plain-language callout listing every reason this preview recommends talking to a real attorney. */
export function AttorneyEscalationNotice({ assessment }: AttorneyEscalationNoticeProps) {
  if (assessment.attorneyFlags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-purple-800 bg-purple-50 p-4 text-purple-950">
      <p className="font-semibold">Based on your answers, talking with a family law attorney is a good idea:</p>
      <ul className="flex flex-col gap-2 pl-5 list-disc">
        {assessment.attorneyFlags.map((flag) => (
          <li key={flag.id}>
            <span className="font-semibold">{flag.label}.</span> {flag.reason}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        You can find a lawyer through the{" "}
        <a
          href="https://www.floridabar.org/public/lrs/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          Florida Bar Lawyer Referral Service
        </a>
        .
      </p>
    </div>
  );
}
