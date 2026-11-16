#!/usr/bin/env bash
#
# Reproducible production build for this template.
#
# What it does: verify the toolchain, install from the lockfile, clear dist/,
# run the same build the CI runs, and assert the artifact exists. It never reads
# stdin and never publishes anything, so it is safe in CI and in a release job.
#
# Usage:
#   bash deploy/build.sh                  # install deps (frozen) + full build
#   bash deploy/build.sh --with-tests     # ... after running unit tests
#   bash deploy/build.sh --skip-install   # reuse an existing node_modules
#   bash deploy/build.sh --build-only     # skip type-check (CI already ran it)
#   bash deploy/build.sh --help
#
# Environment:
#   SKIP_INSTALL=1    skip pnpm install (requires node_modules)
#   FORCE_INSTALL=1   reinstall from the lockfile even when up to date
#   SKIP_TYPE_CHECK=1 build with Vite only; `pnpm type-check` must have run separately
#   STRICT_ENV=1      fail on local env overrides and on a non-absolute API base URL
#
# Exit codes: 0 success; 1 environment/build failure; 2 bad arguments.

set -Eeuo pipefail

export CI=true
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export npm_config_yes=true
exec </dev/null

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

RUN_TESTS=0
SKIP_TYPE_CHECK=0
PNPM_VERSION=""

