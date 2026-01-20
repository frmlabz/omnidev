#!/usr/bin/env bash
# Integration test helpers for OmniDev
# Provides common assertions and utilities for test cases

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test directory (set by setup_testdir)
TEST_DIR=""
OMNIDEV="${OMNIDEV:-}"

# ============================================================================
# Setup and Teardown
# ============================================================================

# Create an isolated temp directory and set up cleanup trap
# Usage: setup_testdir
setup_testdir() {
  local prefix="${1:-omnidev-it-}"
  TEST_DIR="$(mktemp -d "/tmp/${prefix}XXXXXX")"
  cd "$TEST_DIR"

  # Set up cleanup trap
  trap cleanup EXIT

  echo "Test directory: $TEST_DIR"
}

# Cleanup function called on exit
cleanup() {
  if [[ -n "$TEST_DIR" && -d "$TEST_DIR" ]]; then
    rm -rf "$TEST_DIR"
  fi
}

# ============================================================================
# CLI Wrapper
# ============================================================================

# Run omnidev CLI command
# Usage: run_omnidev <args...>
# Returns: exit code from command
# Outputs: stdout/stderr passed through
run_omnidev() {
  if [[ -z "$OMNIDEV" ]]; then
    fail "OMNIDEV environment variable not set"
  fi

  # OMNIDEV contains the full command (e.g., "bun /repo/packages/cli/dist/index.js")
  # shellcheck disable=SC2086
  $OMNIDEV "$@"
}

# ============================================================================
# Assertions
# ============================================================================

# Fail the test with a message
# Usage: fail <message>
fail() {
  echo -e "${RED}FAIL: $1${NC}" >&2
  exit 1
}

# Assert a file exists
# Usage: assert_file_exists <path>
assert_file_exists() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    fail "Expected file to exist: $path"
  fi
}

# Assert a file does not exist
# Usage: assert_file_not_exists <path>
assert_file_not_exists() {
  local path="$1"
  if [[ -f "$path" ]]; then
    fail "Expected file to not exist: $path"
  fi
}

# Assert a directory exists
# Usage: assert_dir_exists <path>
assert_dir_exists() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    fail "Expected directory to exist: $path"
  fi
}

# Assert a file contains a string
# Usage: assert_file_contains <path> <substring>
assert_file_contains() {
  local path="$1"
  local substring="$2"

  if [[ ! -f "$path" ]]; then
    fail "File does not exist: $path"
  fi

  if ! grep -q "$substring" "$path"; then
    fail "Expected file '$path' to contain: $substring"
  fi
}

# Assert a file does not contain a string
# Usage: assert_file_not_contains <path> <substring>
assert_file_not_contains() {
  local path="$1"
  local substring="$2"

  if [[ ! -f "$path" ]]; then
    fail "File does not exist: $path"
  fi

  if grep -q "$substring" "$path"; then
    fail "Expected file '$path' to NOT contain: $substring"
  fi
}

# Assert command succeeds (exit code 0)
# Usage: assert_success <command...>
assert_success() {
  if ! "$@"; then
    fail "Command failed: $*"
  fi
}

# Assert command fails (non-zero exit code)
# Usage: assert_failure <command...>
assert_failure() {
  if "$@"; then
    fail "Command should have failed: $*"
  fi
}

# Assert string equality
# Usage: assert_eq <expected> <actual> [message]
assert_eq() {
  local expected="$1"
  local actual="$2"
  local message="${3:-}"

  if [[ "$expected" != "$actual" ]]; then
    if [[ -n "$message" ]]; then
      fail "$message: expected '$expected', got '$actual'"
    else
      fail "Expected '$expected', got '$actual'"
    fi
  fi
}

# Assert string contains substring
# Usage: assert_contains <haystack> <needle>
assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" != *"$needle"* ]]; then
    fail "Expected string to contain '$needle' in: $haystack"
  fi
}

# ============================================================================
# OmniDev-specific Assertions
# ============================================================================

# Assert .omni/ directory structure is valid
# Usage: assert_omni_structure
assert_omni_structure() {
  assert_dir_exists ".omni"
  assert_dir_exists ".omni/capabilities"
  # State directory is created on first state write (e.g., profile set)
  # Note: .omni/instructions.md is no longer created - instructions are embedded directly
  # into provider-specific files (CLAUDE.md, AGENTS.md, etc.)
}

# Assert a capability is synced (has directory with capability.toml)
# Usage: assert_capability_synced <name>
assert_capability_synced() {
  local name="$1"
  local cap_dir=".omni/capabilities/$name"

  assert_dir_exists "$cap_dir"
  assert_file_exists "$cap_dir/capability.toml"
}

# Assert a capability is NOT synced
# Usage: assert_capability_not_synced <name>
assert_capability_not_synced() {
  local name="$1"
  local cap_dir=".omni/capabilities/$name"

  if [[ -d "$cap_dir" ]]; then
    fail "Expected capability '$name' to not be synced, but found: $cap_dir"
  fi
}

