// ── Agent Protocol ────────────────────────────────────────────────────
// AI agents write these JSON files to .kiln/agents/{agentId}.json
// Kiln's Oracle reads them to show agent status in the UI.

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentTask {
  type: 'generate' | 'iterate' | 'refine';
  component: string;
  parentVariant?: string;
  instruction?: string;
}

export interface AgentState {
  id: string;
  status: AgentStatus;
  task: AgentTask;
  outputs: string[];
  startedAt: string;
  updatedAt: string;
  log: string[];
}
