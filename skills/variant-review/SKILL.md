---
name: variant-review
description: This skill should be used when the user asks to "process pending reviews",
  "apply review results", "handle variant reviews", "pending を処理", "レビュー結果を適用",
  or discusses variant review processing. Reads variant-review.json and dispatches
  agents to handle each pending variant.
---

# Variant Review Processor

## Overview

Process pending variant reviews from `docs/variant-review.json` and dispatch agents to handle each decision.

## Steps

### 1. Detect Pending Reviews

Read `docs/variant-review.json` and extract pending items:

```
pending = variants where status !== null && applied !== true
```

For each component, iterate through its variants and collect those that need processing.

### 2. Dispatch Agents Per Variant

For each pending variant, spawn an agent (via Task tool) based on its status:

| Status | Agent Task |
|--------|-----------|
| **adopt** | Copy variant file to Default (replace the base component) → set `applied: true` |
| **iterate** | Read `docs/variant-generation-guide.md`, use feedback + iterateMode to generate next generation v{N+1}a,b,c → set `applied: true` |
| **drop** | Delete the variant file → set `applied: true` |
| **keep** | No file changes → set `applied: true` |
| **skip** | No action, do not set applied |

### 3. Agent State Files

Each agent MUST write its state to `.kiln/agents/{agentId}.json` following the protocol defined in `references/agent-protocol.md`.

The Kiln Oracle polls this directory and reflects status changes in the dashboard UI.

### 4. Iterate Mode Details

When processing an `iterate` variant:

1. Read `docs/variant-generation-guide.md` for generation rules
2. Check the variant's `iterateMode` field:
   - `structural` — Change 3+ aspects (layout, color, typography, motion, visual weight)
   - `component` — Change only `targetPart`; keep everything else identical
   - `auto` (or null) — Auto-detect from feedback text:
     - Mentions specific UI element name → **component** mode
     - Mentions overall impression/layout → **structural** mode
     - Unclear → default to **structural**
3. Use the `feedback` text as the primary instruction
4. Generate 3 variants: v{N+1}a, v{N+1}b, v{N+1}c
5. Follow naming conventions from the guide

### 5. Post-Processing

After all agents complete:
- Update `docs/variant-review.json` setting `applied: true` for each processed variant
- Report summary to the user
