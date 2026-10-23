import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';

const SCENARIOS = [
  { id: 'NORMAL',          label: 'Normal Mine',       icon: '✓', desc: 'Clear environment, full visibility, no obstacles.' },
  { id: 'DUST_CLOUD',      label: 'Dust Cloud',        icon: '☁', desc: 'Visibility drops to 35%. RGB degrades, Radar reliable.' },
  { id: 'WORKER_AHEAD',    label: 'Worker Ahead',      icon: '⚠', desc: 'Person spawned 30m ahead. Triggers emergency stop.' },
  { id: 'VEHICLE_AHEAD',   label: 'Vehicle Ahead',     icon: '⛏', desc: 'Haul trucks 30m/60m ahead with relative velocity.' },
  { id: 'ROCK_OBSTACLE',   label: 'Rock Obstacle',     icon: '⬟', desc: 'Static rock 15m ahead triggering navigation.' },
];

export default function Controls({ telemetry, onTelemetryUpdate, onDriveInput }) {
  const [demoState, setDemoState] = useState('IDLE');
  const [demoStage, setDemoStage] = useState('');
  const [loadingScenario, setLoadingScenario] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const activeScenario = telemetry?.scenario || 'NORMAL';

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const trigger = async (id) => {
    setLoadingScenario(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/simulation/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: id })
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.telemetry && onTelemetryUpdate) {
        onTelemetryUpdate(data.telemetry);
      }
      return true;
    } catch (err) {
      console.error('Failed to trigger scenario:', err);
      setError(`Failed to set "${id}": ${err.message || 'Network error'}`);
      return false;
    } finally {
      setLoadingScenario(null);
    }
  };

  const stopDemo = async () => {
    abortRef.current = true;
    setDemoState('IDLE');
    setDemoStage('');
    await trigger('NORMAL');
  };

  const waitWithAbort = (ms) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (abortRef.current || Date.now() - start >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  const runDemo = async () => {
    if (demoState === 'RUNNING') {
      await stopDemo();
      return;
    }

    abortRef.current = false;
    setDemoState('RUNNING');
    setError(null);

    const stages = [
      { id: 'NORMAL', label: '1/5: Clear Normal Environment', duration: 2500 },
      { id: 'DUST_CLOUD', label: '2/5: Heavy Dust Incursion', duration: 3000 },
      { id: 'WORKER_AHEAD', label: '3/5: Worker Hazard (Emergency Stop)', duration: 3500 },
      { id: 'VEHICLE_AHEAD', label: '4/5: Haul Trucks Relative Velocity', duration: 3500 },
      { id: 'ROCK_OBSTACLE', label: '5/5: Static Rock Avoidance', duration: 3500 },
    ];

    try {
      for (const stage of stages) {
        if (abortRef.current) break;
        setDemoStage(stage.label);
        const ok = await trigger(stage.id);
        if (!ok || abortRef.current) break;
        await waitWithAbort(stage.duration);
      }
    } finally {
      if (!abortRef.current) {
        await trigger('NORMAL');
      }
      setDemoState('IDLE');
      setDemoStage('');
    }
  };

  const driveBtnStyle = {
    background: 'var(--bg-panel-light)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-main)',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center',
    userSelect: 'none'
  };

  const handleDriveStart = (key) => {
    if (onDriveInput) {
      onDriveInput(key, true);
    }
  };

  const handleDriveEnd = (key) => {
    if (onDriveInput) {
      onDriveInput(key, false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          SCENARIO CONTROLS
        </div>
        <button
          onClick={runDemo}
          style={{
            background: demoState === 'RUNNING' ? 'var(--status-critical)' : 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            padding: '4px 10px',
            fontSize: '10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: '0.2s',
            animation: demoState === 'RUNNING' ? 'flash-text 1.5s infinite' : 'none'
          }}
        >
          {demoState === 'RUNNING' ? '■ STOP DEMO' : '▶ DEMO MODE'}
        </button>
      </div>

      {demoState === 'RUNNING' && (
        <div style={{
          fontSize: '10px',
          color: 'var(--accent-cyan)',
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '4px',
          padding: '4px 8px',
          marginBottom: '8px',
          fontWeight: 600
        }}>
          {demoStage}
        </div>
      )}

      {error && (
        <div style={{
          fontSize: '11px',
          color: 'var(--status-critical)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--status-critical)',
          borderRadius: '4px',
          padding: '6px 8px',
          marginBottom: '8px'
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SCENARIOS.map(s => {
          const isActive = activeScenario === s.id;
          const isLoading = loadingScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                if (demoState === 'RUNNING') {
                  stopDemo();
                }
                trigger(s.id);
              }}
              disabled={isLoading}
              style={{
                background: isActive ? 'rgba(59, 130, 246, 0.16)' : 'var(--bg-panel-light)',
                border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{s.label}</span>
                  {isActive && (
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.15)', padding: '1px 6px', borderRadius: '3px' }}>
                      ACTIVE
                    </span>
                  )}
                  {isLoading && (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Updating...</span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Drive Pad */}
      <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span><span style={{ color: 'var(--accent-cyan)' }}>⌨</span> DRIVE CONTROLS</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>W/A/S/D or Click & Hold</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxWidth: '170px', margin: '0 auto' }}>
          <div></div>
          <button
            onMouseDown={() => handleDriveStart('w')}
            onMouseUp={() => handleDriveEnd('w')}
            onMouseLeave={() => handleDriveEnd('w')}
            onTouchStart={(e) => { e.preventDefault(); handleDriveStart('w'); }}
            onTouchEnd={() => handleDriveEnd('w')}
            style={driveBtnStyle}
            title="Accelerate Forward (W / Up)"
          >▲ W</button>
          <div></div>
          <button
            onMouseDown={() => handleDriveStart('a')}
            onMouseUp={() => handleDriveEnd('a')}
            onMouseLeave={() => handleDriveEnd('a')}
            onTouchStart={(e) => { e.preventDefault(); handleDriveStart('a'); }}
            onTouchEnd={() => handleDriveEnd('a')}
            style={driveBtnStyle}
            title="Steer Left (A / Left)"
          >◀ A</button>
          <button
            onMouseDown={() => handleDriveStart('s')}
            onMouseUp={() => handleDriveEnd('s')}
            onMouseLeave={() => handleDriveEnd('s')}
            onTouchStart={(e) => { e.preventDefault(); handleDriveStart('s'); }}
            onTouchEnd={() => handleDriveEnd('s')}
            style={driveBtnStyle}
            title="Brake / Reverse (S / Down)"
          >▼ S</button>
          <button
            onMouseDown={() => handleDriveStart('d')}
            onMouseUp={() => handleDriveEnd('d')}
            onMouseLeave={() => handleDriveEnd('d')}
            onTouchStart={(e) => { e.preventDefault(); handleDriveStart('d'); }}
            onTouchEnd={() => handleDriveEnd('d')}
            style={driveBtnStyle}
            title="Steer Right (D / Right)"
          >▶ D</button>
        </div>
      </div>
    </div>
  );
}
