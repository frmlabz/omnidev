#!/usr/bin/env bash
# Test: Full comprehensive workflow
# Validates: Multiple iterations of init, sync, add, profile, capability, and mcp commands

set -euo pipefail

# Source helpers
# shellcheck source=../inside/helpers.sh
source "${HELPERS_PATH}"

# Setup
setup_testdir "full-workflow-"

# ============================================================================
# Step 1: Version check
# ============================================================================
info "Step 1: Version check..."
version_output=$(run_omnidev --version || true)
info "CLI version: $version_output"

# ============================================================================
# Step 2: Create initial omni.toml with 2 profiles and 2 capability sources
# ============================================================================
info "Step 2: Creating initial omni.toml..."
cat > omni.toml << 'EOF'
[capabilities.sources]
standard = { source = "github:frmlabz/omnidev", path = "examples/fixtures/standard" }
claude-plugin = { source = "github:frmlabz/omnidev", path = "examples/fixtures/claude-plugin" }

[profiles.default]
capabilities = ["standard"]

[profiles.work]
capabilities = ["standard", "claude-plugin"]
EOF

# ============================================================================
# Step 3: Init with claude-code
# ============================================================================
info "Step 3: Running init with claude-code..."
run_omnidev init claude-code

# ============================================================================
# Step 4: Validate OMNI.md created
# ============================================================================
info "Step 4: Validating OMNI.md created..."
assert_omni_md_exists
assert_file_contains "OMNI.md" "# Project Instructions"

# ============================================================================
# Step 4b: Doctor check
# ============================================================================
info "Step 4b: Running doctor check..."
run_omnidev doctor

# ============================================================================
# Step 5: Sync
# ============================================================================
info "Step 5: Running sync..."
run_omnidev sync
assert_omni_structure
assert_capability_synced "standard"

# ============================================================================
# Step 6: Add third capability via CLI
# ============================================================================
info "Step 6: Adding third capability via CLI..."
run_omnidev add cap bare-skills --github frmlabz/omnidev --path examples/fixtures/bare-skills

# ============================================================================
# Step 7: Capability list - verify 3 capabilities
# ============================================================================
info "Step 7: Listing capabilities..."
cap_output=$(run_omnidev capability list)
assert_contains "$cap_output" "standard"
assert_contains "$cap_output" "claude-plugin"
assert_contains "$cap_output" "bare-skills"

# ============================================================================
# Step 8: Sync again
# ============================================================================
info "Step 8: Running sync again..."
run_omnidev sync

# ============================================================================
# Step 9: Profile list - verify both profiles
# ============================================================================
info "Step 9: Listing profiles..."
profile_output=$(run_omnidev profile list)
assert_contains "$profile_output" "default"
assert_contains "$profile_output" "work"

# ============================================================================
# Step 10: Switch to work profile
# ============================================================================
info "Step 10: Switching to work profile..."
run_omnidev profile set work

# ============================================================================
# Step 11: Sync
# ============================================================================
info "Step 11: Running sync..."
run_omnidev sync
assert_capability_synced "claude-plugin"

# ============================================================================
# Step 12: Capability disable (standard)
# ============================================================================
info "Step 12: Disabling standard capability..."
run_omnidev capability disable standard

# ============================================================================
# Step 13: Sync
# ============================================================================
info "Step 13: Running sync..."
run_omnidev sync

# ============================================================================
# Step 14: Capability enable (standard)
# ============================================================================
info "Step 14: Re-enabling standard capability..."
run_omnidev capability enable standard

# ============================================================================
# Step 15: Sync
# ============================================================================
info "Step 15: Running sync..."
run_omnidev sync

# ============================================================================
# Step 16: Add MCP server (stdio)
# ============================================================================
info "Step 16: Adding stdio MCP server..."
run_omnidev add mcp local-mcp --command echo --args "hello"

# ============================================================================
# Step 17: Sync
# ============================================================================
info "Step 17: Running sync..."
run_omnidev sync

# ============================================================================
# Step 18: Add another MCP server (http)
# ============================================================================
info "Step 18: Adding HTTP MCP server..."
run_omnidev add mcp remote-mcp --transport http --url "https://example.com/mcp"

