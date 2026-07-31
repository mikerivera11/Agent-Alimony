export * from "./lumpSum";
// `BasisPoints` is intentionally not re-exported here: both modules define the
// same integer-basis-points alias, and re-exporting either one would be an
// arbitrary choice. Import it from the specific module you mean.
export {
  COMPARISON_APPRECIATION_BPS,
  HOME_EQUITY_GROWTH_BASES,
  HOME_EQUITY_MODEL_VERSION,
  HomeEquityInputError,
  MAX_APPRECIATION_BPS,
  MAX_PROJECTION_YEARS,
  MIN_APPRECIATION_BPS,
  calculateHomeEquity,
  type HomeEquityGrowthBasis,
  type HomeEquityInput,
  type HomeEquityPosition,
  type HomeEquityResult,
  type HomeEquityScenario,
  type HomeEquityYear,
} from "./homeEquity";
