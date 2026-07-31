/**
 * Court-form support.
 *
 * This module turns confirmed intake data and deterministic rule results into
 * *worksheets* laid out the way Florida's official forms are laid out, so a
 * person (or their attorney) can transcribe them onto the real filing.
 *
 * It deliberately does **not** reproduce or fill an official Florida Supreme
 * Court Approved Family Law Form, and the distinction is not pedantic:
 *
 * - The official forms are versioned documents with a revision date in their
 *   footer. Embedding a copy would silently go stale, and a superseded form is
 *   rejected at the clerk's window. Referring to a form by number while
 *   pointing at the court's own current copy cannot go stale.
 * - The official PDFs *are* interactive AcroForms (12.902(e) carries 93
 *   fields, 12.995(a) carries 317), so filling one is technically possible.
 *   It is not done here because the field names are positional rather than
 *   semantic — "Odd Years 1" through "Odd Years 7" carry no indication of
 *   which holiday each row belongs to. Any mapping is therefore an inference,
 *   it silently re-points on the next revision, and a figure landing in the
 *   wrong box on a sworn court document is worse than no figure at all.
 * - Guessing where a form lives is unsafe. A plausible-looking URL for form
 *   12.995(a) turned out to serve Florida's Dependency Benchbook. Form
 *   identity is therefore something this module *records as verified*, never
 *   infers.
 *
 * The line structure below is taken from Fla. Stat. §61.30 itself, not from a
 * form. The statute prescribes the computation in order, the rules engine
 * already implements and tests exactly that order, and the statute is the
 * authority the form is derived from — so this stays correct even across form
 * revisions.
 */

import type { StatutoryCitation } from "@/domain/rules";

/**
 * Identity of an official form this app refers to but does not reproduce.
 *
 * `verified` records whether the number, title, and revision have been
 * confirmed against the document's own footer. Anything unverified is shown
 * without a link and without a revision date rather than being presented as
 * authoritative, because the failure mode here is a person filing the wrong
 * document.
 */
export interface OfficialFormReference {
  /** Form number as it appears in the footer, e.g. "12.902(e)". */
  readonly formNumber: string;
  readonly title: string;
  /**
   * Revision as printed in the form footer, e.g. "03/24". Null when this has
   * not been verified against the document itself.
   */
  readonly revision: string | null;
  /** Where the court publishes it. Null when no URL has been verified. */
  readonly url: string | null;
  readonly verified: boolean;
  /** Shown to the user so an unverified reference is never silently trusted. */
  readonly note: string;
}

export type FormLineKind = "input" | "computed" | "section" | "note";

export interface FormLine {
  /** Line label, worded as the statute words it. */
  readonly label: string;
  /** Rendered value. Null for section headers and notes. */
  readonly value: string | null;
  readonly kind: FormLineKind;
  /** Statutory subsection this line comes from, e.g. "§61.30(2)(a)". */
  readonly authority?: string;
  /** Shown beneath the line to explain a term in plain language. */
  readonly explanation?: string;
}

export interface FormWorksheet {
  readonly id: string;
  readonly title: string;
  /** One sentence stating what this is and, importantly, what it is not. */
  readonly subtitle: string;
  readonly officialForm: OfficialFormReference;
  readonly rulesetId: string;
  readonly ruleVersion: string;
  readonly effectiveDate: string;
  readonly generatedAt: string;
  readonly lines: readonly FormLine[];
  readonly citations: readonly StatutoryCitation[];
  /** Anything the worksheet could not fill, stated rather than left blank. */
  readonly gaps: readonly string[];
}
