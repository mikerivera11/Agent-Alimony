#!/usr/bin/env bash
# scripts/azure/smoke-test.sh
#
# Minimal post-deploy smoke test: confirms the deployed app answers on
# /api/health, /, /documents, and /results. Sends no case data, no
# credentials, and no request bodies — GET requests only, and it only
# reports HTTP status codes and (for /api/health) the JSON status/version
# fields, never full response bodies.
#
# Usage:
#   ENVIRONMENT_NAME=prod ./scripts/azure/smoke-test.sh
# or, without an outputs file:
#   BASE_URL=https://myapp.azurewebsites.net ./scripts/azure/smoke-test.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

require_command curl

if [ -z "${BASE_URL:-}" ]; then
  require_env ENVIRONMENT_NAME "Set ENVIRONMENT_NAME to read infra/.deployment-outputs.<env>.json, or set BASE_URL directly."
  BASE_URL="$(read_deployment_output "$ENVIRONMENT_NAME" webAppUrl)"
fi
BASE_URL="${BASE_URL%/}"

log_info "Smoke testing ${BASE_URL} ..."

failures=0

check_status() {
  local path="$1"
  local expected="$2"
  local url="${BASE_URL}${path}"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo "000")"
  if [ "$status" = "$expected" ]; then
    log_ok "GET ${path} -> ${status}"
  else
    log_error "GET ${path} -> ${status} (expected ${expected})"
    failures=$((failures + 1))
  fi
}

# /api/health: also confirm it reports the minimal, expected shape.
health_body="$(curl -sS --max-time 15 "${BASE_URL}/api/health" || true)"
health_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${BASE_URL}/api/health" || echo "000")"
if [ "$health_status" = "200" ] && printf '%s' "$health_body" | grep -q '"status":"ok"'; then
  log_ok "GET /api/health -> 200 (status: ok)"
else
  log_error "GET /api/health -> ${health_status} (expected 200 with status: ok)"
  failures=$((failures + 1))
fi

check_status "/" "200"
check_status "/documents" "200"
check_status "/results" "200"

if [ "$failures" -gt 0 ]; then
  log_error "${failures} smoke check(s) failed."
  exit 1
fi

log_ok "All smoke checks passed."