# Assert MCP server is in .mcp.json
# Usage: assert_mcp_in_config <name>
assert_mcp_in_config() {
  local name="$1"

  assert_file_exists ".mcp.json"

  # Check if mcpServers contains the server name
  if ! grep -q "\"$name\"" ".mcp.json"; then
    fail "Expected .mcp.json to contain MCP server: $name"
  fi
}

# Assert MCP server is NOT in .mcp.json
# Usage: assert_mcp_not_in_config <name>
assert_mcp_not_in_config() {
  local name="$1"

  if [[ -f ".mcp.json" ]] && grep -q "\"$name\"" ".mcp.json"; then
    fail "Expected .mcp.json to NOT contain MCP server: $name"
  fi
}

# Assert fixture marker is present in any synced file
# Usage: assert_marker_synced <marker>
assert_marker_synced() {
  local marker="$1"

  # Search in .omni/ and provider-specific directories
  local found=false

  for search_root in .omni CLAUDE.md .claude .cursor .opencode AGENTS.md .mcp.json; do
    if [[ -e "$search_root" ]]; then
      if grep -r -q "$marker" "$search_root" 2>/dev/null; then
        found=true
        break
      fi
    fi
  done

  if [[ "$found" != "true" ]]; then
    fail "Expected to find marker '$marker' in synced output"
  fi
}

# Assert CLAUDE.md exists (for claude-code provider)
# Usage: assert_claude_md_exists
assert_claude_md_exists() {
  assert_file_exists "CLAUDE.md"
}

# Assert OMNI.md exists
# Usage: assert_omni_md_exists
assert_omni_md_exists() {
  assert_file_exists "OMNI.md"
}

# Assert CLAUDE.md is generated from OMNI.md (contains OMNI.md content)
# Usage: assert_claude_md_generated_from_omni
assert_claude_md_generated_from_omni() {
  assert_file_exists "CLAUDE.md"
  # Check that OMNI.md content is present (# Project Instructions is from OMNI.md template)
  assert_file_contains "CLAUDE.md" "# Project Instructions"
}

# Assert OMNI.md content is reflected in CLAUDE.md
# Usage: assert_omni_content_in_claude <content>
assert_omni_content_in_claude() {
  local content="$1"
  assert_file_exists "OMNI.md"
  assert_file_exists "CLAUDE.md"

  # Check that the content from OMNI.md appears in CLAUDE.md
  if grep -q "$content" "OMNI.md"; then
    if ! grep -q "$content" "CLAUDE.md"; then
      fail "Expected CLAUDE.md to contain content from OMNI.md: $content"
    fi
  fi
}

# Assert omni.toml contains capability source
# Usage: assert_capability_source_in_config <name>
assert_capability_source_in_config() {
  local name="$1"

  assert_file_exists "omni.toml"

  if ! grep -q "\\[$name\\]\\|$name\\s*=" "omni.toml" && ! grep -q "sources\\.$name" "omni.toml"; then
    # Check if it's defined in capabilities.sources section
    if ! grep -A1 "\\[capabilities.sources\\]" "omni.toml" | grep -q "$name"; then
      fail "Expected omni.toml to contain capability source: $name"
    fi
  fi
}

# ============================================================================
# Utilities
# ============================================================================

# Print success message
# Usage: success <message>
success() {
  echo -e "${GREEN}$1${NC}"
}

# Print info message
# Usage: info <message>
info() {
  echo -e "${YELLOW}$1${NC}"
}

# Create a minimal omni.toml
# Usage: create_minimal_omni_toml
create_minimal_omni_toml() {
  cat > omni.toml << 'EOF'
[capabilities.sources]

[profiles.default]
capabilities = []
EOF
}

# Create omni.toml with a single capability source
# Usage: create_omni_toml_with_capability <name> <source>
create_omni_toml_with_capability() {
  local name="$1"
  local source="$2"

  cat > omni.toml << EOF
[capabilities.sources]
$name = "$source"

[profiles.default]
capabilities = ["$name"]
EOF
}

# Create omni.toml with the standard fixture
# Usage: create_standard_fixture_toml
create_standard_fixture_toml() {
  cat > omni.toml << 'EOF'
[capabilities.sources]
standard = { source = "github:Nikola-Milovic/omnidev", path = "examples/fixtures/standard" }

[profiles.default]
capabilities = ["standard"]
EOF
}

# Create omni.toml with multiple profiles
# Usage: create_multi_profile_toml
create_multi_profile_toml() {
  cat > omni.toml << 'EOF'
[capabilities.sources]
standard = { source = "github:Nikola-Milovic/omnidev", path = "examples/fixtures/standard" }
claude-plugin = { source = "github:Nikola-Milovic/omnidev", path = "examples/fixtures/claude-plugin" }

[profiles.default]
capabilities = ["standard"]

[profiles.work]
capabilities = ["standard", "claude-plugin"]
EOF
}
