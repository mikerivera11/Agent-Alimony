#!/usr/bin/env bash
# scripts/azure/enable-local-git.sh
#
# Enables App Service Deployment Center "Local Git" for the web app deployed
# by deploy-infra.sh, and wires up a named git remote so `git push` is the
# release mechanism (per this project's chosen release process — there is no
# GitHub Actions workflow).
#
# Required:
#   AZURE_TENANT_ID      Azure AD tenant ID (az login --tenant).
#   AZURE_SUBSCRIPTION   Subscription ID or exact name (az account set).
#   ENVIRONMENT_NAME      Matches the environmentName used in deploy-infra.sh,
#                          used to locate infra/.deployment-outputs.<env>.json.
#
# Optional overrides (use these if you don't have an outputs file, e.g. the
# app was deployed on a different machine):
#   RESOURCE_GROUP_OVERRIDE
#   WEB_APP_NAME_OVERRIDE
#   GIT_REMOTE_NAME   Defaults to azure-<ENVIRONMENT_NAME>.
#
# The Local Git clone URL returned by Azure CLI for this command contains a
# deployment *username* (not a password) per Microsoft's documented
# behavior — see the README Azure section. This script never requests, logs,
# or stores a deployment password; git itself will prompt for the password
# (interactively, via your configured git credential manager) the first time
# you push, and macOS/Linux credential managers cache it outside this repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

require_command az "Install the Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli"
require_command git

require_env AZURE_TENANT_ID
require_env AZURE_SUBSCRIPTION
require_env ENVIRONMENT_NAME "Must match the environmentName you deployed with, e.g. prod."

log_info "Signing in to Azure AD tenant ${AZURE_TENANT_ID} (a browser window will open)..."
az login --tenant "$AZURE_TENANT_ID" --only-show-errors >/dev/null
az account set --subscription "$AZURE_SUBSCRIPTION"

RESOURCE_GROUP_NAME="${RESOURCE_GROUP_OVERRIDE:-$(read_deployment_output "$ENVIRONMENT_NAME" resourceGroupName)}"
WEB_APP_NAME="${WEB_APP_NAME_OVERRIDE:-$(read_deployment_output "$ENVIRONMENT_NAME" webAppName)}"
GIT_REMOTE_NAME="${GIT_REMOTE_NAME:-azure-${ENVIRONMENT_NAME}}"

log_info "Enabling Local Git deployment for ${WEB_APP_NAME} in ${RESOURCE_GROUP_NAME}..."

# Local Git deployment requires SCM basic auth (see infra/modules/app-service.bicep,
# which enables it explicitly). If a tenant policy has disabled basic auth
# platform-wide, this command fails — see the README "Local Git limitations"
# note for how to detect and work around that.
GIT_URL="$(az webapp deployment source config-local-git \
  --name "$WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --query url -o tsv)"

if [ -z "$GIT_URL" ]; then
  log_error "Azure CLI did not return a Local Git URL. Confirm SCM basic auth isn't disabled by tenant policy (see README)."
  exit 1
fi

if git -C "$REPO_ROOT" remote get-url "$GIT_REMOTE_NAME" >/dev/null 2>&1; then
  git -C "$REPO_ROOT" remote set-url "$GIT_REMOTE_NAME" "$GIT_URL"
  log_ok "Updated existing git remote '${GIT_REMOTE_NAME}'."
else
  git -C "$REPO_ROOT" remote add "$GIT_REMOTE_NAME" "$GIT_URL"
  log_ok "Added git remote '${GIT_REMOTE_NAME}'."
fi

log_ok "Local Git is configured."
cat >&2 <<SUMMARY

  Remote:  ${GIT_REMOTE_NAME}
  URL:     ${GIT_URL}
           (this URL carries a deployment *username* only — never a password)

Next steps:
  1. If you haven't set a deployment password yet, set one interactively
     (input is hidden by the CLI, not stored in this repo):
       az webapp deployment user set --user-name <a-username>
     Alternatively use the app-scope credentials shown under
     Deployment Center > Local Git/FTPS credentials in the Azure portal.
  2. Push to release (App Service deploys from the 'master' branch by
     default, regardless of your local default branch name):
       git push ${GIT_REMOTE_NAME} HEAD:master
     Git will prompt for the deployment password on first push and your
     OS/Git credential manager will cache it — it is never written to this
     repository.
  3. Watch the build: az webapp log tail --name ${WEB_APP_NAME} --resource-group ${RESOURCE_GROUP_NAME}
  4. Smoke test once deployed:
       ENVIRONMENT_NAME=${ENVIRONMENT_NAME} ./scripts/azure/smoke-test.sh
SUMMARY
