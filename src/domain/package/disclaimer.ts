/**
 * Prominent, plain-language disclaimer shown on the results page and on the
 * first page of the generated PDF. Deliberately avoids any language that
 * could read as a settlement agreement, financial affidavit, or binding
 * court filing — this package is an estimate for planning and discussion
 * with an attorney, nothing more.
 */
export const PACKAGE_DISCLAIMER_HEADING = "Estimate only — not legal advice, not a binding agreement";

export const PACKAGE_DISCLAIMER_BODY =
  "This packet is a plain-language, illustrative estimate generated from the information you entered. " +
  "It is not legal advice, not a certified financial affidavit, and not a settlement agreement, contract, or " +
  "court order — nothing in it creates, waives, or modifies any legal right or obligation. Every figure is an " +
  "estimate or range based on the confirmed facts shown below, not a guaranteed or recommended amount a court " +
  "will order. Have a licensed Florida family law attorney review these numbers, along with your complete " +
  "financial picture, before relying on them for any decision or filing.";

export const PACKAGE_DISCLAIMER = `${PACKAGE_DISCLAIMER_HEADING}. ${PACKAGE_DISCLAIMER_BODY}`;
