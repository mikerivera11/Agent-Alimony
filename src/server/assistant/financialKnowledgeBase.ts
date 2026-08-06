import type { StatutoryCitation } from "@/domain/rules/types";

import type { KnowledgeEntry } from "./knowledgeBase";

const CFPB_HOME_EQUITY =
  "https://www.consumerfinance.gov/ask-cfpb/what-is-a-home-equity-loan-en-106/";
const CFPB_HELOC_BROCHURE =
  "https://files.consumerfinance.gov/f/documents/cfpb_heloc-brochure.pdf";
const CFPB_EMERGENCY_FUND =
  "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/";
const IRS_CAPITAL_GAINS = "https://www.irs.gov/taxtopics/tc409";
const FINRA_DIVERSIFICATION =
  "https://www.finra.org/investors/investing/investing-basics/asset-allocation-diversification";

function source(citation: string, title: string, url: string): StatutoryCitation {
  return { citation, title, url };
}

export const FINANCIAL_KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "funding-lump-sum-comparison",
    title: "Should I use home equity or sell investments for a lump sum?",
    keywords: [
      "heloc",
      "home equity",
      "equity line",
      "borrow against",
      "sell stock",
      "sell investments",
      "liquidate investments",
      "lump sum",
      "borrow or sell",
      "finance settlement",
    ],
    answer:
      "There is no universally safer choice. A useful comparison treats this as **secured debt versus an asset sale**, not just as two monthly-payment options.\n\n" +
      "**For a home-equity line or loan, verify:** the annual percentage rate; whether the rate can change; the draw and repayment periods; closing, appraisal, annual, and early-termination fees; the payment after any introductory period; and whether one income can carry the payment after the divorce. The home secures the debt, so a missed-payment problem can put the home itself at risk.\n\n" +
      "**For selling investments, verify:** each lot's adjusted tax basis, unrealized gain or loss, holding period, any loss carryforwards, and whether the sale would leave the remaining portfolio too concentrated. Selling removes market exposure and does not create a required loan payment, but it can create a taxable gain and gives up future participation in that investment.\n\n" +
      "**Compare the same horizon:** total borrowing cost over the realistic payoff period, the after-tax cash a sale would actually produce, emergency cash left afterward, and a downside case in which income falls, the HELOC rate rises, or the investments decline. Do not count an uncertain market return as though it were guaranteed.\n\n" +
      "Before choosing, have a CPA estimate the sale's tax effect from the actual tax lots and a fee-only fiduciary adviser review the portfolio and cash reserve. A lender should provide the HELOC disclosures in writing. A family-law attorney should confirm that the funding method and title/debt changes match the settlement terms.",
    citations: [
      source("CFPB — Home equity loans", "Collateral risk, fixed rates, and fees", CFPB_HOME_EQUITY),
      source("CFPB — HELOC booklet", "Home Equity Lines of Credit booklet", CFPB_HELOC_BROCHURE),
      source("IRS Topic No. 409", "Capital gains and losses", IRS_CAPITAL_GAINS),
      source("FINRA", "Asset allocation and diversification", FINRA_DIVERSIFICATION),
      source("CFPB — Emergency fund", "Building an emergency cash reserve", CFPB_EMERGENCY_FUND),
    ],
  },
  {
    id: "home-equity-borrowing",
    title: "What should I compare before borrowing against my home?",
    keywords: [
      "heloc",
      "home equity",
      "equity loan",
      "equity line",
      "variable rate",
      "interest rate",
      "closing costs",
      "borrow against home",
      "foreclosure",
    ],
    answer:
      "Borrowing against home equity turns the house into collateral for the new obligation. CFPB warns that a lender could foreclose if a home-equity loan is not repaid and that upfront fees and costs matter in addition to the monthly payment.\n\n" +
      "Ask for the annual percentage rate, rate index and margin, adjustment frequency and cap, draw-period payment, repayment-period payment, balloon payment, appraisal and closing costs, annual fees, inactivity fees, and early-termination fees. Stress-test the payment using one post-divorce income and the highest contractually permitted rate, not only today's payment.\n\n" +
      "Also confirm who will own the home, who will sign and remain liable for each mortgage or line, whether the existing mortgage restricts additional liens, and how quickly the loan must close. Those title and liability questions belong in the settlement review with the attorney and lender.",
    citations: [
      source("CFPB — Home equity loans", "Collateral risk, fixed rates, and fees", CFPB_HOME_EQUITY),
      source("CFPB — HELOC booklet", "Home Equity Lines of Credit booklet", CFPB_HELOC_BROCHURE),
    ],
  },
  {
    id: "selling-investments",
    title: "What matters before selling stock or other investments?",
    keywords: [
      "sell stock",
      "selling stock",
      "sell investments",
      "capital gain",
      "capital loss",
      "tax basis",
      "cost basis",
      "tax lot",
      "holding period",
      "portfolio",
      "diversification",
      "concentration",
    ],
    answer:
      "The cash in a brokerage account is not automatically the cash available after a sale. IRS guidance says a capital gain or loss generally starts with the difference between the amount realized and the asset's adjusted basis. It also distinguishes short-term property, generally held one year or less, from long-term property held more than one year.\n\n" +
      "Before selling, export the tax-lot report and identify basis, holding period, unrealized gain or loss, and any lots whose basis is missing. Ask a CPA to estimate federal tax and confirm whether any losses or carryforwards change the result. Do not rely on a generic capital-gains percentage without the complete return.\n\n" +
      "Then examine what remains. FINRA describes diversification as spreading investments among and within asset classes to reduce concentration risk. A sale that raises cash can also unintentionally leave the portfolio concentrated in one company, sector, or account type. Compare the post-sale allocation with the household's new time horizon, risk tolerance, and emergency-cash needs.",
    citations: [
      source("IRS Topic No. 409", "Capital gains and losses", IRS_CAPITAL_GAINS),
      source("FINRA", "Asset allocation and diversification", FINRA_DIVERSIFICATION),
    ],
  },
  {
    id: "post-divorce-liquidity",
    title: "How much liquidity should I preserve?",
    keywords: [
      "liquidity",
      "cash reserve",
      "emergency fund",
      "emergency savings",
      "cash cushion",
      "post divorce budget",
      "after divorce",
      "afford payment",
      "monthly payment",
    ],
    answer:
      "A settlement funding plan should leave enough readily available cash for the post-divorce budget and foreseeable one-time costs. The right reserve is personal, but it should be tested against housing repairs, insurance deductibles, legal or tax bills, moving costs, income interruption, and the first months of support and household payments.\n\n" +
      "Do not compare a HELOC and an investment sale while assuming every remaining dollar can stay invested. First set aside the reserve that must not be exposed to a market decline or dependent on additional borrowing. Then compare the choices using only the genuinely available equity or investments.\n\n" +
      "A fee-only fiduciary adviser can test the reserve and portfolio together; a CPA can estimate taxes; and a housing counselor or lender can explain written loan terms. This guide can organize the comparison, but it cannot determine your risk tolerance or recommend a transaction.",
    citations: [
      source("CFPB — Emergency fund", "Building an emergency cash reserve", CFPB_EMERGENCY_FUND),
      source("FINRA", "Asset allocation and diversification", FINRA_DIVERSIFICATION),
    ],
  },
] as const;
