#!/usr/bin/env bash
# Test: Add capability via CLI command
# Validates: omni.toml updated, capability synced after add

set -euo pipefail

# Source helpers
# shellcheck source=../inside/helpers.sh
source "${HELPERS_PATH}"

# Setup
setup_testdir "add-cap-"

info "Creating minimal omni.toml..."
create_minimal_omni_toml

info "Running init with claude-code provider..."
run_omnidev init claude-code

info "Adding capability via CLI..."
run_omnidev add cap standard --github frmlabz/omnidev --path examples/fixtures/standard

info "Validating omni.toml contains capability source..."
assert_file_contains "omni.toml" "standard"
assert_file_contains "omni.toml" "frmlabz/omnidev"

info "Validating .omni/ structure..."
assert_omni_structure

info "Validating capability synced (add command auto-syncs)..."
assert_capability_synced "standard"

info "Validating fixture markers..."
assert_marker_synced "FIXTURE_MARKER:STANDARD_SKILL"

success "02-add-capability completed successfully"
