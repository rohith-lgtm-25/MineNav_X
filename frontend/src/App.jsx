import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { API_BASE_URL, WS_URL } from './config/api';
import CommandView from './views/CommandView';
import DigitalTwinView from './views/DigitalTwinView';
import PerceptionView from './views/PerceptionView';
import SafetyView from './views/SafetyView';
import SensorsView from './views/SensorsView';

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

  const processTelemetry = (msg) => {
    if (!msg || msg.type !== 'telemetry') return;
    setTelemetry(msg);
    if (msg.mode) {
      setMode(msg.mode);
    }

    // Generate Events
    const newEvents = [];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' });

    if (msg.safety?.risk && msg.safety.risk !== lastState.current.risk) {
      newEvents.push({ time: now, msg: `Risk changed to ${msg.safety.risk}`, type: msg.safety.risk });
      lastState.current.risk = msg.safety.risk;
    }

    if (msg.state?.environment?.visibility !== undefined && Math.abs(msg.state.environment.visibility - lastState.current.vis) > 10) {
      newEvents.push({ time: now, msg: `Visibility changed to ${msg.state.environment.visibility.toFixed(0)}%`, type: 'INFO' });
      lastState.current.vis = msg.state.environment.visibility;
    }

    if (msg.fused_objects && msg.fused_objects.length > lastState.current.trackCount) {
      newEvents.push({ time: now, msg: `New obstacle tracked`, type: 'WARN' });
    }
    if (msg.fused_objects) {
      lastState.current.trackCount = msg.fused_objects.length;
    }

    // Push History
    setHistory(prev => {
      const maxL = 100; // Keep last 100 ticks
      return {
        speed: [...prev.speed, (msg.state?.vehicle?.speed || 0) * 3.6].slice(-maxL),
        visibility: [...prev.visibility, msg.state?.environment?.visibility ?? 100].slice(-maxL),
        ttc: [...prev.ttc, msg.safety?.ttc || 10].slice(-maxL), // Cap 10 for chart
        reqSpeed: [...prev.reqSpeed, (msg.safety?.recommended_speed || 0) * 3.6].slice(-maxL),
        events: [...newEvents, ...prev.events].slice(0, 50) // Keep last 50 events
      };
    });
  };

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;
    let pollInterval = null;
    let reconnectDelay = 2000;
    let hasLoggedError = false;

    // Resilient REST fallback & initial telemetry bootstrap
    const fetchLatestTelemetry = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/telemetry`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            processTelemetry(data);
            setConnected(true);
            hasLoggedError = false;
          }
        } else {
          if (isMounted && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            setConnected(false);
          }
        }
      } catch {
        if (isMounted && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
          setConnected(false);
        }
      }
    };

    // Quick initial bootstrap fetch
    fetchLatestTelemetry();

    // Fallback polling active whenever WebSocket is not connected
    pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchLatestTelemetry();
      }
    }, 2000);

    const connectWebSocket = () => {
      if (!isMounted) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnected(true);
          reconnectDelay = 2000;
          hasLoggedError = false;
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            processTelemetry(msg);
            setConnected(true);
          } catch (e) {
            console.error('Failed to parse telemetry message:', e);
          }
        };

        ws.onerror = () => {
          if (!hasLoggedError) {
            console.warn(`[MineNav-X] Telemetry stream disconnected. Reconnecting to ${WS_URL}...`);
            hasLoggedError = true;
          }
          if (isMounted && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            setConnected(false);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        };
      } catch (err) {
        if (!hasLoggedError) {
          console.warn(`[MineNav-X] Connection failed (${err.message || 'network error'}). Retrying in ${Math.round(reconnectDelay / 1000)}s...`);
          hasLoggedError = true;
        }
        if (isMounted) {
          setConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      }
    };
  }, []);

  const handleDriveInput = (key, pressed) => {
    const k = key.toLowerCase();
    if (keysPressed.current[k] !== pressed) {
      keysPressed.current[k] = pressed;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', ...keysPressed.current }));
      } else {
        fetch(`${API_BASE_URL}/api/simulation/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keysPressed.current)
        }).catch(() => {});
      }
    }
  };

  // Keyboard controls...
  useEffect(() => {
    const keyMap = {
      w: 'w',
      a: 'a',
      s: 's',
      d: 'd',
      arrowup: 'w',
      arrowleft: 'a',
      arrowdown: 's',
      arrowright: 'd'
    };

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return;
      }
      const rawKey = e.key.toLowerCase();
      const mapped = keyMap[rawKey];
      if (mapped) {
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(rawKey)) {
          e.preventDefault();
        }
        if (!keysPressed.current[mapped]) {
          keysPressed.current[mapped] = true;
          sendInput();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return;
      }
      const rawKey = e.key.toLowerCase();
      const mapped = keyMap[rawKey];
      if (mapped) {
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(rawKey)) {
          e.preventDefault();
        }
        if (keysPressed.current[mapped]) {
          keysPressed.current[mapped] = false;
          sendInput();
        }
      }
    };

    const sendInput = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', ...keysPressed.current }));
      } else {
        fetch(`${API_BASE_URL}/api/simulation/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keysPressed.current)
        }).catch(() => {});
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
    try {
      const res = await fetch(`${API_BASE_URL}/api/system/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setMode(newMode);
        if (data.telemetry) {
          processTelemetry(data.telemetry);
        }
      }
    } catch (err) {
      console.error('Failed to toggle system mode:', err);
    }
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
          {connected && (telemetry?.is_simulated || mode === 'SIMULATION') && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              background: 'rgba(59,130,246,0.12)',
              color: 'var(--accent-blue)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(59,130,246,0.3)',
              letterSpacing: '0.5px'
            }}>
              SIMULATED
            </span>
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

        {activeTab === 'COMMAND' && (
          <CommandView
            telemetry={telemetry}
            history={history}
            onTelemetryUpdate={processTelemetry}
            onDriveInput={handleDriveInput}
          />
        )}
        {activeTab === 'DIGITAL TWIN' && <DigitalTwinView telemetry={telemetry} />}
        {activeTab === 'PERCEPTION' && <PerceptionView telemetry={telemetry} />}
        {activeTab === 'SAFETY' && <SafetyView telemetry={telemetry} history={history} />}
        {activeTab === 'SENSORS' && (
          <SensorsView
            telemetry={telemetry}
            onTelemetryUpdate={processTelemetry}
          />
        )}
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
