import { PACKAGE_DISCLAIMER_BODY, PACKAGE_DISCLAIMER_HEADING } from "@/domain/package";

/**
 * Prominent, non-dismissible disclaimer shown at the top of the results
 * page (and mirrored on the first page of the generated PDF). Deliberately
 * uses `role="alert"` so assistive technology announces it immediately.
 */
export function DisclaimerBanner() {
  return (
    <section role="alert" className="flex flex-col gap-2 rounded-lg border-2 border-blue-800 bg-blue-50 p-5">
      <p className="text-lg font-semibold text-blue-950">{PACKAGE_DISCLAIMER_HEADING}.</p>
      <p className="text-blue-950">{PACKAGE_DISCLAIMER_BODY}</p>
    </section>
  );
}
