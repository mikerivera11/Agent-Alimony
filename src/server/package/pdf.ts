/**
 * Server-side PDF generator for the results package, built with pdf-lib.
 *
 * Renders directly from a `PackageViewModel` — never from raw HTML or a
 * client-supplied string blob — with multi-page wrapping, readable
 * headings, and a running footer. The attorney-review disclaimer is always
 * the first content block on the first page.
 */
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import { formatCentsAsDollars } from "@/domain/package";
import type { PackageViewModel, ConfirmedFactEntry } from "@/domain/package";
import type { FormulaStep, MissingFact, RuleFlag, StatutoryCitation, EquitableDistributionResult } from "@/domain/rules";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FOOTER_HEIGHT = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const TITLE_SIZE = 18;
const HEADING_SIZE = 13;
const SUBHEADING_SIZE = 11;
const BODY_SIZE = 9.5;
const FOOTER_SIZE = 8;
const LINE_HEIGHT_FACTOR = 1.32;

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.35, 0.4, 0.47);
const DISCLAIMER_BG = rgb(0.9, 0.94, 1);
const DISCLAIMER_BORDER = rgb(0.05, 0.2, 0.55);

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface Fonts {
  readonly regular: PDFFont;
  readonly bold: PDFFont;
}

/** Manages page/cursor state so callers can just "write" content without worrying about pagination. */
class PdfWriter {
  private page: PDFPage;
  private y: number;
  readonly pages: PDFPage[] = [];
  readonly fonts: Fonts;

  constructor(private readonly doc: PDFDocument, fonts: Fonts) {
    this.fonts = fonts;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number): void {
    if (this.y - height < MARGIN + FOOTER_HEIGHT) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.pages.push(this.page);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  spacer(height = 8): void {
    this.y -= height;
  }

  title(text: string): void {
    this.ensureSpace(TITLE_SIZE * LINE_HEIGHT_FACTOR + 10);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: TITLE_SIZE, font: this.fonts.bold, color: INK });
    this.y -= TITLE_SIZE * LINE_HEIGHT_FACTOR;
  }

  heading(text: string): void {
    this.ensureSpace(HEADING_SIZE * LINE_HEIGHT_FACTOR + 10);
    this.y -= 6;
    this.page.drawText(text, { x: MARGIN, y: this.y, size: HEADING_SIZE, font: this.fonts.bold, color: INK });
    this.y -= HEADING_SIZE * LINE_HEIGHT_FACTOR;
  }

  subheading(text: string): void {
    this.ensureSpace(SUBHEADING_SIZE * LINE_HEIGHT_FACTOR + 4);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: SUBHEADING_SIZE, font: this.fonts.bold, color: INK });
    this.y -= SUBHEADING_SIZE * LINE_HEIGHT_FACTOR;
  }

  paragraph(text: string, options: { indent?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}): void {
    const indent = options.indent ?? 0;
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const color = options.color ?? INK;
    const lines = wrapLine(text, font, BODY_SIZE, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensureSpace(BODY_SIZE * LINE_HEIGHT_FACTOR);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size: BODY_SIZE, font, color });
      this.y -= BODY_SIZE * LINE_HEIGHT_FACTOR;
    }
  }

  bullet(text: string, indent = 0): void {
    this.paragraph(`\u2022 ${text}`, { indent });
  }

  disclaimerBox(heading: string, body: string): void {
    const lines = wrapLine(body, this.fonts.regular, BODY_SIZE, CONTENT_WIDTH - 24);
    const headingLines = wrapLine(heading, this.fonts.bold, SUBHEADING_SIZE, CONTENT_WIDTH - 24);
    const boxHeight =
      16 + headingLines.length * SUBHEADING_SIZE * LINE_HEIGHT_FACTOR + lines.length * BODY_SIZE * LINE_HEIGHT_FACTOR + 12;
    this.ensureSpace(boxHeight);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - boxHeight,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: DISCLAIMER_BG,
      borderColor: DISCLAIMER_BORDER,
      borderWidth: 1.5,
    });
    this.y -= 12;
    for (const line of headingLines) {
      this.page.drawText(line, {
        x: MARGIN + 12,
        y: this.y,
        size: SUBHEADING_SIZE,
        font: this.fonts.bold,
        color: DISCLAIMER_BORDER,
      });
      this.y -= SUBHEADING_SIZE * LINE_HEIGHT_FACTOR;
    }
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + 12, y: this.y, size: BODY_SIZE, font: this.fonts.regular, color: INK });
      this.y -= BODY_SIZE * LINE_HEIGHT_FACTOR;
    }
    this.y = top - boxHeight - 10;
  }
}

