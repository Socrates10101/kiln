import { useState } from 'react';
import type { ComponentGroup } from '../../config/schema.js';
import type { ReviewData, ReviewStatus } from '../../stores/review-store.js';

interface GroupAccordionProps {
  group: ComponentGroup;
  manifest: Record<string, {
    dir: string;
    variants: Record<string, {
      id: string; name: string; generation: number; slot: string; file: string;
    }>;
  }>;
  reviewData?: ReviewData;
  filter?: 'pending' | 'reviewed' | 'all';
  defaultOpen?: boolean;
  onPreview?: (component: string, vid: string) => void;
}

const statusDotColors: Record<ReviewStatus, string> = {
  adopt: '#22c55e',
  iterate: '#eab308',
  keep: '#737373',
  drop: '#ef4444',
  skip: '#525252',
};

export function GroupAccordion({ group, manifest, reviewData, filter = 'all', defaultOpen = true, onPreview }: GroupAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Resolve components that actually exist in manifest
  const resolved = group.components
    .filter((name) => manifest[name])
    .map((name) => ({ name, ...manifest[name] }));

  const totalVariants = resolved.reduce((sum, c) => sum + Object.keys(c.variants).length, 0);

  if (resolved.length === 0) return null;

  return (
    <section style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Group header — clickable */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: open ? '#1a1a1a' : 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid #262626' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#e5e5e5',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px',
            color: '#525252',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}>
            {'\u25B6'}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{group.name}</span>
          <span style={{ fontSize: '11px', color: '#525252' }}>
            {resolved.length} components / {totalVariants} variants
          </span>
        </div>
        <a
          href={`/preview/group/${encodeURIComponent(group.name)}`}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: '11px',
            color: '#f97316',
            textDecoration: 'none',
            padding: '2px 8px',
            borderRadius: '3px',
            border: '1px solid #f9731640',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f9731620'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Preview Page
        </a>
      </button>

      {/* Component list */}
      {open && (
        <div style={{ padding: '8px 0' }}>
          {resolved.map((comp) => (
            <ComponentRow
              key={comp.name}
              name={comp.name}
              component={comp}
              reviewData={reviewData}
              filter={filter}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ComponentRow({ name, component, reviewData, filter, onPreview }: {
  name: string;
  component: { dir: string; variants: Record<string, { id: string; name: string; generation: number; slot: string }> };
  reviewData?: ReviewData;
  filter?: 'pending' | 'reviewed' | 'all';
  onPreview?: (component: string, vid: string) => void;
}) {
  let variants = Object.entries(component.variants);

  // Apply filter
  if (filter && filter !== 'all' && reviewData) {
    variants = variants.filter(([vid]) => {
      const reviewStatus = reviewData.components[name]?.variants[vid]?.status ?? null;
      if (filter === 'pending') return reviewStatus === null;
      if (filter === 'reviewed') return reviewStatus !== null;
      return true;
    });
  }

  // Group by generation
  const generations = new Map<number, typeof variants>();
  for (const [vid, info] of variants) {
    const gen = info.generation;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push([vid, info]);
  }
  const sortedGens = [...generations.entries()].sort((a, b) => a[0] - b[0]);

  if (variants.length === 0) return null;

  return (
    <div style={{
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    }}>
      {/* Component name */}
      <div style={{ width: '180px', flexShrink: 0, paddingTop: '2px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: '10px', color: '#525252', fontFamily: 'monospace' }}>{component.dir}</div>
      </div>

      {/* Variants by gen */}
      <div style={{ flex: 1 }}>
        {sortedGens.map(([gen, genVariants]) => (
          <div key={gen} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: gen < sortedGens[sortedGens.length - 1][0] ? '4px' : 0,
          }}>
            <span style={{
              fontSize: '9px',
              color: '#404040',
              width: '28px',
              flexShrink: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              G{gen}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {genVariants.map(([vid, info]) => {
                const reviewStatus = reviewData?.components[name]?.variants[vid]?.status ?? null;
                return (
                  <a
                    key={vid}
                    href={`/preview/${name}/${vid}`}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => {
                      if (onPreview && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        onPreview(name, vid);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '3px',
                      fontSize: '11px',
                      color: '#e5e5e5',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f97316')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
                  >
                    {/* Status dot */}
                    {reviewStatus && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: statusDotColors[reviewStatus] ?? '#525252',
                        flexShrink: 0,
                      }} />
                    )}
                    <span style={{ fontFamily: 'monospace', color: '#f97316', fontWeight: 600, fontSize: '10px' }}>
                      {vid}
                    </span>
                    {info.name !== vid && (
                      <span style={{ color: '#737373', fontSize: '10px' }}>{info.name}</span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