log() { printf '[build] %s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf '[build] warn: %s\n' "$*" >&2; }
die() {
  printf '[build] error: %s\n' "$*" >&2
  exit 1
}

trap 'status=$?; printf "[build] error: command failed (line %s, exit %s)\n" "${LINENO}" "${status}" >&2' ERR

usage() {
  cat <<'USAGE'
Usage: bash deploy/build.sh [--with-tests] [--skip-install] [--build-only]

  --with-tests     run pnpm test:unit:run before building
  --skip-install   reuse the existing node_modules
  --build-only     skip the type-check bundled in `pnpm build`
  -h, --help       show this help

Environment:
  SKIP_INSTALL=1    same as --skip-install
  FORCE_INSTALL=1   force a reinstall from pnpm-lock.yaml
  SKIP_TYPE_CHECK=1 same as --build-only
  STRICT_ENV=1      fail when .env.local / .env.production.local exists, or when
                    VITE_API_BASE_URL is missing, relative, or points at localhost
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

check_node() {
  local version major minor rest
  version="$(node -p 'process.versions.node')"
  major="${version%%.*}"
  rest="${version#*.}"
  minor="${rest%%.*}"

  if (( major == 22 )); then
    (( minor >= 18 )) || die "Node.js ^22.18.0 or >=24.12.0 required (found ${version}); see .nvmrc."
  elif (( major >= 24 )); then
    if (( major == 24 && minor < 12 )); then
      die "Node.js ^22.18.0 or >=24.12.0 required (found ${version}); see .nvmrc."
    fi
  else
    die "Node.js ^22.18.0 or >=24.12.0 required (found ${version}); see .nvmrc."
  fi
}

ensure_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    command -v corepack >/dev/null 2>&1 ||
      die "pnpm is not installed and corepack is unavailable. Install pnpm 11 first."

    log "pnpm not found; enabling it through corepack"
    corepack enable >/dev/null 2>&1 || die "corepack enable failed"
  fi

  PNPM_VERSION="$(pnpm --version)" || die "cannot read the pnpm version"
  local major="${PNPM_VERSION%%.*}"
  (( major >= 11 )) || die "pnpm >= 11 required (found ${PNPM_VERSION})"
}

check_project() {
  [[ -f "${ROOT_DIR}/package.json" ]] || die "package.json not found in ${ROOT_DIR}"
  [[ -f "${ROOT_DIR}/pnpm-lock.yaml" ]] || die "pnpm-lock.yaml not found; a frozen install is impossible"
}

check_env_overrides() {
  local file
  for file in .env.local .env.production.local; do
    [[ -f "${ROOT_DIR}/${file}" ]] || continue

    if [[ "${STRICT_ENV:-0}" == "1" ]]; then
      die "${file} exists and STRICT_ENV=1; local overrides must not enter a release build"
    fi
    warn "${file} exists and will be compiled into this build"
  done
}

# Resolve VITE_API_BASE_URL the way Vite would: shell environment first, then the
# env files in increasing precedence. Only `.env.example` is committed, so a
# missing value means the template default (`/api`) is in effect.
resolve_api_base_url() {
  local value="${VITE_API_BASE_URL:-}"
  local file line

  for file in .env .env.production .env.local .env.production.local; do
    [[ -f "${ROOT_DIR}/${file}" ]] || continue
    line="$(grep -E '^[[:space:]]*VITE_API_BASE_URL[[:space:]]*=' "${ROOT_DIR}/${file}" | tail -n 1 || true)"
    [[ -n "${line}" ]] || continue
    value="${line#*=}"
    value="${value%%#*}"
    value="$(printf '%s' "${value}" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')"
  done

  printf '%s' "${value}"
}

# A release build that silently ships a relative or loopback API base URL is the
# most expensive configuration mistake in this template: the artifact builds, the
# page loads, and every request fails in production. Warn by default so local
# `bash deploy/build.sh` still works; fail under STRICT_ENV=1 (release pipelines).
check_api_base_url() {
  local base
  base="$(resolve_api_base_url)"

  if [[ -z "${base}" ]]; then
    warn "VITE_API_BASE_URL is not set; the build falls back to '/api' (same-origin reverse proxy expected)"
    [[ "${STRICT_ENV:-0}" == "1" ]] && die "STRICT_ENV=1 requires an explicit VITE_API_BASE_URL"
    return 0
  fi

  if [[ "${base}" =~ ^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$) ]]; then
    warn "VITE_API_BASE_URL points at a loopback host: ${base}"
    [[ "${STRICT_ENV:-0}" == "1" ]] && die "STRICT_ENV=1 rejects a loopback VITE_API_BASE_URL"
    return 0
  fi

  if [[ ! "${base}" =~ ^https?:// ]]; then
    warn "VITE_API_BASE_URL is not an absolute URL: ${base} (same-origin reverse proxy expected)"
    [[ "${STRICT_ENV:-0}" == "1" ]] && die "STRICT_ENV=1 requires an absolute VITE_API_BASE_URL"
    return 0
  fi

  log "API base: ${base}"
}

install_deps() {
  if [[ "${SKIP_INSTALL:-0}" == "1" ]]; then
    log "SKIP_INSTALL=1: skipping pnpm install"
    [[ -d "${ROOT_DIR}/node_modules" ]] || die "node_modules is missing; cannot skip the install"
    [[ -x "${ROOT_DIR}/node_modules/.bin/vite" ]] || die "node_modules has no vite binary; install is incomplete"
    return
  fi

  local args=(--frozen-lockfile)
  if [[ "${FORCE_INSTALL:-0}" == "1" ]]; then
    args+=(--force)
  fi

  step "Install dependencies (pnpm install ${args[*]})"
  ( cd "$ROOT_DIR" && pnpm install "${args[@]}" )
}

run_tests() {
  (( RUN_TESTS )) || return 0

  step "Run unit tests"
  ( cd "$ROOT_DIR" && pnpm run test:unit:run )
}

build_app() {
  step "Clean dist/"
  rm -rf -- "${ROOT_DIR}/dist"

  if [[ "${SKIP_TYPE_CHECK:-0}" == "1" ]]; then
    step "Build (Vite only; type-check must have run separately)"
    ( cd "$ROOT_DIR" && pnpm run build-only )
  else
    step "Build (type-check + Vite production build)"
    ( cd "$ROOT_DIR" && pnpm run build )
  fi

  [[ -f "${ROOT_DIR}/dist/index.html" ]] || die "build produced no dist/index.html"
  [[ -d "${ROOT_DIR}/dist/assets" ]] || die "build produced no dist/assets"
}

main() {
  while (( $# > 0 )); do
    case "$1" in
      --with-tests) RUN_TESTS=1 ;;
      --skip-install) export SKIP_INSTALL=1 ;;
      --build-only) export SKIP_TYPE_CHECK=1 ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        printf '\n[build] error: unknown argument: %s\n' "$1" >&2
        exit 2
        ;;
    esac
    shift
  done

  step "Check environment"
  require_cmd node
  check_node
  ensure_pnpm
  check_project
  log "node $(node -v), pnpm ${PNPM_VERSION}"
  log "project: ${ROOT_DIR}"

  check_env_overrides
  check_api_base_url
  install_deps
  run_tests
  build_app

  step "Done"
  printf '  artifact: %s/dist\n' "$ROOT_DIR"
  printf '  publish:  bash deploy/publish.sh   (or serve dist/ with the SPA fallback in deploy/nginx.conf)\n'
}

main "$@"
