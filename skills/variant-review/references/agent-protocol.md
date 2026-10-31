# Agent State Protocol

Agents communicate their status to Kiln by writing JSON state files. The Kiln Oracle polls these files and emits events to update the dashboard UI.

## File Location

```
.kiln/agents/{agentId}.json
```

## Agent ID Format

Use a descriptive, unique ID:

```
{taskType}-{ComponentName}-{variantId}-{date}
```

Examples:
- `iterate-HeroSection-v1a-20260224`
- `adopt-Navbar-v2b-20260224`
- `drop-Footer-v1c-20260224`

## State Schema

```json
{
  "id": "iterate-HeroSection-v1a-20260224",
  "status": "running",
  "task": {
    "type": "iterate",
    "component": "HeroSection",
    "parentVariant": "v1a",
    "instruction": "Make the CTA larger"
  },
  "outputs": [],
  "startedAt": "2026-02-24T10:00:00.000Z",
  "updatedAt": "2026-02-24T10:00:05.000Z",
  "log": ["Starting iterate...", "Generating v2a..."]
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique agent identifier |
| `status` | `"pending"` \| `"running"` \| `"completed"` \| `"failed"` | Current execution state |
| `task.type` | `"generate"` \| `"iterate"` \| `"refine"` | What the agent is doing |
| `task.component` | string | Target component name |
| `task.parentVariant` | string? | Parent variant ID (for iterate) |
| `task.instruction` | string? | User feedback / instruction text |
| `outputs` | string[] | File paths of generated variants (populated on completion) |
| `startedAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp (update on every status change) |
| `log` | string[] | Append-only progress messages |

## Status Lifecycle

```
pending → running → completed
                  → failed
```

1. Write file with `status: "pending"` before starting work
2. Update to `status: "running"` when execution begins
3. On success: set `status: "completed"`, populate `outputs` with generated file paths
4. On failure: set `status: "failed"`, add error details to `log`

Always update `updatedAt` on every status transition.
