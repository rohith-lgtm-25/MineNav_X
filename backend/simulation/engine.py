import math
import time
import asyncio
from models.state import SimulationState, VehicleState, EnvironmentState, DetectedObject

class SimulationEngine:
    def __init__(self):
        self.state = SimulationState(
            vehicle=VehicleState(x=0, y=0, speed=0, heading=0, acceleration=0),
            environment=EnvironmentState(visibility=90.0, objects=[])
        )
        self.last_tick = time.time()
        self.running = True
        self.sim_time = 0.0
        
        # Physics constants
        self.MAX_SPEED = 15.0 # m/s
        self.ACCELERATION_RATE = 2.0 # m/s^2
        self.BRAKE_RATE = 5.0 # m/s^2
        self.TURN_RATE = 45.0 # deg/s
        self.FRICTION = 0.5 # m/s^2
        
        # Current inputs
        self.inputs = {"w": False, "a": False, "s": False, "d": False}
        
        # Target speed limit (e.g. from safety engine)
        self.speed_limit = self.MAX_SPEED

    def set_inputs(self, w: bool, a: bool, s: bool, d: bool):
        self.inputs = {"w": w, "a": a, "s": s, "d": d}

    def set_speed_limit(self, limit: float):
        self.speed_limit = limit

    def set_visibility(self, vis: float):
        self.state.environment.visibility = max(0.0, min(100.0, vis))

    def update(self):
        now = time.time()
        dt = now - self.last_tick
        self.last_tick = now
        self.sim_time += dt

        # Navigation Override
        nav_steer = 0.0
        if hasattr(self, 'nav_engine') and self.nav_engine and self.nav_engine.waypoint:
            # We don't have direct access here easily without restructuring, but we can set it from main.py
            pass
            
        brake_amount = 0.0
        steering_amount = 0.0

        # Update vehicle speed based on inputs
        if self.inputs["w"]:
            self.state.vehicle.speed += self.ACCELERATION_RATE * dt
            self.state.vehicle.acceleration = self.ACCELERATION_RATE
        elif self.inputs["s"]:
            self.state.vehicle.speed -= self.BRAKE_RATE * dt
            self.state.vehicle.acceleration = -self.BRAKE_RATE
            brake_amount = 1.0
        else:
            # Natural friction
            if self.state.vehicle.speed > 0:
                self.state.vehicle.speed -= self.FRICTION * dt
                self.state.vehicle.acceleration = -self.FRICTION
            elif self.state.vehicle.speed < 0:
                self.state.vehicle.speed += self.FRICTION * dt
                self.state.vehicle.acceleration = self.FRICTION
            else:
                self.state.vehicle.acceleration = 0.0

        # Enforce limits
        if self.state.vehicle.speed > self.MAX_SPEED:
            self.state.vehicle.speed = self.MAX_SPEED
        elif self.state.vehicle.speed < -self.MAX_SPEED / 2: # Reverse
            self.state.vehicle.speed = -self.MAX_SPEED / 2
            
        if self.state.vehicle.speed > self.speed_limit:
            self.state.vehicle.speed -= self.BRAKE_RATE * dt * 2
            self.state.vehicle.acceleration = -self.BRAKE_RATE * 2
            brake_amount = 1.0
            if self.state.vehicle.speed < self.speed_limit:
                self.state.vehicle.speed = max(0.0, self.speed_limit)

        self.state.vehicle.brake = brake_amount * 100.0

        # Update heading based on inputs
        turn_direction = 1 if self.state.vehicle.speed >= 0 else -1
        if self.inputs["a"]:
            steering_amount = -1.0
            self.state.vehicle.heading += self.TURN_RATE * dt
        elif self.inputs["d"]:
            steering_amount = 1.0
            self.state.vehicle.heading -= self.TURN_RATE * dt
            
        self.state.vehicle.steering = steering_amount * turn_direction
                
        # Normalize heading to 0-360 (0 is East, 90 is North in standard math, but let's use 0=North, 90=East)
        self.state.vehicle.heading = self.state.vehicle.heading % 360

        # Update position
        # Standard navigation math: 0 is North, 90 is East
        heading_rad = math.radians(90 - self.state.vehicle.heading)
        self.state.vehicle.x += self.state.vehicle.speed * math.cos(heading_rad) * dt
        self.state.vehicle.y += self.state.vehicle.speed * math.sin(heading_rad) * dt

    async def run_loop(self):
        while self.running:
            self.update()
            await asyncio.sleep(0.05) # 20 Hz
