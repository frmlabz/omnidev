#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"
CLI_VERSION="${2:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASES_FILE="${CASES_FILE:-tests/integration/cases.json}"

IMAGE_NODE="omnidev-it-node:local"
IMAGE_BUN="omnidev-it-bun:local"

build_images() {
  docker build -f tests/integration/docker/Dockerfile.node -t "${IMAGE_NODE}" "${ROOT_DIR}"
  docker build -f tests/integration/docker/Dockerfile.bun -t "${IMAGE_BUN}" "${ROOT_DIR}"
}

run_in_container() {
  local image="$1"
  local runner="$2"
  local mode="$3"
  local cli_version="$4"
  local exec_cmd=()
  local uid gid
  uid="$(id -u)"
  gid="$(id -g)"

  if [[ "${image}" == "${IMAGE_NODE}" ]]; then
    exec_cmd=(node tests/integration/inside/run.js)
  else
    exec_cmd=(bun tests/integration/inside/run.js)
  fi

  docker run --rm \
    --user "${uid}:${gid}" \
    -e HOME=/tmp \
    -e IT_MODE="${mode}" \
    -e IT_RUNNER="${runner}" \
    -e IT_CLI_VERSION="${cli_version}" \
    -e IT_CASES_FILE="${CASES_FILE}" \
    -v "${ROOT_DIR}:/repo" \
    -w /repo \
    "${image}" \
    "${exec_cmd[@]}"
}

build_images

case "${MODE}" in
  dev)
    run_in_container "${IMAGE_BUN}" "local" "dev" ""
    run_in_container "${IMAGE_NODE}" "local-node" "dev" ""
    ;;
  release)
    if [[ -z "${CLI_VERSION}" ]]; then
      echo "Usage: $0 release <cli-version>" >&2
      exit 2
    fi
    run_in_container "${IMAGE_NODE}" "npx" "release" "${CLI_VERSION}"
    run_in_container "${IMAGE_BUN}" "bunx" "release" "${CLI_VERSION}"
    ;;
  *)
    echo "Unknown mode: ${MODE} (expected 'dev' or 'release')" >&2
    exit 2
    ;;
esac
