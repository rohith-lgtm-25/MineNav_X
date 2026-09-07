import math

class NavigationEngine:
    def __init__(self):
        self.waypoint = None
        self.status = "IDLE"
        self.suggested_steering = 0.0

    def set_waypoint(self, x: float, y: float):
        self.waypoint = (x, y)
        
    def evaluate(self, vehicle_x, vehicle_y, vehicle_heading, fused_objects) -> dict:
        if not self.waypoint:
            self.status = "IDLE"
            return {"status": self.status, "waypoint": None, "suggested_steering": 0.0}

        dx = self.waypoint[0] - vehicle_x
        dy = self.waypoint[1] - vehicle_y
        dist = math.sqrt(dx**2 + dy**2)
        
        if dist < 5.0:
            self.waypoint = None
            self.status = "ARRIVED"
            return {"status": self.status, "waypoint": None, "suggested_steering": 0.0}

        target_angle = math.degrees(math.atan2(dy, dx))
        heading_err = (target_angle - (90 - vehicle_heading))
        heading_err = (heading_err + 180) % 360 - 180

        is_blocked = False
        avoidance_steer = 0.0
        
        # Check obstacles
        for obj in fused_objects:
            if obj["distance"] < 15.0 and abs(obj["angle"]) < 20:
                is_blocked = True
                break
            elif obj["distance"] < 30.0 and abs(obj["angle"]) < 40:
                self.status = "OBSTACLE_AVOIDANCE"
                avoidance_steer = -1.0 if obj["angle"] > 0 else 1.0
                return {"status": self.status, "waypoint": self.waypoint, "suggested_steering": avoidance_steer}

        if is_blocked:
            self.status = "BLOCKED_PATH"
            return {"status": self.status, "waypoint": self.waypoint, "suggested_steering": 0.0}

        self.status = "STRAIGHT_PATH"
        steer = 1.0 if heading_err > 5 else (-1.0 if heading_err < -5 else 0.0)
        return {"status": self.status, "waypoint": self.waypoint, "suggested_steering": steer}
