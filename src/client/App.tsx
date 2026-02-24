import { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './pages/Dashboard.js';
import type { KilnEvent } from '../events/types.js';
import type { ComponentGroup } from '../config/schema.js';
import type { ReviewData } from '../stores/review-store.js';

export interface PreviewTarget {
  component: string;
  vid: string;
}

export function App() {
  const [manifest, setManifest] = useState<Record<string, any> | null>(null);
  const [groups, setGroups] = useState<ComponentGroup[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [events, setEvents] = useState<KilnEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const fetchReview = useCallback(() => {
    fetch('/api/review')
      .then((r) => r.json())
      .then(setReviewData)
      .catch(console.error);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetch('/api/manifest')
      .then((r) => r.json())
      .then(setManifest)
      .catch(console.error);

    fetch('/api/groups')
      .then((r) => r.json())
      .then(setGroups)
      .catch(console.error);

    fetch('/api/agents')
      .then((r) => r.json())
      .then(setAgents)
      .catch(console.error);

    fetchReview();
  }, [fetchReview]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event: KilnEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-99), event]);

        if (event.type.startsWith('variant:')) {
          fetch('/api/manifest')
            .then((r) => r.json())
            .then(setManifest)
            .catch(console.error);
        }
        if (event.type.startsWith('agent:')) {
          fetch('/api/agents')
            .then((r) => r.json())
            .then(setAgents)
            .catch(console.error);
        }
        if (event.type === 'review:updated') {
          fetchReview();
        }
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, [fetchReview]);

  return (
    <Dashboard
      manifest={manifest}
      groups={groups}
      agents={agents}
      events={events}
      connected={connected}
      preview={preview}
      onPreview={setPreview}
      reviewData={reviewData}
      onReviewUpdated={fetchReview}
    />
  );
}
