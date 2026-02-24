import fs from 'node:fs';
import path from 'node:path';
import type { EventBus } from '../events/event-bus.js';
import type { AgentState } from './protocol.js';

/**
 * AgentOracle monitors .kiln/agents/ for agent state files.
 * Polls on an interval, detects changes, and emits events.
 */
export class AgentOracle {
  private stateDir: string;
  private pollInterval: number;
  private bus: EventBus;
  private timer: ReturnType<typeof setInterval> | null = null;
  private knownStates = new Map<string, AgentState>();

  constructor(opts: { stateDir: string; pollInterval: number; bus: EventBus; root: string }) {
    this.stateDir = path.resolve(opts.root, opts.stateDir);
    this.pollInterval = opts.pollInterval;
    this.bus = opts.bus;
  }

  start(): void {
    fs.mkdirSync(this.stateDir, { recursive: true });
    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getAgents(): AgentState[] {
    return [...this.knownStates.values()];
  }

  private poll(): void {
    let files: string[];
    try {
      files = fs
        .readdirSync(this.stateDir)
        .filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }

    const currentIds = new Set<string>();

    for (const file of files) {
      const filePath = path.join(this.stateDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const state: AgentState = JSON.parse(raw);
        currentIds.add(state.id);

        const known = this.knownStates.get(state.id);

        if (!known) {
          // New agent
          this.knownStates.set(state.id, state);
          this.bus.emit({ type: 'agent:spawned', agentId: state.id, task: state.task });
        } else if (state.updatedAt !== known.updatedAt) {
          // Updated
          this.knownStates.set(state.id, state);

          if (state.status === 'completed') {
            this.bus.emit({
              type: 'agent:completed',
              agentId: state.id,
              outputs: state.outputs,
            });
          } else if (state.status === 'failed') {
            this.bus.emit({
              type: 'agent:failed',
              agentId: state.id,
              error: state.log[state.log.length - 1] ?? 'Unknown error',
            });
          } else {
            const lastLog = state.log[state.log.length - 1];
            if (lastLog) {
              this.bus.emit({
                type: 'agent:progress',
                agentId: state.id,
                message: lastLog,
              });
            }
          }
        }
      } catch {
        // Ignore malformed files
      }
    }
  }
}
