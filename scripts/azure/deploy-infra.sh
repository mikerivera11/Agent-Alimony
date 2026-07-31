#!/usr/bin/env bash
# scripts/azure/deploy-infra.sh
#
# Validates and deploys infra/main.bicep (subscription-scope: creates the
# resource group, then every resource inside it) for one environment, in
# East US 2. Intended to be run interactively by an operator who already has
# access to the target Azure AD tenant/subscription — this script never
# deploys anything by itself in CI, and there is no GitHub Actions workflow
# for it by design.
#
# Required environment variables:
#   AZURE_TENANT_ID         Azure AD tenant ID to log into (az login --tenant).
#   AZURE_SUBSCRIPTION      Subscription ID or exact name to deploy into
#                            (az account set --subscription).
#
# Optional environment variables:
#   PARAMETERS_FILE           Path to a non-secret parameters JSON file.
#                              Defaults to infra/main.parameters.json — copy
#                              infra/main.parameters.example.json there and
#                              fill in namePrefix/environmentName/etc first.
#   POSTGRES_ADMIN_PASSWORD   If unset, you will be prompted (input hidden).
#   SESSION_SIGNING_SECRET    If unset, you will be prompted (input hidden);
#                              leave blank at the prompt to auto-generate one
#                              with `openssl rand -hex 32`.
#   LOCATION                  Defaults to eastus2. This deployment targets
#                              East US 2 only; changing this is not supported
#                              by the rest of this template's assumptions.
#
# Nothing here ever prints a password/token, and no secret is written to any
# file this repository tracks in git.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

require_command az "Install the Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli"
require_command python3

require_env AZURE_TENANT_ID "Example: export AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000"
require_env AZURE_SUBSCRIPTION "Example: export AZURE_SUBSCRIPTION=00000000-0000-0000-0000-000000000000 (or an exact subscription name)"

LOCATION="${LOCATION:-eastus2}"
if [ "$LOCATION" != "eastus2" ]; then
  log_warn "LOCATION=${LOCATION} overrides the East US 2 target this template was designed and reviewed for."
fi

PARAMETERS_FILE="${PARAMETERS_FILE:-${INFRA_DIR}/main.parameters.json}"
if [ ! -f "$PARAMETERS_FILE" ]; then
  log_error "Missing parameters file: ${PARAMETERS_FILE}"
  log_error "Copy infra/main.parameters.example.json to infra/main.parameters.json and fill in non-secret values (namePrefix, environmentName, postgresAdminLogin, etc.)."
  exit 1
fi

NAME_PREFIX="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['parameters']['namePrefix']['value'])" "$PARAMETERS_FILE")"
ENVIRONMENT_NAME="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['parameters']['environmentName']['value'])" "$PARAMETERS_FILE")"

log_info "Deploying namePrefix='${NAME_PREFIX}' environmentName='${ENVIRONMENT_NAME}' to subscription '${AZURE_SUBSCRIPTION}' (${LOCATION})."

log_info "Signing in to Azure AD tenant ${AZURE_TENANT_ID} (a browser window will open)..."
az login --tenant "$AZURE_TENANT_ID" --only-show-errors >/dev/null

az account set --subscription "$AZURE_SUBSCRIPTION"
log_info "Active subscription context:"
az account show --query "{name:name, subscriptionId:id, tenantId:tenantId}" -o table >&2

# --- Secrets: prompt with hidden input; never echoed, never logged ---
if [ -z "${POSTGRES_ADMIN_PASSWORD:-}" ]; then
  read -r -s -p "PostgreSQL admin password (input hidden, not echoed): " POSTGRES_ADMIN_PASSWORD
  echo >&2
fi
if [ -z "$POSTGRES_ADMIN_PASSWORD" ]; then
  log_error "A PostgreSQL admin password is required."
  exit 1
fi

if [ -z "${SESSION_SIGNING_SECRET:-}" ]; then
  read -r -s -p "Session-signing secret, min 32 chars (input hidden; leave blank to auto-generate): " SESSION_SIGNING_SECRET
  echo >&2
fi
if [ -z "$SESSION_SIGNING_SECRET" ]; then
  require_command openssl
  SESSION_SIGNING_SECRET="$(openssl rand -hex 32)"
  log_info "Generated a random session-signing secret (value not printed)."
