import React from 'react';

const SCENARIOS = [
  { id: 'NORMAL',          label: 'Normal Mine',       icon: '✓', desc: 'Clear environment, full visibility, no obstacles.' },
  { id: 'DUST_CLOUD',      label: 'Dust Cloud',        icon: '☁', desc: 'Visibility drops to 35%. RGB degrades, Radar reliable.' },
  { id: 'WORKER_AHEAD',    label: 'Worker Ahead',      icon: '⚠', desc: 'Person spawned 30m ahead. All sensors track.' },
  { id: 'VEHICLE_AHEAD',   label: 'Vehicle Ahead',     icon: '⛏', desc: 'Haul truck 50m ahead with relative velocity.' },
  { id: 'ROCK_OBSTACLE',   label: 'Rock Obstacle',     icon: '⬟', desc: 'Static rock 15m ahead triggering navigation.' },
];

export default function Controls() {
  const [demoState, setDemoState] = React.useState('IDLE');

  const trigger = async (id) => {
    await fetch('http://localhost:8000/api/simulation/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: id })
    });
  };

  const runDemo = async () => {
    if (demoState !== 'IDLE') return;
    setDemoState('RUNNING');
    
    // Step 1: Normal
    await trigger('NORMAL');
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 2: Dust
    await trigger('DUST_CLOUD');
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 3: Worker Ahead (triggers emergency stop if vehicle is moving)
    await trigger('WORKER_AHEAD');
    
    // Reset state after a while so it can be re-run
    setTimeout(() => setDemoState('IDLE'), 10000);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          SCENARIO CONTROLS
        </div>
        <button onClick={runDemo} disabled={demoState !== 'IDLE'} style={{
          background: demoState === 'IDLE' ? 'var(--accent-blue)' : 'var(--bg-panel-light)',
          color: '#fff', border: 'none', padding: '4px 10px', fontSize: '10px', borderRadius: '4px', cursor: demoState === 'IDLE' ? 'pointer' : 'default', fontWeight: 'bold'
        }}>
          {demoState === 'IDLE' ? '▶ DEMO MODE' : 'DEMO RUNNING...'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            onClick={() => trigger(s.id)}
            style={{
              background: 'var(--bg-panel-light)',
              border: '1px solid var(--border-subtle)',
              borderLeft: s.id === 'DUST_CLOUD' ? '3px solid var(--status-caution)' : s.id.includes('OBSTACLE') || s.id.includes('ROCK') ? '3px solid var(--status-high)' : s.id === 'NORMAL' ? '3px solid var(--status-safe)' : '3px solid var(--status-critical)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: '0.2s',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '18px', minWidth: '20px' }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600' }}>{s.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
        <span style={{ color: 'var(--accent-cyan)' }}>⌨</span> W/A/S/D — Drive vehicle
      </div>
    </div>
  );
}
