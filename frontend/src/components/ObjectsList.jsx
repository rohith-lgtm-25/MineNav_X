import React from 'react';

export default function ObjectsList({ telemetry }) {
  if (!telemetry) return null;
  const { fused_objects } = telemetry;

  return (
    <div style={{ marginTop: '20px' }}>
      <h2>Detected Objects (Fusion)</h2>
      {fused_objects.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No obstacles detected.</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {fused_objects.map(obj => (
            <div key={obj.id} style={{ background: '#334155', padding: '8px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>
                <span style={{ textTransform: 'capitalize' }}>{obj.type}</span>
                <span>{(obj.confidence * 100).toFixed(0)}% Conf</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Dist: {obj.distance.toFixed(1)}m</span>
                <span>Rel Vel: {obj.relative_velocity.toFixed(1)} m/s</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
