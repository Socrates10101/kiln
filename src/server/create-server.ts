import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { ResolvedKilnConfig } from '../config/schema.js';
import type { EventBus } from '../events/event-bus.js';
import type { VariantManifest } from '../stores/variant-manifest.js';
import type { ReviewStore } from '../stores/review-store.js';
import type { AgentOracle } from '../agents/oracle.js';
import { kilnVitePlugin } from '../vite-plugin/index.js';
import { getAdapter, previewShell } from '../adapters/react.js';
import { createSSEHandler } from './sse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface KilnServer {
  listen(): Promise<void>;
  close(): Promise<void>;
}

export async function createServer(opts: {
  config: ResolvedKilnConfig;
  bus: EventBus;
  manifest: VariantManifest;
  reviewStore: ReviewStore;
  oracle: AgentOracle;
}): Promise<KilnServer> {
  const { config, bus, manifest, reviewStore, oracle } = opts;
  const adapter = getAdapter(config.preview.framework);

  // ── Vite dev server (middleware mode) ─────────────────────────────
  const frameworkPlugins = await adapter.vitePlugins();

  // Next.js shims directory
  const shimsDir = path.resolve(__dirname, '..', 'shims');

  // Resolve user aliases to absolute paths (preserve trailing slashes)
  const userAliases = Object.fromEntries(
    Object.entries(config.preview.vite?.resolve?.alias as Record<string, string> ?? {}).map(
      ([key, val]) => {
        if (!val.startsWith('.')) return [key, val];
        const hadTrailingSlash = val.endsWith('/');
        const resolved = path.resolve(config.root, val);
        return [key, hadTrailingSlash ? resolved + '/' : resolved];
      },
    ),
  );

  const vite = await createViteServer({
    root: config.root,
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [
      ...frameworkPlugins,
      ...(config.preview.vite?.plugins ?? []),
      kilnVitePlugin({ config, manifest }),
    ],
    resolve: {
      ...config.preview.vite?.resolve,
      alias: {
        ...userAliases,
        // Next.js shims — render plain HTML equivalents
        'next/image': path.join(shimsDir, 'next-image.tsx'),
        'next/link': path.join(shimsDir, 'next-link.tsx'),
        'next/navigation': path.join(shimsDir, 'next-navigation.ts'),
        'next/font/google': path.join(shimsDir, 'next-font.ts'),
      },
    },
    define: {
      'process.env': '{}',
      'process.env.NODE_ENV': '"development"',
    },
    optimizeDeps: {
      include: ['react', 'react-dom/client'],
    },
  });

  // ── Express app ──────────────────────────────────────────────────
  const app = express();

  // Serve public/ directory (images, fonts, etc.) — Vite middleware mode
  // does not auto-serve publicDir, so we add it explicitly.
  app.use(express.static(path.join(config.root, 'public')));

  // JSON body parsing
  app.use(express.json());

  // API routes
  app.get('/api/manifest', (_req, res) => {
    res.json(manifest.toJSON());
  });

  app.get('/api/agents', (_req, res) => {
    res.json(oracle.getAgents());
  });

  app.get('/api/review', (_req, res) => {
    res.json(reviewStore.getData());
  });

  app.get('/api/groups', (_req, res) => {
    res.json(config.groups ?? []);
  });

  // Review update
  app.post('/api/review/:component/:variantId', (req, res) => {
    const { component, variantId } = req.params;
    const { status, feedback, iterateMode, targetPart } = req.body;
    const updated = reviewStore.updateVariant(component, variantId, {
      status, feedback, iterateMode, targetPart,
    });
    bus.emit({ type: 'review:updated', component, variantId, status: updated.status });
    res.json(updated);
  });

  // SSE stream
  app.get('/api/events', createSSEHandler(bus));

  // Group preview — stacked components with variant selector
  // NOTE: Must be registered before /preview/:component/:vid to avoid parameter collision
  app.get('/preview/group/:groupName', async (req, res) => {
    const { groupName } = req.params;
    const group = config.groups?.find((g) => g.name === groupName);
    if (!group) {
      res.status(404).send(`Group not found: ${groupName}`);
      return;
    }

    const entryUrl = `/@kiln/group-preview/${encodeURIComponent(groupName)}.tsx`;
    const html = previewShell(entryUrl);

    const transformed = await vite.transformIndexHtml(req.url, html);
    res.status(200).set('Content-Type', 'text/html').send(transformed);
  });

  // Preview route — serves a full-page preview of a single variant
  app.get('/preview/:component/:vid', async (req, res) => {
    const { component, vid } = req.params;
    const comp = manifest.getComponent(component);
    if (!comp) {
      res.status(404).send(`Component not found: ${component}`);
      return;
    }

    const variant = comp.variants.get(vid);
    if (!variant) {
      res.status(404).send(`Variant not found: ${component}/${vid}`);
      return;
    }

    const html = adapter.previewHtml({
      component,
      vid,
    });

    const transformed = await vite.transformIndexHtml(req.url, html);
    res.status(200).set('Content-Type', 'text/html').send(transformed);
  });

  // Dashboard — serve the client SPA
  app.get('/', async (_req, res) => {
    const html = getDashboardHtml();
    const transformed = await vite.transformIndexHtml('/', html);
    res.status(200).set('Content-Type', 'text/html').send(transformed);
  });

  // Vite middleware (handles HMR, module serving, etc.)
  app.use(vite.middlewares);

  // ── Server lifecycle ─────────────────────────────────────────────

  let httpServer: ReturnType<typeof app.listen> | null = null;

  return {
    async listen() {
      return new Promise<void>((resolve) => {
        httpServer = app.listen(config.server.port, () => {
          resolve();
        });
      });
    },

    async close() {
      await vite.close();
      if (httpServer) {
        httpServer.close();
      }
    },
  };
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kiln</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --font-inter: "Inter", sans-serif;
      --kiln-bg: #0a0a0a;
      --kiln-surface: #141414;
      --kiln-border: #262626;
      --kiln-text: #e5e5e5;
      --kiln-text-dim: #737373;
      --kiln-accent: #f97316;
      --kiln-green: #22c55e;
      --kiln-red: #ef4444;
      --kiln-yellow: #eab308;
    }
    body {
      font-family: var(--font-inter), system-ui, sans-serif;
      background: var(--kiln-bg);
      color: var(--kiln-text);
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  <div id="kiln-dashboard"></div>
  <script type="module" src="/tools/kiln/src/client/main.tsx"></script>
</body>
</html>`;
}
