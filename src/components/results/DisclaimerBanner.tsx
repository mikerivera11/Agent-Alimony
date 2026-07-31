import { PACKAGE_DISCLAIMER_BODY, PACKAGE_DISCLAIMER_HEADING } from "@/domain/package";

import { Alert } from "@/components/ui";

/**
 * Prominent, non-dismissible disclaimer shown at the top of the results
 * page (and mirrored on the first page of the generated PDF). Deliberately
 * uses `role="alert"` so assistive technology announces it immediately.
 */
export function DisclaimerBanner() {
  return (
    <Alert variant="info" emphasis hideIcon role="alert" className="flex-col gap-2">
      <p className="text-lg font-semibold">{PACKAGE_DISCLAIMER_HEADING}.</p>
      <p>{PACKAGE_DISCLAIMER_BODY}</p>
    </Alert>
  );
}
