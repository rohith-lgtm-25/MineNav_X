import React from 'react';
import MineMap from '../components/MineMap';
import Controls from '../components/Controls';
import SvgChart from '../components/SvgChart';

export default function CommandView({ telemetry, history }) {
  if (!telemetry) return <div style={{ padding: '20px' }}>AWAITING TELEMETRY STREAM...</div>;

  const { state, safety } = telemetry;
  const speed = (state.vehicle.speed * 3.6).toFixed(1);
  const reqSpeed = (safety.recommended_speed * 3.6).toFixed(1);
  
  let alertClass = '';
  let riskColor = 'var(--status-safe)';
  if (safety.risk === 'CAUTION') riskColor = 'var(--status-caution)';
  if (safety.risk === 'HIGH_RISK') riskColor = 'var(--status-high)';
  if (safety.risk === 'CRITICAL' || safety.action === 'EMERGENCY_STOP') {
    riskColor = 'var(--status-critical)';
    alertClass = 'alert-critical';
  }

  return (
    <div className="command-grid">
      {/* LEFT: TELEMETRY */}
      <div className="panel">
        <div className="panel-header">VEHICLE INSTRUMENTS</div>
        <div className="panel-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="gauge-block">
              <div className="gauge-label">SPEED</div>
              <div className="gauge-value mono" style={{ color: state.vehicle.speed > safety.recommended_speed ? 'var(--status-high)' : 'var(--text-bright)' }}>
                {speed}<span className="gauge-unit">km/h</span>
              </div>
            </div>
            <div className="gauge-block">
              <div className="gauge-label">HEADING</div>
              <div className="gauge-value mono">{state.vehicle.heading.toFixed(0)}<span className="gauge-unit">°</span></div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            <div>
              <div className="data-row">
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>POS X</span>
                <span className="data-value mono" style={{ fontSize: '11px' }}>{state.vehicle.x.toFixed(2)}</span>
              </div>
              <div className="data-row">
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>POS Y</span>
                <span className="data-value mono" style={{ fontSize: '11px' }}>{state.vehicle.y.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <div className="data-row">
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>ACCEL</span>
                <span className="data-value mono" style={{ fontSize: '11px' }}>{state.vehicle.acceleration?.toFixed(2) || '0.00'} m/s²</span>
              </div>
              <div className="data-row">
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>STEER / BRK</span>
                <span className="data-value mono" style={{ fontSize: '11px' }}>
                  {state.vehicle.steering?.toFixed(1) || '0.0'} / {state.vehicle.brake?.toFixed(0) || '0'}%
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <SvgChart data={history.speed} label="LIVE SPEED (km/h)" color="var(--accent-blue)" min={0} max={60} height={40} currentValue={speed} />
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <div className="panel-header" style={{ background: 'transparent', padding: '0 0 8px 0' }}>ENVIRONMENT</div>
            <div className="gauge-block" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
              <div style={{ textAlign: 'left' }}>
                <div className="gauge-label" style={{ marginBottom: 0 }}>VISIBILITY</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {state.environment.visibility < 40 ? 'HIGH DUST' : state.environment.visibility < 70 ? 'MEDIUM DUST' : 'LOW DUST'}
                </div>
              </div>
              <div className="gauge-value mono" style={{ color: state.environment.visibility < 40 ? 'var(--status-caution)' : 'var(--text-bright)' }}>
                {state.environment.visibility.toFixed(0)}<span className="gauge-unit">%</span>
              </div>
            </div>
          </div>
          
          {/* COMPACT SENSOR HEALTH */}
          <div style={{ marginTop: '16px', flex: 1 }}>
            <div className="panel-header" style={{ background: 'transparent', padding: '0 0 8px 0' }}>SENSOR HEALTH</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              {['radar', 'lidar', 'thermal', 'rgb'].map(s => {
                const isOnline = telemetry.sensors?.[s] === 'online';
                // Estimate confidence purely for visualization based on visibility
                let conf = 99;
                if (s === 'rgb') conf = state.environment.visibility;
                else if (s === 'lidar') conf = Math.max(50, state.environment.visibility + 20);
                else if (s === 'thermal') conf = 98;
                
                return (
                  <div key={s} className="data-row" style={{ paddingBottom: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s}</span>
                    <span className="mono" style={{ fontSize: '11px', color: isOnline ? 'var(--status-safe)' : 'var(--status-offline)' }}>
                      {isOnline ? `${conf.toFixed(0)}%` : 'OFFLINE'}
                    </span>
                  </div>
                );
              })}
              {['ultrasonic', 'imu', 'gnss'].map(s => {
                const isOnline = telemetry.sensors?.[s] === 'online';
                return (
                  <div key={s} className="data-row" style={{ paddingBottom: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s}</span>
                    <span className="mono" style={{ fontSize: '11px', color: isOnline ? 'var(--status-safe)' : 'var(--status-offline)' }}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: DIGITAL TWIN */}
      <div className="panel">
        <div className="panel-header">TACTICAL OVERVIEW</div>
        <div className="panel-content" style={{ padding: 0, justifyContent: 'center', alignItems: 'center' }}>
          <MineMap telemetry={telemetry} size={600} />
        </div>
      </div>

      {/* RIGHT: SAFETY */}
      <div className={`panel ${alertClass}`}>
        <div className="panel-header">SAFETY STATUS</div>
        <div className="panel-content">
          
          <div style={{ textAlign: 'center', padding: '24px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>CURRENT RISK</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: riskColor, letterSpacing: '1px' }}>
              {safety.risk.replace('_', ' ')}
            </div>
            
            {safety.action === 'EMERGENCY_STOP' && (
              <div style={{ marginTop: '16px', background: 'var(--status-critical)', color: '#fff', padding: '8px', borderRadius: '4px', fontWeight: 'bold', animation: 'flash-text 1s infinite' }}>
                EMERGENCY STOP ACTIVATED
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <div className="data-row">
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>RISK TRIGGER</span>
              <span className="data-value mono" style={{ fontSize: '12px', color: 'var(--text-bright)' }}>{safety.trigger_reason || 'NONE'}</span>
            </div>
            <div className="data-row">
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>TIME TO COLLISION</span>
              <span className="data-value mono" style={{ fontSize: '16px', color: safety.ttc < 3 ? 'var(--status-critical)' : 'var(--text-bright)' }}>
                {(safety.closing_speed <= 0.1 && state.vehicle.speed < 0.1) ? 'N/A (Stopped)' : (safety.ttc !== null ? safety.ttc.toFixed(1) + ' s' : '∞')}
              </span>
            </div>
            <div className="data-row">
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>CLOSEST OBJECT</span>
              <span className="data-value mono">
                {safety.closest_distance !== null ? safety.closest_distance.toFixed(1) + ' m' : 'NONE'}
              </span>
            </div>
            <div className="data-row">
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>TARGET SAFE SPEED</span>
              <span className="data-value mono" style={{ color: 'var(--accent-cyan)' }}>{reqSpeed} km/h</span>
            </div>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Controls />
          </div>
        </div>
      </div>
    </div>
  );
}
