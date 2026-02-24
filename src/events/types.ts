import type { AgentTask } from '../agents/protocol.js';
import type { ReviewStatus } from '../stores/review-store.js';

// ── Kiln Event Types ──────────────────────────────────────────────────

export type KilnEvent =
  // Variant events
  | { type: 'variant:discovered'; component: string; variantId: string }
  | { type: 'variant:changed'; component: string; variantId: string }
  | { type: 'variant:removed'; component: string; variantId: string }
  // Agent events
  | { type: 'agent:spawned'; agentId: string; task: AgentTask }
  | { type: 'agent:progress'; agentId: string; message: string }
  | { type: 'agent:completed'; agentId: string; outputs: string[] }
  | { type: 'agent:failed'; agentId: string; error: string }
  // Review events
  | { type: 'review:updated'; component: string; variantId: string; status: ReviewStatus | null }
  // System events
  | { type: 'system:ready' };

export type KilnEventType = KilnEvent['type'];

/** Extract event payload by type */
export type KilnEventOf<T extends KilnEventType> = Extract<KilnEvent, { type: T }>;
