import React from 'react';

const SENSOR_DEFS = [
  { id: 'lidar',      label: 'LiDAR',       color: '#06b6d4', desc: 'High-res 3D spatial mapping' },
  { id: 'radar',      label: 'RADAR',       color: '#3b82f6', desc: 'Doppler velocity & distance' },
  { id: 'thermal',    label: 'THERMAL',     color: '#f97316', desc: 'IR heat signature detection' },
  { id: 'rgb',        label: 'RGB CAM',     color: '#a855f7', desc: 'Visual classification' },
  { id: 'ultrasonic', label: 'ULTRASONIC',  color: '#10b981', desc: 'Short-range proximity' },
];

export default function PerceptionView({ telemetry }) {
  if (!telemetry) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>AWAITING TELEMETRY STREAM...</div>;

  const { raw_sensors, fused_objects, sensors } = telemetry;

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

      {/* LEFT: Per-sensor raw detections */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">SENSOR DETECTIONS</div>
        <div className="panel-content" style={{ gap: '12px' }}>
          {SENSOR_DEFS.map(({ id, label, color, desc }) => {
            const sData = raw_sensors?.[id];
            const detections = sData?.detections || [];
            const isOnline = sensors?.[id] === 'online';

            return (
              <div key={id} style={{
                background: 'var(--bg-base)', border: `1px solid ${isOnline ? color + '40' : 'var(--border-subtle)'}`,
                borderLeft: `3px solid ${isOnline ? color : 'var(--status-offline)'}`,
                borderRadius: '4px', padding: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: isOnline ? color : 'var(--status-offline)' }}>{label}</span>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: isOnline ? 'var(--status-safe)' : 'var(--status-offline)' }}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                    {isOnline && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{detections.length} det.</div>}
                  </div>
                </div>

                {isOnline && detections.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {detections.slice(0, 2).map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-panel)', padding: '4px 6px', borderRadius: '3px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{d.object_type}</span>
                        <span className="mono">{d.distance.toFixed(1)}m @ {d.angle.toFixed(1)}°</span>
                        <span style={{ color }}>{(d.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER: Fusion flow visualizer */}
      <div className="panel">
        <div className="panel-header">SENSOR FUSION PIPELINE</div>
        <div className="panel-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          {fused_objects.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
              No tracks active. Deploy a scenario to observe fusion.
            </div>
          ) : fused_objects.map(obj => (
            <div key={obj.id} style={{
              background: 'var(--bg-base)', border: '1px solid var(--border-focus)',
              borderRadius: '6px', padding: '16px', marginBottom: '16px', width: '100%'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-cyan)', fontSize: '14px', marginBottom: '12px' }}>
                {obj.id}
              </div>

              {/* Fusion lines */}
              {SENSOR_DEFS.filter(s => obj.sensors_detecting?.includes(s.id)).map(({ id, label, color }) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ color, minWidth: '70px', fontWeight: '600' }}>{label}</span>
                  <div style={{ flex: 1, height: '2px', background: color, borderRadius: '2px', opacity: 0.6 }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                </div>
              ))}

              <div style={{ textAlign: 'center', marginTop: '12px', padding: '8px', background: 'var(--bg-panel)', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>FUSED RESULT</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'capitalize', marginTop: '4px' }}>{obj.type}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '6px', fontSize: '11px' }}>
                  <span className="mono">{obj.distance.toFixed(1)}m</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>{(obj.confidence * 100).toFixed(0)}% conf</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Raw JSON feed */}
      <div className="panel">
        <div className="panel-header">RAW SENSOR STREAM</div>
        <div className="panel-content" style={{ padding: 0, gap: 0 }}>
          {SENSOR_DEFS.map(({ id, label, color }) => {
            const sData = raw_sensors?.[id];
            if (!sData || sData.status === 'offline') return null;
            return (
              <div key={id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{
                  padding: '6px 12px', fontSize: '10px', fontWeight: '700',
                  color, background: 'var(--bg-panel-light)', letterSpacing: '1px'
                }}>
                  {label} — {(sData.detections || []).length} DETECTIONS
                </div>
                <pre style={{
                  margin: 0, padding: '8px 12px', fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)',
                  maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(sData.detections?.slice(0, 1) || sData.raw_data || {}, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
