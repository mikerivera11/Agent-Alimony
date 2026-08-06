# Florida Support Guide

A plain-language, Florida-first financial guidance application for organizing family-law facts, estimating child support and current-law alimony constraints, reviewing document-derived proposals, and generating an attorney-review package.

This application provides **legal information and financial estimates only**. It is not a lawyer, does not provide legal advice, does not predict a court order, and does not generate a binding marital settlement agreement.

## Current vertical slice

- Thirteen-topic intake with explanations, autosave, review/edit, accessibility, responsive layouts, and safety prompts
- Two interchangeable layouts for that intake — step by step, or every section on one page — sharing one draft, one set of schemas, and one review screen
- Resume where you left off, deep-link to any topic with `?step=`, and come back to change answers after finishing
- A staleness guard that warns and blocks PDF export when answers change after an estimate was generated
- Deterministic Florida child-support calculations under Fla. Stat. § 61.30
- Deterministic current-law alimony constraints and scenario range under Fla. Stat. § 61.08
- Deterministic equitable distribution under Fla. Stat. § 61.075, including per-item exclusion gated on a written agreement
- Lump-sum settlement modelling, kept outside the rules engine because no statute supplies a rate or a present-value formula
- A Florida family-law information assistant answering from curated, citation-backed statutory material, available standalone and as a side panel on every page that knows which section you are looking at
- Full formula traces, assumptions, warnings, statutory citations, ruleset versions, and source-verification dates
- PDF settlement-information package containing confirmed facts, missing items, calculation details, factors, scenarios, sources, and disclaimers
- PDF/JPEG/PNG upload validation with magic-byte checks and a clearly labeled mock extraction workflow
- Explicit confirm/edit/reject decisions for extraction proposals; proposals never enter calculations automatically
- PostgreSQL schema/repositories, anonymous session-token boundary, local/Azure storage adapters, and seven-day source-document reconciliation

The local MVP stores the working draft and reviewed snapshot in the current browser. The database and Azure Blob adapters are implemented and tested, but the browser flow is intentionally local-first until Azure resources are provisioned.

## Legal-source baseline

