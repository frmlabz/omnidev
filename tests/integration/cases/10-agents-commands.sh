#!/usr/bin/env bash
# Test: Agents and commands sync for Claude Code, Cursor, Codex, and OpenCode
# Validates: subagents -> .claude/agents/, commands -> .claude/skills/ (claude)
#            subagents -> .cursor/agents/, commands -> .cursor/commands/ (cursor)
#            subagents -> .codex/agents/, commands -> .codex/skills/ (codex)
#            subagents -> .opencode/agents/, commands -> .opencode/commands/ (opencode)

set -euo pipefail

# Source helpers
# shellcheck source=../inside/helpers.sh
source "${HELPERS_PATH}"

# Setup
setup_testdir "agents-commands-"

info "Creating omni.toml with standard fixture..."
create_standard_fixture_toml

# ============================================================================
# Test 1: Claude Code provider
# ============================================================================
info "Testing Claude Code provider..."

run_omnidev init claude-code
run_omnidev sync

info "Validating .omni/ structure..."
assert_omni_structure

info "Validating CLAUDE.md exists..."
assert_claude_md_exists

info "Validating subagent synced to .claude/agents/..."
assert_file_exists ".claude/agents/code-reviewer.md"
assert_file_contains ".claude/agents/code-reviewer.md" "name: code-reviewer"
assert_file_contains ".claude/agents/code-reviewer.md" "description: \"Reviews code for quality and best practices\""
assert_file_contains ".claude/agents/code-reviewer.md" "tools: Read, Glob, Grep"
assert_file_contains ".claude/agents/code-reviewer.md" "model: sonnet"
assert_file_contains ".claude/agents/code-reviewer.md" "permissionMode: acceptEdits"
assert_file_contains ".claude/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating command synced as skill to .claude/skills/..."
assert_file_exists ".claude/skills/review-pr/SKILL.md"
assert_file_contains ".claude/skills/review-pr/SKILL.md" "name: review-pr"
assert_file_contains ".claude/skills/review-pr/SKILL.md" "description: \"Review a pull request for issues and improvements\""
assert_file_contains ".claude/skills/review-pr/SKILL.md" "allowed_tools:"
assert_file_contains ".claude/skills/review-pr/SKILL.md" "FIXTURE_MARKER:STANDARD_COMMAND"

success "Claude Code agents and commands test passed"

# ============================================================================
# Test 2: Cursor provider
# ============================================================================
info "Testing Cursor provider..."

# Clean up Claude Code files and switch to Cursor
rm -rf .claude CLAUDE.md

run_omnidev provider enable cursor
run_omnidev provider disable claude-code
run_omnidev sync

info "Validating CLAUDE.md exists (Cursor uses CLAUDE.md)..."
assert_file_exists "CLAUDE.md"

info "Validating subagent synced to .cursor/agents/..."
assert_file_exists ".cursor/agents/code-reviewer.md"
assert_file_contains ".cursor/agents/code-reviewer.md" "name: code-reviewer"
assert_file_contains ".cursor/agents/code-reviewer.md" "description: \"Reviews code for quality and best practices\""
# Cursor maps 'sonnet' to 'inherit'
assert_file_contains ".cursor/agents/code-reviewer.md" "model: inherit"
assert_file_contains ".cursor/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating command synced to .cursor/commands/..."
assert_file_exists ".cursor/commands/review-pr.md"
# Cursor commands are plain markdown with heading
assert_file_contains ".cursor/commands/review-pr.md" "# review-pr"
assert_file_contains ".cursor/commands/review-pr.md" "FIXTURE_MARKER:STANDARD_COMMAND"

success "Cursor agents and commands test passed"

# ============================================================================
# Test 3: Codex provider
# ============================================================================
info "Testing Codex provider..."

# Clean up Cursor files and switch to Codex
rm -rf .cursor CLAUDE.md

run_omnidev provider enable codex
run_omnidev provider disable cursor
run_omnidev sync

info "Validating AGENTS.md exists..."
assert_file_exists "AGENTS.md"

