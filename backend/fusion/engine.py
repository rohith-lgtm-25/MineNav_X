import math
from typing import List, Dict
from sensors.models import SensorData

class TrackedObject:
    def __init__(self, track_id: str):
        self.id = track_id
        self.type = "unknown"
        self.distance = 0.0
        self.relative_velocity = 0.0
        self.angle = 0.0
        self.x = 0.0
        self.y = 0.0
        self.confidence = 0.5
        self.sensors_detecting = []
        self.missed_frames = 0
        
    def update(self, detections: list):
        if not detections:
            self.missed_frames += 1
            self.confidence -= 0.1
            return
            
        self.missed_frames = 0
        self.distance = sum(d.distance for d in detections) / len(detections)
        self.relative_velocity = sum(d.relative_velocity for d in detections) / len(detections)
        self.angle = sum(d.angle for d in detections) / len(detections)
        self.x = sum(d.x for d in detections) / len(detections)
        self.y = sum(d.y for d in detections) / len(detections)
        
        types = [d.object_type for d in detections if d.object_type != 'unknown']
        if types:
            self.type = max(set(types), key=types.count)
            
        base_conf = sum(d.confidence for d in detections) / len(detections)
        boost = 0.1 * (len(detections) - 1)
        self.confidence = min(1.0, base_conf + boost)
        
        self.sensors_detecting = list(set([d.id.split("_")[0] for d in detections]))

class SensorFusionEngine:
    def __init__(self):
        self.tracks: Dict[str, TrackedObject] = {}
        self.next_track_id = 1
        self.ASSOCIATION_RADIUS = 6.5 # meters

    def fuse(self, sensor_datasets: List[SensorData]) -> List[dict]:
        all_detections = []
        for ds in sensor_datasets:
            if ds.detections:
                all_detections.extend(ds.detections)
                
        # 1. Associate detections with existing tracks
        matched_detections = {t_id: [] for t_id in self.tracks}
        unmatched_detections = []
        
        for det in all_detections:
            best_dist = self.ASSOCIATION_RADIUS
            best_track = None
            
            for t_id, track in self.tracks.items():
                dist = math.sqrt((det.x - track.x)**2 + (det.y - track.y)**2)
                if dist < best_dist:
                    best_dist = dist
                    best_track = t_id
                    
            if best_track:
                matched_detections[best_track].append(det)
            else:
                unmatched_detections.append(det)
                
        # 2. Update existing tracks
        dead_tracks = []
        for t_id, track in self.tracks.items():
            track.update(matched_detections[t_id])
            if track.missed_frames > 5 or track.confidence <= 0.0:
                dead_tracks.append(t_id)
                
        for t_id in dead_tracks:
            del self.tracks[t_id]
            
        # 3. Create new tracks for unmatched detections
        while unmatched_detections:
            seed = unmatched_detections.pop(0)
            cluster = [seed]
            i = 0
            while i < len(unmatched_detections):
                cand = unmatched_detections[i]
                dist = math.sqrt((seed.x - cand.x)**2 + (seed.y - cand.y)**2)
                if dist < self.ASSOCIATION_RADIUS:
                    cluster.append(unmatched_detections.pop(i))
                else:
                    i += 1
                    
            t_id = f"Track_{self.next_track_id:03d}"
            self.next_track_id += 1
            new_track = TrackedObject(t_id)
            new_track.update(cluster)
            self.tracks[t_id] = new_track
            
        results = []
        for t in self.tracks.values():
            results.append({
                "id": t.id,
                "type": t.type,
                "distance": t.distance,
                "relative_velocity": t.relative_velocity,
                "angle": t.angle,
                "confidence": t.confidence,
                "sensors_detecting": t.sensors_detecting,
                "x": t.x,
                "y": t.y
            })
        return results
