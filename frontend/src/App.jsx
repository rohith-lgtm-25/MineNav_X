import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import CommandView from './views/CommandView';
import DigitalTwinView from './views/DigitalTwinView';
import PerceptionView from './views/PerceptionView';
import SafetyView from './views/SafetyView';
import SensorsView from './views/SensorsView';

const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState('SIMULATION');
  const [activeTab, setActiveTab] = useState('COMMAND');
  
  // Historical data for charts
  const [history, setHistory] = useState({
    speed: [], visibility: [], ttc: [], reqSpeed: [], events: []
  });

  const wsRef = useRef(null);
  const keysPressed = useRef({ w: false, a: false, s: false, d: false });
  const lastState = useRef({ risk: 'SAFE', vis: 100, trackCount: 0 });

  useEffect(() => {
    const connect = () => {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => setConnected(true);
      wsRef.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 1000);
      };
      
      wsRef.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'telemetry') {
          setTelemetry(msg);
          setMode(msg.mode);
          
          // Generate Events
          const newEvents = [];
          const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' });
          
          if (msg.safety.risk !== lastState.current.risk) {
            newEvents.push({ time: now, msg: `Risk changed to ${msg.safety.risk}`, type: msg.safety.risk });
            lastState.current.risk = msg.safety.risk;
          }
          
          if (Math.abs(msg.state.environment.visibility - lastState.current.vis) > 10) {
            newEvents.push({ time: now, msg: `Visibility changed to ${msg.state.environment.visibility.toFixed(0)}%`, type: 'INFO' });
            lastState.current.vis = msg.state.environment.visibility;
          }
          
          if (msg.fused_objects.length > lastState.current.trackCount) {
            newEvents.push({ time: now, msg: `New obstacle tracked`, type: 'WARN' });
          }
          lastState.current.trackCount = msg.fused_objects.length;

          // Push History
          setHistory(prev => {
            const maxL = 100; // Keep last 100 ticks
            return {
              speed: [...prev.speed, msg.state.vehicle.speed * 3.6].slice(-maxL),
              visibility: [...prev.visibility, msg.state.environment.visibility].slice(-maxL),
              ttc: [...prev.ttc, msg.safety.ttc || 10].slice(-maxL), // Cap 10 for chart
              reqSpeed: [...prev.reqSpeed, msg.safety.recommended_speed * 3.6].slice(-maxL),
              events: [...newEvents, ...prev.events].slice(0, 50) // Keep last 50 events
            };
          });
        }
      };
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  // Keyboard controls...
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['w','a','s','d'].includes(e.key.toLowerCase())) {
        keysPressed.current[e.key.toLowerCase()] = true;
        sendInput();
      }
    };
    const handleKeyUp = (e) => {
      if (['w','a','s','d'].includes(e.key.toLowerCase())) {
        keysPressed.current[e.key.toLowerCase()] = false;
        sendInput();
      }
    };
    const sendInput = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', ...keysPressed.current }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toggleMode = async () => {
    const newMode = mode === 'SIMULATION' ? 'HARDWARE' : 'SIMULATION';
    await fetch('http://localhost:8000/api/system/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
  };

  const navs = ['COMMAND', 'DIGITAL TWIN', 'PERCEPTION', 'SAFETY', 'SENSORS'];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="top-nav">
        <div className="nav-brand">
          <span className="nav-brand-title">MINENAV-X</span>
          <span className="nav-brand-subtitle">AUTONOMOUS MINE COMMAND CENTER</span>
        </div>
        
        <div className="nav-links">
          {navs.map(n => (
            <button key={n} className={`nav-link ${activeTab === n ? 'active' : ''}`} onClick={() => setActiveTab(n)}>
              {n}
            </button>
          ))}
        </div>

        <div className="nav-status">
          {telemetry && (
            <div style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">
              <div>T+ {telemetry.sim_time.toFixed(1)}s</div>
              <div>{telemetry.tick_rate.toFixed(0)} Hz</div>
            </div>
          )}
          <button className={`mode-toggle ${mode === 'HARDWARE' ? 'hardware' : ''}`} onClick={toggleMode}>
            {mode}
          </button>
          <div style={{ fontWeight: 600, color: connected ? 'var(--status-safe)' : 'var(--status-offline)' }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="view-container">
        {mode === 'HARDWARE' && (
          <div style={{ background: 'var(--status-caution)', color: '#000', padding: '12px', textAlign: 'center', fontWeight: 'bold', borderRadius: '4px', marginBottom: '16px' }}>
            WARNING: HARDWARE MODE SELECTED. AWAITING PHYSICAL SENSOR DRIVERS. NO SIMULATED DATA WILL BE GENERATED.
          </div>
        )}

        {activeTab === 'COMMAND' && <CommandView telemetry={telemetry} history={history} />}
        {activeTab === 'DIGITAL TWIN' && <DigitalTwinView telemetry={telemetry} />}
        {activeTab === 'PERCEPTION' && <PerceptionView telemetry={telemetry} />}
        {activeTab === 'SAFETY' && <SafetyView telemetry={telemetry} history={history} />}
        {activeTab === 'SENSORS' && <SensorsView telemetry={telemetry} />}
      </div>

      {/* Bottom Info Strip */}
      <footer className="bottom-strip">
        <div className="strip-item">
          <span className="strip-label">SENSOR FUSION</span>
          <span className="strip-value" style={{ color: 'var(--accent-cyan)' }}>
            {telemetry?.fused_objects?.length || 0} TRACKS
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">AI PERCEPTION</span>
          <span className="strip-value">
            {(telemetry?.state?.environment?.objects?.length || 0)} TARGETS
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">LIVE TELEMETRY</span>
          <span className="strip-value">
            {telemetry?.state?.vehicle?.speed ? (telemetry.state.vehicle.speed * 3.6).toFixed(1) : '0.0'} KM/H
          </span>
        </div>
        <div className="strip-item" style={{ flex: 1 }}>
          <span className="strip-label">LATEST EVENT</span>
          <span className="strip-value" style={{ color: history.events[0]?.type === 'CRITICAL' ? 'var(--status-critical)' : 'var(--text-bright)' }}>
            {history.events[0] ? `${history.events[0].time} — ${history.events[0].msg}` : 'SYSTEM INITIALIZED'}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
