import type { EscalationAssessment } from "@/domain/intake";

import { Alert } from "@/components/ui";

interface AttorneyEscalationNoticeProps {
  assessment: EscalationAssessment;
}

/** Plain-language callout listing every reason this preview recommends talking to a real attorney. */
export function AttorneyEscalationNotice({ assessment }: AttorneyEscalationNoticeProps) {
  if (assessment.attorneyFlags.length === 0) {
    return null;
  }

  return (
    <Alert variant="attorney" title="Based on your answers, talking with a family law attorney is a good idea:">
      <ul className="flex list-disc flex-col gap-2 pl-5">
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
    </Alert>
  );
}