info "Validating subagent synced to .codex/agents/..."
assert_file_exists ".codex/agents/code-reviewer.toml"
assert_file_contains ".codex/agents/code-reviewer.toml" "name = \"code-reviewer\""
assert_file_contains ".codex/agents/code-reviewer.toml" "description = \"Reviews code for quality and best practices\""
assert_file_contains ".codex/agents/code-reviewer.toml" "developer_instructions = "
assert_file_contains ".codex/agents/code-reviewer.toml" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating command synced as skill to .codex/skills/..."
assert_file_exists ".codex/skills/review-pr/SKILL.md"
assert_file_contains ".codex/skills/review-pr/SKILL.md" "name: review-pr"
assert_file_contains ".codex/skills/review-pr/SKILL.md" "description: \"Review a pull request for issues and improvements\""
assert_file_contains ".codex/skills/review-pr/SKILL.md" "FIXTURE_MARKER:STANDARD_COMMAND"

success "Codex agents and commands test passed"

# ============================================================================
# Test 4: OpenCode provider
# ============================================================================
info "Testing OpenCode provider..."

# Clean up Codex files and switch to OpenCode
rm -rf .codex AGENTS.md

run_omnidev provider enable opencode
run_omnidev provider disable codex
run_omnidev sync

info "Validating AGENTS.md exists..."
assert_file_exists "AGENTS.md"

info "Validating subagent synced to .opencode/agents/..."
assert_file_exists ".opencode/agents/code-reviewer.md"
assert_file_contains ".opencode/agents/code-reviewer.md" "description: \"Reviews code for quality and best practices\""
# OpenCode maps 'sonnet' to full model ID
assert_file_contains ".opencode/agents/code-reviewer.md" "model: anthropic/claude-sonnet-4"
# OpenCode uses object format for tools
assert_file_contains ".opencode/agents/code-reviewer.md" "tools:"
assert_file_contains ".opencode/agents/code-reviewer.md" "read: true"
assert_file_contains ".opencode/agents/code-reviewer.md" "glob: true"
assert_file_contains ".opencode/agents/code-reviewer.md" "grep: true"
# OpenCode maps permission modes
assert_file_contains ".opencode/agents/code-reviewer.md" "permissions:"
assert_file_contains ".opencode/agents/code-reviewer.md" "edit: allow"
assert_file_contains ".opencode/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating command synced to .opencode/commands/..."
assert_file_exists ".opencode/commands/review-pr.md"
assert_file_contains ".opencode/commands/review-pr.md" "description: \"Review a pull request for issues and improvements\""
assert_file_contains ".opencode/commands/review-pr.md" "FIXTURE_MARKER:STANDARD_COMMAND"

success "OpenCode agents and commands test passed"

# ============================================================================
# Test 5: All four providers enabled
# ============================================================================
info "Testing all four providers enabled..."

run_omnidev provider enable claude-code
run_omnidev provider enable cursor
run_omnidev provider enable codex
run_omnidev sync

info "Validating both CLAUDE.md and AGENTS.md exist..."
assert_file_exists "CLAUDE.md"
assert_file_exists "AGENTS.md"

info "Validating Claude Code agents..."
assert_file_exists ".claude/agents/code-reviewer.md"
assert_file_contains ".claude/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating Cursor agents..."
assert_file_exists ".cursor/agents/code-reviewer.md"
assert_file_contains ".cursor/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating Codex agents..."
assert_file_exists ".codex/agents/code-reviewer.toml"
assert_file_contains ".codex/agents/code-reviewer.toml" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating OpenCode agents..."
assert_file_exists ".opencode/agents/code-reviewer.md"
assert_file_contains ".opencode/agents/code-reviewer.md" "FIXTURE_MARKER:STANDARD_SUBAGENT"

info "Validating Claude Code commands as skills..."
assert_file_exists ".claude/skills/review-pr/SKILL.md"
assert_file_contains ".claude/skills/review-pr/SKILL.md" "FIXTURE_MARKER:STANDARD_COMMAND"

info "Validating Cursor commands..."
assert_file_exists ".cursor/commands/review-pr.md"
assert_file_contains ".cursor/commands/review-pr.md" "FIXTURE_MARKER:STANDARD_COMMAND"

info "Validating Codex commands as skills..."
assert_file_exists ".codex/skills/review-pr/SKILL.md"
assert_file_contains ".codex/skills/review-pr/SKILL.md" "FIXTURE_MARKER:STANDARD_COMMAND"

info "Validating OpenCode commands..."
assert_file_exists ".opencode/commands/review-pr.md"
assert_file_contains ".opencode/commands/review-pr.md" "FIXTURE_MARKER:STANDARD_COMMAND"

success "10-agents-commands completed successfully"
