/**
 * Curated Florida family-law knowledge base.
 *
 * Every entry is transcribed from, or directly summarises, statutory text
 * that was fetched from the official Florida Senate site and recorded in the
 * ruleset source manifest. This file is the ONLY substantive legal content
 * the assistant is allowed to state.
 *
 * Why a curated base instead of letting a model answer from memory: a
 * language model asked about §61.08 will happily invent repealed
 * "permanent alimony", pre-2023 duration rules, or a nonexistent formula.
 * Retrieval over verified text keeps the assistant's substance deterministic
 * and citable; a model, when configured, only rephrases these passages in
 * plainer language.
 *
 * Statutory compilation: 2025 Florida Statutes as published by the Florida
 * Senate. Alimony content reflects the framework applicable to petitions
 * pending or filed on or after July 1, 2023.
 */

import type { StatutoryCitation } from "@/domain/rules/types";

export interface KnowledgeEntry {
  readonly id: string;
  /** Short plain-language title, used as a suggested question. */
  readonly title: string;
  /** Terms that should route a question to this entry. */
  readonly keywords: readonly string[];
  /** Plain-language answer. Must not contain computed dollar figures. */
  readonly answer: string;
  readonly citations: readonly StatutoryCitation[];
  /** Set when the topic routinely exceeds what this app can model. */
  readonly requiresAttorneyReview?: boolean;
}

