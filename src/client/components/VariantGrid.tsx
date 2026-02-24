interface VariantGridProps {
  manifest: Record<string, {
    dir: string;
    variants: Record<string, {
      id: string;
      name: string;
      generation: number;
      slot: string;
      file: string;
    }>;
  }>;
}

export function VariantGrid({ manifest }: VariantGridProps) {
  const components = Object.entries(manifest);

  if (components.length === 0) {
    return (
      <div style={{ color: '#737373', padding: '40px', textAlign: 'center' }}>
        No variant files found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {components.map(([name, comp]) => (
        <ComponentCard key={name} name={name} component={comp} />
      ))}
    </div>
  );
}

function ComponentCard({ name, component }: {
  name: string;
  component: VariantGridProps['manifest'][string];
}) {
  const variants = Object.entries(component.variants);

  // Group by generation
  const generations = new Map<number, typeof variants>();
  for (const [vid, info] of variants) {
    const gen = info.generation;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push([vid, info]);
  }

  const sortedGens = [...generations.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <section style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Component header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>{name}</h2>
          <span style={{ fontSize: '11px', color: '#737373' }}>{variants.length} variants</span>
        </div>
        <span style={{ fontSize: '11px', color: '#525252', fontFamily: 'monospace' }}>
          {component.dir}
        </span>
      </div>

      {/* Variants by generation */}
      <div style={{ padding: '12px 16px' }}>
        {sortedGens.map(([gen, genVariants]) => (
          <div key={gen} style={{ marginBottom: gen < sortedGens[sortedGens.length - 1][0] ? '12px' : 0 }}>
            <div style={{ fontSize: '10px', color: '#525252', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gen {gen}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {genVariants.map(([vid, info]) => (
                <a
                  key={vid}
                  href={`/preview/${name}/${vid}`}
                  target="_blank"
                  rel="noopener"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#e5e5e5',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f97316')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
                >
                  <span style={{ fontFamily: 'monospace', color: '#f97316', fontWeight: 600, fontSize: '11px' }}>
                    {vid}
                  </span>
                  <span style={{ color: '#a3a3a3' }}>{info.name !== vid ? info.name : ''}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
