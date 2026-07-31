/**
 * Loads and validates the generated Fla. Stat. §61.30(6) guidelines
 * schedule fixture, and provides deterministic lookup helpers.
 *
 * Table-row selection: each row in the statutory schedule represents the
 * FLOOR of a $50 combined-net-monthly-income bracket (e.g. the $800.00 row
 * covers $800.00-$849.99, the $850.00 row covers $850.00-$899.99, and so
 * on). Because the fixture only records the exact $50 multiples and this
 * ruleset cannot independently re-verify the bracket boundaries against the
 * statute's typeset table, incomes that fall between two table rows are
 * always normalized DOWN to the bracket floor row rather than interpolated
 * — the statute does not define interpolation, and inventing one would be
 * guessing. This is recorded as an assumption on every calculated outcome.
 */
import { z } from "zod";

import { cents, type Cents } from "../../money";
import scheduleFixture from "../../../../../data/legal/florida/child-support-schedule-2025.json";

const scheduleRowSchema = z.object({
  combinedMonthlyNetIncomeCents: z.number().int().nonnegative(),
  basicNeedCentsByChildren: z.array(z.number().int().nonnegative()).length(6),
});

const scheduleFixtureSchema = z.object({
  rulesetId: z.string(),
  jurisdiction: z.string(),
  statuteCompilation: z.string(),
  sourceVerifiedAt: z.string(),
  source: z.object({
    title: z.string(),
    url: z.string(),
    sha256: z.string(),
  }),
  schedule: z.array(scheduleRowSchema).min(1),
  aboveSchedulePercentBasisPointsByChildren: z.array(z.number().int().nonnegative()).length(6),
  implementationNotes: z.array(z.string()),
});

export type ScheduleFixture = z.infer<typeof scheduleFixtureSchema>;

/** Validated once at module load; throws immediately if the fixture is malformed. */
export const FLORIDA_CHILD_SUPPORT_SCHEDULE: ScheduleFixture =
  scheduleFixtureSchema.parse(scheduleFixture);

export const SCHEDULE_ROW_INCREMENT_CENTS = 5_000; // $50.00
export const SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS = cents(
  FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule[0]!.combinedMonthlyNetIncomeCents,
);
export const SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS = cents(
  FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule[FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule.length - 1]!
    .combinedMonthlyNetIncomeCents,
);

export interface ScheduleLookupResult {
  readonly rowCombinedNetIncomeCents: Cents;
  readonly basicMonthlyNeedCents: Cents;
  readonly wasAboveSchedule: boolean;
  readonly requestedCombinedNetIncomeCents: Cents;
  readonly normalizedToTableRow: boolean;
}

/**
 * Looks up the minimum monthly child support need for `numberOfChildren`
 * (1-6) given `combinedNetIncomeCents`. Callers are responsible for
 * rejecting incomes below `SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS` first
 * (Fla. Stat. §61.30(6)(a) requires HHS poverty-guideline data this ruleset
 * does not source; see childSupport/calculate.ts).
 */
export function lookupScheduleAmount(
  combinedNetIncomeCents: Cents,
  numberOfChildren: number,
): ScheduleLookupResult {
  if (!Number.isInteger(numberOfChildren) || numberOfChildren < 1 || numberOfChildren > 6) {
    throw new RangeError(`numberOfChildren must be an integer between 1 and 6, got ${numberOfChildren}.`);
  }
  if (combinedNetIncomeCents < SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS) {
    throw new RangeError(
      `combinedNetIncomeCents ${combinedNetIncomeCents} is below the schedule minimum; callers must handle this branch explicitly.`,
    );
  }

  const childIndex = numberOfChildren - 1;

  if (combinedNetIncomeCents > SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS) {
    const topRow = FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule.at(-1)!;
    const overageCents = combinedNetIncomeCents - SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS;
    const basisPoints =
      FLORIDA_CHILD_SUPPORT_SCHEDULE.aboveSchedulePercentBasisPointsByChildren[childIndex]!;
    const overageObligationCents = Math.round((overageCents * basisPoints) / 10_000);
    return {
      rowCombinedNetIncomeCents: SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS,
      basicMonthlyNeedCents: cents(
        topRow.basicNeedCentsByChildren[childIndex]! + overageObligationCents,
      ),
      wasAboveSchedule: true,
      requestedCombinedNetIncomeCents: combinedNetIncomeCents,
      normalizedToTableRow: false,
    };
  }

  const rowIndex = Math.min(
    FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule.length - 1,
    Math.max(
      0,
      Math.floor(
        (combinedNetIncomeCents - SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS) /
          SCHEDULE_ROW_INCREMENT_CENTS,
      ),
    ),
  );
  const row = FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule[rowIndex]!;

  return {
    rowCombinedNetIncomeCents: cents(row.combinedMonthlyNetIncomeCents),
    basicMonthlyNeedCents: cents(row.basicNeedCentsByChildren[childIndex]!),
    wasAboveSchedule: false,
    requestedCombinedNetIncomeCents: combinedNetIncomeCents,
    normalizedToTableRow: row.combinedMonthlyNetIncomeCents !== combinedNetIncomeCents,
  };
}
