import type { KilnEvent } from '../../events/types.js';

interface EventLogProps {
  events: KilnEvent[];
}

const eventIcons: Record<string, string> = {
  'variant:discovered': '+',
  'variant:changed': '~',
  'variant:removed': '-',
  'agent:spawned': '>',
  'agent:progress': '.',
  'agent:completed': '*',
  'agent:failed': '!',
  'review:updated': '\u2713',
  'system:ready': '#',
};

const eventColors: Record<string, string> = {
  'variant:discovered': '#22c55e',
  'variant:changed': '#eab308',
  'variant:removed': '#ef4444',
  'agent:spawned': '#f97316',
  'agent:progress': '#737373',
  'agent:completed': '#22c55e',
  'agent:failed': '#ef4444',
  'review:updated': '#22c55e',
  'system:ready': '#525252',
};

function formatEvent(event: KilnEvent): string {
  switch (event.type) {
    case 'variant:discovered':
      return `${event.component}/${event.variantId}`;
    case 'variant:changed':
      return `${event.component}/${event.variantId}`;
    case 'variant:removed':
      return `${event.component}/${event.variantId}`;
    case 'agent:spawned':
      return `${event.agentId}: ${event.task.component}`;
    case 'agent:progress':
      return `${event.agentId}: ${event.message}`;
    case 'agent:completed':
      return `${event.agentId}: ${event.outputs.length} outputs`;
    case 'agent:failed':
      return `${event.agentId}: ${event.error}`;
    case 'review:updated':
      return `${event.component}/${event.variantId} \u2192 ${event.status}`;
    case 'system:ready':
      return 'Connected';
  }
}

export function EventLog({ events }: EventLogProps) {
  const reversed = [...events].reverse();

  return (
    <section style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: '8px',
      overflow: 'hidden',
      flex: 1,
      minHeight: 0,
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #262626',
      }}>
        <h3 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3a3a3' }}>
          Events
        </h3>
      </div>

      <div style={{ padding: '4px 0', maxHeight: '400px', overflow: 'auto', fontFamily: 'monospace', fontSize: '11px' }}>
        {reversed.length === 0 ? (
          <div style={{ padding: '16px 14px', color: '#525252', textAlign: 'center', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
            Waiting for events...
          </div>
        ) : (
          reversed.map((event, i) => (
            <div
              key={i}
              style={{
                padding: '3px 14px',
                display: 'flex',
                gap: '8px',
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: eventColors[event.type] ?? '#525252', flexShrink: 0 }}>
                {eventIcons[event.type] ?? '?'}
              </span>
              <span style={{ color: '#525252', flexShrink: 0 }}>
                {event.type.split(':')[1]}
              </span>
              <span style={{ color: '#a3a3a3' }}>
                {formatEvent(event)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
