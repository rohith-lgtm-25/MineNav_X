import React from 'react';
import SvgChart from '../components/SvgChart';

const RISK_COLORS = {
  SAFE: 'var(--status-safe)',
  CAUTION: 'var(--status-caution)',
  HIGH_RISK: 'var(--status-high)',
  CRITICAL: 'var(--status-critical)',
  EMERGENCY_STOP: 'var(--status-critical)',
};

const RISK_ORDER = ['SAFE', 'CAUTION', 'HIGH_RISK', 'CRITICAL', 'EMERGENCY_STOP'];

export default function SafetyView({ telemetry, history }) {
  if (!telemetry) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>AWAITING TELEMETRY STREAM...</div>;

  const { safety, state } = telemetry;
  const speed = (state.vehicle.speed * 3.6).toFixed(1);
  const reqSpeed = (safety.recommended_speed * 3.6).toFixed(1);
  const isEmergency = safety.action === 'EMERGENCY_STOP';
  const riskColor = RISK_COLORS[safety.risk] || 'var(--status-safe)';

  const currentRiskIndex = RISK_ORDER.indexOf(safety.risk);

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>

      {/* LEFT: Safety Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

        <div className={`panel ${isEmergency ? 'alert-critical' : ''}`} style={isEmergency ? {} : { borderColor: riskColor + '60' }}>
          <div className="panel-header" style={{ color: riskColor }}>
            SAFETY DECISION ENGINE
          </div>
          <div className="panel-content">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>CURRENT RISK LEVEL</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: riskColor, letterSpacing: '1px' }}>
                {safety.risk.replace('_', ' ')}
              </div>
              {isEmergency && (
                <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.2)', border: '1px solid var(--status-critical)', borderRadius: '6px', padding: '12px', animation: 'flash-text 1s infinite' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--status-critical)' }}>EMERGENCY STOP</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>VEHICLE BRAKING TO HALT</div>
                </div>
              )}
            </div>

            {/* Risk Ladder */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {RISK_ORDER.map((r, i) => (
                <div key={r} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                  borderRadius: '4px',
                  background: i === currentRiskIndex ? RISK_COLORS[r] + '20' : 'var(--bg-base)',
                  border: `1px solid ${i === currentRiskIndex ? RISK_COLORS[r] : 'transparent'}`,
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: i <= currentRiskIndex ? RISK_COLORS[r] : 'var(--border-focus)'
                  }} />
                  <span style={{ fontSize: '11px', color: i === currentRiskIndex ? RISK_COLORS[r] : 'var(--text-muted)', fontWeight: i === currentRiskIndex ? '700' : '400' }}>
                    {r.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="panel">
          <div className="panel-header">KEY SAFETY METRICS</div>
          <div className="panel-content">
            {[
              ['Risk Trigger', safety.trigger_reason || 'NONE', 'var(--text-bright)'],
              ['Time To Collision', (safety.closing_speed <= 0.1 && state.vehicle.speed < 0.1) ? 'N/A (Stopped)' : (safety.ttc !== null ? safety.ttc.toFixed(1) + ' s' : '∞'), safety.ttc !== null && safety.ttc < 3 ? 'var(--status-critical)' : 'var(--text-bright)'],
              ['Closing Speed', safety.closing_speed ? safety.closing_speed.toFixed(1) + ' m/s' : '0.0 m/s', safety.closing_speed > 2 ? 'var(--status-caution)' : 'var(--text-bright)'],
              ['Closest Object', safety.closest_distance !== null ? safety.closest_distance.toFixed(1) + ' m' : 'CLEAR', 'var(--text-bright)'],
              ['Current Speed', speed + ' km/h', state.vehicle.speed > safety.recommended_speed ? 'var(--status-high)' : 'var(--text-bright)'],
              ['Safe Speed Target', reqSpeed + ' km/h', 'var(--accent-cyan)'],
            ].map(([label, val, color]) => (
              <div key={label} className="data-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
                <span className="mono" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Charts */}
      <div className="panel">
        <div className="panel-header">LIVE TELEMETRY CHARTS</div>
        <div className="panel-content" style={{ gap: '24px' }}>
          <SvgChart data={history.speed} label="Vehicle Speed (km/h)" color="var(--accent-blue)" min={0} max={60} height={70} currentValue={`${speed} km/h`} />
          <SvgChart data={history.reqSpeed} label="Recommended Safe Speed (km/h)" color="var(--accent-cyan)" min={0} max={60} height={70} currentValue={`${reqSpeed} km/h`} />
          <SvgChart data={history.ttc} label="Time To Collision (s, capped 10s)" color={safety.ttc && safety.ttc < 3 ? 'var(--status-critical)' : 'var(--status-caution)'} min={0} max={10} height={70} currentValue={safety.ttc !== null ? safety.ttc.toFixed(1) + ' s' : '∞'} />
          <SvgChart data={history.visibility} label="Visibility Index (%)" color="var(--status-safe)" min={0} max={100} height={70} currentValue={`${state.environment.visibility.toFixed(0)}%`} />

          {/* Event log */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>LIVE EVENT LOG</div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.events.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No events yet.</div>
              ) : history.events.map((ev, i) => {
                const c = ev.type === 'CRITICAL' || ev.type === 'EMERGENCY_STOP' ? 'var(--status-critical)' :
                  ev.type === 'HIGH_RISK' ? 'var(--status-high)' :
                  ev.type === 'CAUTION' ? 'var(--status-caution)' :
                  ev.type === 'WARN' ? 'var(--status-caution)' : 'var(--text-muted)';
                return (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '6px 8px', background: 'var(--bg-base)', borderRadius: '3px', borderLeft: `2px solid ${c}` }}>
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ev.time}</span>
                    <span style={{ fontSize: '11px', color: c }}>{ev.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
