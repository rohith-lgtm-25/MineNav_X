import time
import math
import random
from sensors.models import SensorData, SensorObject
from models.state import SimulationState

class BaseSensorAdapter:
    def __init__(self, name: str):
        self.name = name
        self.status = "online"
        self.seq = 0
        
    def set_status(self, status: str):
        self.status = status
        
    def get_data(self, state: SimulationState) -> SensorData:
        raise NotImplementedError

def calculate_relative(state: SimulationState, obj) -> tuple:
    dx = obj.x - state.vehicle.x
    dy = obj.y - state.vehicle.y
    dist = math.sqrt(dx**2 + dy**2)
    
    heading_rad = math.radians(90 - state.vehicle.heading)
    vx = state.vehicle.speed * math.cos(heading_rad)
    vy = state.vehicle.speed * math.sin(heading_rad)
    
    # closing velocity (positive means closing in)
    dot_product = vx * dx + vy * dy
    closing_speed = (dot_product / dist) if dist > 0 else 0
    
    target_angle = math.degrees(math.atan2(dy, dx))
    angle = (target_angle - (90 - state.vehicle.heading))
    angle = (angle + 180) % 360 - 180
    
    return dist, closing_speed, angle, dx, dy

class SimulatedRgbAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("rgb")
        
    def get_data(self, state: SimulationState) -> SensorData:
        self.seq += 1
        data = SensorData(sensor=self.name, timestamp=time.time(), status=self.status, detections=[])
        if self.status != "online": return data
        
        vis = state.environment.visibility
        for i, obj in enumerate(state.environment.objects):
            dist, closing_speed, angle, dx, dy = calculate_relative(state, obj)
            if dist > 80 or abs(angle) > 60: continue
            
            conf = min(0.95, vis / 100.0 + 0.1 - (dist / 200))
            if conf > 0.3:
                # Add noise
                dist_noise = random.gauss(0, 0.5)
                angle_noise = random.gauss(0, 1.0)
                data.detections.append(SensorObject(
                    id=f"rgb_{self.seq}_{i}",
                    object_type=obj.type,
                    distance=max(0.1, dist + dist_noise),
                    relative_velocity=closing_speed,
                    angle=angle + angle_noise,
                    confidence=conf,
                    x=state.vehicle.x + (dist+dist_noise)*math.cos(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                    y=state.vehicle.y + (dist+dist_noise)*math.sin(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                    heading=obj.heading
                ))
        return data

class SimulatedThermalAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("thermal")
        
    def get_data(self, state: SimulationState) -> SensorData:
        self.seq += 1
        data = SensorData(sensor=self.name, timestamp=time.time(), status=self.status, detections=[])
        if self.status != "online": return data
        
        for i, obj in enumerate(state.environment.objects):
            dist, closing_speed, angle, dx, dy = calculate_relative(state, obj)
            if dist > 100 or abs(angle) > 50: continue
            
            if obj.type in ["person", "vehicle"]:
                conf = 0.90 - (dist / 300)
                if conf > 0.5:
                    dist_noise = random.gauss(0, 1.5)
                    angle_noise = random.gauss(0, 1.5)
                    data.detections.append(SensorObject(
                        id=f"thermal_{self.seq}_{i}",
                        object_type=obj.type,
                        distance=max(0.1, dist + dist_noise),
                        relative_velocity=closing_speed,
                        angle=angle + angle_noise,
                        confidence=conf,
                        x=state.vehicle.x + (dist+dist_noise)*math.cos(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                        y=state.vehicle.y + (dist+dist_noise)*math.sin(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                        heading=obj.heading
                    ))
        return data

class SimulatedRadarAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("radar")
        
    def get_data(self, state: SimulationState) -> SensorData:
        self.seq += 1
        data = SensorData(sensor=self.name, timestamp=time.time(), status=self.status, detections=[])
        if self.status != "online": return data
        
        for i, obj in enumerate(state.environment.objects):
            dist, closing_speed, angle, dx, dy = calculate_relative(state, obj)
            if dist > 150 or abs(angle) > 45: continue
            
            conf = 0.95 - (dist / 500)
            dist_noise = random.gauss(0, 0.2) # Radar is accurate in distance
            vel_noise = random.gauss(0, 0.1)  # accurate doppler
            angle_noise = random.gauss(0, 2.0) # slightly worse angle
            
            data.detections.append(SensorObject(
                id=f"radar_{self.seq}_{i}",
                object_type=obj.type, # Radar might struggle with type, but fusion handles this
                distance=max(0.1, dist + dist_noise),
                relative_velocity=closing_speed + vel_noise,
                angle=angle + angle_noise,
                confidence=conf,
                x=state.vehicle.x + (dist+dist_noise)*math.cos(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                y=state.vehicle.y + (dist+dist_noise)*math.sin(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                heading=obj.heading
            ))
        return data

class SimulatedLidarAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("lidar")
        
    def get_data(self, state: SimulationState) -> SensorData:
        self.seq += 1
        data = SensorData(sensor=self.name, timestamp=time.time(), status=self.status, detections=[])
        if self.status != "online": return data
        
        vis = state.environment.visibility
        for i, obj in enumerate(state.environment.objects):
            dist, closing_speed, angle, dx, dy = calculate_relative(state, obj)
            if dist > 120: continue
            
            dust_factor = (100 - vis) / 100.0
            conf = 0.98 - (dust_factor * 0.4) - (dist / 400)
            
            if conf > 0.4:
                dist_noise = random.gauss(0, 0.05) # Lidar is very accurate
                angle_noise = random.gauss(0, 0.1)
                data.detections.append(SensorObject(
                    id=f"lidar_{self.seq}_{i}",
                    object_type=obj.type,
                    distance=max(0.1, dist + dist_noise),
                    relative_velocity=closing_speed,
                    angle=angle + angle_noise,
                    confidence=conf,
                    x=state.vehicle.x + (dist+dist_noise)*math.cos(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                    y=state.vehicle.y + (dist+dist_noise)*math.sin(math.radians(90 - state.vehicle.heading + angle + angle_noise)),
                    heading=obj.heading
                ))
        return data

class SimulatedUltrasonicAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("ultrasonic")
        
    def get_data(self, state: SimulationState) -> SensorData:
        self.seq += 1
        data = SensorData(sensor=self.name, timestamp=time.time(), status=self.status, detections=[])
        if self.status != "online": return data
        
        for i, obj in enumerate(state.environment.objects):
            dist, closing_speed, angle, dx, dy = calculate_relative(state, obj)
            if dist > 8: continue # short range
            
            conf = 0.99 - (dist / 8.0) * 0.5
            dist_noise = random.gauss(0, 0.1)
            data.detections.append(SensorObject(
                id=f"us_{self.seq}_{i}",
                object_type="unknown", # US usually doesn't know type
                distance=max(0.1, dist + dist_noise),
                relative_velocity=closing_speed,
                angle=angle,
                confidence=conf,
                x=state.vehicle.x + (dist+dist_noise)*math.cos(math.radians(90 - state.vehicle.heading + angle)),
                y=state.vehicle.y + (dist+dist_noise)*math.sin(math.radians(90 - state.vehicle.heading + angle)),
                heading=obj.heading
            ))
        return data

class SimulatedIMUAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("imu")
        
    def get_data(self, state: SimulationState) -> SensorData:
        if self.status != "online": 
            return SensorData(sensor=self.name, timestamp=time.time(), status="offline", raw_data=None)
            
        accel = state.vehicle.acceleration + random.gauss(0, 0.1)
        # simplistic angular velocity
        angular_vel = random.gauss(0, 0.5) 
        heading = state.vehicle.heading + random.gauss(0, 0.5)
        
        return SensorData(
            sensor=self.name, 
            timestamp=time.time(), 
            status="online",
            raw_data={"acceleration": accel, "angular_velocity": angular_vel, "heading": heading}
        )

class SimulatedGNSSAdapter(BaseSensorAdapter):
    def __init__(self):
        super().__init__("gnss")
        self.base_lat = -23.723 # generic mine location
        self.base_lon = 133.881
        
    def get_data(self, state: SimulationState) -> SensorData:
        if self.status != "online":
            return SensorData(sensor=self.name, timestamp=time.time(), status="offline", raw_data=None)
            
        # 1 meter ~ 1/111111 degrees
        lat = self.base_lat + (state.vehicle.y / 111111.0) + random.gauss(0, 0.00001)
        lon = self.base_lon + (state.vehicle.x / (111111.0 * math.cos(math.radians(self.base_lat)))) + random.gauss(0, 0.00001)
        
        return SensorData(
            sensor=self.name,
            timestamp=time.time(),
            status="online",
            raw_data={"latitude": lat, "longitude": lon, "accuracy": random.uniform(1.0, 3.0)}
        )
