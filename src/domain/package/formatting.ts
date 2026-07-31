const centsFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats an integer-cents amount (as used throughout the rules engine) as a dollar string. */
export function formatCentsAsDollars(amountCents: number): string {
  return centsFormatter.format(amountCents / 100);
}