| Topic | Primary source | Ruleset |
| --- | --- | --- |
| Alimony | [Fla. Stat. § 61.08 (2025 compilation)](https://www.flsenate.gov/Laws/Statutes/2025/61.08) | `fl-alimony-61.08`, current law applicable to petitions pending/filed on or after July 1, 2023 |
| Child support | [Fla. Stat. § 61.30 (2025 compilation)](https://www.flsenate.gov/Laws/Statutes/2025/61.30) | `fl-child-support-61.30` |
| Equitable distribution | [Fla. Stat. § 61.075 (2025 compilation)](https://www.flsenate.gov/Laws/Statutes/2025/61.075) | `fl-equitable-distribution-61.075` |
| Family-law forms | [Florida Courts family-law forms](https://www.flcourts.gov/Services/family-courts/domestic-relations-court-resources/family-law-forms) | Reference only |

The § 61.30 schedule is generated from the official statute HTML into `data/legal/florida/child-support-schedule-2025.json`. The fixture records the source URL, verification date, and source SHA-256. It is not hand-transcribed.

The following branches deliberately return an explicit unsupported/review result instead of guessing:

- Child-support cases requiring the annually updated HHS poverty guideline
- More than six children
- Pre-July 1, 2023 alimony law
- Exceptional alimony-duration extensions
- Disputed/imputed income or disputed need/ability to pay
- Closely-held business valuation and enterprise goodwill under § 61.075(6)(a)1.f
- Coverture-fraction passive appreciation on nonmarital mortgage paydown under § 61.075(6)(a)1.c
- Dissipation offsets under § 61.075(1)(i), and any unequal distribution, for which the statute supplies factors but no formula
- Official Florida form 12.902(e) visual parity and Rule 12.285 deadline automation until their current revision text is separately pinned

### Lump-sum modelling is finance, not law

Lump-sum present-value modelling lives in `src/domain/finance/`, deliberately outside `src/domain/rules/`. Florida permits alimony to be paid periodically or in a lump sum (§ 61.08(1)(a)) and permits distribution as a lump sum or in installments, where a court "may require a reasonable rate of interest or may otherwise recognize the time value of the money" (§ 61.075(10)(b)). But no statute fixes a rate and none supplies a present-value formula.

Accordingly the discount rate is a required input with **no default** — a default would read as a legal standard — and results are always returned across a band of rates so the figure's sensitivity to an unlegislated assumption stays visible.

**Home equity** lives in `src/domain/finance/homeEquity.ts` for the same reason. Current equity is arithmetic, but a *projection* is not law: Florida classifies and values the marital estate as of the § 61.075(7) cut-off date, so appreciation after that date is not what a court divides, and no statute supplies an appreciation rate. `calculateHomeEquity` therefore returns `current` and `projection` as separate shapes so a caller cannot conflate them, requires the growth rate as an explicit input, and returns a band of comparison rates alongside it. Two details worth keeping: an underwater home reports zero equity plus a separate shortfall rather than negative equity, so it can never silently subtract from the estate elsewhere; and selling costs come off the sale price rather than off the equity figure (on a $500k home with a $300k mortgage and 6% costs, that is $170k, not $188k).

**Commingled separate property** is escalated rather than estimated. Premarital savings, gifts, and inheritances are nonmarital under § 61.075(6)(b), but that character survives only so far as the funds can still be *traced*, and any enhancement in value resulting from marital funds or either party's efforts during the marriage is itself marital under § 61.075(6)(a)1.b. Tracing is an evidentiary exercise over account history the app has never seen, so a nonmarital item flagged as commingled returns `requiresProfessionalReview`: setting the whole amount aside, or none of it, would both risk a materially wrong estate.

The model also refuses to invent a term. If the alimony calculation produced no durational term, the buyout is declined and explained rather than falling back to the length of the marriage. That fallback is tempting and wrong: durational alimony is unavailable below three years of marriage, and bridge-the-gap and rehabilitative alimony are capped at two and five years and tied to specific needs rather than a fixed term, so marriage length would inflate a buyout far past anything § 61.08 permits — and would do so worst in the longest marriages.

## Local setup

Prerequisites:

- Node.js 24
- npm
- Chromium installed by Playwright for browser tests
- PostgreSQL only if you want to run migrations or repository integration locally

```bash
cp .env.example .env.local
```

Replace `SESSION_SIGNING_SECRET` with a local random value:

```bash
openssl rand -hex 32
```

Then install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The fastest complete evaluation path is **Try fictional demo**, then save through each prefilled step, confirm the review, inspect both calculations, download the PDF, and open the document demo.

The upload preview needs `.env.local` because its server route validates the environment. It validates and hashes a file in memory, then discards the bytes. The mock adapter returns `not_processed` for real uploads; only the separate fictional demo action returns fixed demo proposals.

## Validation commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Refresh the official legal sources:

```bash
SOURCE_VERIFIED_AT=YYYY-MM-DD npm run sources:florida    # child-support guideline schedule
SOURCE_VERIFIED_AT=YYYY-MM-DD npm run sources:statutes   # Chapter 61 statutory corpus
git diff -- data/legal/florida/
```

Review every legal-source diff before merging. A successful scrape does not prove that court forms, annual poverty figures, or legal interpretations are unchanged.

## Architecture

```text
src/domain/intake/                   Guided schemas, completeness, review, escalation
src/domain/rules/                    Pure state-agnostic rules contracts
src/domain/rules/florida/            Versioned Florida calculations
src/domain/finance/                  Financial modelling that is NOT grounded in statute
src/domain/integration/              Reviewed-intake to confirmed-fact mapping
src/domain/package/                  Review-package view model and scenarios
src/server/assistant/                Florida family-law information assistant
src/server/extraction/               Mock/configured adapter boundary
src/server/storage/                  Validation, local storage, Azure Blob adapter
src/server/session/                  Signed browser-session token boundary
src/server/persistence/              Session-scoped PostgreSQL repositories
src/server/package/                  Strict payload validation and PDF generation
src/db/                              Drizzle schema/client
drizzle/                             SQL migration
data/legal/florida/                  Immutable generated legal fixtures
```

The `src/domain/rules/` and `src/domain/finance/` split is load-bearing. Everything under `rules/` is traceable to statutory text and returns citations; anything that is a modelling assumption instead lives under `finance/` so the two are never confused in review.

Rules functions accept only nominally branded `ConfirmedFact<T>` values. Extraction results are untrusted proposals with provenance and confidence. Human confirmation is required before the server extraction boundary can map a proposal into a fact, and document content cannot choose a ruleset or alter a formula.

Money is represented as integer cents. The child-support schedule, high-income percentages, time-sharing threshold, alimony classifications, duration ceilings, and 35% amount ceiling are deterministic and test-covered.

## Family-law information assistant

`/assistant` answers general questions about Florida family law. It is positioned as an information assistant, **not** an "AI family-law attorney": it states that it is not a lawyer, gives no legal advice, creates no attorney-client relationship, and is not privileged.

The substance of every answer comes from verified Florida material, never from a model's memory. This is the point of the design: a language model asked about Florida alimony from memory will readily describe permanent alimony, which was eliminated for petitions filed on or after July 1, 2023. A model, when configured, only rephrases retrieved passages.

Grounding has two tiers, and `src/server/assistant/grounding.ts` is the single entry point both adapters use — an adapter that retrieved differently would be a second, separately-behaving source of legal grounding.

1. **Curated entries** (`knowledgeBase.ts`) — plain-language answers written for someone with no legal background, transcribed from the same statutory text already verified for the rulesets. Preferred whenever one matches.
2. **Verbatim statutory corpus** (`data/legal/florida/statute-corpus-2025.json`) — the app's slice of Chapter 61, chunked by subsection, each chunk carrying its citation, section catchline, source URL and a hash of the page it came from. Generated by `npm run sources:statutes`; never hand-edited and never summarised.

The second tier exists because a dozen hand-written entries cannot cover a chapter, and **retrieval cannot retrieve what is not there**. Before it existed, a question outside those entries returned either "I have no verified material" or, worse, a confident-looking answer assembled from an unrelated entry. When no curated entry matches, the assistant now quotes the governing statute directly and links to the official text rather than paraphrasing it.

Retrieval is deterministic BM25 over the corpus plus phrase matching and a small everyday-to-statutory vocabulary bridge ("overnights" → time-sharing, "take-home" → net income). It is lexical rather than embedding-based on purpose: testable, no network call, identical in development and production, and it cannot silently drift. Its measured behaviour is high recall — the governing section reliably lands in the retrieved set — rather than perfect top-1 ranking, which is what a semantic retriever would improve.

Two properties are load-bearing and must survive any change to retrieval:

- **Relevance is earned by the question alone.** Section context and topic preference only *re-rank* material that already cleared the relevance threshold. They can never lift an unmatched entry, so "I don't have verified material on that" stays reachable — that sentence is a feature, not a failure.
- **A clear winner suppresses the also-rans.** Entries scoring far below the best match are dropped, so a specific answer is not buried under a general overview.

Guardrails are enforced in code, not merely requested in the prompt:

- **The assistant never states a dollar figure.** Model output containing currency is discarded in favour of the local adapter, because every figure in this app must come from the deterministic rulesets. Statutory thresholds are redacted too — before the text reaches a model, and before it is shown to a reader — with the citation offered instead. Quoting an enacted figure would arguably be defensible, but the guarantee is only worth having if it holds without exceptions and can be checked by a test. The §61.30(6) guideline schedule is excluded from the corpus entirely for the same reason: the deterministic calculator owns it.
- Text a person types is wrapped in an untrusted-data envelope with system-like delimiters stripped, and recognised instruction-override attempts are declined before any model call.
- Any provider failure falls back to the local adapter with a visible note rather than degrading silently.
- **Citations name what the answer used, not what retrieval touched.** Grounding is deliberately broader than citation: statutory chunks are retrieved alongside a curated entry so a model has exact wording to stay faithful to, and those chunks may be only loosely related. For a generated answer, `citationsUsedIn` reads the section references back out of the answer text and keeps only those the grounding supports — so a section the answer never used is not listed, and a section the model recalled from training data rather than from its grounding is dropped rather than shown as if verified. Both simpler rules were tried against the live model and both misled: citing everything retrieved pointed readers at §61.14 (modification) for a question about which children count, and citing only the curated entries cited §61.30(1)–(6) for an answer written entirely from §61.14(4) and §61.30(14). The rule has one definition, in `grounding.ts`, because it previously had two that disagreed.
- Disclosures that exceed what this app can model — abuse, coercion, hidden assets, business income, special-needs children, out-of-state jurisdiction, imminent deadlines — raise escalation notices with referral information. Detection is recall-biased: a spurious referral is harmless, a missed one is not.

The endpoint is stateless and persists nothing; neither the question nor the answer is logged.

### Financial options guide

The chat has a separate **Financial options** mode for questions such as whether
to use home equity or sell investments to fund a settlement lump sum. Its
in-memory thread and grounding are separate from the Florida-law assistant. It
compares secured-debt cost and home risk, tax basis and holding period,
portfolio concentration, and post-divorce liquidity using curated CFPB, IRS,
and FINRA sources.

It does not select securities, recommend or execute a transaction, calculate
taxes from chat, or present itself as a fiduciary, CPA, lender, or lawyer. Its
role is to organize a same-horizon comparison and identify what the user should
have verified by the lender, CPA, fee-only fiduciary adviser, and family-law
attorney before acting.

### Asking from inside a section

A side panel carries the same assistant on every page, so a question can be asked where it arises instead of by abandoning the form. It keeps one conversation as you move between sections, and scopes each question to whichever section is on screen — shown explicitly as "Answering about ...", with a control to widen back out to anything. Each intake topic also has its own "Have a question about ...?" button that opens the panel already scoped to it.

While the panel is open it insets the page rather than covering it, so the sticky header's Quick exit stays one click away; on small screens, where the panel is a full-screen sheet, it carries its own Quick exit instead. `src/domain/intake/assistantTopics.ts` maps each of the thirteen topics to the knowledge-base entries relevant to it and to three suggested starter questions. A test asserts that all thirty-nine of those starters actually retrieve grounded material, so no suggestion can be offered that the assistant would then decline.

The topic is a **closed enum of step ids** at the API boundary, never free text, so it opens no injection path. More importantly, a topic can only ever *re-rank* — the preference boost is applied after the minimum-score filter, so an entry must first match the question on its own merits. This matters: an earlier design appended the topic's keywords to the scored text, which let the section itself manufacture a match, and a question about pizza asked from the alimony section came back with three confident alimony passages. The cost of the stricter rule is that a genuinely vague question ("what counts here?") is declined rather than guessed at, which is the correct trade in this domain; the suggested starters exist to solve discovery instead.

### Providers

| `ASSISTANT_PROVIDER` | Behaviour |
| --- | --- |
| `local` (default) | Answers from the built-in statute reference. Needs no AI provider and is not a stub. |
| `foundry` | Additionally uses an Azure OpenAI GPT deployment on Azure AI Foundry to rephrase the same retrieved passages in plainer language. |
| `agent` (deployed) | Runs a Foundry **Agent Service** agent that decides when to retrieve, by calling a `search_florida_law` tool. Falls back to `foundry`, which falls back to `local`. |

The Foundry adapter calls the Azure OpenAI chat-completions API at `https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions` using `fetch` and the existing `@azure/identity` dependency, rather than taking a hard dependency on a provider SDK. It authenticates by managed identity (Entra scope `https://cognitiveservices.azure.com/.default`, role **Cognitive Services OpenAI User**), with `AZURE_FOUNDRY_API_KEY` as a fallback. The API version is set by `AZURE_FOUNDRY_API_VERSION` so a model needing a newer one does not require a code change.

`infra/modules/foundry.bicep` provisions the account and model deployment. The deployed configuration is **gpt-5.6-sol** (version `2026-07-09`) on `GlobalStandard`, 50k TPM, with `AZURE_FOUNDRY_API_VERSION=2025-04-01-preview`. All four are Bicep parameters (`foundryModelName`, `foundryModelVersion`, `foundryModelCapacity`, `foundryApiVersion`) because model availability, quota, and the minimum API version that accepts `max_completion_tokens` all move independently of this code. `enableFoundryAssistant: false` skips the whole module and pins `ASSISTANT_PROVIDER=local`.

Three things about that module are load-bearing rather than incidental:

- **Local auth is disabled** (`disableLocalAuth: true`), so there is no API key to store, leak, or rotate; the web app's managed identity is the only way in.
- **Public network access is disabled and the account is reached over a private endpoint.** This is not a hardening preference — tenant policy forces it on this resource type and reverts attempts to re-enable it, exactly as it does for Key Vault and Storage. The data plane answers to `*.openai.azure.com`, `*.services.ai.azure.com`, and `*.cognitiveservices.azure.com` depending on the route the client takes, so all three private DNS zones are linked to the VNet. Linking only the one the current code path uses produces an intermittent failure that reads like a transient network fault.
- **The role assignment lives in that module, not `modules/role-assignments.bicep`,** for the reason documented there: its name must embed the principal ID to survive the web app being recreated, and only module parameters resolve early enough to appear in a resource name.

Enabling the model does not move any legal substance out of this repository. Retrieval still runs in application code against the committed corpus; the model only ever sees passages retrieval already selected, and its output is still scanned for dollar figures and discarded if any appear. Every failure path — unreachable account, missing role assignment, rejected API version — falls back to the local adapter with a visible note, so a misconfiguration degrades phrasing rather than breaking the assistant or changing an answer.

### Viewing the agent in AI Foundry

Two separate things stop the portal's Agents page from showing anything, and
fixing only one of them still leaves it empty. Both are described here because
the first is easy to mistake for the second.

**1. There has to be an agent.** Agents are data-plane objects with no ARM
representation, so Bicep cannot create them; `agent-adapter.ts` creates one
lazily on first use instead. But that code only runs when
`ASSISTANT_PROVIDER=agent`. While the provider is `foundry` — which is the
current setting, because the agent data plane returned 401 to the web app's
managed identity — the Agent Service is never called, no agent is ever created,
and the project's agent list is genuinely empty. A reachable portal will
faithfully show you nothing.

Create it explicitly:

```bash
export AZURE_FOUNDRY_PROJECT_ENDPOINT="https://<account>.services.ai.azure.com/api/projects/<project>"
export AZURE_FOUNDRY_AGENT_MODEL=gpt-5.1
npm run foundry:agent
```

The script imports `AGENT_INSTRUCTIONS` and the tool definition from
`agent-adapter.ts` rather than restating them, and derives the agent name from
the same `agentNameFor()` the adapter uses to look it up. That matters: a second
copy of either would let the agent you see in the portal drift from the agent
the application actually talks to, or cause the app to create a duplicate
alongside it. Re-running the script is safe — it returns the existing agent.

**2. The portal has to be able to reach the data plane.** The account is created
with `publicNetworkAccess: 'Disabled'` and `networkAcls.defaultAction: 'Deny'`,
so the only route in is the private endpoint, and the blade reports:

> Error loading your agents. Public access is disabled. Please configure private endpoint.

That is the configuration working as intended, not a failed deployment — the
running app reaches the same account fine over the private endpoint. Note that
allowlisting your own workstation IP is **not** sufficient: the portal appears to
call the data plane from its own backend rather than from your browser, so the
request does not arrive from your IP. Opening it up therefore means:

```bash
az resource update --ids $(az cognitiveservices account show \
  -n ai-fsg-prod-tensozsvpq7m -g fsg-prod-rg --query id -o tsv) \
  --set properties.publicNetworkAccess=Enabled \
        properties.networkAcls.defaultAction=Allow
```

Reverse it with `defaultAction=Deny` and `publicNetworkAccess=Disabled` when
finished. The private endpoint keeps working throughout, so the app is
unaffected either way.

This widens network exposure on a resource used by an app that handles financial
data, so it is worth being precise about what it does and does not do. The
account sets `disableLocalAuth: true`, meaning API keys do not exist for it and
every request must carry an Entra ID token from a principal holding a role on
the account. Network reachability is therefore not the only control — but it was
a control, and this removes it. Prefer turning it back off once you are done
looking.

`infra/modules/foundry.bicep` exposes `foundryPublicNetworkAccess` and
`foundryAllowedIpRules` so this choice is expressed in the template instead of
being a manual change that the next `az deployment sub create` silently reverts.

### The agent tier

`foundry` pre-fetches passages and hands the model one prompt, so a follow-up question arrives with no memory of the last answer and retrieval is fixed before the model has seen anything. The `agent` provider instead registers one tool, `search_florida_law`, and lets the agent decide when to call it and what to search for.

That inverts where grounding comes from, so it is worth being precise about what did **not** change. The tool runs the same `gatherGrounding` over the same committed corpus, so the agent cannot reach material the other adapters could not. Retrieval still happens in application code, in this repository, under test. Passages are currency-redacted *before* the agent reads them, so the "never states a dollar figure" guarantee does not rest on the agent's restraint.

What did change is that grounding is no longer structurally guaranteed. A model free to skip retrieval will sometimes skip it, and what comes back then is recalled training data wearing this app's citations. So the run is inspected rather than trusted: **an answer produced without a tool call is discarded** and the question is re-answered by the fallback with a visible note. Unknown tool names are refused rather than guessed at, and a search that matches nothing returns an explicit instruction to decline instead of an empty result the agent might fill from memory.

**This targets Foundry's current (v2) Agents API, not `/assistants`.** Agents created through the older Assistants-style API are shown in the portal under "Classic agents" and the API is described there as superseded. The differences that matter to this code are that agents are versioned and referenced **by name** rather than by an opaque `asst_…` id, and that a run is a single synchronous `POST /openai/v1/responses` instead of a thread plus a polling loop — which removed the poller outright. One sharp edge: the v2 API rejects agent names containing anything but alphanumerics and interior hyphens, so a model id like `gpt-5.1` cannot be interpolated verbatim; `agentNameFor()` slugifies it and is covered by tests, because the real service enforces this only at create time.

Conversation history is replayed into every request rather than held on a server-side thread. That was true of the thread-based version too, and for the same reason: a stored thread would be conversation content living outside this app's own retention rules. `previous_response_id` is used only to continue a single in-flight tool loop, never across user turns.

**The agent runs gpt-5.1, not gpt-5.6-sol, and that is a constraint rather than a preference.** The Agent Service always sends `top_p`, which gpt-5.5 and the whole gpt-5.6 family reject outright; this was verified against a live resource across five API versions and cannot be configured away by setting the parameter explicitly. gpt-5.1 accepts it. The chat-completions tier keeps the newer model, and since substance comes from the corpus either way, the difference is phrasing. gpt-5.1 is also a regional `Standard` deployment drawing on a separate quota pool, not `GlobalStandard`.

The agent itself is created by the app on first use and reused by name. Agents are data-plane objects with no ARM type, so Bicep cannot declare one; doing it in code keeps release to a single `git push` rather than a bootstrap step that can be skipped. `npm run foundry:agent` performs the same bootstrap on demand — see "Viewing the agent in AI Foundry" for why that is needed to see anything in the portal.

**What-if scenarios, and why the agent does not calculate them.** "What would my support be if I earned nine thousand instead" is the question people actually want answered, and the agent is structurally unable to answer it: it never sees your case, and every dollar figure is stripped from its output before you read it. Letting it call the rulesets would not have fixed that, because every calculation accepts only a `ConfirmedFact` whose source is `user-entered`, `user-confirmed-extraction`, or `document-confirmed`. A number a model parsed out of a sentence is none of those, and passing it as `user-entered` would quietly defeat the confirmation boundary the whole application rests on.

So the app answers it instead, and the boundary was widened honestly rather than bypassed. `conversational-scenario` is a fourth provenance that is explicitly **not** a confirmation of anything. It lets a hypothetical through the same deterministic calculators — real §61.30 and §61.08 arithmetic, not a second approximate path — while marking it as something nobody reviewed and nothing may keep.

Four properties make that safe to ship:

- **You type the number, not the model.** The what-if panel on the results page takes explicit numeric inputs. A figure parsed out of prose can be misread, and the misreading would be invisible once it is currency-formatted. Model prefill is a deliberate non-goal for now; if it is ever added, the echo below is what makes it checkable.
- **Every result restates what it changed and what it changed from**, so a wrong entry is visible next to the answer it produced.
- **Nothing is persisted.** `POST /api/scenario` follows the package routes — the client posts its confirmed answers, the server re-validates and recalculates, the client never sends a figure — but it stores nothing and is `no-store`. The override applies to the calculator input, never to the draft: an income override replaces one total, because splitting it back across the statutory categories would mean inventing a breakdown of someone's wages.
- **Export refuses it.** `buildPackageViewModel` calls `assertNotScenarioFact` and throws rather than printing a hypothetical in a document someone takes to an attorney. That guard is tested by mocking a mapper into making exactly the mistake it guards against, and verified by removing the guard and watching the test fail — the rules engine will happily compute a what-if, which is precisely why the refusal has to live at the point figures become a document.

Overnights are the one override with arithmetic of its own: moving one parent's nights moves the other's, since the year is fixed and leaving the other untouched would silently invent or destroy nights.

> **First deployment needs one re-run.** ARM sometimes starts the model deployment while the parent Cognitive Services account is still in `Accepted` and fails with `AccountProvisioningStateInvalid`. The `parent` relationship is the strongest ordering Bicep can express, so there is no template fix; wait for the account to report `Succeeded` and re-run. Subsequent deployments are unaffected.
>
> The same error has a second, permanent cause worth distinguishing: **creating or updating the project returns the account to `Accepted`**, and any write touching the account while it is there fails. That one does not resolve on a re-run, because ARM starts the private endpoint in parallel with the project every time. It is fixed in the template with an explicit `dependsOn`, since the `parent` graph does not imply that ordering.

## How income is counted

One function, `sumGrossIncomeDollars`, is the whole app's definition of gross
income. Child support reads it, and so do the alimony 35% cap and the
reasonable-need estimate — because §61.08(8)(c) says alimony net income
"shall be calculated in conformity with s. 61.30(2) and (3)". They are not
permitted to disagree about what income is, so there is deliberately only one
place to change it.

Variable pay is collected in separate fields because §61.30(2)(a) does not
treat it alike:

| Intake field | Treatment | Authority |
| --- | --- | --- |
| Bonuses and sales commissions | Counted | §61.30(2)(a)2. |
| Stock/equity vesting as pay (RSUs) | Counted | §61.30(2)(a)2. |
| Interest and dividends | Counted | §61.30(2)(a)10. |
| Recurring gains from selling property | Counted | §61.30(2)(a)14. |
| **One-time (nonrecurring) gains** | **Not counted as income** | §61.30(2)(a)14. |

The last row is the reason these are separate fields rather than one
"investment income" box. A single box invites a one-time stock sale to be
entered as income, which §61.30(2)(a)14 excludes. Nonrecurring gains are still
recorded and shown in the package, because §61.30(13) lets a court order
support paid from nonrecurring income where recurring income cannot meet the
child's needs — but that is a judicial decision, not a line in the sum.

**Averaging is not implemented as a rule.** §61.30(2) requires income to be
determined monthly but prescribes no method for averaging pay that varies year
to year. The intake offers a helper that divides a yearly figure by 12 and says
plainly that this is arithmetic, not law, and that a court may use a different
period. Encoding ÷12 as *the* rule would invent one the statute does not
contain.

New income fields use `addedMoneySchema` (`.default(0)`). Drafts live in browser
localStorage as raw JSON and are never migrated, so a draft saved before a field
existed has no key for it; without the default it would fail validation and, if
it slipped through, reach the money sum as `NaN`.

## Court form worksheets

The results screen exports two worksheets alongside the estimate packet:
Child Support Guidelines (Form 12.902(e), rev. 06/25) and Parenting Plan
(Form 12.995(a), rev. 02/18).

They are **worksheets, not filled forms**, and that is a deliberate choice
rather than a limitation of the PDF tooling:

- The official PDFs *are* interactive AcroForms — 12.902(e) carries 93 fields
  and 12.995(a) carries 317, so filling them is technically possible. The field
  names are positional rather than semantic, though (`Odd Years 1` through
  `Odd Years 7` give no clue which holiday each row is). Any mapping would be
  an inference that silently re-points on the next revision, and a figure in
  the wrong box on a sworn document is worse than no figure.
- Forms carry a revision footer and a superseded form is refused at the
  clerk's window, so an embedded copy goes stale. Referring to the form by
  number while pointing at the court's own current copy cannot.
- The line order is taken from the **statute** (§61.30, §61.13(2)(b)), not from
  a form. The statute is the authority the form is derived from and the rules
  engine already implements exactly that order, so the layout survives form
  revisions.

The parenting-plan intake includes a structured holiday schedule builder that
matches the information Form 12.995(a) asks for: named holiday, alternating or
every-year assignment, odd-year parent, exact beginning/end time, priority over
the regular schedule, and the form's two optional weekend-correction rules.
Thanksgiving, Christmas, and New Year's Day begin as **proposed alternating
defaults**. They are not presented as Florida legal defaults; the form leaves
those choices blank. Christmas starts opposite Thanksgiving so one parent does
not receive both in the same year. Blank times remain visible gaps in the
worksheet and attorney filing-readiness list rather than being invented.

Every figure comes from the rule result the packet uses. Nothing on a worksheet
is computed locally, so a worksheet cannot disagree with the packet in the same
envelope. `/api/package/worksheet` re-validates and recalculates server-side
exactly like `/api/package`; the client never sends a figure.

### Verifying a form reference

`OfficialFormReference.verified` means the number, title, and revision were read
out of the **footer** of the court's own PDF. Do not set it any other way:

- Metadata is stale, and trusting it has already caused one wrong value here.
  12.995(a) was recorded as revision `03/09` for a while. `03/09` is what the
  PDF's `Title` metadata says; the footer on every page reads `02/18`, and
  `(02/18)` is the only revision token anywhere in the document. Likewise
  12.902(e)'s filename implies `11/20` while its footer reads `06/25`.
- Extract with a real PDF parser. The bad `03/09` reading came from a
  hand-rolled content-stream scraper that mangled kerned text. Kerning splits
  words across separate string literals, so naive extraction silently loses or
  garbles exactly the footer you are trying to read.
- Download URLs carry opaque CMS content ids that **cannot be guessed**. A
  plausible-looking invented URL for 12.995(a) served Florida's Dependency
  Benchbook instead.

To find a form's real download URL, use the court's own page data rather than
scraping HTML — the site is client-rendered, so the links are not in the markup:

```
https://www.flcourts.gov/sitemap-{1,2,3}.xml          # index of every form page
https://www.flcourts.gov/_next/data/<buildId>/<path>.json   # carries number, date, and PDF uri
```

All seventeen references in `officialForms.ts` were verified on 2026-08-02 this
way: page JSON for the number and CMS date, then the PDF itself downloaded and
its footer read with a parser. The two agreed in every case. An unverified form
exposes no URL and no revision, and a test enforces that.

## Attorney filing packet

Optional, off by default, and the only intake section whose answers never reach
a calculation. When a person turns it on, the last intake step collects what
*court forms* need but an estimate does not — full legal names, addresses,
where the marriage took place, when Florida residence began, and each child's
five-year address history.

`/api/package/filing-packet` returns a PDF containing:

- **A residency check**, done as arithmetic off the date given rather than as a
  yes/no the person self-assesses (§61.021 requires six months).
- **The forms this case calls for**, chosen from the answers — which petition,
  which settlement agreement, and the child-related forms only when there are
  children — each with its verified revision and the court's own URL.
- **Exactly what is still missing** per form, worded as the question that was
  not answered rather than as a field name.
- **A term sheet** covering alimony, child support, equitable distribution, and
  parenting, with the statutory basis printed under every figure.

Three things it deliberately does not do:

- **It does not fill in the official PDFs**, for the AcroForm reason above.
- **It does not draft a marital settlement agreement.** Drafting the binding
  instrument means deciding whether alimony is modifiable, who claims the
  children on a tax return, whether a QDRO is needed to divide retirement,
  whether life insurance secures support, and how a house is deeded or
  refinanced. None of that is arithmetic. Each section of the term sheet lists
  those decisions under "For the attorney to decide" instead of guessing.
- **It never collects Social Security numbers**, even though Form 12.902(j)
  needs them. They change no calculation here and would make a breach far
  worse, so the packet says to complete that form by hand.

## Saving, editing, and coming back

Answers autosave to the browser as they are typed (debounced, flushed on navigation), and a visible indicator reports when the draft was last saved. If the server is reachable they are mirrored to a saved case behind that write, which is what makes version history and cross-device recovery possible — see "Accounts and version history". The wizard remembers the topic you were last on and reopens there; `?step=<topicId>` deep-links to any topic directly.

Finishing does not freeze you out. The reviewed snapshot used for calculation is stored separately from the working draft, so answers stay editable afterwards — and because a snapshot's figures can then contradict the answers on file, `isReviewedSnapshotStale()` compares the draft's `updatedAt` against the snapshot's `reviewedAt`. When they diverge the results screen says so, offers to recalculate, and **disables PDF export** until it is recalculated. Exporting a packet for an attorney whose numbers no longer match the user's own answers is the failure this prevents.

That comparison is why navigation must never touch `updatedAt`: `updatedAt` means *an answer changed*, and moving between screens persists position without bumping it. If it did, a freshly confirmed estimate would immediately declare itself stale. Timestamps that cannot be parsed are treated as stale, since the figures cannot be proven current.

## Accounts and version history

Signing in is optional and the app is fully usable without it. That is a
deliberate position, not an unfinished one: someone researching their own
divorce may have good reasons not to create an account tied to their email,
and the privacy notice says as much.

What an account buys is the two things localStorage cannot give:

- the draft **survives this browser** — a different device, a cleared cache, a
  replaced laptop;
- **version history**, so answers can be brought back to how they were.

### How the draft is stored

The browser copy stays authoritative for responsiveness. Every answer is
written to `localStorage` first and mirrored to the server behind it, so typing
never waits on the network and an unreachable server costs *history*, never
*answers*. `createSyncedIntakeDraftStorage` reports `offline` and keeps going.

Saves are serialised and carry an `expectedRevision`. Two tabs, or a phone and
a laptop, saving the same case is ordinary here; without the compare-and-swap
the later save would silently erase the earlier one's answers. On conflict the
client adopts the newer revision and reports it rather than overwriting.

One rule is worth calling out because it is easy to get backwards: a **server
draft that is empty never replaces local answers**. An empty draft is exactly
the shape a freshly created account has, and wiping someone's work as a
consequence of signing in would be an unforgivable first impression.

### Restoring is never destructive

`case_revisions` is append-only. Restoring reads an old snapshot and saves it
**forward** as a new revision, recording `restored_from_revision` for
provenance. Nothing is deleted, so a restore is itself undoable and the history
remains a true record of what was entered when. A destructive revert would be
the only operation in this app capable of losing a person's financial answers
outright, which is why it does not exist.

### Who can read a case

One predicate, `ownerPredicate()`, defines ownership everywhere:

- **anonymous** callers reach only *unclaimed* cases from their own session;
- **signed-in** callers reach their account's cases, plus unclaimed ones from
  the session in front of them.

Once a case is claimed by an account the session route closes. A borrowed or
shared browser must not keep reading a case after the person signed in and
walked away — and that is precisely the situation the session route would
otherwise cover. For the same reason, signing in only adopts cases from *that
session*, so it cannot sweep up a previous user's draft on a shared computer.

Anything not matching is reported as **404, not 403**, so the API never
confirms that someone else's case exists. Repository tests assert this against
the compiled SQL rather than trusting the code to read correctly.

### The shared-computer rule

The draft is mirrored to `localStorage` so typing never waits on the network.
That convenience has a sharp edge: the browser copy outlives the server
session, so on a shared or public machine the question "what does the next
person to sit down see?" has to have a *tested* answer.

Two things enforce it:

- **Signing out wipes the local mirror**, not just the cookie. It runs even if
  the sign-out request fails, because leaving somebody's income and debts on a
  library computer over a network blip is the worst available outcome and the
  server copy is safe regardless.
- **The mirror records whose it is.** On load the client compares the signed-in
  user against that marker and discards the local copy if they differ. The one
  transition that must *not* clear anything is anonymous → signed in: that is
  someone signing in to keep the draft they were already working on, which the
  server has just claimed for their account.

The sweep is by key **prefix**, not an enumerated list. A list is correct the
day it is written and quietly wrong the first time somebody adds a key without
remembering it — and the cost of that mistake is disclosing a stranger's
divorce finances. Resetting a layout preference along the way is a trivial
price for a rule that cannot drift.

Server-side ownership checks would stop the second person *writing to* the
first person's row, but they cannot stop the browser *showing* it. That is why
this lives on the client and is tested there.

### Why session expiry cannot delete an account's case

`cases.session_id` is `ON DELETE SET NULL`, not `ON DELETE CASCADE`. The
cascade was the obvious default and it was the wrong one: the day anyone adds a
routine "delete expired sessions" job, every signed-in person's saved case
would vanish with it — silently, with no way back, and with the job author
having no reason to suspect it.

With `set null` the worst case becomes an orphaned anonymous row, which is
recoverable and cleanable. `purgeExpiredSessions()`
(`src/server/session/purge.ts`) is the one safe way to do it: it deletes
anonymous cases explicitly and in the right order, and never touches an
account-owned one. A session lapsing is not somebody asking to erase their
financial answers.

### Google sign-in setup

Sign-in uses the OpenID Connect authorization-code flow with PKCE, written out
directly rather than pulled from an auth framework. The app already has a
database-backed session layer (hashed opaque secret, signed token, rotation,
revocation); adding Auth.js would mean two sources of truth about who is signed
in, which is the ambiguity that produces authorization bugs.

Checked on every callback, each for a specific reason:

| Check | What it prevents |
| --- | --- |
| `state`, hashed server-side and deleted on first use | CSRF into the login, and replay of a captured callback URL |
| PKCE verifier, never sent to the browser | an intercepted authorization code being redeemable |
| ID token signature against Google's JWKS | a forged token |
| `iss` / `aud` | a token minted for a different application |
| `nonce` | a token not bound to *this* request |
| origin-checked redirect (twice) | this endpoint becoming an open redirect |

The redirect check is worth spelling out, because the obvious version of it is
wrong. Testing that the path starts with `/` and not `//` is not enough: the
URL parser normalises backslashes for http(s), so `/\evil.com` passes that test
and resolves to `https://evil.com/`. Worse, `/..//evil.com` resolves
*same-origin* and then normalises to `//evil.com`, which is protocol-relative
the next time it is used. The only invariant that holds is that the returned
string still lands on this origin from any base, so that is what is asserted —
in `sanitiseRedirectPath`, again at the callback, and in tests.

Identity is keyed on the OIDC `sub` claim, **not email**. Email addresses can
be reassigned, and keying on one would eventually let a stranger inherit
another person's financial case. An unverified email is dropped rather than
displayed.

To enable it, create an OAuth 2.0 Client ID (type: Web application) in the
Google Cloud Console with these authorized redirect URIs:

```
http://localhost:3000/api/auth/google/callback
https://<your-app>.azurewebsites.net/api/auth/google/callback
```

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Keep both out of the
repo; `.env.local` is gitignored and is the right home for local development.

On the deployed app the client ID and secret are **App Service settings**, not
Key Vault references — unlike `SESSION_SIGNING_SECRET`, which is a reference.
That inconsistency is deliberate and worth recording. The production vault has
`publicNetworkAccess: Disabled` and is pinned there: setting it to `Enabled`
returns success and silently leaves it `Disabled`, so an Azure Policy is
enforcing it. The vault is reachable only over its private endpoint, and the
Kudu container — the one place inside the VNet where commands can be run — has
no managed identity (`IDENTITY_ENDPOINT` is unset), so there is no path from a
workstation or from Kudu to write a secret.

App settings are encrypted at rest and readable only with control-plane RBAC on
the app, which is the same set of people who could read a Key Vault reference,
so this is a modest step down rather than an exposure. What is lost is the
vault's separate audit trail and rotation story. To close it, write the secret
from somewhere inside the VNet with an identity that holds **Key Vault Secrets
Officer**, then swap the app setting to
`@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/google-client-secret)`.

**When either is unset the feature disappears cleanly**: the header renders no
sign-in control and `/api/auth/google/start` returns 501. Offering a button
that leads to an error would be worse than offering none.

## Privacy and security defaults

- Accounts are **optional**; anonymous use is a first-class mode, not a degraded one (see "Accounts and version history")
- Federated identity only — no password, password hash, or reset token is ever handled, so there is no credential here to leak
- Signing in rotates the session token, so a token captured while anonymous cannot inherit the account
- Private Azure Blob containers in the production design
- Seven-day source-document retention; confirmed structured facts are separate
- No raw document bytes or extracted financial values in application logs
- Assistant conversations are never persisted and never logged, and provider error bodies are never echoed
- Random storage object names; user filenames are display-only
- MIME declaration, extension, and magic-byte validation
- Bounded streaming request reads before multipart parsing
- Server-side ownership checks and optimistic draft concurrency in repositories
- Strict PDF API payload; all calculation figures are regenerated server-side
- Managed identity for Azure Blob and Key Vault access
- The Google client secret is an App Service setting rather than a Key Vault reference, because policy pins the vault private and no in-VNet identity can write to it (see "Google sign-in setup")

## Azure target

The Azure deployment targets **Central US** in whichever Azure AD tenant/subscription you point the tooling at:

- Azure App Service (Linux, Node 24) for the Next.js server, with a system-assigned managed identity, `httpsOnly`, TLS 1.2 minimum, FTPS disabled, and a health check on `/api/health`
- Azure Database for PostgreSQL Flexible Server, private by default (VNet-delegated subnet + private DNS zone; no public endpoint) with a documented public-access fallback
- Azure Storage with shared-key access disabled, public blob access disabled, and private `case-documents`/`generated-packages` containers (seven-day lifecycle deletion of source documents only)
- Azure Key Vault (RBAC, soft delete, purge protection) holding `DATABASE_URL` and `SESSION_SIGNING_SECRET`, referenced by the App Service via Key Vault references
- Application Insights + Log Analytics, with no application code assuming or requiring sensitive-data logging
- Azure CLI + Bicep for infrastructure (`infra/`) and **App Service Deployment Center Local Git** for application releases (`scripts/azure/`) — there is intentionally no GitHub Actions workflow

Azure deployment is performed only after the local vertical slice passes, and only manually, by an operator with access to the target tenant. Tenant and subscription selection is driven entirely by `az login --tenant` and `az account set --subscription`, using environment variables supplied at deploy time — no tenant ID, subscription ID, or secret is ever hard-coded in Bicep or committed to source control.

### Infrastructure layout

```text
infra/main.bicep                    Subscription-scope entry point: creates the resource group, then deploys resources.bicep into it
infra/resources.bicep               Resource-group-scope orchestrator: wires modules together, role assignments, app settings, diagnostics
infra/modules/network.bicep         VNet, App Service/PostgreSQL delegated subnets, private DNS zone for PostgreSQL
infra/modules/postgres.bicep        PostgreSQL Flexible Server + database (private by default)
infra/modules/storage.bicep         Storage account, containers, 7-day source-document lifecycle policy
infra/modules/keyvault.bicep        Key Vault (RBAC) + DATABASE_URL/SESSION_SIGNING_SECRET secrets
infra/modules/app-service.bicep     Linux App Service Plan + Web App (Node 24), Local Git basic-auth policy
infra/modules/monitoring.bicep      Log Analytics workspace + Application Insights
infra/main.parameters.example.json  Placeholder-only parameters file (copy to main.parameters.json, gitignored)
scripts/azure/deploy-infra.sh       Login, validate, deploy Bicep; saves non-secret deployment outputs
scripts/azure/enable-local-git.sh   Enables Local Git; configures a named git remote (no credentials committed)
scripts/azure/smoke-test.sh         GET-only checks of /api/health, /, /documents, /results
scripts/azure/lib.sh                Shared helpers (logging, env checks, reading deployment outputs)
```

### Prerequisites

- Access to the target Azure AD tenant and an Azure subscription in it, with App Service quota in the chosen region
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (this project was validated against CLI 2.88 and Bicep CLI 0.45; run `az bicep install`/`az bicep upgrade` if you don't already have the Bicep CLI)
- `git`, `curl`, `openssl`, and `python3` (used only by `scripts/azure/*.sh` to parse deployment-output JSON — no extra npm/pip packages required)
- The local vertical slice already passing (`npm run typecheck && npm run lint && npm test && npm run build`)

None of this requires GitHub Actions, a service principal, or CI secrets: every command below is run interactively, from an operator's machine, using their own Azure AD sign-in.

**App Service quota is per-region, and worth checking first.** On the subscription this was deployed to, East US and East US 2 both reported `InternalSubscriptionIsOverQuotaForSku` with "Current Limit (Total VMs): 0" — for every SKU, including B1 — while Central US and West US 2 worked fine. Note that `az deployment sub validate` does **not** surface quota; only `create` does, and it fails late, after most resources have already provisioned. If a deploy fails this way, try another region before requesting a quota increase: create a throwaway resource group and `az appservice plan create --sku B1 --is-linux` in a few candidates to find one that works.

### Tenant/subscription parameter flow

1. Copy `infra/main.parameters.example.json` to `infra/main.parameters.json` (gitignored) and fill in the **non-secret** values: `namePrefix`, `environmentName`, `location` (`centralus`), `postgresAdminLogin`, SKUs, `enablePrivateNetworking`, `tags`.
2. Export the two tenant-scoping variables for the session — these are never written to a file and never appear in Bicep parameters:
   ```bash
   export AZURE_TENANT_ID=<your-tenant-guid>
   export AZURE_SUBSCRIPTION=<your-subscription-id-or-exact-name>
   ```
3. The two secrets (`POSTGRES_ADMIN_PASSWORD`, `SESSION_SIGNING_SECRET`) are never put in a parameters file at all. Either export them as environment variables beforehand, or let `deploy-infra.sh` prompt for them with hidden input (leaving the session secret blank auto-generates one with `openssl rand -hex 32`, printed nowhere).

### Testing against a deployed environment

The Playwright suite can run against a deployed URL instead of a local dev server:

```bash
E2E_BASE_URL=https://<app>.azurewebsites.net npx playwright test --workers=1
```

Use `--workers=1` against a B1 plan. Five parallel workers saturate a single small instance and produce timeouts that look like application failures but are not. This is how two real deployment faults were found — the suite passed locally and failed against Azure.

### Deploying infrastructure

```bash
cp infra/main.parameters.example.json infra/main.parameters.json
# edit infra/main.parameters.json with your non-secret values

export AZURE_TENANT_ID=<your-tenant-guid>
export AZURE_SUBSCRIPTION=<your-subscription-id-or-name>

./scripts/azure/deploy-infra.sh
```

This logs in (`az login --tenant`), sets the subscription context (`az account set --subscription`), runs `az bicep build` and `az deployment sub validate`, asks for confirmation, then runs `az deployment sub create` against `infra/main.bicep` at **subscription scope** — the template itself creates the `<namePrefix>-<environmentName>-rg` resource group in the chosen region and deploys every resource into it. Non-secret outputs (resource group, web app name/URL, Key Vault/storage names) are saved to `infra/.deployment-outputs.<environmentName>.json` (gitignored) for the other two scripts to read.

### Releasing the application (Local Git)

```bash
export AZURE_TENANT_ID=<your-tenant-guid>
export AZURE_SUBSCRIPTION=<your-subscription-id-or-name>
export ENVIRONMENT_NAME=<same environmentName as above>

./scripts/azure/enable-local-git.sh
git push azure-<environmentName> HEAD:master   # App Service always deploys from "master"
```

`enable-local-git.sh` runs `az webapp deployment source config-local-git`, adds/updates a git remote named `azure-<environmentName>`, and prints next steps. It never prints a password: the returned Local Git URL carries only a deployment *username* (Azure's documented behavior), and git prompts for the password interactively on first push, letting your OS/Git credential manager cache it outside this repository. Set a deployment password once beforehand with `az webapp deployment user set --user-name <name>` if you haven't already (also prompts interactively).

On push, Azure's Oryx build system runs `npm install` and `npm run build` for you (via `SCM_DO_BUILD_DURING_DEPLOYMENT=true`), then the App Service runs `npm run start`. A full build typically takes several minutes; watch progress with:

```bash
az webapp log tail --name <web-app-name> --resource-group <resource-group-name>
```

Then confirm the release:

```bash
ENVIRONMENT_NAME=<environmentName> ./scripts/azure/smoke-test.sh
```

### Local Git limitations

- Local Git deployment requires **SCM basic authentication** on the App Service (`infra/modules/app-service.bicep` enables it explicitly, alongside FTP basic auth left explicitly disabled). If an Azure Policy at the tenant level disables SCM basic auth platform-wide, `enable-local-git.sh` will fail with a clear error and Local Git cannot be used until that policy is relaxed for this app.
- App Service always deploys Local Git pushes from the **`master`** branch, regardless of your local repository's default branch name — push with `git push <remote> HEAD:master`.
- There is exactly one App Service instance with no deployment slot in this MVP topology, so a push causes a brief restart (not a zero-downtime swap). `alwaysOn: true` keeps the app warm between pushes but does not eliminate the restart window during a deploy.
- Local Git has no separate build log storage beyond Kudu's own deployment history; `az webapp log tail` only shows live output, so tail it during the push if you want to see build errors as they happen.

### Rollback

Local Git deployment history is retained by Kudu. To roll back:

1. **Preferred:** `git revert` the problematic commit(s) locally and `git push azure-<environmentName> HEAD:master` again — this is the same release path as a forward fix and keeps the deployment log linear.
2. **Alternative:** open the app's **Deployment Center > Logs** blade in the Azure portal, find a prior successful deployment, and use **Redeploy** — Kudu re-runs the build for that historical commit without requiring a local git operation.

Because there is no deployment slot, both options briefly restart the running instance; there is no slot-swap rollback in this MVP topology.

### Database migration caveat

Local Git/Oryx only runs `npm install && npm run build` on push — **it does not run `npm run db:migrate`**, and nothing in this template wires Drizzle migrations into the release path automatically. When `enablePrivateNetworking` is `true` (the default), the PostgreSQL server also has no public endpoint, so a plain operator laptop cannot reach it directly to run migrations either. Run migrations from inside the VNet-integrated App Service itself instead:

```bash
az webapp ssh --name <web-app-name> --resource-group <resource-group-name>
# inside the SSH session (DATABASE_URL is already present as a resolved Key Vault reference):
npm run db:migrate
```

Run this once after the first deploy (to create the schema) and again after any deploy that changes `src/db/schema.ts`/`drizzle/`. Always review the generated SQL in `drizzle/` before deploying it to a real environment.

### Network/privacy tradeoffs

- **PostgreSQL** is private by default (`enablePrivateNetworking: true`): a delegated VNet subnet plus a linked `privatelink.postgres.database.azure.com` private DNS zone means the server has **no public network endpoint at all**, and the App Service reaches it only via regional VNet integration. Setting `enablePrivateNetworking: false` is a deliberate, clearly non-private MVP fallback; public access is then allowlisted to the App Service's possible outbound IP addresses rather than all Azure tenants.
- **Storage and Key Vault** are reachable over their public endpoints in this template, secured by TLS 1.2+, disabled shared-key/anonymous access, and Azure AD RBAC (managed identity) for every data-plane call. Their private-networking story (private endpoints) was intentionally out of scope for this MVP; see the comments in `infra/modules/storage.bicep`/`infra/modules/keyvault.bicep` for the exact reasoning if you want to extend this later.

### Tearing it down

```bash
az account set --subscription "$AZURE_SUBSCRIPTION"
az group delete --name <namePrefix>-<environmentName>-rg --yes
```

Key Vault has purge protection enabled, so the vault (and its secrets) remains recoverable in a soft-deleted state for the configured 90-day retention period after the resource group is deleted. Azure blocks manual purge during that window; either recover the vault if needed or wait for the retention period to expire.
