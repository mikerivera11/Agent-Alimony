/**
 * Confirmed-fact boundary.
 *
 * Every calculation exported from `src/domain/rules/**` accepts only
 * `ConfirmedFact<T>` values. A `ConfirmedFact` is a nominally-branded wrapper
 * that can only be produced by calling `confirmFact`; it cannot be produced
 * by an object literal, by `JSON.parse`-ing a payload (the brand is a
 * runtime `Symbol` and never survives serialization), or by an AI/document
 * extraction proposal that merely happens to have a similar shape (e.g.
 * `{ value, confidence, source: "ocr" }`).
 *
 * This module intentionally has zero dependencies on any AI, extraction, or
 * server module — it only knows about "has this fact been confirmed by a
 * human/authoritative source, yes or no".
 */

const CONFIRMED_FACT_BRAND: unique symbol = Symbol("domain.rules.ConfirmedFact");

/** Where a confirmed fact's value ultimately came from. */
export type ConfirmedFactSource =
  | "user-entered"
  | "user-confirmed-extraction"
  | "document-confirmed";

export interface ConfirmedFact<T> {
  readonly [CONFIRMED_FACT_BRAND]: true;
  readonly value: T;
  readonly source: ConfirmedFactSource;
  readonly confirmedAt: string;
}

/**
 * The only way to construct a `ConfirmedFact`. Callers outside this package
 * (extraction pipelines, AI proposal handlers, etc.) must explicitly route a
 * value through here — and, by policy, only after a human has confirmed it.
 * This module does not, and must not, call into any extraction/AI code to
 * decide that for itself.
 */
export function confirmFact<T>(
  value: T,
  source: ConfirmedFactSource,
  confirmedAt: string = new Date().toISOString(),
): ConfirmedFact<T> {
  return {
    [CONFIRMED_FACT_BRAND]: true,
    value,
    source,
    confirmedAt,
  };
}

export function isConfirmedFact<T>(input: unknown): input is ConfirmedFact<T> {
  return (
    typeof input === "object" &&
    input !== null &&
    (input as Record<PropertyKey, unknown>)[CONFIRMED_FACT_BRAND] === true &&
    "value" in input
  );
}

export class UnconfirmedInputError extends Error {
  constructor(
    message = "Rules engine inputs must be created with confirmFact(); unconfirmed or extraction-proposal-shaped data is rejected at the confirmed-fact boundary.",
  ) {
    super(message);
    this.name = "UnconfirmedInputError";
  }
}

/**
 * Runtime guard used at the top of every public `calculate*` function. TS
 * types alone cannot stop a JavaScript caller (or a caller using `as any`)
 * from handing us extraction-shaped data, so every entry point re-checks the
 * brand at runtime and throws `UnconfirmedInputError` if it is missing.
 */
export function assertConfirmedFact<T>(input: unknown): asserts input is ConfirmedFact<T> {
  if (!isConfirmedFact<T>(input)) {
    throw new UnconfirmedInputError();
  }
}

export function unwrapConfirmedFact<T>(input: ConfirmedFact<T>): T {
  assertConfirmedFact<T>(input);
  return input.value;
}
