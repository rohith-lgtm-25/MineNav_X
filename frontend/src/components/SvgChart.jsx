import React from 'react';

export default function SvgChart({ 
  data, 
  width = '100%', 
  height = 60, 
  color = 'var(--accent-cyan)', 
  min = 0, 
  max = 100, 
  label = '',
  currentValue = null
}) {
  if (!data || data.length === 0) {
    return <div style={{ height, background: 'rgba(255,255,255,0.02)' }} />;
  }
  
  const maxPoints = 100;
  // Pad data to always fill from right to left if not full
  const points = data.length < maxPoints 
    ? [...Array(maxPoints - data.length).fill(null), ...data] 
    : data.slice(-maxPoints);
  
  const range = max - min || 1;
  
  // Calculate SVG Path
  let pathStr = '';
  points.forEach((val, i) => {
    if (val === null) return;
    // x varies from 0 to 100 (percentage based for responsive SVG)
    const x = (i / (maxPoints - 1)) * 100;
    const clamped = Math.max(min, Math.min(max, val));
    const y = 100 - ((clamped - min) / range) * 100;
    
    if (!pathStr) pathStr += `M ${x} ${y} `;
    else pathStr += `L ${x} ${y} `;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        {currentValue !== null && <span className="mono" style={{ color }}>{currentValue}</span>}
      </div>
      <div style={{ position: 'relative', height, width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          
          <path d={pathStr} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}
