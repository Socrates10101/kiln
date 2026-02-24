import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { VariantManifest } from '../stores/variant-manifest.js';
import type { ResolvedKilnConfig, ComponentGroup } from '../config/schema.js';

const VIRTUAL_MANIFEST = 'virtual:kiln/manifest';
const RESOLVED_MANIFEST = '\0' + VIRTUAL_MANIFEST;

// Virtual module prefixes
const PREVIEW_PREFIX = '/@kiln/preview/';
const GROUP_PREVIEW_PREFIX = '/@kiln/group-preview/';

/**
 * Vite plugin that provides virtual modules for Kiln's preview system.
 *
 * - `virtual:kiln/manifest`                  — exports manifest as JSON
 * - `/@kiln/preview/:comp/:vid.tsx`           — single variant preview entry
 * - `/@kiln/group-preview/:groupName.tsx`     — group preview entry
 *     - If group has `pageFile`: rewrites the real page with variant proxies
 *     - Otherwise: simple stacked layout
 */
export function kilnVitePlugin(opts: {
  config: ResolvedKilnConfig;
  manifest: VariantManifest;
}): Plugin {
  const { config, manifest } = opts;

  return {
    name: 'kiln',

    resolveId(id) {
      if (id === VIRTUAL_MANIFEST) return RESOLVED_MANIFEST;
      if (id.startsWith(PREVIEW_PREFIX)) return id;
      if (id.startsWith(GROUP_PREVIEW_PREFIX)) return id;
    },

    load(id) {
      if (id === RESOLVED_MANIFEST) {
        return `export default ${JSON.stringify(manifest.toJSON())}`;
      }

      // Single variant preview: /@kiln/preview/ComponentName/v3a.tsx
      if (id.startsWith(PREVIEW_PREFIX)) {
        const rest = id.slice(PREVIEW_PREFIX.length).replace(/\.tsx$/, '');
        const parts = rest.split('/');
        if (parts.length !== 2) return null;

        const [componentName, vid] = parts;
        const comp = manifest.getComponent(componentName);
        if (!comp) return null;

        const variant = comp.variants.get(vid);
        if (!variant) return null;

        return generatePreviewEntry(config, variant.file);
      }

      // Group preview: /@kiln/group-preview/Homepage.tsx
      if (id.startsWith(GROUP_PREVIEW_PREFIX)) {
        const groupName = id.slice(GROUP_PREVIEW_PREFIX.length).replace(/\.tsx$/, '');
        const group = config.groups?.find((g) => g.name === decodeURIComponent(groupName));
        if (!group) return `document.body.innerHTML = '<p>Group not found: ${groupName}</p>';`;

        if (group.pageFile) {
          return generatePageBasedGroupEntry(config, manifest, group);
        }
        return generateStackedGroupEntry(config, manifest, group);
      }
    },

    handleHotUpdate({ file, server }) {
      const basename = file.split('/').pop() ?? '';
      if (config.variants.pattern.test(basename)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_MANIFEST);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

// ── Shared IO mock snippet ────────────────────────────────────────────

const IO_MOCK = `
if (typeof window !== 'undefined' && !window.__kilnIOPatched) {
  window.__kilnIOPatched = true;
  window.IntersectionObserver = class MockIntersectionObserver {
    #callback;
    root = null;
    rootMargin = '0px';
    thresholds = [0];
    constructor(callback) { this.#callback = callback; }
    observe(target) {
      requestAnimationFrame(() => {
        this.#callback([{
          isIntersecting: true,
          target,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: performance.now(),
        }], this);
      });
    }
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}`;

// ── CSS import helper ─────────────────────────────────────────────────

function cssImports(config: ResolvedKilnConfig): string {
  return config.preview.css
    .map((f) => {
      const normalized = f.startsWith('./') ? f.slice(1) : f.startsWith('/') ? f : '/' + f;
      return `import '${normalized}';`;
    })
    .join('\n');
}

// ── Single variant preview entry ──────────────────────────────────────

function generatePreviewEntry(config: ResolvedKilnConfig, componentFile: string): string {
  const importPath = '/' + componentFile;

  return `
${cssImports(config)}
import { createRoot } from 'react-dom/client';
import Component from '${importPath}';
${IO_MOCK}
const root = createRoot(document.getElementById('kiln-root'));
root.render(<Component />);
`;
}

// ── Variant selector panel (shared between page-based and stacked) ────

function variantSelectorPanel(groupName: string): string {
  return `
function VariantSelector({ groupConfig, selections, setVariant, soloComponent, setSoloComponent }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div style={{
      position: 'fixed', top: 12, left: 12, zIndex: 9999,
      background: 'rgba(10,10,10,0.92)', borderRadius: 8,
      border: '1px solid #333', padding: collapsed ? '6px 10px' : '10px 14px',
      maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
      fontFamily: '"Inter", system-ui, sans-serif',
      backdropFilter: 'blur(8px)',
      fontSize: 12, color: '#e5e5e5',
      minWidth: collapsed ? 'auto' : 200,
      transition: 'all 0.15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
           onClick={() => setCollapsed(c => !c)}>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ${JSON.stringify(groupName).slice(1, -1)}
        </div>
        <span style={{ fontSize: 10, color: '#525252' }}>{collapsed ? '\\u25B6' : '\\u25BC'}</span>
      </div>
      {!collapsed && soloComponent && (
        <div
          onClick={() => setSoloComponent(null)}
          style={{
            marginTop: 6, padding: '4px 8px', borderRadius: 4,
            fontSize: 11, color: '#a3a3a3', cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {'\u2190'} Page view
        </div>
      )}
      {!collapsed && groupConfig.map(comp => (
        <div key={comp.name} style={{
          marginTop: 8,
          opacity: soloComponent && soloComponent !== comp.name ? 0.35 : 1,
          transition: 'opacity 0.15s ease',
        }}>
          <div
            style={{
              fontSize: 11,
              color: soloComponent === comp.name ? '#f97316' : '#737373',
              marginBottom: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onClick={() => setSoloComponent(soloComponent === comp.name ? null : comp.name)}
          >
            <span>{comp.name}</span>
            {soloComponent === comp.name && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#f97316', letterSpacing: '0.05em' }}>SOLO</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {comp.variants.map(vid => (
              <button
                key={vid}
                onClick={() => setVariant(comp.name, vid)}
                style={{
                  padding: '2px 8px', borderRadius: 3, border: '1px solid',
                  borderColor: selections[comp.name] === vid ? '#f97316' : '#444',
                  background: selections[comp.name] === vid ? '#f97316' : 'transparent',
                  color: selections[comp.name] === vid ? '#000' : '#a3a3a3',
                  cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                }}
              >
                {vid}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}`;
}

// ── Shared variant state + URL sync ───────────────────────────────────

function variantStateCode(): string {
  return `
const KilnVariantCtx = React.createContext({
  selections: {}, setVariant: () => {},
  soloComponent: null, setSoloComponent: () => {},
});

function useKilnVariant(componentName) {
  const { selections } = React.useContext(KilnVariantCtx);
  return selections[componentName];
}

function KilnVariantProvider({ groupConfig, children }) {
  const params = new URLSearchParams(window.location.search);
  const [selections, setSelections] = React.useState(() => {
    const init = {};
    for (const comp of groupConfig) {
      init[comp.name] = params.get(comp.name.toLowerCase()) || comp.defaultVariant;
    }
    return init;
  });

  const setVariant = React.useCallback((compName, vid) => {
    setSelections(prev => {
      const next = { ...prev, [compName]: vid };
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) {
        p.set(k.toLowerCase(), v);
      }
      window.history.replaceState(null, '', '?' + p.toString());
      return next;
    });
  }, []);

  const [soloComponent, setSoloComponent] = React.useState(null);

  return (
    <KilnVariantCtx.Provider value={{ selections, setVariant, soloComponent, setSoloComponent }}>
      {children}
    </KilnVariantCtx.Provider>
  );
}`;
}

// ── Collect variant data for a group ──────────────────────────────────

function collectGroupVariants(manifest: VariantManifest, group: ComponentGroup) {
  const componentData: { name: string; variants: { vid: string; file: string }[] }[] = [];
  for (const compName of group.components) {
    const comp = manifest.getComponent(compName);
    if (!comp) continue;
    const variants: { vid: string; file: string }[] = [];
    for (const [vid, info] of comp.variants) {
      variants.push({ vid, file: info.file });
    }
    if (variants.length > 0) {
      componentData.push({ name: compName, variants });
    }
  }
  return componentData;
}

// ── PAGE-BASED group preview (uses actual page.tsx layout) ────────────

function generatePageBasedGroupEntry(
  config: ResolvedKilnConfig,
  manifest: VariantManifest,
  group: ComponentGroup,
): string {
  const pageFilePath = path.resolve(config.root, group.pageFile!);
  let pageSource: string;
  try {
    pageSource = fs.readFileSync(pageFilePath, 'utf-8');
  } catch {
    return `document.body.innerHTML = '<p>Page file not found: ${group.pageFile}</p>';`;
  }

  const componentData = collectGroupVariants(manifest, group);
  const componentSet = new Set(componentData.map((c) => c.name));

  // Parse imports from the page source
  // Match: import Name from "path" or import Name from 'path'
  const importRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
  const parsedImports: { fullMatch: string; importName: string; importPath: string; basename: string }[] = [];

  let match;
  while ((match = importRegex.exec(pageSource)) !== null) {
    const importName = match[1];
    const importPath = match[2];
    const basename = importPath.split('/').pop()!.replace(/\.\w+$/, '');
    parsedImports.push({ fullMatch: match[0], importName, importPath, basename });
  }

  // Separate: group component imports vs other imports
  const groupImports: typeof parsedImports = [];
  const otherImports: typeof parsedImports = [];

  for (const imp of parsedImports) {
    if (componentSet.has(imp.basename)) {
      groupImports.push(imp);
    } else {
      otherImports.push(imp);
    }
  }

  // Remove ALL original imports and the export default from the page source
  let rewrittenPage = pageSource;
  for (const imp of parsedImports) {
    rewrittenPage = rewrittenPage.replace(imp.fullMatch, '');
  }
  // Remove export default, keep the function (consume original name e.g. "Home")
  rewrittenPage = rewrittenPage.replace(/export\s+default\s+function\s+\w+/, 'function __KilnPage__');
  // Also handle: export default PageName (at the end)
  rewrittenPage = rewrittenPage.replace(/export\s+default\s+\w+\s*;?\s*$/, '');

  // Generate variant imports and proxy components
  const variantImports: string[] = [];
  const proxyComponents: string[] = [];
  const pageComponentNames = new Set(groupImports.map((gi) => gi.basename));

  for (const gi of groupImports) {
    const comp = componentData.find((c) => c.name === gi.basename);
    if (!comp) continue;

    // Import all variants
    const variantMap: string[] = [];
    for (const v of comp.variants) {
      const alias = `__${comp.name}_${v.vid}__`.replace(/[^a-zA-Z0-9_]/g, '_');
      variantImports.push(`import ${alias} from '/${v.file}';`);
      variantMap.push(`  '${v.vid}': ${alias}`);
    }

    // Create proxy component using the ORIGINAL import name (e.g. AI_RED_TEAM_Section)
    proxyComponents.push(`
const __${comp.name}_map__ = {
${variantMap.join(',\n')}
};
function ${gi.importName}(props) {
  const vid = useKilnVariant('${comp.name}');
  const Comp = __${comp.name}_map__[vid] || Object.values(__${comp.name}_map__)[0];
  return <Comp {...props} />;
}`);
  }

  // Generate proxy components for group members NOT imported by page.tsx
  // (needed for solo mode — these components exist in the group but aren't in the page layout)
  for (const comp of componentData) {
    if (pageComponentNames.has(comp.name)) continue;

    const variantMap: string[] = [];
    for (const v of comp.variants) {
      const alias = `__${comp.name}_${v.vid}__`.replace(/[^a-zA-Z0-9_]/g, '_');
      variantImports.push(`import ${alias} from '/${v.file}';`);
      variantMap.push(`  '${v.vid}': ${alias}`);
    }

    const proxyName = `__KilnSoloProxy_${comp.name}__`.replace(/[^a-zA-Z0-9_]/g, '_');
    proxyComponents.push(`
const __${comp.name}_map__ = {
${variantMap.join(',\n')}
};
function ${proxyName}(props) {
  const vid = useKilnVariant('${comp.name}');
  const Comp = __${comp.name}_map__[vid] || Object.values(__${comp.name}_map__)[0];
  return <Comp {...props} />;
}`);
  }

  // Config JSON for the selector panel
  const configJSON = JSON.stringify(
    componentData.map((c) => ({
      name: c.name,
      variants: c.variants.map((v) => v.vid),
      defaultVariant: c.variants[0]?.vid,
    })),
  );

  // For non-group imports: stub component imports, keep utility/library imports
  // Heuristic: if importName starts with uppercase → likely a React component → stub it
  // If importName starts with lowercase → likely a utility → keep it
  const keptImports: string[] = [];
  const stubbedComponents: string[] = [];

  for (const imp of otherImports) {
    if (/^[A-Z]/.test(imp.importName)) {
      // Stub component: render nothing (avoids Node.js dependency issues)
      stubbedComponents.push(`function ${imp.importName}() { return null; }`);
    } else {
      keptImports.push(imp.fullMatch);
    }
  }

  // Solo map: component name → proxy component reference (for solo preview mode)
  // Includes ALL group components, not just those imported by page.tsx
  const soloMapEntries: string[] = [];
  for (const comp of componentData) {
    const gi = groupImports.find((g) => g.basename === comp.name);
    if (gi) {
      soloMapEntries.push(`  '${comp.name}': ${gi.importName}`);
    } else {
      const proxyName = `__KilnSoloProxy_${comp.name}__`.replace(/[^a-zA-Z0-9_]/g, '_');
      soloMapEntries.push(`  '${comp.name}': ${proxyName}`);
    }
  }

  return `
${cssImports(config)}
import React from 'react';
import { createRoot } from 'react-dom/client';
${keptImports.join('\n')}
${variantImports.join('\n')}
${IO_MOCK}

// Stubbed non-group components (avoid Node.js dependency issues)
${stubbedComponents.join('\n')}

${variantStateCode()}
${variantSelectorPanel(group.name)}

// Proxy components for group members
${proxyComponents.join('\n')}

// Solo component map
const __KilnSoloMap__ = {
${soloMapEntries.join(',\n')}
};

// Rewritten page (imports removed, export default → function __KilnPage__)
${rewrittenPage}

const groupConfig = ${configJSON};

function __KilnGroupPreview__() {
  return (
    <KilnVariantProvider groupConfig={groupConfig}>
      <__KilnSelectorBridge__ />
      <__KilnContentBridge__ />
    </KilnVariantProvider>
  );
}

function __KilnSelectorBridge__() {
  const { selections, setVariant, soloComponent, setSoloComponent } = React.useContext(KilnVariantCtx);
  return <VariantSelector groupConfig={groupConfig} selections={selections} setVariant={setVariant} soloComponent={soloComponent} setSoloComponent={setSoloComponent} />;
}

function __KilnContentBridge__() {
  const { soloComponent } = React.useContext(KilnVariantCtx);
  if (soloComponent) {
    const Comp = __KilnSoloMap__[soloComponent];
    return Comp ? <Comp /> : null;
  }
  return <__KilnPage__ />;
}

const root = createRoot(document.getElementById('kiln-root'));
root.render(<__KilnGroupPreview__ />);
`;
}

// ── STACKED group preview (fallback when no pageFile) ─────────────────

function generateStackedGroupEntry(
  config: ResolvedKilnConfig,
  manifest: VariantManifest,
  group: ComponentGroup,
): string {
  const componentData = collectGroupVariants(manifest, group);

  // Generate imports for all variant files
  const imports: string[] = [];
  const componentMapEntries: string[] = [];

  for (const comp of componentData) {
    for (const v of comp.variants) {
      const alias = `${comp.name}_${v.vid}`.replace(/[^a-zA-Z0-9_]/g, '_');
      imports.push(`import ${alias} from '/${v.file}';`);
      componentMapEntries.push(`  '${comp.name}/${v.vid}': ${alias},`);
    }
  }

  const configJSON = JSON.stringify(
    componentData.map((c) => ({
      name: c.name,
      variants: c.variants.map((v) => v.vid),
      defaultVariant: c.variants[0]?.vid,
    })),
  );

  return `
${cssImports(config)}
import React from 'react';
import { createRoot } from 'react-dom/client';
${imports.join('\n')}
${IO_MOCK}

const componentMap = {
${componentMapEntries.join('\n')}
};

const groupConfig = ${configJSON};

${variantStateCode()}
${variantSelectorPanel(group.name)}

function __KilnStackedContent__() {
  const { selections, soloComponent } = React.useContext(KilnVariantCtx);

  if (soloComponent) {
    const vid = selections[soloComponent];
    const Comp = componentMap[soloComponent + '/' + vid];
    return Comp ? <Comp /> : null;
  }

  return (
    <>
      {groupConfig.map(comp => {
        const vid = selections[comp.name];
        const Comp = componentMap[comp.name + '/' + vid];
        if (!Comp) return null;
        return <Comp key={comp.name + '/' + vid} />;
      })}
    </>
  );
}

function __KilnSelectorBridge__() {
  const { selections, setVariant, soloComponent, setSoloComponent } = React.useContext(KilnVariantCtx);
  return <VariantSelector groupConfig={groupConfig} selections={selections} setVariant={setVariant} soloComponent={soloComponent} setSoloComponent={setSoloComponent} />;
}

function GroupPreview() {
  return (
    <KilnVariantProvider groupConfig={groupConfig}>
      <__KilnSelectorBridge__ />
      <__KilnStackedContent__ />
    </KilnVariantProvider>
  );
}

const root = createRoot(document.getElementById('kiln-root'));
root.render(<GroupPreview />);
`;
}
