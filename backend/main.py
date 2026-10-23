import asyncio
import math
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from simulation.engine import SimulationEngine
from sensors.adapters import (
    SimulatedLidarAdapter, SimulatedRadarAdapter, SimulatedThermalAdapter,
    SimulatedRgbAdapter, SimulatedUltrasonicAdapter, SimulatedIMUAdapter, SimulatedGNSSAdapter
)
from fusion.engine import SensorFusionEngine
from safety.engine import SafetyDecisionEngine
from simulation.navigation import NavigationEngine
from models.state import DetectedObject

app = FastAPI(title="MineNav-X Simulation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine()
active_connections = []

sensors_map = {
    "lidar": SimulatedLidarAdapter(),
    "radar": SimulatedRadarAdapter(),
    "thermal": SimulatedThermalAdapter(),
    "rgb": SimulatedRgbAdapter(),
    "ultrasonic": SimulatedUltrasonicAdapter(),
    "imu": SimulatedIMUAdapter(),
    "gnss": SimulatedGNSSAdapter()
}

fusion_engine = SensorFusionEngine()
safety_engine = SafetyDecisionEngine()
nav_engine = NavigationEngine()
system_mode = "SIMULATION"
current_scenario = "NORMAL"
latest_telemetry = None

async def broadcast_telemetry(payload: dict):
    """Immediately broadcast telemetry payload to all active WebSocket connections."""
    dead_connections = []
    for connection in list(active_connections):
        try:
            await connection.send_json(payload)
        except Exception:
            dead_connections.append(connection)

    for dead in dead_connections:
        if dead in active_connections:
            active_connections.remove(dead)

def generate_telemetry_payload(tick_rate: float = 20.0) -> dict:
    """Generate the latest telemetry snapshot based on current system mode."""
    global latest_telemetry

    if system_mode == "HARDWARE":
        # In HARDWARE mode, awaiting physical vehicle sensor drivers.
        # No simulated sensor data or mock vehicle movement is generated.
        raw_sensor_data = {}
        fused_objects = []
        nav_result = {"status": "STANDBY_AWAITING_HARDWARE", "waypoints": []}
        safety_result = {
            "risk": "CAUTION",
            "action": "STANDBY",
            "recommended_speed": 0.0,
            "ttc": None,
            "closest_distance": None,
            "closing_speed": 0.0,
            "trigger_reason": "HARDWARE_MODE_AWAITING_SENSORS"
        }
    else:
        # 1. Generate Sensor Data from simulated adapters
        datasets = [adapter.get_data(engine.state) for adapter in sensors_map.values()]

        # 2. Sensor Fusion
        fused_objects = fusion_engine.fuse(datasets)

        # 3. Navigation
        nav_result = nav_engine.evaluate(
            engine.state.vehicle.x,
            engine.state.vehicle.y,
            engine.state.vehicle.heading,
            fused_objects
        )

        # 4. Safety Decision & TTC
        safety_result = safety_engine.evaluate(
            fused_objects,
            engine.state.environment.visibility,
            engine.state.vehicle.speed
        )

        # 5. Enforce Speed Limit via Safety Engine
        engine.set_speed_limit(safety_result["recommended_speed"])

        # Serialize raw sensors for UI
        raw_sensor_data = {}
        for ds in datasets:
            raw_sensor_data[ds.sensor] = ds.model_dump()

    # 6. Build Telemetry Payload
    payload = {
        "type": "telemetry",
        "mode": system_mode,
        "scenario": current_scenario,
        "is_simulated": (system_mode == "SIMULATION"),
        "telemetry_source": "SIMULATION_ENGINE" if system_mode == "SIMULATION" else "PHYSICAL_SENSORS",
        "sim_time": engine.sim_time,
        "tick_rate": tick_rate,
        "state": engine.state.model_dump(),
        "sensors": {name: s.status for name, s in sensors_map.items()},
        "raw_sensors": raw_sensor_data,
        "fused_objects": fused_objects,
        "safety": safety_result,
        "navigation": nav_result
    }
    latest_telemetry = payload
    return payload

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(engine.run_loop())
    asyncio.create_task(broadcast_state())

async def broadcast_state():
    last_broadcast = time.time()
    while True:
        now = time.time()
        tick_rate = 1.0 / (now - last_broadcast) if (now - last_broadcast) > 0 else 0
        last_broadcast = now

        payload = generate_telemetry_payload(tick_rate=tick_rate)
        await broadcast_telemetry(payload)
        await asyncio.sleep(0.05)  # 20 Hz telemetry

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    # Immediately stream latest telemetry snapshot to initial connection
    if latest_telemetry is not None:
        try:
            await websocket.send_json(latest_telemetry)
        except Exception:
            pass
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "input":
                engine.set_inputs(
                    w=data.get("w", False),
                    a=data.get("a", False),
                    s=data.get("s", False),
                    d=data.get("d", False)
                )
            elif data.get("type") == "visibility":
                engine.set_visibility(data.get("value", 100.0))
    except (WebSocketDisconnect, Exception):
        if websocket in active_connections:
            active_connections.remove(websocket)

@app.get("/api/system/status")
def system_status():
    return {"status": "online", "mode": system_mode, "scenario": current_scenario}

@app.get("/api/telemetry")
def get_telemetry():
    """Retrieve the latest vehicle and sensor telemetry snapshot."""
    if latest_telemetry is None:
        return generate_telemetry_payload(tick_rate=20.0)
    return latest_telemetry

@app.post("/api/system/mode")
async def set_mode(data: dict):
    global system_mode
    system_mode = data.get("mode", "SIMULATION")
    payload = generate_telemetry_payload(tick_rate=20.0)
    await broadcast_telemetry(payload)
    return {"status": "ok", "mode": system_mode, "telemetry": payload}

@app.post("/api/simulation/scenario")
async def set_scenario(data: dict):
    global current_scenario
    scenario = data.get("name", "NORMAL")
    current_scenario = scenario
    fusion_engine.tracks.clear()
    engine.state.environment.objects = []

    if scenario == "NORMAL":
        engine.state.environment.visibility = 95.0
        engine.state.vehicle.speed = 0.0
    elif scenario == "DUST_CLOUD":
        engine.state.environment.visibility = 35.0
        engine.state.vehicle.speed = 5.0
    elif scenario == "WORKER_AHEAD":
        heading_rad = math.radians(90 - engine.state.vehicle.heading)
        worker_x = engine.state.vehicle.x + 30 * math.cos(heading_rad)
        worker_y = engine.state.vehicle.y + 30 * math.sin(heading_rad)
        engine.state.environment.objects.append(DetectedObject(
            id=f"worker_{len(engine.state.environment.objects)}",
            type="person", x=worker_x, y=worker_y
        ))
        engine.state.vehicle.speed = 10.0 # Force forward movement for TTC demonstration
    elif scenario == "VEHICLE_AHEAD":
        heading_rad = math.radians(90 - engine.state.vehicle.heading)
        # Vehicle 1 — closer, 30 m ahead, slow
        veh1_x = engine.state.vehicle.x + 30 * math.cos(heading_rad)
        veh1_y = engine.state.vehicle.y + 30 * math.sin(heading_rad)
        truck1 = DetectedObject(
            id="haul_truck_1",
            type="vehicle", x=veh1_x, y=veh1_y, speed=3.0, heading=engine.state.vehicle.heading
        )
        engine.state.environment.objects.append(truck1)
        # Vehicle 2 — farther, 60 m ahead, faster
        veh2_x = engine.state.vehicle.x + 60 * math.cos(heading_rad)
        veh2_y = engine.state.vehicle.y + 60 * math.sin(heading_rad)
        truck2 = DetectedObject(
            id="haul_truck_2",
            type="vehicle", x=veh2_x, y=veh2_y, speed=5.0, heading=engine.state.vehicle.heading
        )
        engine.state.environment.objects.append(truck2)
        engine.state.vehicle.speed = 6.0
    elif scenario == "ROCK_OBSTACLE":
        heading_rad = math.radians(90 - engine.state.vehicle.heading)
        rx = engine.state.vehicle.x + 15 * math.cos(heading_rad)
        ry = engine.state.vehicle.y + 15 * math.sin(heading_rad)
        engine.state.environment.objects.append(DetectedObject(
            id=f"rock_{len(engine.state.environment.objects)}",
            type="rock", x=rx, y=ry
        ))
        engine.state.vehicle.speed = 4.0

    payload = generate_telemetry_payload(tick_rate=20.0)
    await broadcast_telemetry(payload)
    return {"status": "ok", "scenario": scenario, "telemetry": payload}

@app.post("/api/simulation/input")
async def set_input(data: dict):
    engine.set_inputs(
        w=data.get("w", False),
        a=data.get("a", False),
        s=data.get("s", False),
        d=data.get("d", False)
    )
    payload = generate_telemetry_payload(tick_rate=20.0)
    return {"status": "ok", "telemetry": payload}

@app.post("/api/sensors/{sensor_name}/status")
async def set_sensor_status(sensor_name: str, data: dict):
    if sensor_name in sensors_map:
        new_status = data.get("status", "online")
        sensors_map[sensor_name].set_status(new_status)
        payload = generate_telemetry_payload(tick_rate=20.0)
        await broadcast_telemetry(payload)
        return {"status": "ok", "sensor": sensor_name, "status_value": new_status, "telemetry": payload}
    return {"status": "not found"}
