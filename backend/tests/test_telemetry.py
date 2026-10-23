import pytest
from fastapi.testclient import TestClient
import main
from main import app, active_connections, engine

@pytest.fixture
def client():
    # Ensure starting in simulation mode and clean scenario
    main.system_mode = "SIMULATION"
    main.current_scenario = "NORMAL"
    engine.state.environment.objects = []
    engine.state.vehicle.speed = 0.0
    with TestClient(app) as test_client:
        yield test_client

def test_telemetry_endpoint_schema(client):
    """Verify /api/telemetry returns a complete, compliant telemetry payload."""
    response = client.get("/api/telemetry")
    assert response.status_code == 200
    data = response.json()

    assert data["type"] == "telemetry"
    assert data["mode"] == "SIMULATION"
    assert data["scenario"] == "NORMAL"
    assert data["is_simulated"] is True
    assert data["telemetry_source"] == "SIMULATION_ENGINE"
    assert "sim_time" in data
    assert "tick_rate" in data

    # State verification
    assert "state" in data
    assert "vehicle" in data["state"]
    assert "environment" in data["state"]
    assert "speed" in data["state"]["vehicle"]
    assert "heading" in data["state"]["vehicle"]
    assert "visibility" in data["state"]["environment"]

    # Sensor verification
    assert "sensors" in data
    for sensor in ["lidar", "radar", "thermal", "rgb", "ultrasonic", "imu", "gnss"]:
        assert sensor in data["sensors"]

    assert "raw_sensors" in data
    assert "fused_objects" in data
    assert isinstance(data["fused_objects"], list)

    # Safety & Nav verification
    assert "safety" in data
    assert "risk" in data["safety"]
    assert "recommended_speed" in data["safety"]
    assert "navigation" in data
    assert "status" in data["navigation"]

def test_telemetry_hardware_mode_transition(client):
    """Verify HARDWARE mode stops generating mock readings and clearly reports hardware state."""
    # Switch to HARDWARE
    set_res = client.post("/api/system/mode", json={"mode": "HARDWARE"})
    assert set_res.status_code == 200
    assert set_res.json()["mode"] == "HARDWARE"

    tel_res = client.get("/api/telemetry")
    assert tel_res.status_code == 200
    data = tel_res.json()

    assert data["mode"] == "HARDWARE"
    assert data["is_simulated"] is False
    assert data["telemetry_source"] == "PHYSICAL_SENSORS"
    assert data["fused_objects"] == []
    assert data["raw_sensors"] == {}
    assert data["safety"]["action"] == "STANDBY"
    assert data["safety"]["trigger_reason"] == "HARDWARE_MODE_AWAITING_SENSORS"

    # Switch back to SIMULATION
    set_back = client.post("/api/system/mode", json={"mode": "SIMULATION"})
    assert set_back.status_code == 200
    assert set_back.json()["mode"] == "SIMULATION"

    data_back = client.get("/api/telemetry").json()
    assert data_back["mode"] == "SIMULATION"
    assert data_back["is_simulated"] is True
    assert data_back["telemetry_source"] == "SIMULATION_ENGINE"

def test_all_scenarios_update_state_and_telemetry(client):
    """Verify each scenario correctly updates environmental state and telemetry."""
    # 1. NORMAL
    res_norm = client.post("/api/simulation/scenario", json={"name": "NORMAL"})
    assert res_norm.status_code == 200
    data_norm = client.get("/api/telemetry").json()
    assert data_norm["scenario"] == "NORMAL"
    assert data_norm["state"]["environment"]["visibility"] >= 90.0
    assert len(data_norm["state"]["environment"]["objects"]) == 0

    # 2. DUST_CLOUD
    res_dust = client.post("/api/simulation/scenario", json={"name": "DUST_CLOUD"})
    assert res_dust.status_code == 200
    data_dust = client.get("/api/telemetry").json()
    assert data_dust["scenario"] == "DUST_CLOUD"
    assert data_dust["state"]["environment"]["visibility"] == 35.0

    # 3. WORKER_AHEAD
    res_worker = client.post("/api/simulation/scenario", json={"name": "WORKER_AHEAD"})
    assert res_worker.status_code == 200
    data_worker = client.get("/api/telemetry").json()
    assert data_worker["scenario"] == "WORKER_AHEAD"
    assert any(obj["type"] == "person" for obj in data_worker["state"]["environment"]["objects"])
    assert data_worker["state"]["vehicle"]["speed"] > 0

    # 4. VEHICLE_AHEAD
    res_veh = client.post("/api/simulation/scenario", json={"name": "VEHICLE_AHEAD"})
    assert res_veh.status_code == 200
    data_veh = client.get("/api/telemetry").json()
    assert data_veh["scenario"] == "VEHICLE_AHEAD"
    assert any(obj["type"] == "vehicle" for obj in data_veh["state"]["environment"]["objects"])

    # 5. ROCK_OBSTACLE
    res_rock = client.post("/api/simulation/scenario", json={"name": "ROCK_OBSTACLE"})
    assert res_rock.status_code == 200
    data_rock = client.get("/api/telemetry").json()
    assert data_rock["scenario"] == "ROCK_OBSTACLE"
    assert any(obj["type"] == "rock" for obj in data_rock["state"]["environment"]["objects"])

    # Reset back to NORMAL
    client.post("/api/simulation/scenario", json={"name": "NORMAL"})

def test_sensor_status_toggle(client):
    """Verify individual sensor status can be failed and restored."""
    # Fail LiDAR
    res_fail = client.post("/api/sensors/lidar/status", json={"status": "offline"})
    assert res_fail.status_code == 200
    data_fail = client.get("/api/telemetry").json()
    assert data_fail["sensors"]["lidar"] == "offline"

    # Restore LiDAR
    res_restore = client.post("/api/sensors/lidar/status", json={"status": "online"})
    assert res_restore.status_code == 200
    data_restore = client.get("/api/telemetry").json()
    assert data_restore["sensors"]["lidar"] == "online"

def test_vehicle_input_controls(client):
    """Verify vehicle input endpoint registers drive inputs."""
    res = client.post("/api/simulation/input", json={"w": True, "a": False, "s": False, "d": False})
    assert res.status_code == 200
    assert engine.inputs["w"] is True
    assert engine.inputs["s"] is False

    # Stop driving
    res_stop = client.post("/api/simulation/input", json={"w": False, "a": False, "s": False, "d": False})
    assert res_stop.status_code == 200
    assert engine.inputs["w"] is False

def test_websocket_telemetry_lifecycle(client):
    """Verify WebSocket connection sends telemetry, accepts commands, and cleans up on close."""
    initial_conns = len(active_connections)
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "telemetry"
        assert "state" in msg
        assert "safety" in msg

        # Send control inputs
        ws.send_json({"type": "input", "w": True, "a": False, "s": False, "d": False})
        ws.send_json({"type": "visibility", "value": 85.0})

    # Ensure connection closed cleanly
    assert len(active_connections) == initial_conns
