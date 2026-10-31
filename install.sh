#!/usr/bin/env bash
set -euo pipefail

# ── Kiln Installer ──────────────────────────────────────────────────
# Run from the host project root:
#   tools/kiln/install.sh

KILN_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(pwd)"

echo ""
echo "Installing Kiln..."
echo "  Kiln:    $KILN_DIR"
echo "  Project: $PROJECT_ROOT"
echo ""

# ── 1. Install Kiln dependencies ─────────────────────────────────────

echo "1/4  Dependencies"

if [ -d "$KILN_DIR/node_modules" ]; then
  echo "     ✓ already installed"
else
  echo "     → pnpm install"
  (cd "$KILN_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
fi
echo ""

# ── 2. Add kiln script to host package.json ──────────────────────────

echo "2/4  Package script"

PKG="$PROJECT_ROOT/package.json"
if [ ! -f "$PKG" ]; then
  echo "     ⚠ No package.json found. Skipping."
else
  # Check if "kiln" script already exists
  if grep -q '"kiln"' "$PKG" 2>/dev/null; then
    echo "     ✓ \"kiln\" script exists"
  else
    # Compute relative path from project root to kiln cli
    RELATIVE_CLI="$(python3 -c "import os.path; print(os.path.relpath('$KILN_DIR/src/cli.ts', '$PROJECT_ROOT'))")"
    echo "     → adding \"kiln\": \"tsx $RELATIVE_CLI\""
    # Use node to safely modify JSON
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
      if (!pkg.scripts) pkg.scripts = {};
      pkg.scripts.kiln = 'tsx $RELATIVE_CLI';
      fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
    "
  fi
fi
echo ""

# ── 3. Skills & working directory (via TypeScript installer) ─────────

echo "3/4  Skills & working directory"

# Run the TypeScript installer with Kiln's own tsx (installed in step 1)
"$KILN_DIR/node_modules/.bin/tsx" "$KILN_DIR/src/cli.ts" install 2>&1 | grep -v "^Installing"
echo ""

# ── 4. Config scaffold ───────────────────────────────────────────────

echo "4/4  Config"

CONFIG="$PROJECT_ROOT/kiln.config.ts"
if [ -f "$CONFIG" ]; then
  echo "     ✓ kiln.config.ts exists"
else
  RELATIVE_INDEX="$(python3 -c "import os.path; print(os.path.relpath('$KILN_DIR/src/index.js', '$PROJECT_ROOT'))")"
  cat > "$CONFIG" << EOF
import { defineConfig } from './$RELATIVE_INDEX';

export default defineConfig({
  name: '$(basename "$PROJECT_ROOT")',

  variants: {
    include: ['.kiln/variants/**/*.v*.tsx'],
    pattern: /^(.+)\.v(\d+)([a-z])\.tsx$/,
  },

  groups: [
    // { name: 'Homepage', components: ['HeroSection', 'Footer'] },
  ],

  review: {
    file: 'docs/variant-review.json',
  },

  preview: {
    framework: 'react',
    css: [],
    // vite: { plugins: [], resolve: { alias: {} } },
  },

  agents: {
    stateDir: '.kiln/agents/',
    pollInterval: 2000,
  },

  server: { port: 4400 },
});
EOF
  echo "     → kiln.config.ts created (edit to match your project)"
fi
echo ""

echo "Done. Run 'pnpm kiln' to start."
echo ""
