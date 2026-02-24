import { EventEmitter } from 'node:events';
import type { KilnEvent, KilnEventType, KilnEventOf } from './types.js';

/**
 * Typed event bus for internal Kiln communication.
 * All subsystems emit events here; SSE streams read from here.
 */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: KilnEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  on<T extends KilnEventType>(type: T, handler: (event: KilnEventOf<T>) => void): () => void {
    this.emitter.on(type, handler);
    return () => this.emitter.off(type, handler);
  }

  /** Listen to all events */
  onAny(handler: (event: KilnEvent) => void): () => void {
    this.emitter.on('*', handler);
    return () => this.emitter.off('*', handler);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
