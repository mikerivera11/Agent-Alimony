/**
 * Catalogue of the Florida Supreme Court Approved Family Law Forms an
 * uncontested dissolution normally involves.
 *
 * This module deliberately does *not* fill these forms in. It records which
 * ones a case needs, and the filing packet reports which answers the user has
 * already given that map onto them. The reason is in `types.ts`: the official
 * PDFs are AcroForms whose field names are positional rather than semantic, so
 * writing into them is guesswork that produces an authoritative-looking but
 * wrong document. An attorney fills the forms; this tells them what they have.
 *
 * Every entry below was verified on 2026-08-02 by downloading the court's own
 * PDF from the URL recorded here and reading the footer with a PDF parser.
 * `revision` is the date printed in that footer, and the title is the title
 * printed beside it — not the CMS listing, not the filename, and not the PDF
 * metadata, all three of which drift. Two concrete traps this caught:
 *
 * - 12.995(a) had been recorded here as revision 03/09. It is 02/18. The bad
 *   value came from a hand-rolled content-stream scraper that mangled kerned
 *   text; a real parser reading the same byte-identical file finds (02/18) as
 *   the only revision token in the document.
 * - 12.902(f)(3) is the *simplified* dissolution settlement agreement. The one
 *   for a case with dependent or minor children is 12.902(f)(1). Getting these
 *   the wrong way round would hand an attorney the wrong agreement entirely.
 *
 * Download URLs carry an opaque CMS content id that cannot be guessed, so they
 * are recorded verbatim rather than constructed.
 */

import type { OfficialFormReference } from "./types";

const VERIFIED_ON = "2026-08-02";

function note(extra: string): string {
  return (
    `Number, title, and revision were read from the footer of the court's own PDF on ${VERIFIED_ON}. ` +
    `Check that the revision in the footer of the copy you file matches; if it does not, the court's ` +
    `copy is newer and it governs. ${extra}`
  ).trim();
}

/** Whether a form is needed in every uncontested dissolution, or only sometimes. */
export type FilingFormRequirement = "required" | "situational";

export interface FilingFormEntry {
  readonly form: OfficialFormReference;
  readonly requirement: FilingFormRequirement;
  /** Plain-language statement of when this form is needed. */
  readonly whenItApplies: string;
  /** Why the court wants it, so the user understands rather than obeys. */
  readonly whyItMatters: string;
}

