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

### The agent tier

`foundry` pre-fetches passages and hands the model one prompt, so a follow-up question arrives with no memory of the last answer and retrieval is fixed before the model has seen anything. The `agent` provider instead registers one tool, `search_florida_law`, and lets the agent decide when to call it and what to search for, on a Foundry thread that carries the conversation.

That inverts where grounding comes from, so it is worth being precise about what did **not** change. The tool runs the same `gatherGrounding` over the same committed corpus, so the agent cannot reach material the other adapters could not. Retrieval still happens in application code, in this repository, under test. Passages are currency-redacted *before* the agent reads them, so the "never states a dollar figure" guarantee does not rest on the agent's restraint.

What did change is that grounding is no longer structurally guaranteed. A model free to skip retrieval will sometimes skip it, and what comes back then is recalled training data wearing this app's citations. So the run is inspected rather than trusted: **an answer produced without a tool call is discarded** and the question is re-answered by the fallback with a visible note. Unknown tool names are refused rather than guessed at, and a search that matches nothing returns an explicit instruction to decline instead of an empty result the agent might fill from memory.

Threads are created per request and prior turns replayed into them, rather than one long-lived server-side thread per user. A persistent thread would be conversation content living outside this app's own retention rules.

**The agent runs gpt-5.1, not gpt-5.6-sol, and that is a constraint rather than a preference.** The Agent Service always sends `top_p`, which gpt-5.5 and the whole gpt-5.6 family reject outright; this was verified against a live resource across five API versions and cannot be configured away by setting the parameter explicitly. gpt-5.1 accepts it. The chat-completions tier keeps the newer model, and since substance comes from the corpus either way, the difference is phrasing. gpt-5.1 is also a regional `Standard` deployment drawing on a separate quota pool, not `GlobalStandard`.

The agent itself is created by the app on first use and reused by name. Agents are data-plane objects with no ARM type, so Bicep cannot declare one; doing it in code keeps release to a single `git push` rather than a bootstrap step that can be skipped.

**Not yet built: calculator tools.** The obvious next step is letting the agent call the deterministic rulesets so it can answer "what would my support be". It is not built because it runs into a real boundary rather than a missing afternoon: every calculation accepts only a `ConfirmedFact`, whose source must be `user-entered`, `user-confirmed-extraction`, or `document-confirmed`. Numbers a model parses out of a chat message are none of those, and passing them as `user-entered` would quietly defeat the confirmation boundary the whole application is built on. The options — calculate only from saved intake data, add a distinct conversational-scenario provenance whose results are labelled and never persisted, or use saved data as a base with echoed-back overrides — are a product decision, not an implementation detail.

> **First deployment needs one re-run.** ARM sometimes starts the model deployment while the parent Cognitive Services account is still in `Accepted` and fails with `AccountProvisioningStateInvalid`. The `parent` relationship is the strongest ordering Bicep can express, so there is no template fix; wait for the account to report `Succeeded` and re-run. Subsequent deployments are unaffected.
>
> The same error has a second, permanent cause worth distinguishing: **creating or updating the project returns the account to `Accepted`**, and any write touching the account while it is there fails. That one does not resolve on a re-run, because ARM starts the private endpoint in parallel with the project every time. It is fixed in the template with an explicit `dependsOn`, since the `parent` graph does not imply that ordering.

## Saving, editing, and coming back

Answers autosave to the browser as they are typed (debounced, flushed on navigation), and a visible indicator reports when the draft was last saved. The wizard remembers the topic you were last on and reopens there; `?step=<topicId>` deep-links to any topic directly.

Finishing does not freeze you out. The reviewed snapshot used for calculation is stored separately from the working draft, so answers stay editable afterwards — and because a snapshot's figures can then contradict the answers on file, `isReviewedSnapshotStale()` compares the draft's `updatedAt` against the snapshot's `reviewedAt`. When they diverge the results screen says so, offers to recalculate, and **disables PDF export** until it is recalculated. Exporting a packet for an attorney whose numbers no longer match the user's own answers is the failure this prevents.

That comparison is why navigation must never touch `updatedAt`: `updatedAt` means *an answer changed*, and moving between screens persists position without bumping it. If it did, a freshly confirmed estimate would immediately declare itself stale. Timestamps that cannot be parsed are treated as stale, since the figures cannot be proven current.

## Privacy and security defaults

- No account in the initial MVP; local drafts are browser-bound and have no cross-device recovery
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
