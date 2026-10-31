/**
 * Shared HTML shell for all preview pages (single variant + group).
 * Mirrors Next.js layout.tsx: fonts, CSS variables, body class.
 */
export function previewShell(entryUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Zen+Old+Mincho:wght@400;700;900&display=swap" rel="stylesheet" />
  <style>
    :root {
      --font-inter: "Inter", sans-serif;
      --font-zen-old-mincho: "Zen Old Mincho", serif;
    }
  </style>
</head>
<body class="font-sans">
  <div id="kiln-root"></div>
  <script type="module" src="${entryUrl}"></script>
</body>
</html>`;
}

export interface FrameworkAdapter {
  name: string;
  vitePlugins: () => Promise<import('vite').PluginOption[]>;
  /** Generate the HTML for a preview page */
  previewHtml: (opts: { component: string; vid: string }) => string;
}

export const reactAdapter: FrameworkAdapter = {
  name: 'react',

  async vitePlugins() {
    const react = await import('@vitejs/plugin-react');
    return [react.default()];
  },

  previewHtml({ component, vid }) {
    const entryUrl = `/@kiln/preview/${component}/${vid}.tsx`;
    return previewShell(entryUrl);
  },
};

export function getAdapter(framework: string): FrameworkAdapter {
  if (framework === 'react') return reactAdapter;
  throw new Error(`Unsupported framework: ${framework}. Currently only 'react' is supported.`);
}
