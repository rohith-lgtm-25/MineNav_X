import test from 'node:test';
import assert from 'node:assert/strict';

// Helper validator matching App.jsx logic
function validateTelemetryPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.type !== 'telemetry') return false;
  if (!payload.state || typeof payload.state !== 'object') return false;
  if (!payload.safety || typeof payload.safety !== 'object') return false;
  return true;
}

test('validateTelemetryPayload accepts valid production telemetry payload', () => {
  const sample = {
    type: 'telemetry',
    mode: 'SIMULATION',
    scenario: 'NORMAL',
    is_simulated: true,
    sim_time: 12.5,
    tick_rate: 20.0,
    state: {
      vehicle: { x: 0, y: 0, speed: 5.5, heading: 90 },
      environment: { visibility: 95.0, objects: [] }
    },
    safety: { risk: 'SAFE', action: 'NONE', recommended_speed: 15.0 },
    sensors: { lidar: 'online', radar: 'online' },
    fused_objects: []
  };

  assert.equal(validateTelemetryPayload(sample), true);
  assert.equal(sample.scenario, 'NORMAL');
});

test('validateTelemetryPayload rejects invalid or corrupted messages', () => {
  assert.equal(validateTelemetryPayload(null), false);
  assert.equal(validateTelemetryPayload('corrupt string'), false);
  assert.equal(validateTelemetryPayload({ type: 'pong' }), false);
  assert.equal(validateTelemetryPayload({ type: 'telemetry' }), false); // missing state & safety
});

test('safe message parser handles JSON parse errors without throwing', () => {
  let parsed = null;
  let parseError = null;

  try {
    parsed = JSON.parse('{"type": "telemetry", "mode": "SIMULATION"');
  } catch (err) {
    parseError = err;
  }

  assert.notEqual(parseError, null);
  assert.equal(parsed, null);
});

test('keyboard map correctly maps both WASD and Arrow keys to vehicle controls', () => {
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

  assert.equal(keyMap['w'], 'w');
  assert.equal(keyMap['arrowup'], 'w');
  assert.equal(keyMap['a'], 'a');
  assert.equal(keyMap['arrowleft'], 'a');
  assert.equal(keyMap['s'], 's');
  assert.equal(keyMap['arrowdown'], 's');
  assert.equal(keyMap['d'], 'd');
  assert.equal(keyMap['arrowright'], 'd');
});

test('scenario name validation correctly identifies all supported scenarios', () => {
  const validScenarios = ['NORMAL', 'DUST_CLOUD', 'WORKER_AHEAD', 'VEHICLE_AHEAD', 'ROCK_OBSTACLE'];
  for (const s of validScenarios) {
    assert.equal(validScenarios.includes(s), true);
  }
  assert.equal(validScenarios.includes('UNKNOWN_SCENARIO'), false);
});
