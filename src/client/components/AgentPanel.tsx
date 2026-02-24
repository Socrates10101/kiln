import type { AgentState } from '../../agents/protocol.js';

interface AgentPanelProps {
  agents: AgentState[];
}

const statusColors: Record<string, string> = {
  pending: '#eab308',
  running: '#f97316',
  completed: '#22c55e',
  failed: '#ef4444',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
};

export function AgentPanel({ agents }: AgentPanelProps) {
  return (
    <section style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3a3a3' }}>
          Agents
        </h3>
        <span style={{ fontSize: '11px', color: '#525252' }}>{agents.length}</span>
      </div>

      <div style={{ padding: '8px 0', maxHeight: '300px', overflow: 'auto' }}>
        {agents.length === 0 ? (
          <div style={{ padding: '16px 14px', fontSize: '12px', color: '#525252', textAlign: 'center' }}>
            No active agents
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))
        )}
      </div>
    </section>
  );
}

function AgentCard({ agent }: { agent: AgentState }) {
  const statusColor = statusColors[agent.status] ?? '#737373';
  const lastLog = agent.log[agent.log.length - 1];

  return (
    <div style={{
      padding: '8px 14px',
      borderBottom: '1px solid #1a1a1a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          ...(agent.status === 'running' ? { animation: 'pulse 1.5s infinite' } : {}),
        }} />
        <span style={{ fontSize: '12px', fontWeight: 500 }}>
          {agent.task.component}
        </span>
        <span style={{ fontSize: '10px', color: '#525252' }}>
          {statusLabels[agent.status]}
        </span>
      </div>
      {lastLog && (
        <div style={{ fontSize: '11px', color: '#737373', paddingLeft: '14px' }}>
          {lastLog}
        </div>
      )}
    </div>
  );
}
