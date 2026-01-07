# OmniDev Product Specification

> **Status**: MVP Draft v0.5
> **Last Updated**: 2026-01-07

## Vision

OmniDev is a meta-MCP that eliminates context bloat by exposing only **2 tools** to the LLM while providing access to unlimited power through a sandboxed coding environment. **Capabilities** are the fundamental building blocks—plugins that add MCPs, custom functionality, documentation, or workflows—all exposed as callable functions in the sandbox.

**The Core Insight**: Most agents use MCP by directly exposing "tools" to the LLM. We do something different: we convert MCP tools (and everything else) into a **programmable API** (Python/TypeScript), and ask the LLM to write code that calls that API.

> *Reference: Inspired by Cloudflare's "Code Mode". LLMs are often better at writing code to call tools than calling tools directly. This approach allows stringing together multiple calls, looping, and logic without round-trips.*

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Architecture Overview](#architecture-overview)
3. [The Two MCP Tools](#the-two-mcp-tools)
4. [Capabilities System](#capabilities-system)
5. [Sandbox Environment](#sandbox-environment)
6. [Git Safety Layer](#git-safety-layer)
7. [Directory Structure](#directory-structure)
8. [Configuration System](#configuration-system)
9. [Profiles System](#profiles-system)
10. [Task & Plan Management](#task--plan-management)
11. [CLI Interface](#cli-interface)
12. [Demo Scenarios](#demo-scenarios)
13. [Technical Notes](#technical-notes)
14. [Future Features](#future-features)

---

## Core Concepts

### The Problem

1.  **Context Bloat**: Loading 10 MCPs = 100+ tool definitions in context.
2.  **Inefficient Execution**: Traditional agents need a round-trip for every tool call.
3.  **Rigid Tooling**: Tools are static; they don't adapt to project phases (planning vs. coding).
4.  **Unsafe File Access**: LLMs can make destructive changes without safety nets.

### The Solution: "Everything is a Capability"

OmniDev wraps every piece of functionality into a **Capability**.

*   **MCPs → Code**: An AWS MCP becomes `aws.*` functions in the sandbox.
*   **Workflows → Code**: Task management becomes `tasks.*` functions.
*   **Docs → Code**: Guidelines become searchable/readable context.

The LLM interacts with the world via **Code**, not JSON tool calls.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Traditional MCP Approach                    │
│                                                                  │
│   LLM Context: [tool1, tool2, tool3, ... tool50]                │
│                        ↓                                         │
│   Action: Call tool1 → Wait → Result → Call tool2 → Wait...     │
│                                                                  │
│                  SLOW, BLOATED, FRAGILE                         │
│└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OmniDev Approach                            │
│                                                                  │
│   LLM Context: [omni_query, omni_execute]                       │
│                        ↓                                         │
│   Action: Write Script                                          │
│           ├── result1 = tool1()                                 │
│           ├── if result1: tool2(result1)                        │
│           └── return final_result                               │
│                                                                  │
│                  FAST, PROGRAMMATIC, POWERFUL                   │
│└─────────────────────────────────────────────────────────────────┘
```

### Core Requirements Summary

1.  **Flexible Task Management**: "Tasks" are just a capability. Users can swap the default task system for a custom Jira or Trello capability.
2.  **Doc-Driven Development**: Capabilities can ingest documentation (e.g., "Code Guidelines") and expose them to the LLM to enforce standards.
3.  **MCP-to-Code Conversion**: Any MCP server is automatically converted into a sandboxed library (`server.action()`).
4.  **Layered Configuration**: Supports teams. A team lead shares a minimal config (repo access, linting rules), and individual developers layer their own tools (debugging, personal notes) on top.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM / AI Agent                           │
│                                                                  │
│   Only sees 2 tools:                                            │
│   • omni_query - Discover capabilities & query docs             │
│   • omni_execute - Run code with full project access            │
│└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OmniDev Server                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Capabilities Registry                     │   │
│  │  • Directories in .omnidev/capabilities/                 │   │
│  │  • Composed of code, docs, skills, and MCP config        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  The Sandbox (Containerized)             │   │
│  │  • Runtime: Python (primary), TypeScript (future)        │   │
│  │  • Modules: Auto-generated from active Capabilities      │   │
│  │  • Access: Read/Write to Repo (controlled)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Git Safety Layer                        │   │
│  │  • Auto-commit / Rollback                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│└─────────────────────────────────────────────────────────────────┘
```

---

## The Two MCP Tools

*(Unchanged from previous version - these remain the entry points)*

### Tool 1: `omni_query`
Discover what libraries are available in the sandbox.

### Tool 2: `omni_execute`
Write and run code using those libraries.

---

## Capabilities System

### Structure of a Capability

A capability is not a rigid "type" but a **composition**. It is defined by a directory in `.omnidev/capabilities/<name>/` containing any combination of the following components:

```
.omnidev/capabilities/my-capability/
├── definition.md       # Metadata & General Docs (Required)
├── tools/              # Custom Code Injection
│   ├── script.py       # Python functions to inject
│   └── utils.ts        # TypeScript functions (future)
├── docs/               # Knowledge Base
│   ├── guidelines.md   # Text to be indexed
│   └── reference.pdf   # PDFs/other formats
├── skills/             # Agent Instructions
│   └── usage.md        # Prompts/skills for the LLM
└── mcp.toml            # External MCP Configuration
```

### Components Detail

1.  **`definition.md` (Metadata)**
    *   Frontmatter (YAML/TOML) defines version, author, and description.
    *   Body contains high-level documentation shown in generic `omni_query` results.

2.  **`tools/` (Sandbox Code)**
    *   Contains `.py` (or `.ts`) files.
    *   These are injected into the sandbox and namespaced (e.g., `my_capability.my_function`).
    *   Used for custom logic that doesn't need a full external MCP server.

3.  **`docs/` (Knowledge)**
    *   Markdown or text files that provide context.
    *   Indexed by OmniDev for RAG-like querying via `omni_query`.
    *   Example: `code_style.md` tells the LLM how to write code in this project.

4.  **`skills/` (Prompts)**
    *   Defines "skills" or "behaviors" for the LLM.
    *   Example: A `planning` capability might have a skill that says "Always break down tasks into subtasks before execution."

5.  **`mcp.toml` (External Tools)**
    *   Defines an external MCP server to run (e.g., `npx`, `docker`, `uv`).
    *   **Supervisor Role**: OmniDev handles the lifecycle (start/stop) of these MCP servers.
    *   **Wrapper**: OmniDev automatically converts the MCP's tools into callable sandbox functions (`mcp_name.tool_name()`).

### Installation & Management

*   **Manual**: Drop a folder into `.omnidev/capabilities/`.
*   **Hub (Future)**: `omnidev install <capability>` downloads from a registry.
*   **Composition**: A user can mix and match. A "DevOps" capability might contain `kubectl` MCP (via `mcp.toml`) AND a custom python script to parse logs (`tools/parser.py`) AND documentation on deployment policy (`docs/deploy.md`).

---

## Sandbox Environment

### Implementation

The sandbox must be **containerized** and **performant**.
*   **Technology**: Docker or WebAssembly (WASM) for speed/safety.
*   **Language Support**: Initially Python (due to rich ecosystem for scripting), but architected to support TypeScript (Node/Deno) since LLMs excel at TS tool usage.
*   **Repo Access**: The sandbox mounts the user's repository.
    *   *Mode 1: Full Access* (Default) - Can read/write files (protected by Git Safety).
    *   *Mode 2: Read-Only* - For analysis or safe browsing.

### Code Mode Execution

Instead of single tool calls, the sandbox executes scripts:

```python
# The LLM writes this whole block:
import aws
import filesystem

# 1. Get data
config = filesystem.read_json("config.prod.json")

# 2. Logic & Transformation
bucket_name = f"backup-{config['id']}"

# 3. Execution
if not aws.s3_exists(bucket_name):
    aws.s3_create(bucket_name)
    print(f"Created {bucket_name}")
```

---

## Configuration System

### Layered Configuration (Team Support)

OmniDev supports a hierarchical configuration model.

1.  **Global (User)**: `~/.omnidev/config.yaml`
    *   *User's personal preferences, API keys, global tools.*
2.  **Team (Project Shared)**: `.omnidev.yaml` (Git-tracked)
    *   *Shared capabilities and settings.*
3.  **Local (Project Private)**: `.omnidev.local.yaml` (Git-ignored)
    *   *Developer's personal overrides.*

### Configuration Files

The configuration simply points to which capabilities are enabled/active from the `capabilities/` directory.

```yaml
# .omnidev.yaml
project: "backend-api"

# Define where capabilities are found (defaults to .omnidev/capabilities)
capability_path: ".omnidev/capabilities"

# Active capabilities for this project
enabled_capabilities:
  - tasks          # Loads from .omnidev/capabilities/tasks/
  - git            # Loads from .omnidev/capabilities/git/
  - company-lint   # Loads from .omnidev/capabilities/company-lint/

profiles:
  planning:
    - tasks
    - research
  coding:
    - git
    - company-lint
```

---

## Task & Plan Management

### Tasks as a Capability

The Task system is **not hardcoded**. It is a default capability (`builtin/tasks` or `.omnidev/capabilities/tasks`) that provides:
1.  **Schema**: Defines what a task looks like (title, status, validators).
2.  **Functions**: `tasks.list()`, `tasks.complete()`, `tasks.validate()`.
3.  **Context**: Injects prompt instructions on how to manage the plan.

If a user wants to use GitHub Issues instead:
1.  Disable the `tasks` capability.
2.  Enable a `github-issues` capability.
3.  The sandbox now has `github.issues.create()` instead of `tasks.create()`, and the LLM adapts via the new capability's docs.

---

## Directory Structure

```
project-root/
├── .omnidev/
│   ├── config.yaml                    # Project configuration
│   ├── config.local.yaml              # Local overrides (gitignored)
│   ├── capabilities/                  # THE CAPABILITY REGISTRY
│   │   ├── tasks/                     # A built-in capability
│   │   │   ├── definition.md
│   │   │   ├── tools/
│   │   │   │   └── task_manager.py
│   │   │   └── docs/
│   │   ├── aws/                       # An MCP-based capability
│   │   │   ├── definition.md
│   │   │   └── mcp.toml               # Defines "npx -y @modelcontextprotocol/server-aws..."
│   │   └── my-custom-tool/
│   │       ├── definition.md
│   │       └── tools/
│   │           └── script.py
│   ├── profiles/                      # Profile definitions
│   └── sandbox/                       # Sandbox temp files
└── .gitignore
```

---

## Future Features

*   **TypeScript Sandbox**: Native support for TS execution (Deno/Node).
*   **Remote Sandboxes**: Execute code in a cloud container for heavy workloads.
*   **Capability Hub**: `omnidev install user/capability`.
