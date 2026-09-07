import React from 'react';
import MineMap from '../components/MineMap';

export default function DigitalTwinView({ telemetry }) {
  if (!telemetry) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>AWAITING TELEMETRY STREAM...</div>;

  const { state, fused_objects, navigation } = telemetry;
  const { vehicle, environment } = state;

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

      {/* Main map — full bleed */}
      <div className="panel" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="panel-header">
          DIGITAL TWIN — MINE ENVIRONMENT
          <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
            {fused_objects.length} TRACKS ACTIVE
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px' }}>
          <MineMap telemetry={telemetry} size={580} />
        </div>
      </div>

      {/* Right info sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

        {/* Vehicle State */}
        <div className="panel">
          <div className="panel-header">EGO VEHICLE STATE</div>
          <div className="panel-content">
            {[
              ['Position X', `${vehicle.x.toFixed(2)} m`],
              ['Position Y', `${vehicle.y.toFixed(2)} m`],
              ['Speed', `${(vehicle.speed * 3.6).toFixed(1)} km/h`],
              ['Heading', `${vehicle.heading.toFixed(1)}°`],
              ['Acceleration', `${vehicle.acceleration.toFixed(2)} m/s²`],
            ].map(([k, v]) => (
              <div key={k} className="data-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{k}</span>
                <span className="data-value mono" style={{ fontSize: '12px' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Environment */}
        <div className="panel">
          <div className="panel-header">ENVIRONMENT</div>
          <div className="panel-content">
            <div className="data-row">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Visibility</span>
              <span className="mono" style={{
                color: environment.visibility < 40 ? 'var(--status-critical)' :
                  environment.visibility < 70 ? 'var(--status-caution)' : 'var(--status-safe)'
              }}>{environment.visibility.toFixed(0)}%</span>
            </div>
            {/* Visibility bar */}
            <div style={{ background: 'var(--bg-base)', borderRadius: '4px', height: '6px', marginTop: '8px' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${environment.visibility}%`,
                background: environment.visibility < 40 ? 'var(--status-critical)' :
                  environment.visibility < 70 ? 'var(--status-caution)' : 'var(--status-safe)',
                transition: 'width 0.5s'
              }} />
            </div>

            <div className="data-row" style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nav Status</span>
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>{navigation.status}</span>
            </div>
            <div className="data-row">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Obstacles</span>
              <span className="mono">{state.environment.objects.length}</span>
            </div>
          </div>
        </div>

        {/* Active Tracks */}
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-header">ACTIVE TRACKS</div>
          <div className="panel-content">
            {fused_objects.length === 0
              ? <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No objects detected.</div>
              : fused_objects.map(obj => (
                <div key={obj.id} style={{
                  background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                  borderRadius: '4px', padding: '10px', marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                    <span>{obj.id}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '2px' }}>{obj.type}</div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px' }}>
                    <span className="mono">{obj.distance.toFixed(1)}m</span>
                    <span className="mono" style={{ color: obj.relative_velocity > 0 ? 'var(--status-critical)' : 'var(--status-safe)' }}>
                      {obj.relative_velocity > 0 ? '↙' : '↗'} {Math.abs(obj.relative_velocity).toFixed(1)} m/s
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
