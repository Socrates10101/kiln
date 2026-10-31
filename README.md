# Kiln

> 日本語版: [README.ja.md](./README.ja.md)

**Eyes and structured input for Claude Code.**

Kiln is a small local dashboard that you add to a project as a git submodule.
It lets you *see* UI variants that Claude Code generated and give *structured*
feedback (adopt / iterate / keep / drop) that Claude Code can act on.

Kiln itself does not generate code and does not make decisions. It only does
two things: show, and exchange structured input.

```
Claude Code (the actor)
  │
  ├── things a text CLI handles fine → plain conversation
  │
  └── things text cannot convey → Kiln assists
       ├── visual preview of variants            (see)
       └── structured input of review decisions  (exchange)
```

## Install

Kiln is meant to live inside the project it serves, as `tools/kiln`.

```bash
# 1. add as a submodule
git submodule add https://github.com/Socrates10101/kiln.git tools/kiln

# 2. run the installer from the host project root
tools/kiln/install.sh
```

What `install.sh` does:

| Step | What happens |
|------|--------------|
| Dependencies | runs `pnpm install` inside `tools/kiln/` |
| Package script | adds a `"kiln": "tsx tools/kiln/src/cli.ts"` script to the host `package.json` (skipped if absent) |
| Skills | symlinks each `tools/kiln/skills/*` into `.claude/skills/` so Claude Code picks them up |
| Working dir | creates `.kiln/variants/`, `.kiln/agents/` and `.kiln/.gitignore` (ignores `agents/`) |
| Config | scaffolds `kiln.config.ts` in the host root if it does not exist |

Requirements: Node 20+, pnpm, python3 (used by the installer to compute relative paths),
and `tsx` resolvable from the host project (`npx tsx` is used when it is not installed).

After installing:

```bash
# edit the config to match your project
$EDITOR kiln.config.ts

# start the dashboard
pnpm kiln
```

The dashboard opens at **http://localhost:4400** (port is configurable).

| URL | Purpose |
|-----|---------|
| `/` | dashboard |
| `/preview/:component/:variantId` | full-page preview of one variant |
| `/preview/group/:groupName` | preview a component group (optionally inside the real page file) |
| `/api/manifest`, `/api/review`, `/api/agents`, `/api/groups` | JSON read endpoints |
| `/api/review/:component/:variantId` | `POST` a review decision |
| `/api/events` | Server-Sent Events stream |

## What ends up in your project

```
my-project/
  ├── kiln.config.ts                      ← project config (you edit this)
  ├── tools/kiln/                         ← submodule (do not edit)
  ├── .kiln/
  │   ├── variants/                       ← variant files (tracked in git)
  │   ├── agents/                         ← agent state files (gitignored)
  │   └── .gitignore                      ← ignores agents/
  ├── .claude/skills/
  │   └── variant-review → ../../tools/kiln/skills/variant-review   ← symlink (tracked)
  └── docs/
      └── variant-review.json             ← review data (tracked)
```

## Variant file naming

A variant is a single file named `<Component>.v<generation><slot>.tsx`:

```
.kiln/variants/HeroSection.v1a.tsx
.kiln/variants/HeroSection.v1b.tsx
.kiln/variants/HeroSection.v2a.tsx   ← generated from v1x with feedback
```

| Part | Meaning |
|------|---------|
| `HeroSection` | component name; variants of the same component are grouped |
| `v1`, `v2`, … | generation; each `iterate` round produces the next generation |
| `a`, `b`, `c` | slot; sibling variants of the same generation |

The pattern is a regex in `kiln.config.ts` (`variants.pattern`) with three
capture groups: component, generation, slot. The default is
`/^(.+)\.v(\d+)([a-z])\.tsx$/`.

Each variant file must `export default` a React component. A JSDoc comment at
the top gives the variant a human-readable name in the dashboard:

```tsx
/** v2a: Split Horizon (Gen 2) */
export default function HeroSection() { … }
```

Recognised forms are `/** v2a: Name (Gen 2) */`, `/** v2a: Name */` and
`/** Name -- description */`. Without one, the id (`v2a`) is shown.

## `kiln.config.ts` reference

Every option below exists in `src/config/schema.ts`. `defineConfig` only
provides types; it returns the object unchanged.