function renderMissingFacts(writer: PdfWriter, missingFacts: readonly MissingFact[]): void {
  for (const fact of missingFacts) {
    writer.bullet(fact.description, 12);
  }
}

function renderFlags(writer: PdfWriter, flags: readonly RuleFlag[]): void {
  for (const flag of flags) {
    writer.bullet(`[${flag.severity}] ${flag.description}`, 12);
  }
}

function renderFormulaTrace(writer: PdfWriter, formulaTrace: readonly FormulaStep[]): void {
  writer.subheading("Formula trace");
  for (const step of formulaTrace) {
    writer.paragraph(step.description, { bold: true, indent: 8 });
    const valueLine = Object.entries(step.values)
      .map(([key, value]) => `${key}: ${value === null ? "n/a" : String(value)}`)
      .join("  ·  ");
    if (valueLine) {
      writer.paragraph(valueLine, { indent: 16, color: MUTED });
    }
  }
}

function renderChildSupportSection(writer: PdfWriter, viewModel: PackageViewModel): void {
  writer.heading("Child support outcome (Fla. Stat. §61.30)");
  const outcome = viewModel.childSupport;
  if (outcome.kind === "calculated") {
    const result = outcome.result;
    writer.bullet(`Obligor: ${result.obligorParentId ?? "unknown"}`);
    writer.bullet(`Monthly transfer amount: ${formatCentsAsDollars(result.monthlyTransferAmountCents)}`);
    writer.bullet(`Total minimum child support need: ${formatCentsAsDollars(result.totalMinimumChildSupportNeedCents)}`);
    writer.bullet(`Substantial time-sharing applied: ${result.substantialTimeSharingApplied ? "Yes" : "No"}`);
    if (outcome.warnings.length > 0) {
      writer.subheading("Warnings");
      renderFlags(writer, outcome.warnings);
    }
    renderFormulaTrace(writer, outcome.formulaTrace);
  } else if (outcome.kind === "needsInput") {
    writer.paragraph(outcome.message);
    renderMissingFacts(writer, outcome.missingFacts);
  } else if (outcome.kind === "notImplemented") {
    writer.paragraph(outcome.reason);
  } else {
    writer.paragraph(outcome.reason);
    renderFlags(writer, outcome.flags);
  }
}

function renderAlimonySection(writer: PdfWriter, viewModel: PackageViewModel): void {
  writer.heading("Alimony outcome / factor analysis (Fla. Stat. §61.08)");
  const outcome = viewModel.alimony;
  if (outcome.kind === "calculated") {
    const result = outcome.result;
    writer.bullet(`Marriage duration: ${result.marriageDurationMonths} months (${result.marriageDurationCategory}-term)`);
    writer.bullet(`Illustrative amount ceiling: ${formatCentsAsDollars(result.amountCeiling.rangeCeilingCents)} per month`);
    writer.bullet(`Limiting factor: ${result.amountCeiling.limitingFactor}`);
    writer.subheading("Available forms");
    for (const form of result.formAvailability) {
      writer.bullet(`${form.form}: ${form.available ? "Available" : "Not available"} — ${form.reason}`);
    }
    writer.subheading("Section 61.08(3) factors considered");
    for (const factor of result.subsectionThreeFactors) {
      writer.bullet(`${factor.citation}: ${factor.description}`, 4);
    }
    if (outcome.warnings.length > 0) {
      writer.subheading("Warnings");
      renderFlags(writer, outcome.warnings);
    }
    renderFormulaTrace(writer, outcome.formulaTrace);
  } else if (outcome.kind === "needsInput") {
    writer.paragraph(outcome.message);
    renderMissingFacts(writer, outcome.missingFacts);
  } else if (outcome.kind === "notImplemented") {
    writer.paragraph(outcome.reason);
  } else {
    writer.paragraph(outcome.reason);
    renderFlags(writer, outcome.flags);
  }
}

function edSpouseLabel(result: EquitableDistributionResult, spouse: "a" | "b" | null): string {
  if (spouse === "a") return result.partyALabel;
  if (spouse === "b") return result.partyBLabel;
  return "n/a";
}

