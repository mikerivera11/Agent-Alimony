#!/usr/bin/env bash
# Shared helpers for scripts/azure/*.sh. Not meant to be run directly.
#
# Security rules every script in this directory follows:
#  - Never print a password, connection string, or token to stdout/stderr.
#  - Never write a secret into a file this repo tracks in git.
#  - Prefer prompting via `read -rs` (or letting az/git's own interactive
#    credential flows handle it) over passing secrets as long-lived shell
#    variables that could leak into `ps`/history.
set -euo pipefail

AZURE_LIB_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${AZURE_LIB_SCRIPT_DIR}/../.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra"

color_reset=$'\033[0m'
color_red=$'\033[31m'
color_yellow=$'\033[33m'
color_green=$'\033[32m'
color_blue=$'\033[34m'

log_info()  { printf '%s[info]%s %s\n'  "$color_blue"   "$color_reset" "$1" >&2; }
log_warn()  { printf '%s[warn]%s %s\n'  "$color_yellow" "$color_reset" "$1" >&2; }
log_error() { printf '%s[error]%s %s\n' "$color_red"    "$color_reset" "$1" >&2; }
log_ok()    { printf '%s[ok]%s %s\n'    "$color_green"  "$color_reset" "$1" >&2; }

require_command() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '${cmd}' was not found on PATH."
    if [ -n "$hint" ]; then
      log_error "$hint"
    fi
    exit 1
  fi
}

require_env() {
  local name="$1"
  local hint="${2:-}"
  if [ -z "${!name:-}" ]; then
    log_error "Required environment variable ${name} is not set."
    if [ -n "$hint" ]; then
      log_error "$hint"
    fi
    exit 1
  fi
}

# Reads one output value from a saved deployment-outputs JSON file
# (infra/.deployment-outputs.<environment>.json). Never used for secret
# values — DATABASE_URL/SESSION_SIGNING_SECRET are never written to that
# file in the first place (see deploy-infra.sh), only non-secret resource
# names/URLs.
read_deployment_output() {
  local environment_name="$1"
  local output_key="$2"
  local outputs_file="${INFRA_DIR}/.deployment-outputs.${environment_name}.json"
  if [ ! -f "$outputs_file" ]; then
    log_error "Missing ${outputs_file}."
    log_error "Run scripts/azure/deploy-infra.sh first, or set the corresponding *_OVERRIDE environment variable."
    exit 1
  fi
  python3 - "$outputs_file" "$output_key" <<'PY'
import json
import sys

path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    outputs = json.load(handle)
value = outputs.get(key, {}).get("value")
if value is None:
    sys.exit(f"Output '{key}' not found in {path}")
print(value)
PY
}

confirm() {
  local prompt="$1"
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}