```ts
import { defineConfig } from './tools/kiln/src/index.js';

export default defineConfig({
  name: 'my-project',

  // Variant discovery
  variants: {
    include: ['.kiln/variants/**/*.v*.tsx'],   // globs; default ['src/**/*.v*.tsx']
    pattern: /^(.+)\.v(\d+)([a-z])\.tsx$/,     // 3 groups: component, generation, slot
  },

  // Optional page-level grouping shown in the dashboard
  groups: [
    {
      name: 'Homepage',
      components: ['HeroSection', 'Footer'],
      pageFile: 'src/app/page.tsx',            // optional: render variants inside the real page
    },
  ],

  // Where review decisions are persisted (relative to project root)
  review: {
    file: 'docs/variant-review.json',          // default
  },

  // Preview rendering
  preview: {
    framework: 'react',                        // the only framework today
    css: ['./src/app/globals.css'],            // CSS files injected into every preview
    vite: {                                    // optional extra Vite config
      plugins: [],
      resolve: { alias: { '@/': './src/' } },  // relative aliases are resolved from the project root
    },
  },

  // Agent state monitoring
  agents: {
    stateDir: '.kiln/agents/',                 // default
    pollInterval: 2000,                        // ms, default
  },

  server: { port: 4400 },                      // default
});
```

Notes:

- Without a `pageFile`, a group preview stacks its components vertically with a
  variant selector per component. With a `pageFile`, Kiln rewrites that page so
  every imported group component is swapped for the selected variant.
- Previews alias `next/image`, `next/link`, `next/navigation` and
  `next/font/google` to plain-HTML shims, so components written for Next.js
  render without a Next runtime.
- `process.env` is defined as an empty object inside previews.

## The review flow

```
          variant-review.json
User ──→ Kiln ─────────────────────→ Claude Code (leader)
                                        │
                                        ├── agent 1 (iterate)
                                        ├── agent 2 (adopt)
                                        └── agent 3 (iterate)
                                        │
          .kiln/variants/               │
User ←── Kiln ←────────────────────────┘
          (picked up by the file watcher)
```

| Channel | Direction | Content |
|---------|-----------|---------|
| `variant-review.json` | Kiln → Claude Code | the user's decisions and feedback |
| `.kiln/variants/` | Claude Code → Kiln | generated variant files |
| `.kiln/agents/*.json` | Claude Code → Kiln | agent execution state (see `skills/variant-review/references/agent-protocol.md`) |

### 1. Review in the dashboard

For each variant pick one status:

| Status | Meaning |
|--------|---------|
| `adopt` | make this variant the default implementation |
| `iterate` | generate the next generation from this one, using your feedback |
| `keep` | hold for now |
| `drop` | delete the variant |

For `iterate` you can add free-text feedback and choose a mode:

| Mode | Scope of change |
|------|-----------------|
| `auto` | inferred from the feedback text (default) |
| `structural` | large changes: layout, colour, typography, motion |
| `component` | change only the named `targetPart`, keep everything else |

Decisions are written to `variant-review.json` with `applied: false`.

### 2. Apply with the skill

The `variant-review` skill (installed into `.claude/skills/`) teaches Claude
Code how to process the file. In Claude Code, say for example:

```
apply the review results
```

Claude Code reads the pending entries, dispatches one agent per decision,
and marks each entry `applied: true` when done. Two modes are available:

| Mode | Trigger phrase | Behaviour |
|------|----------------|-----------|
| one-shot | "process pending reviews" | handle current pending entries once |
| watch | "watch for reviews" | poll the file and process new decisions as they arrive |

Agents report progress by writing `.kiln/agents/<id>.json`; Kiln polls that
directory and shows status in the dashboard's agent panel.

## Development

Inside `tools/kiln/` (or a standalone clone):

```bash
pnpm install
pnpm start      # run the CLI against the current directory (needs a kiln.config.ts)
pnpm build      # tsc typecheck (Kiln runs from source via tsx, nothing is emitted)
pnpm test       # vitest
```

Stack: Express + Vite in middleware mode, React client with inline styles,
Server-Sent Events for live updates, chokidar for file watching.

## License

[MIT](./LICENSE)
