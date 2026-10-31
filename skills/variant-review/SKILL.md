---
name: variant-review
description: This skill should be used when the user asks to "process pending reviews",
  "apply review results", "apply the review", "handle variant reviews", "watch for reviews",
  or otherwise discusses applying Kiln variant review decisions.
  Reads the Kiln review file (variant-review.json) and dispatches agents to handle each pending variant.
---

# Variant Review Processor

## Overview

Kiln (`tools/kiln`) is a dashboard where the user reviews generated UI variants.
Each decision is written to the review file configured in `kiln.config.ts`
(`review.file`, default `docs/variant-review.json`). This skill turns those
decisions into work: one agent per pending variant.

Two modes of operation:
- **One-shot** — process the current pending entries once, then stop
- **Watch** — keep polling the review file and process new decisions as they arrive

Before starting, read `kiln.config.ts` in the project root to find:
- `review.file` — the review JSON to read and update
- `variants.include` / `variants.pattern` — where variant files live and how they are named
- `agents.stateDir` — where to write agent state files (default `.kiln/agents/`)

---

## Modes

### One-shot (default)

Triggers: "process pending reviews", "apply the review results"

1. Read the review file
2. Process every pending variant (see below)
3. Report a summary and stop

### Watch

Triggers: "watch for reviews", "process reviews in watch mode"

1. Read the review file and process existing pending entries first
2. Poll the file every 2 seconds
3. When a new pending entry appears (one not seen before), process it immediately
4. Continue until the user tells you to stop

**Watch loop:**

```
seen = {}  # set of component/variantId keys already handled

initial_pending = detect_pending(review_file)
for each in initial_pending:
    process(each)
    seen.add(each.key)

while not stopped:
    sleep(2 seconds)
    read review_file
    for each variant where status !== null && applied !== true:
        if variant.key not in seen:
            seen.add(variant.key)
            process(variant)
```

**Notes:**
- Polling only reads the review file; it is cheap
- Tell the user when a new pending entry is detected, then start processing
- If a new decision arrives mid-processing, finish the current one first

---

## Detecting pending entries

Read the review file and select:

```
pending = variants where status !== null && applied !== true
```

The file has the shape `{ meta, components: { [name]: { path, variants: { [variantId]: review } } } }`.
Each `review` has `status`, `feedback`, `iterateMode`, `targetPart`, `applied`.

---

## Processing by status

| Status | Agent task |
|--------|-----------|
| **adopt** | copy the variant file over the base component (replace the default implementation) → set `applied: true` |
| **iterate** | generate the next generation `v{N+1}a`, `v{N+1}b`, `v{N+1}c` from `feedback` and `iterateMode` → set `applied: true` |
| **drop** | delete the variant file → set `applied: true` |
| **keep** | no file changes → set `applied: true` |
| **skip** | do nothing; do not set `applied` |

Variant files are named `<Component>.v<generation><slot>.tsx` (unless
`variants.pattern` in `kiln.config.ts` says otherwise) and must
`export default` the component. Start each new file with a JSDoc line such as
`/** v2a: Short descriptive name (Gen 2) */` so the dashboard can show a name.

If the project has its own variant generation guide (for example under `docs/`),
read it first and follow its conventions; it takes precedence over the defaults here.

---

## Agent state files

Each agent writes its state to `<agents.stateDir>/{agentId}.json`.
The format is described in `references/agent-protocol.md`.

Kiln polls this directory and reflects the state in the dashboard.

---

## Iterate details

For an `iterate` variant:

1. Check `iterateMode`:
   - `structural` — change 3 or more aspects (layout, colour, typography, motion, visual weight)
   - `component` — change only `targetPart`; keep everything else identical
   - `auto` (or null) — infer from the feedback text:
     - names a specific UI element → **component**
     - talks about overall impression or layout → **structural**
     - unclear → fall back to **structural**
2. Use the `feedback` text as the primary instruction
3. Generate three variants: `v{N+1}a`, `v{N+1}b`, `v{N+1}c`, in the same directory as the parent
4. Keep the naming convention so the dashboard discovers them automatically

---

## Post-processing

After each variant is handled:
- Set `applied: true` for that entry in the review file
- Report a summary of what was done to the user