export const OFFICIAL_FILING_FORMS: readonly FilingFormEntry[] = [
  {
    form: {
      formNumber: "12.928",
      title: "Cover Sheet for Family Court Cases",
      revision: "02/24",
      url: "https://www.flcourts.gov/content/download/685879/7661787?version=13",
      verified: true,
      note: note("It also discloses any related family cases, so the same judge can hear them."),
    },
    requirement: "required",
    whenItApplies: "Filed with the petition that opens the case.",
    whyItMatters:
      "Tells the clerk what kind of family case this is and whether your family already has other cases before the court.",
  },
  {
    form: {
      formNumber: "12.901(b)(1)",
      title: "Petition for Dissolution of Marriage with Dependent or Minor Child(ren)",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685808/7661154?version=5",
      verified: true,
      note: note("Use this version only when the marriage involves dependent or minor children."),
    },
    requirement: "situational",
    whenItApplies: "The marriage involves dependent or minor children.",
    whyItMatters: "The document that opens the case and states what you are asking the court to order.",
  },
  {
    form: {
      formNumber: "12.901(b)(2)",
      title: "Petition for Dissolution of Marriage with Property but No Dependent or Minor Child(ren)",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685809/7661161?version=5",
      verified: true,
      note: note("Use this version when there are no minor children but there is property or debt to divide."),
    },
    requirement: "situational",
    whenItApplies: "No dependent or minor children, but there is property or debt to divide.",
    whyItMatters: "The document that opens the case and states what you are asking the court to order.",
  },
  {
    form: {
      formNumber: "12.901(b)(3)",
      title: "Petition for Dissolution of Marriage with No Dependent or Minor Child(ren) or Property",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685810/7661168?version=5",
      verified: true,
      note: note("Use this version only when there are neither minor children nor property or debt to divide."),
    },
    requirement: "situational",
    whenItApplies: "No dependent or minor children and no property or debt to divide.",
    whyItMatters: "The document that opens the case and states what you are asking the court to order.",
  },
  {
    form: {
      formNumber: "12.901(a)",
      title: "Joint Petition for Simplified Dissolution of Marriage",
      revision: "06/25",
      url: "https://www.flcourts.gov/content/download/685807/7661147?version=9",
      verified: true,
      note: note(
        "Simplified dissolution has strict eligibility limits and gives up rights other routes keep, including " +
          "financial disclosure and a trial. Whether you qualify, and whether you should use it, is a question for " +
          "an attorney.",
      ),
    },
    requirement: "situational",
    whenItApplies:
      "Both spouses agree, there are no minor or dependent children, neither spouse seeks alimony, and both give up the right to a trial and appeal.",
    whyItMatters: "A shorter route that exists only for the narrow set of cases that fit all of its conditions.",
  },
  {
    form: {
      formNumber: "12.902(c)",
      title: "Family Law Financial Affidavit (Long Form)",
      revision: "06/25",
      url: "https://www.flcourts.gov/content/download/685813/7661197?version=15",
      verified: true,
      note: note(
        "Florida publishes a short form (12.902(b)) and this long form, and which one you must file depends on a " +
          "gross-income threshold in the family law rules. This app does not assert that threshold because it " +
          "could not be verified against a primary source, so confirm the correct form with an attorney or the clerk.",
      ),
    },
    requirement: "situational",
    whenItApplies: "Each spouse files one. Which version depends on an income threshold set by the family law rules.",
    whyItMatters:
      "Sworn statement of income, expenses, assets, and debts. It is the document the court's support figures are built on.",
  },
  {
    form: {
      formNumber: "12.902(b)",
      title: "Family Law Financial Affidavit (Short Form)",
      revision: "10/21",
      url: "https://www.flcourts.gov/content/download/685812/7661190?version=12",
      verified: true,
      note: note(
        "See the note on 12.902(c): which affidavit applies depends on an income threshold this app does not assert.",
      ),
    },
    requirement: "situational",
    whenItApplies: "Each spouse files one. Which version depends on an income threshold set by the family law rules.",
    whyItMatters:
      "Sworn statement of income, expenses, assets, and debts. It is the document the court's support figures are built on.",
  },
  {
    form: {
      formNumber: "12.902(k)",
      title: "Notice of Joint Verified Waiver of Filing Financial Affidavits",
      revision: "10/23",
      url: "https://www.flcourts.gov/content/download/896441/9989336?version=5",
      verified: true,
      note: note("Waiving disclosure is a decision with consequences; discuss it with an attorney before signing."),
    },
    requirement: "situational",
    whenItApplies: "Both spouses agree to waive filing financial affidavits, where the rules allow it.",
    whyItMatters: "Records that both spouses chose not to file affidavits, rather than simply omitting them.",
  },
  {
    form: {
      formNumber: "12.932",
      title: "Certificate of Compliance with Mandatory Disclosure",
      revision: "06/25",
      url: "https://www.flcourts.gov/content/download/685889/7661881?version=13",
      verified: true,
      note: note("Lists the documents each spouse exchanged, such as tax returns, pay stubs, and account statements."),
    },
    requirement: "required",
    whenItApplies: "Each spouse files one, unless mandatory disclosure has been properly waived.",
    whyItMatters: "Confirms you gave the other spouse the financial documents the rules require you to exchange.",
  },
  {
    form: {
      formNumber: "12.902(e)",
      title: "Child Support Guidelines Worksheet",
      revision: "06/25",
      url: "https://www.flcourts.gov/content/download/685815/7661211?version=15",
      verified: true,
      note: note("This app produces a worksheet in this form's shape; the filed copy must still be the court's form."),
    },
    requirement: "situational",
    whenItApplies: "The case involves children for whom support is being set.",
    whyItMatters: "Shows the court how the child support figure was calculated under the statutory guidelines.",
  },
  {
    form: {
      formNumber: "12.995(a)",
      title: "Parenting Plan",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/686031/7663107?version=2",
      verified: true,
      note: note(
        "Florida also publishes a supervised/safety-focused variant (12.995(b)) and a relocation/long-distance " +
          "variant (12.995(c)). Which one fits your case is a decision for you and an attorney.",
      ),
    },
    requirement: "situational",
    whenItApplies: "The case involves minor children.",
    whyItMatters: "Sets out time-sharing, decision-making, and how the parents will communicate about the children.",
  },
  {
    form: {
      formNumber: "12.902(d)",
      title: "Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) Affidavit",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685814/7661204?version=3",
      verified: true,
      note: note("Fla. Stat. §61.522(1) requires each child's addresses and carers for the last five years."),
    },
    requirement: "situational",
    whenItApplies: "The case involves minor children.",
    whyItMatters:
      "Establishes that Florida is the right state to decide about the children, by listing where each child has lived for the last five years.",
  },
  {
    form: {
      formNumber: "12.902(f)(1)",
      title: "Marital Settlement Agreement for Dissolution of Marriage with Dependent or Minor Child(ren)",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685816/7661218?version=3",
      verified: true,
      note: note("This app does not draft this agreement. It produces a term sheet an attorney can draft it from."),
    },
    requirement: "situational",
    whenItApplies: "The case is uncontested and involves dependent or minor children.",
    whyItMatters: "The binding agreement between the spouses that the final judgment adopts.",
  },
  {
    form: {
      formNumber: "12.902(f)(2)",
      title: "Marital Settlement Agreement for Dissolution of Marriage with Property but No Dependent or Minor Child(ren)",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/685817/7661225?version=3",
      verified: true,
      note: note("This app does not draft this agreement. It produces a term sheet an attorney can draft it from."),
    },
    requirement: "situational",
    whenItApplies: "The case is uncontested, has no minor children, but has property or debt to divide.",
    whyItMatters: "The binding agreement between the spouses that the final judgment adopts.",
  },
  {
    form: {
      formNumber: "12.902(f)(3)",
      title: "Marital Settlement Agreement for Simplified Dissolution of Marriage",
      revision: "10/21",
      url: "https://www.flcourts.gov/content/download/685818/7661232?version=6",
      verified: true,
      note: note("Pairs with the simplified route (12.901(a)) only."),
    },
    requirement: "situational",
    whenItApplies: "The case is proceeding as a simplified dissolution.",
    whyItMatters: "The binding agreement between the spouses that the final judgment adopts.",
  },
  {
    form: {
      formNumber: "12.902(j)",
      title: "Notice of Social Security Number",
      revision: "06/18",
      url: "https://www.flcourts.gov/content/download/685820/7661246?version=5",
      verified: true,
      note: note(
        "This app never collects Social Security numbers, because they change none of its calculations and would " +
          "make any breach far worse. Complete this form by hand.",
      ),
    },
    requirement: "required",
    whenItApplies: "Filed with the petition.",
    whyItMatters: "Gives the court the Social Security numbers it is required to collect, without putting them in the public file.",
  },
  {
    form: {
      formNumber: "12.990(c)(1)",
      title: "Final Judgment of Dissolution of Marriage with Dependent or Minor Child(ren)",
      revision: "02/18",
      url: "https://www.flcourts.gov/content/download/686020/7663006?version=1",
      verified: true,
      note: note("The judge signs this. It is listed so you know what the process ends with, not so you file it."),
    },
    requirement: "situational",
    whenItApplies: "Prepared for the judge to sign at the end of a case involving minor children.",
    whyItMatters: "The order that actually ends the marriage and makes the agreed terms enforceable.",
  },
];

export function findFilingForm(formNumber: string): FilingFormEntry | undefined {
  return OFFICIAL_FILING_FORMS.find((entry) => entry.form.formNumber === formNumber);
}
