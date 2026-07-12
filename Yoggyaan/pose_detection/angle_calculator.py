import math

def _to_point(lm):
    if isinstance(lm, (list, tuple)):
        return lm[0], lm[1]
    return lm["x"], lm["y"]

def angle_between(a, b, c) -> float:
    ax, ay = _to_point(a)
    bx, by = _to_point(b)
    cx, cy = _to_point(c)
    radians = math.atan2(cy - by, cx - bx) - math.atan2(ay - by, ax - bx)
    angle = abs(math.degrees(radians))
    return 360.0 - angle if angle > 180.0 else angle

def is_above(a, b) -> bool:
    return _to_point(a)[1] < _to_point(b)[1]

def lateral_distance(a, b) -> float:
    return abs(_to_point(a)[0] - _to_point(b)[0])

def vertical_distance(a, b) -> float:
    """Signed vertical distance: positive if a is below b (higher y value)."""
    return _to_point(a)[1] - _to_point(b)[1]

def euclidean_distance(a, b) -> float:
    ax, ay = _to_point(a)
    bx, by = _to_point(b)
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

def smooth_landmarks(prev: list, curr: list, alpha: float = 0.4) -> list:
    if not prev or len(prev) != len(curr):
        return [dict(lm) for lm in curr]
    result = []
    for p, c in zip(prev, curr):
        result.append({
            "x": p["x"] * (1 - alpha) + c["x"] * alpha,
            "y": p["y"] * (1 - alpha) + c["y"] * alpha,
            "z": p.get("z", 0) * (1 - alpha) + c.get("z", 0) * alpha,
            "visibility": c.get("visibility", 1.0),
        })
    return result