function renderEquitableDistributionSection(writer: PdfWriter, viewModel: PackageViewModel): void {
  writer.heading("Property & debt division (Fla. Stat. §61.075)");
  const outcome = viewModel.equitableDistribution;
  if (outcome.kind === "calculated") {
    const result = outcome.result;
    const withEx = result.distributionWithExclusions;
    const withoutEx = result.baselineWithoutExclusions;

    const payment = withEx.equalizingPayment;
    if (payment.fromSpouse === null || payment.amountCents === 0) {
      writer.bullet("Equalizing payment: none needed — holdings already balance.");
    } else {
      writer.bullet(
        `Equalizing payment (with exclusions): ${edSpouseLabel(result, payment.fromSpouse)} pays ${edSpouseLabel(
          result,
          payment.toSpouse,
        )} ${formatCentsAsDollars(payment.amountCents)}.`,
      );
    }

    writer.subheading("Separate (nonmarital) property set aside — Fla. Stat. §61.075(6)(b)");
    if (result.nonmaritalSetAside.items.length === 0) {
      writer.bullet("No items set aside as separate property.", 4);
    } else {
      for (const item of result.nonmaritalSetAside.items) {
        writer.bullet(
          `${item.label}: ${formatCentsAsDollars(item.valueCents)} — ${item.basisCitation}`,
          4,
        );
      }
    }
    writer.bullet(`${result.partyALabel} keeps (net): ${formatCentsAsDollars(result.nonmaritalSetAside.aNetCents)}`, 4);
    writer.bullet(`${result.partyBLabel} keeps (net): ${formatCentsAsDollars(result.nonmaritalSetAside.bNetCents)}`, 4);

    writer.subheading("Marital estate — with vs. without written-agreement exclusions");
    writer.bullet(
      `With exclusions: net estate ${formatCentsAsDollars(withEx.netMaritalEstateCents)}, equalizing payment ${formatCentsAsDollars(withEx.equalizingPayment.amountCents)}.`,
      4,
    );
    writer.bullet(
      `Without exclusions: net estate ${formatCentsAsDollars(withoutEx.netMaritalEstateCents)}, equalizing payment ${formatCentsAsDollars(withoutEx.equalizingPayment.amountCents)}.`,
      4,
    );

    if (result.exclusions.length > 0) {
      writer.subheading("Items requested to be excluded by written agreement");
      for (const exclusion of result.exclusions) {
        writer.bullet(
          `${exclusion.label} (${formatCentsAsDollars(exclusion.valueCents)}): ${exclusion.honored ? "excluded" : "kept in estate"} — ${exclusion.reason}`,
          4,
        );
      }
    }

    if (outcome.warnings.length > 0) {
      writer.subheading("Warnings");
      renderFlags(writer, outcome.warnings);
    }
    renderFormulaTrace(writer, outcome.formulaTrace);
  } else if (outcome.kind === "needsInput") {
    writer.paragraph(outcome.message);
    renderMissingFacts(writer, outcome.missingFacts);
  } else if (outcome.kind === "notImplemented") {
    writer.paragraph(outcome.reason);
  } else {
    writer.paragraph(outcome.reason);
    renderFlags(writer, outcome.flags);
  }
}

function renderLumpSumSection(writer: PdfWriter, viewModel: PackageViewModel): void {
  writer.heading("Lump-sum settlement (optional, illustrative)");
  const lumpSum = viewModel.lumpSum;
  if (!lumpSum.available || lumpSum.model === null) {
    writer.paragraph(lumpSum.reason ?? "A lump-sum illustration is not available for this case.");
    return;
  }

  writer.paragraph(
    "No Florida statute sets a discount rate or a present-value formula. The rate is the parties' own financial assumption, so the figures below are shown as a range, never as a single correct number.",
  );
  const model = lumpSum.model;
  writer.bullet(
    `Illustrative rate ${(lumpSum.illustrativeRateBps / 100).toString()}% — present value ${formatCentsAsDollars(model.selected.presentValueCents)} (converts ${formatCentsAsDollars(lumpSum.monthlyAmountCents)}/month for ${lumpSum.numberOfMonths} months).`,
  );

  writer.subheading("Sensitivity band");
  for (const scenario of model.range) {
    writer.bullet(
      `${(scenario.annualDiscountRateBps / 100).toString()}%: ${formatCentsAsDollars(scenario.presentValueCents)}`,
      4,
    );
  }

  if (model.assumptions.length > 0) {
    writer.subheading("Assumptions");
    for (const assumption of model.assumptions) {
      writer.bullet(assumption, 4);
    }
  }
  if (model.warnings.length > 0) {
    writer.subheading("Warnings");
    for (const warning of model.warnings) {
      writer.bullet(warning, 4);
    }
  }
}

