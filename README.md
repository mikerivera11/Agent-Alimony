# Florida Support Guide

A plain-language, Florida-first financial guidance application for organizing family-law facts, estimating child support and current-law alimony constraints, reviewing document-derived proposals, and generating an attorney-review package.

This application provides **legal information and financial estimates only**. It is not a lawyer, does not provide legal advice, does not predict a court order, and does not generate a binding marital settlement agreement.

## Current vertical slice

- Thirteen-topic intake with explanations, autosave, review/edit, accessibility, responsive layouts, safety prompts, and a fictional demo
- Two interchangeable layouts for that intake — step by step, or every section on one page — sharing one draft, one set of schemas, and one review screen
- Deterministic Florida child-support calculations under Fla. Stat. § 61.30
- Deterministic current-law alimony constraints and scenario range under Fla. Stat. § 61.08
- Deterministic equitable distribution under Fla. Stat. § 61.075, including per-item exclusion gated on a written agreement
- Lump-sum settlement modelling, kept outside the rules engine because no statute supplies a rate or a present-value formula
- A Florida family-law information assistant answering from curated, citation-backed statutory material
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

Refresh the official child-support fixture:

```bash
SOURCE_VERIFIED_AT=YYYY-MM-DD npm run sources:florida
git diff -- data/legal/florida/child-support-schedule-2025.json
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

The substance of every answer comes from a curated knowledge base in `src/server/assistant/knowledgeBase.ts`, transcribed from the same statutory text already verified for the rulesets. This is the point of the design: a language model asked about Florida alimony from memory will readily describe permanent alimony, which was eliminated for petitions filed on or after July 1, 2023. Retrieval over verified passages keeps the legal substance deterministic and citable. Retrieval itself is transparent lexical scoring rather than embeddings — testable, no network call, and identical in development and production.

Guardrails are enforced in code, not merely requested in the prompt:

- **The assistant never states a dollar figure.** Model output containing currency is discarded in favour of the local adapter, because every figure in this app must come from the deterministic rulesets.
- Text a person types is wrapped in an untrusted-data envelope with system-like delimiters stripped, and recognised instruction-override attempts are declined before any model call.
- Any provider failure falls back to the local adapter with a visible note rather than degrading silently.
- Disclosures that exceed what this app can model — abuse, coercion, hidden assets, business income, special-needs children, out-of-state jurisdiction, imminent deadlines — raise escalation notices with referral information. Detection is recall-biased: a spurious referral is harmless, a missed one is not.

The endpoint is stateless and persists nothing; neither the question nor the answer is logged.

### Providers

| `ASSISTANT_PROVIDER` | Behaviour |
| --- | --- |
| `local` (default) | Answers from the built-in statute reference. Needs no AI provider and is not a stub. |
| `foundry` | Additionally uses Claude Opus 5 on Azure AI Foundry to rephrase the same retrieved passages in plainer language. |

The Foundry adapter calls the Anthropic Messages API at `https://<resource>.services.ai.azure.com/anthropic/v1/messages` using `fetch` and the existing `@azure/identity` dependency, rather than taking a hard dependency on a 0.x provider SDK. It authenticates by managed identity (Entra scope `https://ai.azure.com/.default`, role **Cognitive Services User**), with `AZURE_FOUNDRY_API_KEY` as a fallback.

Not yet implemented, deliberately: the Foundry Bicep module. The current `Microsoft.CognitiveServices/accounts` API version could not be verified from this environment, and this project does not guess at unverified values. When provisioning, note that Foundry does **not** apply Azure content filtering to Claude models, that `Microsoft.SaaS/register/action` must be run once on the subscription, and that CSP, free-trial, student, and sponsored-credit-only subscriptions cannot subscribe to Anthropic Claude on Azure Marketplace.

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

The planned Azure deployment uses **East US 2** in whichever Azure AD tenant/subscription you point the tooling at:

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

- Access to the target Azure AD tenant and an Azure subscription in it, in East US 2
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (this project was validated against CLI 2.88 and Bicep CLI 0.45; run `az bicep install`/`az bicep upgrade` if you don't already have the Bicep CLI)
- `git`, `curl`, `openssl`, and `python3` (used only by `scripts/azure/*.sh` to parse deployment-output JSON — no extra npm/pip packages required)
- The local vertical slice already passing (`npm run typecheck && npm run lint && npm test && npm run build`)

None of this requires GitHub Actions, a service principal, or CI secrets: every command below is run interactively, from an operator's machine, using their own Azure AD sign-in.

### Tenant/subscription parameter flow

1. Copy `infra/main.parameters.example.json` to `infra/main.parameters.json` (gitignored) and fill in the **non-secret** values: `namePrefix`, `environmentName`, `location` (`eastus2`), `postgresAdminLogin`, SKUs, `enablePrivateNetworking`, `tags`.
2. Export the two tenant-scoping variables for the session — these are never written to a file and never appear in Bicep parameters:
   ```bash
   export AZURE_TENANT_ID=<your-tenant-guid>
   export AZURE_SUBSCRIPTION=<your-subscription-id-or-exact-name>
   ```
3. The two secrets (`POSTGRES_ADMIN_PASSWORD`, `SESSION_SIGNING_SECRET`) are never put in a parameters file at all. Either export them as environment variables beforehand, or let `deploy-infra.sh` prompt for them with hidden input (leaving the session secret blank auto-generates one with `openssl rand -hex 32`, printed nowhere).

### Deploying infrastructure

```bash
cp infra/main.parameters.example.json infra/main.parameters.json
# edit infra/main.parameters.json with your non-secret values

export AZURE_TENANT_ID=<your-tenant-guid>
export AZURE_SUBSCRIPTION=<your-subscription-id-or-name>

./scripts/azure/deploy-infra.sh
```

This logs in (`az login --tenant`), sets the subscription context (`az account set --subscription`), runs `az bicep build` and `az deployment sub validate`, asks for confirmation, then runs `az deployment sub create` against `infra/main.bicep` at **subscription scope** — the template itself creates the `<namePrefix>-<environmentName>-rg` resource group in East US 2 and deploys every resource into it. Non-secret outputs (resource group, web app name/URL, Key Vault/storage names) are saved to `infra/.deployment-outputs.<environmentName>.json` (gitignored) for the other two scripts to read.

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
