import type { Request, Response } from 'express';
import type { EventBus } from '../events/event-bus.js';

/**
 * SSE endpoint handler. Streams KilnEvents to connected clients.
 * Auto-reconnects via standard SSE retry mechanism.
 */
export function createSSEHandler(bus: EventBus) {
  return (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send retry interval (3 seconds)
    res.write('retry: 3000\n\n');

    // Send initial ready event
    res.write(`data: ${JSON.stringify({ type: 'system:ready' })}\n\n`);

    // Subscribe to all events
    const unsubscribe = bus.onAny((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Cleanup on disconnect
    res.on('close', () => {
      unsubscribe();
    });
  };
}
