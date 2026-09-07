class SafetyDecisionEngine:
    def evaluate(self, fused_objects: list, visibility: float, current_speed: float) -> dict:
        risk = "SAFE"
        recommended_speed = 15.0 # Max typical simulation speed in m/s
        action = "NONE"
        min_ttc = 999.0
        closest_dist = 999.0
        
        # 1. Base recommended speed based on visibility (Visibility Engine Phase 6)
        if visibility < 30:
            recommended_speed = 2.0  # roughly 7 km/h
        elif visibility < 60:
            recommended_speed = 5.0  # roughly 18 km/h
        elif visibility < 90:
            recommended_speed = 10.0 # roughly 36 km/h
            
        # 2. Collision Risk & TTC (Phase 7)
        risk = "SAFE"
        action = "NONE"
        recommended_speed = current_speed
        min_ttc = None
        closest_dist = None
        max_closing_speed = 0.0
        trigger_reason = "NONE"
        
        for obj in fused_objects:
            dist = obj["distance"]
            # Positive relative velocity means moving closer
            rel_vel = obj["relative_velocity"]
            
            if closest_dist is None or dist < closest_dist:
                closest_dist = dist
                
            if rel_vel > 0:
                ttc = dist / rel_vel
                if min_ttc is None or ttc < min_ttc:
                    min_ttc = ttc
                    max_closing_speed = rel_vel
                    
        # Decision Logic
        if min_ttc is not None and min_ttc < 2.0:
            risk = "CRITICAL"
            action = "EMERGENCY_STOP"
            recommended_speed = 0.0
            trigger_reason = "TTC < 2.0s"
        elif closest_dist is not None and closest_dist < 10.0:
            risk = "CRITICAL"
            action = "EMERGENCY_STOP"
            recommended_speed = 0.0
            trigger_reason = "PROXIMITY < 10m"
        elif min_ttc is not None and min_ttc < 5.0:
            risk = "HIGH_RISK"
            recommended_speed = 5.0
            trigger_reason = "TTC < 5.0s"
        elif visibility < 40.0:
            risk = "HIGH_RISK"
            recommended_speed = 5.0
            trigger_reason = "LOW VISIBILITY"
        elif closest_dist is not None and closest_dist < 20.0:
            risk = "CAUTION"
            recommended_speed = 8.0
            trigger_reason = "PROXIMITY < 20m"
        elif visibility < 70.0:
            risk = "CAUTION"
            recommended_speed = 10.0
            trigger_reason = "REDUCED VISIBILITY"
        else:
            recommended_speed = 15.0 # Max speed
            
        return {
            "risk": risk,
            "action": action,
            "ttc": min_ttc,
            "closest_distance": closest_dist,
            "closing_speed": max_closing_speed,
            "trigger_reason": trigger_reason,
            "recommended_speed": recommended_speed
        }
