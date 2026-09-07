from pydantic import BaseModel
from typing import List, Optional

class VehicleState(BaseModel):
    x: float = 0.0
    y: float = 0.0
    speed: float = 0.0  # m/s
    heading: float = 0.0  # degrees (0 is East, 90 is North)
    acceleration: float = 0.0  # m/s^2
    steering: float = 0.0
    brake: float = 0.0

class DetectedObject(BaseModel):
    id: str
    type: str  # e.g., 'person', 'rock', 'vehicle'
    x: float
    y: float
    speed: float = 0.0
    heading: float = 0.0
    
class EnvironmentState(BaseModel):
    visibility: float = 100.0  # 0 to 100%
    objects: List[DetectedObject] = []

class SimulationState(BaseModel):
    vehicle: VehicleState
    environment: EnvironmentState
    status: str = "running"
