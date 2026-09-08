from pydantic import BaseModel
from typing import List, Optional, Any

class SensorObject(BaseModel):
    id: str
    object_type: str
    distance: float
    relative_velocity: float
    angle: float
    confidence: float
    x: float = 0.0
    y: float = 0.0
    heading: float = 0.0

class SensorData(BaseModel):
    sensor: str
    timestamp: float
    status: str = "online"
    detections: List[SensorObject] = []
    raw_data: Optional[Any] = None
