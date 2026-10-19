#!/usr/bin/env bash
# Builds Next.js locally and deploys its standalone artifact through Azure's
# ARM-authenticated ZipDeploy endpoint. No publishing password is required.
#
# Required:
#   AZURE_TENANT_ID
#   AZURE_SUBSCRIPTION
#   ENVIRONMENT_NAME
#
# Optional:
#   RESOURCE_GROUP_OVERRIDE
#   WEB_APP_NAME_OVERRIDE
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

require_command az "Install the Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli"
require_command npm
require_command zip

require_env AZURE_TENANT_ID
require_env AZURE_SUBSCRIPTION
require_env ENVIRONMENT_NAME "Must match the environment deployed by deploy-infra.sh, e.g. prod."

log_info "Signing in to Azure AD tenant ${AZURE_TENANT_ID}..."
az login --tenant "$AZURE_TENANT_ID" --only-show-errors >/dev/null
az account set --subscription "$AZURE_SUBSCRIPTION"

RESOURCE_GROUP_NAME="${RESOURCE_GROUP_OVERRIDE:-$(read_deployment_output "$ENVIRONMENT_NAME" resourceGroupName)}"
WEB_APP_NAME="${WEB_APP_NAME_OVERRIDE:-$(read_deployment_output "$ENVIRONMENT_NAME" webAppName)}"

WORK_DIR="$(mktemp -d)"
STAGING_DIR="${WORK_DIR}/standalone"
ZIP_PATH="${WORK_DIR}/florida-support-guide.zip"
mkdir -p "$STAGING_DIR"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

log_info "Installing locked dependencies and building the production application..."
(
  cd "$REPO_ROOT"
  npm ci
  npm run build
)

if [ ! -f "${REPO_ROOT}/.next/standalone/server.js" ]; then
  log_error "Next.js did not produce .next/standalone/server.js."
  exit 1
fi

log_info "Packaging the standalone server..."
cp -R "${REPO_ROOT}/.next/standalone/." "$STAGING_DIR/"
mkdir -p "${STAGING_DIR}/.next/static"
cp -R "${REPO_ROOT}/.next/static/." "${STAGING_DIR}/.next/static/"
if [ -d "${REPO_ROOT}/public" ]; then
  cp -R "${REPO_ROOT}/public" "${STAGING_DIR}/public"
fi
(cd "$STAGING_DIR" && zip -qr "$ZIP_PATH" .)

log_info "Deploying the prebuilt package to ${WEB_APP_NAME}..."
az webapp config appsettings set \
  --name "$WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  --only-show-errors >/dev/null
az webapp config set \
  --name "$WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --startup-file "node server.js" \
  --only-show-errors >/dev/null
az webapp deploy \
  --name "$WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --src-path "$ZIP_PATH" \
  --type zip \
  --clean true \
  --restart true \
  --track-status true \
  --timeout 900000 \
  --only-show-errors >/dev/null

log_ok "Deployment completed. Running smoke tests..."
BASE_URL="https://${WEB_APP_NAME}.azurewebsites.net" "${SCRIPT_DIR}/smoke-test.sh"
