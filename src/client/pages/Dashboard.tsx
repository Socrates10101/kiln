import { useMemo, useState } from 'react';
import { GroupAccordion } from '../components/GroupAccordion.js';
import { ReviewBar } from '../components/ReviewBar.js';
import { AgentPanel } from '../components/AgentPanel.js';
import { EventLog } from '../components/EventLog.js';
import type { KilnEvent } from '../../events/types.js';
import type { ComponentGroup } from '../../config/schema.js';
import type { ReviewData } from '../../stores/review-store.js';
import type { PreviewTarget } from '../App.js';

type FilterMode = 'pending' | 'reviewed' | 'all';

const filterTabs: { value: FilterMode; label: string }[] = [
  { value: 'pending', label: '\u672A\u30EC\u30D3\u30E5\u30FC' },
  { value: 'reviewed', label: '\u30EC\u30D3\u30E5\u30FC\u6E08' },
  { value: 'all', label: '\u5168\u90E8' },
];

interface DashboardProps {
  manifest: Record<string, any> | null;
  groups: ComponentGroup[];
  agents: any[];
  events: KilnEvent[];
  connected: boolean;
  preview: PreviewTarget | null;
  onPreview: (target: PreviewTarget | null) => void;
  reviewData: ReviewData | null;
  onReviewUpdated: () => void;
}

export function Dashboard({ manifest, groups, agents, events, connected, preview, onPreview, reviewData, onReviewUpdated }: DashboardProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const componentCount = manifest ? Object.keys(manifest).length : 0;
  const variantCount = manifest
    ? Object.values(manifest).reduce(
        (sum: number, c: any) => sum + Object.keys(c.variants).length,
        0,
      )
    : 0;

  // Find ungrouped components
  const ungrouped = useMemo(() => {
    if (!manifest || groups.length === 0) return [];
    const grouped = new Set(groups.flatMap((g) => g.components));
    return Object.keys(manifest).filter((name) => !grouped.has(name));
  }, [manifest, groups]);

  // Get current variant's review for preview
  const currentVariantReview = preview && reviewData
    ? reviewData.components[preview.component]?.variants[preview.vid]
    : undefined;

  return (
    <div style={{
      padding: '24px',
      maxWidth: preview ? 'none' : '1400px',
      margin: '0 auto',
      ...(preview
        ? { height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const }
        : { minHeight: '100vh' }),
    }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#f97316' }}>Kiln</span>
          </h1>
          <span style={{ fontSize: '12px', color: '#737373' }}>
            {componentCount} components / {variantCount} variants
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: connected ? '#22c55e' : '#ef4444',
          }} />
          <span style={{ fontSize: '12px', color: '#737373' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Main grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: preview ? '400px 1fr' : '1fr 320px',
        gap: preview ? '0' : '24px',
        ...(preview ? { flex: 1, minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' } : {}),
      }}>
        {/* Left: Grouped components */}
        <main style={{
          ...(preview ? { overflowY: 'auto' as const, paddingRight: '16px', minHeight: 0 } : {}),
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: '2px',
            marginBottom: '8px',
            background: '#141414',
            border: '1px solid #262626',
            borderRadius: '6px',
            padding: '3px',
          }}>
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: filter === tab.value ? '#262626' : 'transparent',
                  color: filter === tab.value ? '#e5e5e5' : '#525252',
                  fontFamily: 'inherit',
                  transition: 'all 0.1s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {manifest ? (
              <>
                {groups.map((group) => (
                  <GroupAccordion
                    key={group.name}
                    group={group}
                    manifest={manifest}
                    reviewData={reviewData ?? undefined}
                    filter={filter}
                    onPreview={(component, vid) => onPreview({ component, vid })}
                  />
                ))}
                {ungrouped.length > 0 && (
                  <GroupAccordion
                    group={{ name: 'Ungrouped', components: ungrouped }}
                    manifest={manifest}
                    reviewData={reviewData ?? undefined}
                    filter={filter}
                    defaultOpen={false}
                    onPreview={(component, vid) => onPreview({ component, vid })}
                  />
                )}
              </>
            ) : (
              <div style={{ color: '#737373', padding: '40px', textAlign: 'center' }}>
                Loading...
              </div>
            )}
          </div>
        </main>

        {/* Right: Preview panel or sidebar */}
        {preview ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderLeft: '1px solid #262626',
          }}>
            {/* Preview header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: '1px solid #262626',
              background: '#141414',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#e5e5e5', fontWeight: 500 }}>
                  {preview.component}
                </span>
                <span style={{ fontSize: '11px', color: '#f97316', fontFamily: 'monospace' }}>
                  {preview.vid}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={`/preview/${preview.component}/${preview.vid}`}
                  target="_blank"
                  rel="noopener"
                  style={{
                    fontSize: '11px',
                    color: '#737373',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid #333',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#525252'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; }}
                >
                  Open in tab
                </a>
                <button
                  onClick={() => onPreview(null)}
                  style={{
                    background: 'none',
                    border: '1px solid #333',
                    borderRadius: '3px',
                    color: '#737373',
                    cursor: 'pointer',
                    padding: '2px 8px',
                    fontSize: '14px',
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#525252'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Review bar */}
            <ReviewBar
              component={preview.component}
              variantId={preview.vid}
              currentReview={currentVariantReview}
              onReviewUpdated={onReviewUpdated}
            />
            {/* Preview iframe */}
            <iframe
              key={`${preview.component}/${preview.vid}`}
              src={`/preview/${preview.component}/${preview.vid}`}
              style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
            />
          </div>
        ) : (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <AgentPanel agents={agents} />
            <EventLog events={events} />
          </aside>
        )}
      </div>
    </div>
  );
}
