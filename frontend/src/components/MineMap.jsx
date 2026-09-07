import React, { useRef, useEffect } from 'react';

const OBJECT_COLORS = {
  person: '#eab308',
  worker: '#eab308',
  vehicle: '#3b82f6',
  haul_truck: '#60a5fa',
  rock: '#94a3b8',
  barrier: '#f97316',
  unknown: '#64748b',
};

const RISK_RING_RADII = [20, 40, 60]; // meters

export default function MineMap({ telemetry, size = 500 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!telemetry) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { state, fused_objects, safety } = telemetry;
    const { vehicle, environment } = state;
    const vis = environment.visibility;
    const headingRad = ((90 - vehicle.heading) * Math.PI) / 180;

    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 200; // 200m world visible

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#05070B';
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = 'rgba(30,41,59,0.7)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < size; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let y = 0; y < size; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }

    // Mine Zones
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, cx, cy);
    ctx.fillStyle = 'rgba(100,116,139,0.3)';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('ZONE A (ACTIVE)', 10, 20);
    ctx.fillText('ZONE B (MAINTENANCE)', cx + 10, cy + 20);

    // Mine Road / Path Geometry
    ctx.beginPath();
    ctx.moveTo(cx, size);
    ctx.lineTo(cx, cy);
    ctx.quadraticCurveTo(cx, 40, cx + 100, 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 40;
    ctx.stroke();

    // Planned Navigation Path
    if (telemetry.navigation?.waypoint) {
      const [wx, wy] = telemetry.navigation.waypoint;
      const wpx = cx + wx * scale;
      const wpy = cy - wy * scale;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(wpx, wpy);
      ctx.strokeStyle = 'rgba(16,185,129,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Waypoint marker
      ctx.beginPath(); ctx.arc(wpx, wpy, 4, 0, Math.PI * 2); ctx.fillStyle = '#10b981'; ctx.fill();
    } else {
      // Projected path if no waypoint
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(headingRad) * 60 * scale, cy - Math.sin(headingRad) * 60 * scale);
      ctx.strokeStyle = 'rgba(6,182,212,0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Sensor Coverage Cone
    const fov = 90 * Math.PI / 180; // 90 degree FOV
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, RISK_RING_RADII[2] * scale, -headingRad - fov/2, -headingRad + fov/2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(59,130,246,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,130,246,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Detection range rings
    RISK_RING_RADII.forEach((r, i) => {
      const colors = ['rgba(239,68,68,0.2)', 'rgba(251,191,36,0.15)', 'rgba(16,185,129,0.1)'];
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors[i].replace('0.2', '0.05').replace('0.15', '0.05').replace('0.1', '0.05');
      ctx.fill();
    });

    // Ring labels
    RISK_RING_RADII.forEach((r) => {
      ctx.fillStyle = 'rgba(100,116,139,0.6)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`${r}m`, cx + r * scale + 2, cy - 2);
    });

    // Fused Objects
    fused_objects.forEach(obj => {
      const angRad = ((90 - vehicle.heading + obj.angle) * Math.PI) / 180;
      const px = cx + obj.distance * scale * Math.cos(angRad);
      const py = cy - obj.distance * scale * Math.sin(angRad);
      const color = OBJECT_COLORS[obj.type] || OBJECT_COLORS.unknown;

      // Glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 16);
      grad.addColorStop(0, color + '60');
      grad.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();

      // Object dot
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${obj.id} (${obj.type})`, px + 10, py - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`${obj.distance.toFixed(1)}m`, px + 10, py + 8);
    });

    // Ego Vehicle (triangle pointing in heading direction)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-headingRad + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-9, 10);
    ctx.lineTo(9, 10);
    ctx.closePath();
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Fog overlay based on visibility
    const fogAlpha = (1 - vis / 100) * 0.7;
    if (fogAlpha > 0) {
      const fog = ctx.createRadialGradient(cx, cy, size * 0.25, cx, cy, size * 0.7);
      fog.addColorStop(0, `rgba(180,140,60,0)`);
      fog.addColorStop(1, `rgba(180,140,60,${fogAlpha})`);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = fog;
      ctx.fill();
    }

  }, [telemetry, size]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          borderRadius: '50%',
          border: `2px solid ${telemetry?.safety?.risk === 'CRITICAL' ? 'var(--status-critical)' : 'var(--border-subtle)'}`,
          boxShadow: telemetry?.safety?.risk === 'CRITICAL'
            ? '0 0 30px rgba(239,68,68,0.3)'
            : '0 0 20px rgba(6,182,212,0.05)',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: '1',
          objectFit: 'contain'
        }}
      />
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
        {Object.entries(OBJECT_COLORS).slice(0, 4).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: v }} />
            <span style={{ textTransform: 'capitalize' }}>{k}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#06b6d4' }} />
          <span>Ego Vehicle</span>
        </div>
      </div>
    </div>
  );
}
