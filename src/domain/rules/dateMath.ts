/**
 * Deterministic, UTC-anchored date-difference helpers used for marriage
 * duration (alimony) and other statutory date computations. Dates are plain
 * ISO `YYYY-MM-DD` strings; all arithmetic is done in UTC to avoid any
 * host-timezone nondeterminism.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseIsoDate(value: string): Date {
  if (!isValidIsoDate(value)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole calendar days between two ISO dates (`end` minus `start`). */
export function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Whole elapsed calendar months between two ISO dates (`end` minus `start`),
 * floored so a partial trailing month is not counted — e.g. 2010-01-15 to
 * 2020-01-14 is 119 whole months, not 120.
 */
export function wholeMonthsBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}