const FL_SENATE = "https://www.flsenate.gov/Laws/Statutes/2025";

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "alimony-forms",
    title: "What kinds of alimony can a Florida court award?",
    keywords: [
      "alimony",
      "types",
      "forms",
      "kinds",
      "bridge the gap",
      "bridge-the-gap",
      "rehabilitative",
      "durational",
      "temporary",
      "permanent",
      "spousal support",
      "maintenance",
    ],
    answer:
      "Florida law lets a court award bridge-the-gap, rehabilitative, or durational alimony, or a combination of " +
      "them. It may also award temporary support while the case is pending.\n\n" +
      "**Bridge-the-gap** helps you move from being married to being single by covering identifiable short-term " +
      "needs. It cannot last more than 2 years, and once ordered it cannot be modified in amount or duration.\n\n" +
      "**Rehabilitative** alimony helps you get back into the workforce — redeveloping skills or credentials, or " +
      "getting education or training. It requires a specific, written rehabilitative plan, and it cannot last " +
      "more than 5 years.\n\n" +
      "**Durational** alimony provides support for a set period after a short-term, moderate-term, or long-term " +
      "marriage. It is not available if the marriage lasted less than 3 years.\n\n" +
      "Important: Florida eliminated **permanent alimony** for cases filed on or after July 1, 2023. If you read " +
      "older articles online, they may describe rules that no longer apply.\n\n" +
      "The court must first find that one spouse has an actual need for support and the other has the ability to " +
      "pay it. Only then does it decide the type, amount, and duration.",
    citations: [
      { citation: "Fla. Stat. §61.08(1)(a)", title: "Forms of alimony", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(2)", title: "Need and ability to pay", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(6)", title: "Bridge-the-gap alimony", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(7)", title: "Rehabilitative alimony", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(8)", title: "Durational alimony", url: `${FL_SENATE}/61.08` },
    ],
  },
  {
    id: "alimony-marriage-length",
    title: "How does the length of my marriage affect alimony?",
    keywords: [
      "length",
      "duration",
      "how long",
      "married",
      "years",
      "short term",
      "moderate term",
      "long term",
      "10 years",
      "short-term",
      "moderate-term",
      "long-term",
      "20 years",
    ],
    answer:
      "Florida sorts marriages into three categories, measured from the date you married to the date the " +
      "petition for dissolution was filed:\n\n" +
      "- **Short-term**: less than 10 years\n" +
      "- **Moderate-term**: 10 years or more, but less than 20 years\n" +
      "- **Long-term**: 20 years or more\n\n" +
      "That category caps how long durational alimony can last. The cap is a percentage of the length of the " +
      "marriage: 50% for a short-term marriage, 60% for a moderate-term marriage, and 75% for a long-term " +
      "marriage. A court can exceed the cap only upon a written finding of clear and convincing evidence that " +
      "it is necessary, applying specific statutory factors.\n\n" +
      "Durational alimony is not available at all if the marriage lasted less than 3 years.\n\n" +
      "This app calculates your marriage length and the resulting cap for you on the results screen — those " +
      "numbers come from the app's calculator, not from me.",
    citations: [
      { citation: "Fla. Stat. §61.08(5)", title: "Marriage length definitions", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(8)(b)", title: "Durational alimony duration caps", url: `${FL_SENATE}/61.08` },
    ],
  },
  {
    id: "alimony-amount-cap",
    title: "Is there a limit on how much alimony a court can order?",
    keywords: [
      "how much",
      "amount",
      "cap",
      "limit",
      "maximum",
      "35 percent",
      "35%",
      "net income",
      "reasonable need",
      "calculate alimony",
    ],
    answer:
      "Yes, for durational alimony. The amount is the **lesser of** two things:\n\n" +
      "1. The receiving spouse's reasonable need, or\n" +
      "2. 35% of the difference between the spouses' net incomes.\n\n" +
      "Because it is whichever is *smaller*, a low reasonable-need figure will hold the whole estimate down — " +
      "which is why this app asks you for a monthly budget and, if you leave the need figure blank, derives it " +
      "from the expenses you entered.\n\n" +
      "There is **no statutory formula** that produces a single \"correct\" alimony number in Florida. The " +
      "statute sets an outer ceiling; within it, the judge has discretion guided by the statutory factors. That " +
      "is why this app shows a **range** rather than a prediction.\n\n" +
      "Bridge-the-gap and rehabilitative alimony are not subject to this 35% cap; they are tied to the specific " +
      "short-term needs or the written rehabilitative plan they are meant to fund.\n\n" +
      "The court can also order alimony to be paid **periodically or in a lump sum**, or both.",
    citations: [
      { citation: "Fla. Stat. §61.08(8)(c)", title: "Durational alimony amount ceiling", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(1)(a)", title: "Periodic or lump sum payment", url: `${FL_SENATE}/61.08` },
    ],
  },
  {
    id: "alimony-factors",
    title: "What does a judge look at when deciding alimony?",
    keywords: [
      "factors",
      "judge",
      "consider",
      "decide",
      "standard of living",
      "adultery",
      "cheating",
      "affair",
      "need",
      "ability to pay",
      "workforce",
      "homemaker",
      "stay at home",
      "imputed",
      "imputed income",
      "unemployed",
      "underemployed",
      "voluntarily unemployed",
      "earning capacity",
    ],
    answer:
      "After finding need and ability to pay, the court weighs all relevant factors, including:\n\n" +
      "- The standard of living established during the marriage, and whether both households can reasonably " +
      "  maintain it (the statute recognises they often cannot)\n" +
      "- The length of the marriage\n" +
      "- Each spouse's age, physical health, mental health, and emotional condition\n" +
      "- Each spouse's resources and income, including from marital and nonmarital assets\n" +
      "- Each spouse's earning capacity, education, vocational skills, and employability — and, for the spouse " +
      "  seeking support, the time and cost of getting the education or training needed to find work\n" +
      "- Each spouse's contributions to the marriage, including homemaking, child care, education, and " +
      "  career-building for the other spouse\n" +
      "- Responsibilities each will have for any minor children they have together, with special consideration " +
      "  for a child with a mental or physical disability\n" +
      "- The tax treatment and consequences of an alimony award\n" +
      "- Any other factor necessary to do equity and justice between the parties\n\n" +
      "The court **may** also consider adultery and the resulting economic circumstances — but note it is the " +
      "*economic* impact that matters, not punishment. A court may consider any type of earned or unearned " +
      "income, and it may impute income to a spouse who is voluntarily unemployed or underemployed.",
    citations: [
      { citation: "Fla. Stat. §61.08(3)", title: "Alimony factors", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(4)", title: "Adultery and imputed income", url: `${FL_SENATE}/61.08` },
    ],
  },
  {
    id: "child-support-basics",
    title: "How is child support calculated in Florida?",
    keywords: [
      "child support",
      "children",
      "guideline",
      "worksheet",
      "61.30",
      "how is child support",
      "kids",
      "gross income",
      "income",
      "self-employment",
      "self employment",
      "business income",
      "deductions",
      "net income",
      "child care",
      "childcare",
      "health insurance",
      "uninsured medical",
      "support amount",
    ],
    answer:
      "Florida uses an \"income shares\" model. In plain terms, the law estimates what the parents would have " +
      "spent on the children together, then splits that between them. The main steps are:\n\n" +
      "1. **Gross income** for each parent — wages, bonuses, self-employment income, disability and retirement " +
      "   benefits, rental income, and other statutory categories.\n" +
      "2. Subtract only the **allowed deductions** — taxes, FICA, mandatory retirement, mandatory union dues, " +
      "   health insurance for the parent (not the children), and court-ordered support actually paid.\n" +
      "3. Add the two **net incomes** together and look up the combined figure in the statutory guideline " +
      "   schedule for the number of children.\n" +
      "4. Split that amount between the parents **in proportion to their share of combined net income**.\n" +
      "5. Adjust for child care costs, the children's health insurance, and uninsured medical costs.\n" +
      "6. If each parent has the children for **at least 20% of the overnights** in a year, a substantial " +
      "   time-sharing adjustment applies.\n\n" +
      "The guideline result is presumptively correct. A judge can go above or below it, but must make written " +
      "findings to vary by more than 5%.\n\n" +
      "The app performs this whole calculation for you and shows every step, the schedule row it used, and the " +
      "statute behind each step.",
    citations: [
      { citation: "Fla. Stat. §61.30(1)", title: "Guideline presumption and 5% variance", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. §61.30(2)", title: "Gross income categories", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. §61.30(3)", title: "Allowable deductions", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. §61.30(6)", title: "Guideline schedule", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. §61.30(11)(b)", title: "Substantial time-sharing adjustment", url: `${FL_SENATE}/61.30` },
    ],
  },
  {
    id: "child-support-which-children",
    title: "Which children go into the child support calculation?",
    keywords: [
      "other children",
      "children from other marriages",
      "other marriage",
      "previous marriage",
      "previous relationship",
      "prior relationship",
      "another relationship",
      "another marriage",
      "first marriage",
      "shared minor children",
      "shared children",
      "which children",
      "include children",
      "stepchild",
      "stepchildren",
      "step child",
      "half sibling",
      "subsequent children",
      "child from a previous",
      "my other kids",
      "other kids",
      "dependent in fact",
      "still in high school",
      "turns 18",
      "age 18",
    ],
    answer:
      "Only the children **you and your spouse share in this case** go into the child support calculation. " +
      "Children you have from another relationship are **not** added to the number of children on the " +
      "worksheet.\n\n" +
      "A child counts if they are a minor, or if they are 18 to 19 years old, still in high school, dependent " +
      "in fact, and reasonably expected to graduate before turning 19.\n\n" +
      "Children from another relationship can still affect the result, but only in specific ways:\n\n" +
      "1. **As a deduction.** Court-ordered support for other children that you *actually pay* is subtracted " +
      "   from your gross income. Both parts matter — it has to be under a court order, and it has to actually " +
      "   be paid. An informal arrangement does not qualify. There is a field for this in the deductions " +
      "   step.\n" +
      "2. **As a possible reason to depart from the guidelines.** For children born or adopted *after* the " +
      "   support obligation arose (the statute calls these \"subsequent children\"), the general rule is that " +
      "   their existence is **not** a basis for disregarding the guideline amount. A parent may raise them as " +
      "   a justification for deviating, but only in a proceeding to increase an existing award — never to " +
      "   justify decreasing one. If it is raised, the court also considers the income of the other parent of " +
      "   those children.\n\n" +
      "Alimony you pay under a court order from a previous marriage is a separate allowable deduction.\n\n" +
      "Stepchildren are not part of this calculation. If your situation involves an existing support order for " +
      "other children, it is worth having a Florida family-law attorney check how the two interact.",
    citations: [
      {
        citation: "Fla. Stat. §61.30(1)(a)",
        title: "Which child the guideline amount covers",
        url: `${FL_SENATE}/61.30`,
      },
      {
        citation: "Fla. Stat. §61.30(3)(f)",
        title: "Deduction for court-ordered support for other children actually paid",
        url: `${FL_SENATE}/61.30`,
      },
      {
        citation: "Fla. Stat. §61.30(3)(g)",
        title: "Deduction for spousal support paid under a prior order",
        url: `${FL_SENATE}/61.30`,
      },
      {
        citation: "Fla. Stat. §61.30(12)",
        title: "Subsequent children and deviation from the guidelines",
        url: `${FL_SENATE}/61.30`,
      },
    ],
  },
  {
    id: "variable-income",
    title: "How are bonuses, sales commissions, and stock counted?",
    keywords: [
      "bonus",
      "bonuses",
      "commission",
      "commissions",
      "sales commission",
      "stock",
      "stocks",
      "rsu",
      "rsus",
      "equity",
      "vesting",
      "vest",
      "capital gains",
      "dividends",
      "overtime",
      "variable income",
      "fluctuating income",
      "one-time",
      "nonrecurring",
    ],
    answer:
      "Florida uses one definition of gross income for **both** child support and alimony. The alimony statute " +
      "says net income is figured \u201cin conformity with s. 61.30(2) and (3)\u201d, so anything that counts as " +
      "income for child support also counts toward the alimony calculation.\n\n" +
      "**Counted as income:**\n\n" +
      "- **Bonuses, sales commissions, allowances, overtime, and tips.** These are listed in the statute right " +
      "alongside salary \u2014 they are income, not extras.\n" +
      "- **Stock or equity you receive for working**, such as RSUs, generally as it vests. It is pay that happens " +
      "to be delivered in shares.\n" +
      "- **Interest and dividends** on savings and investments.\n\n" +
      "**The important exception \u2014 selling things:** gains from selling stock or property count *unless the " +
      "gain is nonrecurring*. So if you routinely sell vested shares, that is income. If you sold something once " +
      "and do not expect to repeat it, the statute does not count it as income. Note that even then, a court may " +
      "order support paid out of nonrecurring income or assets if recurring income cannot meet the child\u2019s " +
      "needs.\n\n" +
      "**How lumpy pay becomes a monthly figure:** income is determined on a monthly basis, but the statute does " +
      "**not** prescribe a method for averaging pay that changes year to year. Dividing an annual bonus by 12 is " +
      "a reasonable starting point and is what this app does if you use the yearly-amount helper, but it is " +
      "arithmetic rather than a rule \u2014 a court may use a different period, often a multi-year average, " +
      "especially where commissions swing widely. If a large share of your income is variable, that choice can " +
      "move the number significantly and is worth discussing with an attorney.",
    citations: [
      { citation: "Fla. Stat. \u00a761.30(2)(a)2.", title: "Bonuses, commissions, allowances, overtime, and tips", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. \u00a761.30(2)(a)10.", title: "Interest and dividends", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. \u00a761.30(2)(a)14.", title: "Gains from dealings in property, unless nonrecurring", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. \u00a761.30(13)", title: "Support may be paid from nonrecurring income or assets", url: `${FL_SENATE}/61.30` },
      { citation: "Fla. Stat. \u00a761.08(8)(c)", title: "Alimony net income figured in conformity with s. 61.30(2) and (3)", url: `${FL_SENATE}/61.08` },
    ],
  },
  {
    id: "child-support-overnights",
    title: "How do overnights and time-sharing change child support?",
    keywords: [
      "overnight",
      "overnights",
      "time sharing",
      "time-sharing",
      "custody",
      "visitation",
      "parenting plan",
      "20 percent",
      "20%",
      "50/50",
    ],
    answer:
      "Overnights matter a great deal. Florida counts the number of overnights each parent has with the child " +
      "in a year.\n\n" +
      "If **each** parent exercises at least 20% of the overnights (that is 73 or more nights out of 365), a " +
      "substantial time-sharing adjustment applies. It works by increasing the total support obligation by a " +
      "gross-up factor, allocating it by both income share and overnight share, and then offsetting the two " +
      "parents' obligations against each other.\n\n" +
      "Below that 20% threshold, the standard calculation applies without the adjustment.\n\n" +
      "Two practical cautions: count **actual** overnights, not what an order says on paper if reality differs; " +
      "and remember that the total across both parents should equal the days in the year. The app checks that " +
      "for you and warns if the numbers do not add up.",
    citations: [
      { citation: "Fla. Stat. §61.30(11)(b)", title: "Substantial time-sharing adjustment", url: `${FL_SENATE}/61.30` },
    ],
  },
  {
    id: "parenting-plan",
    title: "What has to be in a Florida parenting plan, and who decides what?",
    keywords: [
      "parenting plan",
      "parental responsibility",
      "shared parental responsibility",
      "sole parental responsibility",
      "decision making",
      "decision-making",
      "school designation",
      "school boundary",
      "time-sharing schedule",
      "timesharing schedule",
      "equal time-sharing",
      "50/50",
      "exchanges",
      "holidays",
      "best interests",
    ],
    answer:
      "Florida requires a parenting plan in every case involving a minor child, and the court has to approve it. " +
      "At a minimum it must describe how the parents will share the daily tasks of raising the child, set out a " +
      "time-sharing schedule saying when the child is with each parent, say who is responsible for health care, " +
      "for school-related matters (including the address used for school registration), and for other activities, " +
      "describe how the parents will communicate with the child, and designate where exchanges happen.\n\n" +
      "**Parental responsibility is separate from the schedule.** Parental responsibility is about who makes major " +
      "decisions — education, health care, religious upbringing. Time-sharing is about where the child sleeps. " +
      "A court orders *shared* parental responsibility, meaning both parents confer and decide together, unless it " +
      "finds that shared responsibility would be detrimental to the child. In deciding detriment the court considers " +
      "evidence of domestic violence, among other things.\n\n" +
      "**On the schedule, there is a rebuttable presumption that equal time-sharing is in the child's best " +
      "interests.** A parent who wants a different schedule has to prove by a preponderance of the evidence that " +
      "equal time-sharing is not in the child's best interests. Unless the parents agree on a schedule and the " +
      "court approves it, the court must weigh all of the statutory best-interest factors and make specific written " +
      "findings.\n\n" +
      "Changing a plan later is harder than setting one now: modifying a parenting plan or time-sharing schedule " +
      "requires showing a substantial and material change of circumstances.",
    citations: [
      {
        citation: "Fla. Stat. §61.13(2)(b)",
        title: "What a parenting plan must contain",
        url: `${FL_SENATE}/61.13`,
      },
      {
        citation: "Fla. Stat. §61.13(2)(c)",
        title: "Best interests, equal time-sharing presumption, and shared parental responsibility",
        url: `${FL_SENATE}/61.13`,
      },
    ],
  },
  {
    id: "equitable-distribution",
    title: "How is property divided in a Florida divorce?",
    keywords: [
      "property",
      "divide",
      "division",
      "equitable distribution",
      "assets",
      "split",
      "house",
      "marital",
      "nonmarital",
      "61.075",
      "50/50",
      "before the marriage",
      "premarital",
      "separate property",
      "commingled",
      "commingling",
      "inheritance",
      "savings",
      "half",
    ],
    answer:
      "Florida is an **equitable distribution** state, not a community-property state. The court starts from " +
      "the premise that marital assets and debts should be divided **equally**, and then adjusts if there is a " +
      "justification for an unequal split based on the statutory factors.\n\n" +
      "First the court has to sort what is **marital** from what is **nonmarital**:\n\n" +
      "- **Marital** generally means assets acquired and debts incurred during the marriage, individually or " +
      "  jointly; the increase in value of a nonmarital asset from marital effort or marital funds; gifts " +
      "  between spouses during the marriage; and retirement, pension, profit-sharing, annuity, and deferred " +
      "  compensation benefits accrued during the marriage.\n" +
      "- **Nonmarital** generally means what you owned before the marriage, inheritances and gifts from third " +
      "  parties to you alone, income from nonmarital assets (unless you treated it as marital), and anything " +
      "  excluded by a valid written agreement.\n\n" +
      "The cut-off date for classifying assets is the earliest of: the date the parties signed a valid " +
      "separation agreement, a date the agreement specifies, or the date the petition was filed.\n\n" +
      "Factors that can justify an unequal split include each spouse's contributions (including as homemaker " +
      "and parent), each spouse's economic circumstances, the length of the marriage, interruption of a career " +
      "or education, the desirability of keeping an asset intact, keeping the marital home for a dependent " +
      "child, and intentional waste or destruction of marital assets within the 2 years before filing.\n\n" +
      "Order of operations matters: the court divides property **first**, and only then considers alimony — " +
      "because what you receive in the division changes what you need and what you can afford to pay.",
    citations: [
      { citation: "Fla. Stat. §61.075(1)", title: "Equal-division premise and factors", url: `${FL_SENATE}/61.075` },
      { citation: "Fla. Stat. §61.075(6)(a)", title: "Marital assets and liabilities", url: `${FL_SENATE}/61.075` },
      { citation: "Fla. Stat. §61.075(6)(b)", title: "Nonmarital assets and liabilities", url: `${FL_SENATE}/61.075` },
      { citation: "Fla. Stat. §61.075(7)", title: "Classification cut-off date", url: `${FL_SENATE}/61.075` },
      { citation: "Fla. Stat. §61.075(9)", title: "Distribution decided before alimony", url: `${FL_SENATE}/61.075` },
    ],
  },
  {
    id: "retirement-accounts",
    title: "What happens to my 401(k) or pension?",
    keywords: [
      "401k",
      "401(k)",
      "retirement",
      "pension",
      "ira",
      "profit sharing",
      "deferred compensation",
      "annuity",
      "qdro",
    ],
    answer:
      "The portion of a retirement, pension, profit-sharing, annuity, or deferred-compensation plan that " +
      "**accrued during the marriage** is a marital asset, even if only one spouse's name is on the account. " +
      "What accrued before the marriage is generally nonmarital.\n\n" +
      "Two practical points the statute does not spell out but that matter enormously:\n\n" +
      "- Dividing an employer plan such as a 401(k) or pension usually requires a **Qualified Domestic " +
      "  Relations Order (QDRO)** — a separate court order drafted to the plan's requirements, entered in " +
      "  addition to the divorce judgment. Getting this wrong can cost taxes and penalties. IRAs are divided " +
      "  differently, by transfer incident to divorce.\n" +
      "- A dollar in a pre-tax retirement account is **not** worth the same as a dollar in a bank account, " +
      "  because it will be taxed on withdrawal. Trading \"my 401(k) for your savings\" at face value can " +
      "  quietly favour one side.\n\n" +
      "Spouses can agree in a **valid written agreement** to exclude an asset from the marital estate — that is " +
      "the legal basis for the app's option to leave a specific account out of a proposed scenario. An " +
      "agreement like that should be reviewed by an attorney before you sign it.",
    citations: [
      {
        citation: "Fla. Stat. §61.075(6)(a)1.e",
        title: "Retirement benefits accrued during marriage are marital",
        url: `${FL_SENATE}/61.075`,
      },
      {
        citation: "Fla. Stat. §61.075(6)(b)4",
        title: "Assets excluded by valid written agreement",
        url: `${FL_SENATE}/61.075`,
      },
    ],
    requiresAttorneyReview: true,
  },
  {
    id: "lump-sum",
    title: "Can I pay alimony as a lump sum instead of monthly?",
    keywords: [
      "lump sum",
      "lump-sum",
      "buyout",
      "buy out",
      "one time",
      "one-time",
      "pay off",
      "payoff",
      "installments",
      "present value",
    ],
    answer:
      "Yes — Florida expressly allows alimony to be ordered as **periodic or lump sum payments**, and allows " +
      "combinations of forms of alimony and forms of payment. For property division, the court may likewise " +
      "order a lump-sum payment or payment in installments over a fixed period.\n\n" +
      "People often prefer a lump sum for a clean break: no ongoing entanglement, no risk of the payor not " +
      "paying, and no future modification fights. The trade-off is that it takes a large amount of cash or " +
      "assets up front.\n\n" +
      "Two cautions you should take seriously:\n\n" +
      "- **There is no statutory discount rate.** The statute says that if payment is in installments the court " +
      "  may require \"a reasonable rate of interest\" or otherwise recognise the time value of money — but it " +
      "  fixes no number. Any present-value figure is therefore a *financial modelling assumption*, not law. " +
      "  This app makes you enter that rate yourself and shows a range, precisely so the assumption stays " +
      "  visible.\n" +
      "- **Tax treatment differs sharply.** Since the 2019 federal change, alimony under a new order is neither " +
      "  deductible by the payor nor taxable to the recipient, while a property transfer between spouses " +
      "  incident to divorce is generally not a taxable event at all. Whether a payment is characterised as " +
      "  alimony or as equitable distribution can change the real cost substantially.\n\n" +
      "Because of both points, have a Florida family-law attorney — and often a CPA — review any lump-sum " +
      "proposal before you agree to it.",
    citations: [
      { citation: "Fla. Stat. §61.08(1)(a)", title: "Periodic or lump sum payments", url: `${FL_SENATE}/61.08` },
      { citation: "Fla. Stat. §61.08(1)(b)", title: "Combined forms of alimony and payment", url: `${FL_SENATE}/61.08` },
      {
        citation: "Fla. Stat. §61.075(10)",
        title: "Lump sum or installment distribution and time value of money",
        url: `${FL_SENATE}/61.075`,
      },
    ],
    requiresAttorneyReview: true,
  },
  {
    id: "financial-disclosure",
    title: "What financial documents do I have to provide?",
    keywords: [
      "documents",
      "disclosure",
      "financial affidavit",
      "paperwork",
      "tax return",
      "pay stub",
      "bank statement",
      "what do i need",
      "upload",
      "12.285",
    ],
    answer:
      "Florida requires **mandatory disclosure** in family cases with financial issues. Both sides exchange " +
      "financial information whether or not the other side asks for it. Commonly required items include:\n\n" +
      "- A sworn **financial affidavit** (there is a short form and a long form, depending on your income)\n" +
      "- Federal **tax returns**, typically for the last several years\n" +
      "- **W-2s, 1099s, and recent pay stubs**\n" +
      "- **Bank, brokerage, and investment** account statements\n" +
      "- **Retirement and pension** statements\n" +
      "- **Credit card and loan** statements\n" +
      "- **Health insurance and child care** records\n" +
      "- **Deeds, mortgage statements, and property** records\n" +
      "- Any **existing court orders** for support\n\n" +
      "The exact list, the number of years, and the deadlines come from Florida Family Law Rule of Procedure " +
      "12.285 and can be affected by local practice and by your judge's orders. Treat the list above as the " +
      "usual starting point, not as a complete or authoritative checklist for your case — check the current " +
      "rule and the official forms, or ask an attorney.\n\n" +
      "Be careful and accurate: a financial affidavit is signed under oath.",
    citations: [
      {
        citation: "Fla. Fam. L. R. P. 12.285",
        title: "Mandatory disclosure (verify current text and deadlines)",
        url: "https://www.flcourts.gov/Services/family-courts/domestic-relations-court-resources/family-law-forms",
      },
    ],
  },
  {
    id: "app-scope",
    title: "What can this app actually do for me?",
    keywords: [
      "what can you do",
      "help",
      "how does this work",
      "what is this",
      "scope",
      "capabilities",
      "attorney",
      "lawyer",
      "legal advice",
      "should i talk to",
      "what can this app",
      "what does this app",
      "who are you",
    ],
    answer:
      "This app helps you get organised and understand the numbers before you talk to a lawyer or mediator. " +
      "Specifically it:\n\n" +
      "- Walks you through the financial information a Florida family case needs, one topic at a time, and " +
      "  explains why each item is asked for\n" +
      "- Calculates a Florida child-support guideline estimate showing every step and the statute behind it\n" +
      "- Shows the deterministic statutory ceilings on durational alimony and an estimate **range**\n" +
      "- Lets you upload documents and confirm any information pulled from them before it is used\n" +
      "- Produces a downloadable package you can hand to an attorney or mediator\n\n" +
      "What it does **not** do: give legal advice, predict what a judge will order, file anything, draft a " +
      "binding settlement agreement, or represent you. Every calculation here is an estimate built from the " +
      "figures you entered — if those change, so does the result.\n\n" +
      "I can explain how the Florida rules work and what a term means. I do not calculate anything: all the " +
      "numbers you see in this app come from its deterministic calculators.",
    citations: [],
  },
];

/** Fast lookup by entry id. */
export const KNOWLEDGE_BY_ID: ReadonlyMap<string, KnowledgeEntry> = new Map(
  KNOWLEDGE_BASE.map((entry) => [entry.id, entry]),
);

/** Questions offered as starting points in the chat UI. */
export const SUGGESTED_QUESTIONS: readonly string[] = [
  "What kinds of alimony can a Florida court award?",
  "How does the length of my marriage affect alimony?",
  "How is child support calculated in Florida?",
  "How is property divided in a Florida divorce?",
  "Can I pay alimony as a lump sum instead of monthly?",
  "What financial documents do I have to provide?",
];
