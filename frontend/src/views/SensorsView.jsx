import React from 'react';

const ALL_SENSORS = [
  { id: 'lidar',      label: 'LiDAR',      desc: 'High-density 3D point cloud mapping (120m range)',   range: '120m',  hz: '20' },
  { id: 'radar',      label: 'RADAR',      desc: 'mmWave Doppler — velocity & distance (150m range)',   range: '150m',  hz: '20' },
  { id: 'thermal',    label: 'THERMAL',    desc: 'Infrared heat signature camera (100m range)',          range: '100m',  hz: '20' },
  { id: 'rgb',        label: 'RGB CAM',    desc: 'Visual classification camera (80m range)',            range: '80m',   hz: '20' },
  { id: 'ultrasonic', label: 'ULTRASONIC', desc: 'Short-range proximity detection (8m range)',          range: '8m',    hz: '20' },
  { id: 'imu',        label: 'IMU',        desc: 'Inertial measurement — acceleration & heading',       range: 'N/A',   hz: '20' },
  { id: 'gnss',       label: 'GNSS',       desc: 'Global Navigation Satellite System — position',      range: 'Global', hz: '10' },
];

export default function SensorsView({ telemetry }) {
  if (!telemetry) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>AWAITING TELEMETRY STREAM...</div>;

  const { sensors, raw_sensors } = telemetry;

  const toggleSensor = async (id, currentStatus) => {
    const newStatus = currentStatus === 'online' ? 'offline' : 'online';
    await fetch(`http://localhost:8000/api/sensors/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  };

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', overflowY: 'auto' }}>
      {ALL_SENSORS.map(s => {
        const status = sensors?.[s.id] || (raw_sensors?.[s.id]?.status) || 'online';
        const isOnline = status === 'online';
        const sData = raw_sensors?.[s.id];
        const detCount = sData?.detections?.length || 0;

        return (
          <div key={s.id} className="panel" style={{ borderLeft: `3px solid ${isOnline ? 'var(--status-safe)' : 'var(--status-offline)'}` }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', letterSpacing: '1px' }}>{s.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: '700',
                  color: isOnline ? 'var(--status-safe)' : 'var(--status-offline)',
                  background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
                  padding: '2px 8px', borderRadius: '10px',
                  border: `1px solid ${isOnline ? 'var(--status-safe)' : 'var(--status-offline)'}`
                }}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <button
                  onClick={() => toggleSensor(s.id, status)}
                  style={{
                    background: isOnline ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${isOnline ? 'var(--status-offline)' : 'var(--status-safe)'}`,
                    color: isOnline ? 'var(--status-offline)' : 'var(--status-safe)',
                    padding: '2px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  {isOnline ? 'FAIL' : 'RESTORE'}
                </button>
              </div>
            </div>
            <div className="panel-content" style={{ gap: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.desc}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                {[
                  ['RANGE', s.range],
                  ['RATE', s.hz + ' Hz'],
                  ['DETECTIONS', detCount.toString()],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>{k}</div>
                    <div className="mono" style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Latest Detection */}
              {isOnline && sData?.detections?.length > 0 && (
                <div style={{ marginTop: '8px', background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-muted)', maxHeight: '80px', overflowY: 'auto' }}>
                  {JSON.stringify(sData.detections[0], null, 2)}
                </div>
              )}
              {isOnline && sData?.raw_data && (
                <div style={{ marginTop: '8px', background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {JSON.stringify(sData.raw_data, null, 2)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