# ============================================================================
# Step 19: Sync
# ============================================================================
info "Step 19: Running sync..."
run_omnidev sync

# ============================================================================
# Step 20: Switch back to default profile
# ============================================================================
info "Step 20: Switching back to default profile..."
run_omnidev profile set default

# ============================================================================
# Step 21: Sync
# ============================================================================
info "Step 21: Running sync..."
run_omnidev sync

# ============================================================================
# Step 22: Add fourth capability via CLI
# ============================================================================
info "Step 22: Adding fourth capability (demo-mcp)..."
# Note: demo-mcp may not have a capability.toml, so we use a known fixture
# For this test, we'll verify omni.toml is updated
run_omnidev add cap extra-cap --github frmlabz/omnidev --path examples/fixtures/standard
# This will fail if same name, so we use a unique name

# ============================================================================
# Step 23: Capability list - verify capabilities visible
# ============================================================================
info "Step 23: Listing capabilities..."
cap_output=$(run_omnidev capability list)
assert_contains "$cap_output" "standard"
# extra-cap uses same fixture as standard, so ID is "standard" not "extra-cap"
# Verify it's in omni.toml instead (done in step 30)

# ============================================================================
# Step 24: Switch to work profile again
# ============================================================================
info "Step 24: Switching to work profile..."
run_omnidev profile set work

# ============================================================================
# Step 25: Capability disable (claude-plugin)
# ============================================================================
info "Step 25: Disabling claude-plugin capability..."
run_omnidev capability disable claude-plugin

# ============================================================================
# Step 26: Capability enable (claude-plugin)
# ============================================================================
info "Step 26: Re-enabling claude-plugin capability..."
run_omnidev capability enable claude-plugin

# ============================================================================
# Step 27: Profile set default
# ============================================================================
info "Step 27: Setting default profile..."
run_omnidev profile set default

# ============================================================================
# Step 27b: Modify OMNI.md and verify regeneration
# ============================================================================
info "Step 27b: Testing OMNI.md -> CLAUDE.md regeneration..."

# Add custom content to OMNI.md
echo "" >> OMNI.md
echo "## Custom Project Section" >> OMNI.md
echo "This is a custom section added to test regeneration." >> OMNI.md

# Sync to regenerate CLAUDE.md
run_omnidev sync

# Verify the custom content appears in CLAUDE.md
assert_file_contains "CLAUDE.md" "Custom Project Section"
assert_file_contains "CLAUDE.md" "custom section added to test regeneration"

# ============================================================================
# Step 28: Final sync
# ============================================================================
info "Step 28: Running final sync..."
run_omnidev sync

# ============================================================================
# Step 29: Final doctor check
# ============================================================================
info "Step 29: Running final doctor check..."
run_omnidev doctor

# ============================================================================
# Step 30: Comprehensive validation
# ============================================================================
info "Step 30: Running comprehensive validation..."

info "  - Validating .omni/ structure..."
assert_omni_structure

info "  - Validating standard capability synced..."
assert_capability_synced "standard"

info "  - Validating MCPs exist in omni.toml (not in .mcp.json since we're in default profile)..."
assert_file_contains "omni.toml" "local-mcp"
assert_file_contains "omni.toml" "remote-mcp"

info "  - Validating fixture markers..."
assert_marker_synced "FIXTURE_MARKER:STANDARD_SKILL"
assert_marker_synced "FIXTURE_MARKER:STANDARD_RULE"

info "  - Validating OMNI.md exists..."
assert_omni_md_exists

info "  - Validating CLAUDE.md exists and is generated from OMNI.md..."
assert_claude_md_exists
assert_claude_md_generated_from_omni

info "  - Validating CLAUDE.md contains OMNI.md content..."
assert_omni_content_in_claude "# Project Instructions"

info "  - Validating omni.toml contains all capability sources..."
assert_file_contains "omni.toml" "standard"
assert_file_contains "omni.toml" "claude-plugin"
assert_file_contains "omni.toml" "bare-skills"
assert_file_contains "omni.toml" "extra-cap"

info "  - Validating omni.toml contains MCP configs..."
assert_file_contains "omni.toml" "local-mcp"
assert_file_contains "omni.toml" "remote-mcp"

success "07-full-workflow completed successfully - all steps passed!"
