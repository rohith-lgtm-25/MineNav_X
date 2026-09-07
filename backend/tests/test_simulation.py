import pytest
from simulation.engine import SimulationEngine
from sensors.adapters import SimulatedRadarAdapter, SimulatedRgbAdapter
from fusion.engine import SensorFusionEngine
from safety.engine import SafetyDecisionEngine
from models.state import DetectedObject

def test_radar_detection():
    engine = SimulationEngine()
    engine.state.vehicle.speed = 10.0
    
    # Place object in front (North is +y)
    engine.state.environment.objects.append(DetectedObject(
        id="ground_truth_1",
        type="worker",
        x=0.0,
        y=20.0
    ))
    
    radar = SimulatedRadarAdapter()
    data = radar.get_data(engine.state)
    
    assert data.status == "online"
    assert len(data.detections) == 1
    # distance should be ~20m with slight noise
    assert 19.5 < data.detections[0].distance < 20.5
    assert data.detections[0].relative_velocity > 0 # we are closing in

def test_visibility_degradation():
    engine = SimulationEngine()
    engine.state.environment.objects.append(DetectedObject(id="gt2", type="rock", x=0.0, y=30.0))
    rgb = SimulatedRgbAdapter()
    
    # High visibility
    engine.state.environment.visibility = 100.0
    data_high = rgb.get_data(engine.state)
    assert len(data_high.detections) == 1
    conf_high = data_high.detections[0].confidence
    
    # Low visibility
    engine.state.environment.visibility = 20.0
    data_low = rgb.get_data(engine.state)
    assert len(data_low.detections) == 0

def test_sensor_fusion_spatial_association():
    fusion = SensorFusionEngine()
    
    # First frame
    radar_data = SimulatedRadarAdapter().get_data(SimulationEngine().state) # empty
    # Mock some data
    from sensors.models import SensorData, SensorObject
    d1 = SensorObject(id="radar_1", object_type="worker", distance=20, relative_velocity=5, angle=0, confidence=0.9, x=20, y=0)
    d2 = SensorObject(id="lidar_1", object_type="worker", distance=20.1, relative_velocity=5, angle=0.1, confidence=0.9, x=20.1, y=0)
    
    res1 = fusion.fuse([SensorData(sensor="radar", timestamp=1, detections=[d1]), 
                        SensorData(sensor="lidar", timestamp=1, detections=[d2])])
                        
    assert len(res1) == 1
    track_id = res1[0]["id"]
    assert track_id.startswith("Track_")
    
    # Second frame (simulate movement)
    d3 = SensorObject(id="radar_2", object_type="worker", distance=19, relative_velocity=5, angle=0, confidence=0.9, x=19, y=0)
    res2 = fusion.fuse([SensorData(sensor="radar", timestamp=2, detections=[d3])])
    
    assert len(res2) == 1
    assert res2[0]["id"] == track_id # MUST persist ID

def test_safety_emergency_stop():
    safety = SafetyDecisionEngine()
    fused_objects = [{
        "id": "Track_001",
        "type": "worker",
        "distance": 8.0, # extremely close
        "relative_velocity": 10.0, # very fast closing speed
        "angle": 0.0
    }]
    
    decision = safety.evaluate(fused_objects, visibility=100.0, current_speed=10.0)
    assert decision["risk"] == "CRITICAL"
    assert decision["action"] == "EMERGENCY_STOP"
    assert decision["recommended_speed"] == 0.0
