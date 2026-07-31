import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as cheerio from "cheerio";

const SOURCE_URL = "https://www.flsenate.gov/Laws/Statutes/2025/61.30";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data/legal/florida/child-support-schedule-2025.json",
);

function parseNumber(value: string): number {
  const parsed = Number(value.replaceAll(",", "").replaceAll("$", "").trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse statutory numeric value: ${value}`);
  }
  return parsed;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "FloridaSupportGuide/1.0 legal-source-verifier" },
  });

  if (!response.ok) {
    throw new Error(`Florida statute fetch failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const tables = $("table");

  if (tables.length < 2) {
    throw new Error("Expected both the statutory schedule and high-income table.");
  }

  const schedule = $(tables[0])
    .find("tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("th,td")
        .toArray()
        .map((cell) => $(cell).text().replace(/\s+/g, " ").trim()),
    )
    .filter((cells) => cells.length === 7 && /^\$?[\d,]+(?:\.\d+)?$/.test(cells[0]))
    .map((cells) => ({
      combinedMonthlyNetIncomeCents: Math.round(parseNumber(cells[0]) * 100),
      basicNeedCentsByChildren: cells
        .slice(1)
        .map((value) => Math.round(parseNumber(value) * 100)),
    }));

  if (schedule.length !== 185) {
    throw new Error(`Expected 185 statutory schedule rows, found ${schedule.length}.`);
  }

  schedule.forEach((row, index) => {
    const expectedIncomeCents = 80_000 + index * 5_000;
    if (row.combinedMonthlyNetIncomeCents !== expectedIncomeCents) {
      throw new Error(
        `Unexpected schedule income at row ${index}: ${row.combinedMonthlyNetIncomeCents}.`,
      );
    }
    if (row.basicNeedCentsByChildren.length !== 6) {
      throw new Error(`Expected six child columns at row ${index}.`);
    }
  });

  const percentages = $(tables[1])
    .find("td")
    .toArray()
    .map((cell) => $(cell).text().trim())
    .filter((value) => /^\d+(?:\.\d+)?%$/.test(value))
    .map((value) => Math.round(parseNumber(value.replace("%", "")) * 100));

  if (percentages.length !== 6) {
    throw new Error(`Expected six high-income percentages, found ${percentages.length}.`);
  }

  const fixture = {
    rulesetId: "fl-child-support-2025",
    jurisdiction: "FL",
    statuteCompilation: "2025",
    sourceVerifiedAt: process.env.SOURCE_VERIFIED_AT ?? "2026-07-30",
    source: {
      title: "Fla. Stat. § 61.30 — Child support guidelines",
      url: SOURCE_URL,
      sha256: sha256(html),
    },
    schedule,
    aboveSchedulePercentBasisPointsByChildren: percentages,
    implementationNotes: [
      "Generated from the official Florida Senate statute table; do not hand edit.",
      "Below-schedule calculations require a separately versioned HHS poverty guideline.",
      "Official Florida Courts form 12.902(e) revision parity remains a separate verification.",
    ],
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${schedule.length} schedule rows to ${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