function renderCitations(writer: PdfWriter, citations: readonly StatutoryCitation[]): void {
  for (const citation of citations) {
    writer.bullet(`${citation.citation}${citation.title ? ` — ${citation.title}` : ""}${citation.url ? ` (${citation.url})` : ""}`);
  }
}

/** Renders the full results package as a PDF. Pure with respect to its input — no I/O beyond pdf-lib's in-memory document. */
export async function generatePackagePdf(viewModel: PackageViewModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Florida Support & Alimony Estimate Packet");
  doc.setSubject("Illustrative estimate — not legal advice");
  doc.setProducer("Florida Support Guide");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const writer = new PdfWriter(doc, fonts);
  return finishDocument(doc, writer, viewModel);
}

async function finishDocument(doc: PDFDocument, writer: PdfWriter, viewModel: PackageViewModel): Promise<Uint8Array> {
  writer.title("Florida Support & Alimony Estimate Packet");
  writer.paragraph(
    `Generated ${new Date(viewModel.generatedAt).toLocaleString("en-US")} · Draft ${viewModel.draftId}${
      viewModel.isDemo ? " · DEMO DATA (fictional example)" : ""
    }`,
    { color: MUTED },
  );
  writer.spacer(6);

  // The disclaimer is always the first substantive content block, on the first page.
  const [heading, ...bodyParts] = viewModel.disclaimer.split(". ");
  writer.disclaimerBox(`${heading}.`, bodyParts.join(". "));

  writer.heading("Confirmed facts");
  const bySection = new Map<string, { title: string; entries: ConfirmedFactEntry[] }>();
  for (const entry of viewModel.confirmedFacts) {
    const bucket = bySection.get(entry.sectionId) ?? { title: entry.sectionTitle, entries: [] };
    bucket.entries.push(entry);
    bySection.set(entry.sectionId, bucket);
  }
  for (const { title, entries } of bySection.values()) {
    writer.subheading(title);
    for (const entry of entries) {
      writer.bullet(`${entry.label}: ${entry.value} (${entry.provenance})`, 8);
    }
  }

  writer.heading("Missing or unsupported items");
  if (viewModel.missingOrUnsupported.length === 0) {
    writer.paragraph("None identified.");
  } else {
    for (const issue of viewModel.missingOrUnsupported) {
      writer.bullet(`[${issue.severity}] ${issue.message}`);
    }
  }

  renderChildSupportSection(writer, viewModel);
  renderAlimonySection(writer, viewModel);
  renderEquitableDistributionSection(writer, viewModel);
  renderLumpSumSection(writer, viewModel);

  writer.heading("Scenarios (illustrative, not a recommendation)");
  if (viewModel.scenarios.length === 0) {
    writer.paragraph("No scenarios could be illustrated from the confirmed facts currently on file.");
  } else {
    for (const scenario of viewModel.scenarios) {
      writer.subheading(scenario.title);
      writer.paragraph(scenario.description, { indent: 8 });
      for (const [key, value] of Object.entries(scenario.figures)) {
        writer.bullet(`${key}: ${value}`, 16);
      }
    }
  }

  writer.heading("Assumptions");
  for (const assumption of viewModel.assumptions) {
    writer.bullet(assumption);
  }

  writer.heading("Sources & citations");
  renderCitations(writer, viewModel.sources);

  writer.heading("Ruleset/source verification dates");
  for (const verification of viewModel.verifications) {
    writer.bullet(
      `${verification.jurisdiction} ${verification.topic} (${verification.rulesetId}): effective ${verification.effectiveDate}, source last verified ${verification.sourceVerifiedAt}${
        verification.sourceUrl ? ` — ${verification.sourceUrl}` : ""
      }`,
    );
  }

  const pages = doc.getPages();
  const generatedLabel = new Date(viewModel.generatedAt).toLocaleDateString("en-US");
  pages.forEach((page, index) => {
    page.drawText(`Generated ${generatedLabel} — Estimate only, not legal advice — Page ${index + 1} of ${pages.length}`, {
      x: MARGIN,
      y: MARGIN / 2,
      size: FOOTER_SIZE,
      font: writer.fonts.regular,
      color: MUTED,
    });
  });

  return doc.save();
}