fi
if [ "${#SESSION_SIGNING_SECRET}" -lt 32 ]; then
  log_error "SESSION_SIGNING_SECRET must be at least 32 characters."
  exit 1
fi

# Secrets are passed to `az deployment sub` via a locally-generated, git-
# ignored parameters overlay file (readable only by the current user, and
# deleted on exit) rather than as CLI arguments, so they never show up in
# `ps`/shell history and are never written anywhere this repo tracks.
SECRET_PARAMS_FILE="${INFRA_DIR}/.secure-params.${ENVIRONMENT_NAME}.$$.json"
cleanup() { rm -f "$SECRET_PARAMS_FILE"; }
trap cleanup EXIT

( umask 077
  # The single-quoted program must not interpolate shell expressions.
  # shellcheck disable=SC2016
  printf '%s\0%s' "$POSTGRES_ADMIN_PASSWORD" "$SESSION_SIGNING_SECRET" |
    python3 -c '
import json
import sys

path = sys.argv[1]
pg_password, session_secret = sys.stdin.buffer.read().split(b"\0", 1)
document = {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "postgresAdminPassword": {"value": pg_password.decode()},
        "sessionSigningSecret": {"value": session_secret.decode()},
    },
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
' "$SECRET_PARAMS_FILE"
)
unset POSTGRES_ADMIN_PASSWORD SESSION_SIGNING_SECRET

log_info "Building infra/main.bicep..."
az bicep build --file "${INFRA_DIR}/main.bicep" --stdout >/dev/null

DEPLOYMENT_NAME="${NAME_PREFIX}-${ENVIRONMENT_NAME}-$(date -u +%Y%m%dT%H%M%SZ)"

log_info "Validating deployment '${DEPLOYMENT_NAME}'..."
az deployment sub validate \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "${INFRA_DIR}/main.bicep" \
  --parameters "@${PARAMETERS_FILE}" \
  --parameters "@${SECRET_PARAMS_FILE}" \
  --only-show-errors >/dev/null
log_ok "Validation succeeded."

if ! confirm "Deploy '${DEPLOYMENT_NAME}' to subscription '${AZURE_SUBSCRIPTION}' in ${LOCATION} now?"; then
  log_warn "Aborted before deployment (validation already succeeded above)."
  exit 1
fi

log_info "Deploying (this provisions a resource group, App Service, PostgreSQL Flexible Server, Storage, Key Vault, and monitoring — it can take 15-25 minutes, mostly for PostgreSQL)..."
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "${INFRA_DIR}/main.bicep" \
  --parameters "@${PARAMETERS_FILE}" \
  --parameters "@${SECRET_PARAMS_FILE}" \
  --only-show-errors >/dev/null

log_ok "Deployment '${DEPLOYMENT_NAME}' complete."

OUTPUTS_FILE="${INFRA_DIR}/.deployment-outputs.${ENVIRONMENT_NAME}.json"
az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs -o json > "$OUTPUTS_FILE"
log_info "Saved (non-secret) deployment outputs to ${OUTPUTS_FILE} (git-ignored)."

WEB_APP_NAME="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['webAppName']['value'])" "$OUTPUTS_FILE")"
WEB_APP_URL="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['webAppUrl']['value'])" "$OUTPUTS_FILE")"
RESOURCE_GROUP_NAME="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['resourceGroupName']['value'])" "$OUTPUTS_FILE")"
IS_PRIVATE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['postgresIsPrivate']['value'])" "$OUTPUTS_FILE")"

log_ok "Infrastructure deployed."
cat >&2 <<SUMMARY

  Resource group:   ${RESOURCE_GROUP_NAME}
  Web app:          ${WEB_APP_NAME}
  URL:              ${WEB_APP_URL}
  PostgreSQL private networking: ${IS_PRIVATE}

Next steps:
  1. Enable Local Git and add the git remote:
       ENVIRONMENT_NAME=${ENVIRONMENT_NAME} ./scripts/azure/enable-local-git.sh
  2. Push the app once you're ready to release:
       git push azure-${ENVIRONMENT_NAME} HEAD:master
  3. Smoke test the running app (safe, no private data sent):
       ENVIRONMENT_NAME=${ENVIRONMENT_NAME} ./scripts/azure/smoke-test.sh
SUMMARY
