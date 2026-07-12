"""
MediaPipe Pose landmark indices used:
  0 : nose
  11/12 : shoulders  13/14 : elbows  15/16 : wrists
  23/24 : hips  25/26 : knees  27/28 : ankles
  29/30 : heel   31/32 : foot index


"""

from .angle_calculator import angle_between, is_above, lateral_distance, vertical_distance, euclidean_distance

REQUIRED_LANDMARKS = 33


def _target_score(actual: float, ideal: float, tol: float) -> float:
    
    if tol <= 0:
        return 1.0 if actual == ideal else 0.0
    return max(0.0, 1.0 - abs(actual - ideal) / tol)


def _min_score(actual: float, floor: float, tol: float) -> float:
    
    if actual >= floor:
        return 1.0
    if tol <= 0:
        return 0.0
    return max(0.0, 1.0 - (floor - actual) / tol)


def _max_score(actual: float, ceiling: float, tol: float) -> float:
    
    if actual <= ceiling:
        return 1.0
    if tol <= 0:
        return 0.0
    return max(0.0, 1.0 - (actual - ceiling) / tol)


def _weighted(parts: list) -> float:
    
    total_w = sum(w for _, w in parts) or 1.0
    return sum(s * w for s, w in parts) / total_w


def _visible(pt, min_vis=0.45):
    return bool(pt) and -0.08 <= pt.get("x", 0) <= 1.08 and -0.08 <= pt.get("y", 0) <= 1.08 and pt.get("visibility", 1.0) >= min_vis

def _avg_y(a,b): 
    return (a["y"] + b["y"]) / 2

def _avg_x(a,b): 
    return (a["x"] + b["x"]) / 2

def _body_height(lm): 
    return abs(_avg_y(lm[11], lm[12]) - _avg_y(lm[27], lm[28]))

def _torso_height(lm): 
    return abs(_avg_y(lm[11], lm[12]) - _avg_y(lm[23], lm[24]))

def _line_deviation(a,b,c):
    dx, dy = c["x"]-a["x"], c["y"]-a["y"]
    length = (dx*dx+dy*dy) ** 0.5 or 1.0
    return abs(dy*b["x"] - dx*b["y"] + c["x"]*a["y"] - c["y"]*a["x"]) / length

def _quality_ok(lm, pose_name):
    standing = [0,11,12,13,14,15,16,23,24,25,26,27,28]
    seated   = [0,11,12,13,14,15,16,23,24,25,26]
   
    sideways_keys = [0,11,12,15,16,23,24,25,26,27,28]
   
    kneeling_keys = [0,11,12,23,24,25,26]
   
    balasana_keys = [11,12,23,24,25,26,15,16]
    
    forward_fold_keys = [11,12,13,14,23,24,25,26,27,28]
    if pose_name in {"warrior", "trikonasana"}:
        keys, min_vis, coverage = sideways_keys, 0.30, 0.60
    elif pose_name == "vajrasana":
        keys, min_vis, coverage = kneeling_keys, 0.30, 0.60
    elif pose_name == "balasana":
        keys, min_vis, coverage = balasana_keys, 0.18, 0.45
    elif pose_name == "padahastasana":
        keys, min_vis, coverage = forward_fold_keys, 0.35, 0.65
    elif pose_name in {"padmasana","baddha_konasana","pranayama"}:
        keys, min_vis, coverage = seated, 0.45, 0.78
    else:
        keys, min_vis, coverage = standing, 0.45, 0.78
    if sum(1 for i in keys if i < len(lm) and _visible(lm[i], min_vis)) / len(keys) < coverage:
        return False
    xs=[lm[i]["x"] for i in keys if i < len(lm)]
    ys=[lm[i]["y"] for i in keys if i < len(lm)]
    return xs and ys and (max(xs)-min(xs)) >= 0.10 and (max(ys)-min(ys)) >= 0.16

def _strict_shape_ok(pose_name, lm):
    if len(lm) < REQUIRED_LANDMARKS or not _quality_ok(lm, pose_name): 
        return False
    lSh, rSh, lWr, rWr, lHi, rHi, lKn, rKn, lAn, rAn = lm[11],lm[12],lm[15],lm[16],lm[23],lm[24],lm[25],lm[26],lm[27],lm[28]
    shx, shy = _avg_x(lSh,rSh), _avg_y(lSh,rSh); hix, hiy = _avg_x(lHi,rHi), _avg_y(lHi,rHi)
    kny, any_ = _avg_y(lKn,rKn), _avg_y(lAn,rAn)
    if pose_name == "tadasana": return _body_height(lm)>0.42 and shy<hiy<kny<any_ and abs(shx-hix)<0.12
    if pose_name == "tree":
        
        body_height_ok = _body_height(lm) > 0.36
        bent_knee_ok = min(angle_between(lHi, lKn, lAn), angle_between(rHi, rKn, rAn)) < 120
        balance_ok = min(lAn["y"], rAn["y"]) < hiy + 0.22
        conditions = [body_height_ok, bent_knee_ok, balance_ok]
        return sum(conditions) >= 2
    if pose_name == "warrior":
       
        lEl, rEl = lm[13], lm[14]
        l_knee_ang = angle_between(lHi, lKn, lAn)
        r_knee_ang = angle_between(rHi, rKn, rAn)
        front_knee_ang = min(l_knee_ang, r_knee_ang)
        back_knee_ang = max(l_knee_ang, r_knee_ang)

        
        shoulder_w = max(lateral_distance(lSh, rSh), 0.05)
        stance_ratio = lateral_distance(lAn, rAn) / shoulder_w

        l_elbow_ang = angle_between(lSh, lEl, lWr)
        r_elbow_ang = angle_between(rSh, rEl, rWr)

        wide_stance   = stance_ratio > 1.0
        front_bent    = 45 <= front_knee_ang <= 165
        back_straight = back_knee_ang > 115
        
        arms_ext = ((l_elbow_ang + r_elbow_ang) / 2 > 110 and
                    min(l_elbow_ang, r_elbow_ang) > 75)
        conditions = [wide_stance, front_bent, back_straight, arms_ext]
       
        return sum(conditions) >= 2
    if pose_name == "trikonasana":
       
        wrist_gap = abs(lWr["y"] - rWr["y"])
        shoulder_tilt = abs(lSh["y"] - rSh["y"])
        torso_lean = abs(shx - hix)
        full_standing = _body_height(lm) > 0.30 and shy < hiy < kny < any_
        wide_base = lateral_distance(lAn, rAn) >= 0.24
        arms_open = lateral_distance(lWr, rWr) >= 0.26
        one_hand_down = max(lWr["y"], rWr["y"]) >= hiy - 0.04
        triangle_tilt = wrist_gap >= 0.09 or shoulder_tilt >= 0.045 or torso_lean >= 0.06
      
        conditions = [full_standing, wide_base, arms_open, one_hand_down, triangle_tilt]
        return sum(conditions) >= 4
    if pose_name == "balasana":
       
        mid_hip = {"x": hix, "y": hiy}
        mid_heel = {"x": _avg_x(lAn, rAn), "y": any_}
        hips_close_to_heels = euclidean_distance(mid_hip, mid_heel) < 0.40
        torso_folded_down = shy >= hiy - 0.06
        body_compact = _body_height(lm) < 0.42
        arms_reaching_forward = max(euclidean_distance(lSh, lWr), euclidean_distance(rSh, rWr)) > 0.16
        conditions = [hips_close_to_heels, torso_folded_down, body_compact, arms_reaching_forward]
        return sum(conditions) >= 2
    if pose_name == "bhujangasana": 
        return abs(lAn["y"]-rAn["y"])<0.16 and (hiy-shy)>0.09 and max(euclidean_distance(lSh,lAn), euclidean_distance(rSh,rAn))>0.32
    if pose_name == "wall_plank_chaturanga": 
        return max(euclidean_distance(lSh,lAn), euclidean_distance(rSh,rAn))>0.36 and abs(shy-any_)>0.08 and min(_line_deviation(lSh,lHi,lAn), _line_deviation(rSh,rHi,rAn))<0.16
    if pose_name == "padahastasana":
        
        
        leg_scale = max(euclidean_distance(lHi, lAn), euclidean_distance(rHi, rAn))
        shoulders_below_hips = shy >= hiy - 0.05
        hips_above_ankles = hiy < any_
        sufficient_leg_scale = leg_scale > 0.20
        torso_folded_forward = abs(shy - hiy) < leg_scale * 0.6
        
        conditions = [shoulders_below_hips, hips_above_ankles, sufficient_leg_scale, torso_folded_forward]
        return sum(conditions) >= 3
    if pose_name == "paschimottanasana": 
        return hiy>shy and abs(lAn["y"]-rAn["y"])<0.16 and min(euclidean_distance(lHi,lAn), euclidean_distance(rHi,rAn))>0.22 and (shy-hiy)>-0.02
    if pose_name == "padmasana": 
        return hiy>shy and lateral_distance(lKn,rKn)>lateral_distance(lHi,rHi)*1.5 and min(lAn["y"],rAn["y"])<hiy+0.20
    if pose_name == "vajrasana":
       
        return hiy > shy and _avg_y(lKn, rKn) > hiy + 0.04
    if pose_name == "baddha_konasana":
        
        seated = hiy > shy
        knee_spread_ok = lateral_distance(lKn, rKn) > lateral_distance(lHi, rHi) * 1.3
        feet_together = euclidean_distance(lAn, rAn) < 0.24
       
        conditions = [seated, knee_spread_ok, feet_together]
        return sum(conditions) >= 2
    if pose_name == "paschim_namaskarasana": 
        return _body_height(lm)>0.34 and shy<hiy<any_ and euclidean_distance(lWr,rWr)<0.22 and shy < _avg_y(lWr,rWr) < hiy+0.10
    if pose_name == "pranayama": 
        return hiy>shy and abs(shx-hix)<0.16 and abs(lSh["y"]-rSh["y"])<0.10
    return False

VALID_POSES = {"tree", "warrior", "padmasana", "vajrasana", "baddha_konasana", "tadasana", "trikonasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama"}

HOLD_POSES = {"padmasana", "baddha_konasana", "vajrasana", "tadasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama", "warrior"}

STABILITY_FRAMES = 5

POSE_PASS_THRESHOLDS = {
   
    "tree": 65, "warrior": 30, "padmasana": 65, "vajrasana": 55,
    "baddha_konasana": 65, "tadasana": 65, "trikonasana": 55,
    "balasana": 40, "bhujangasana": 65, "wall_plank_chaturanga": 65,
    "padahastasana": 55, "paschimottanasana": 65,
    "paschim_namaskarasana": 65, "pranayama": 60,
}


POSE_TOLERANCES = {
    "tree": {
       
        "standing_knee_ideal": 175, "standing_knee_tol": 25, "standing_knee_w": 0.20,
        "bent_knee_ideal": 55,      "bent_knee_tol": 45,     "bent_knee_w": 0.25,
        "elbow_ideal": 170,         "elbow_tol": 35,         "elbow_w": 0.20,
        "arm_raise_ideal": 170,     "arm_raise_tol": 35,     "arm_raise_w": 0.25,
        "hip_sym_ceiling": 0.08,    "hip_sym_tol": 0.10,     "hip_sym_w": 0.10,
       
        "knee_bent_max_angle": 148,
        "arm_raised_elbow_min": 130,
    },
    "warrior": {
       
        "front_knee_ideal": 90,  "front_knee_tol": 85,  "front_knee_w": 0.28,
        "back_knee_ideal": 160,  "back_knee_tol": 75,   "back_knee_w": 0.14,
        "elbow_ideal": 165,      "elbow_tol": 75,        "elbow_w": 0.20,
        "arm_height_ideal": 90,  "arm_height_tol": 70,   "arm_height_w": 0.20,
       
        "stance_ideal": 1.1,    "stance_tol": 0.8,      "stance_w": 0.18,
        
        "knee_target_angle": 90, "knee_tolerance": 85,
        "arm_horizontal_y_tol": 0.20, "stance_min": 0.20, "arm_ext_min": 70,
    },
    "padmasana": {
        
        "knee_spread_ideal": 0.32, "knee_spread_tol": 0.18, "knee_spread_w": 0.35,
        "torso_ceiling": 0.0,      "torso_tol": 0.10,       "torso_w": 0.35,
        "ankle_elev_ideal": 0.08,  "ankle_elev_tol": 0.18,  "ankle_elev_w": 0.30,
        "knee_spread_min": 0.17, "ankle_elev_tol_legacy": 0.06,
    },
    "vajrasana": {
       
        "knee_fold_ideal": 0.30,  "knee_fold_tol": 0.20,  "knee_fold_w": 0.35,
        "torso_ceiling": 0.0,     "torso_tol": 0.10,      "torso_w": 0.35,
        "knees_close_ideal": 0.0, "knees_close_tol": 0.18, "knees_close_w": 0.30,
        "knee_below_hip_min": 0.12, "feet_together_max": 0.18,
    },
    "baddha_konasana": {
       
        "knee_spread_ideal": 0.30, "knee_spread_tol": 0.18, "knee_spread_w": 0.40,
        "feet_close_ideal": 0.0,   "feet_close_tol": 0.14,  "feet_close_w": 0.30,
        "torso_ceiling": 0.0,      "torso_tol": 0.10,       "torso_w": 0.30,
        "knee_spread_min": 0.15, "feet_together_max": 0.11,
    },
    "tadasana": {
       
        "knee_ideal": 178,        "knee_tol": 20,       "knee_w": 0.30,
        "torso_ceiling": 0.0,     "torso_tol": 0.14,    "torso_w": 0.30,
        "feet_width_ceiling": 0.10, "feet_width_tol": 0.16, "feet_width_w": 0.15,
        "shoulder_level_ceiling": 0.0, "shoulder_level_tol": 0.10, "shoulder_level_w": 0.15,
        "elbow_ideal": 172,       "elbow_tol": 35,      "elbow_w": 0.10,
        "feet_width_max": 0.20, "knee_straight_min": 160, "torso_vertical_tol": 0.12,
        "shoulder_level_tol_legacy": 0.08,
    },
    "trikonasana": {
       
        "stance_ideal": 0.55,     "stance_tol": 0.30,     "stance_w": 0.20,
        "knee_ideal": 172,        "knee_tol": 28,         "knee_w": 0.15,
        "arm_line_ideal": 175,    "arm_line_tol": 40,     "arm_line_w": 0.20,
        "tilt_ideal": 0.20,       "tilt_tol": 0.16,       "tilt_w": 0.30,
        "reach_ideal": 0.0,       "reach_tol": 0.18,      "reach_w": 0.15,
        "stance_min": 0.28, "arm_line_min": 0.35, "knee_straight_min": 150, "side_reach_min": 0.18,
    },
    "balasana": {
        
        "hip_heel_ideal": 0.0,    "hip_heel_tol": 0.24,    "hip_heel_w": 0.35,
        "fold_angle_ideal": 35,   "fold_angle_tol": 45,    "fold_angle_w": 0.18,
        "head_low_ideal": 0.0,    "head_low_tol": 0.20,    "head_low_w": 0.12,
        "elbow_ideal": 165,       "elbow_tol": 45,         "elbow_w": 0.10,
        "arm_reach_ideal": 0.30,  "arm_reach_tol": 0.25,   "arm_reach_w": 0.10,
        "symmetry_ideal": 0.0,    "symmetry_tol": 0.12,    "symmetry_w": 0.15,
        "hip_heel_max": 0.34, "fold_min_gap": 0.06, "arm_reach_min": 0.16,
    },
    "bhujangasana": {
       
        "chest_lift_ideal": 0.16, "chest_lift_tol": 0.16, "chest_lift_w": 0.35,
        "elbow_ideal": 150,       "elbow_tol": 40,        "elbow_w": 0.25,
        "shoulder_level_ceiling": 0.0, "shoulder_level_tol": 0.12, "shoulder_level_w": 0.20,
        "hip_level_ceiling": 0.0, "hip_level_tol": 0.12,  "hip_level_w": 0.20,
        "chest_lift_min": 0.08, "hip_ground_tol": 0.18, "elbow_bend_min": 90,
    },
    "wall_plank_chaturanga": {
        
        "body_line_ideal": 175,  "body_line_tol": 30,    "body_line_w": 0.40,
        "elbow_ideal": 150,      "elbow_tol": 40,        "elbow_w": 0.30,
        "feet_close_ideal": 0.0, "feet_close_tol": 0.20, "feet_close_w": 0.15,
        "reach_ideal": 0.40,     "reach_tol": 0.22,      "reach_w": 0.15,
        "body_line_min": 0.34, "arm_angle_min": 120, "torso_straight_tol": 0.20,
    },
    "padahastasana": {
        
        "fold_ideal": 40,        "fold_tol": 45,         "fold_w": 0.35,
        "reach_ideal": 0.0,      "reach_tol": 0.30,      "reach_w": 0.30,
        "head_down_ideal": 1.0,  "head_down_tol": 1.0,   "head_down_w": 0.15,
        "knee_ideal": 165,       "knee_tol": 35,         "knee_w": 0.20,
        "fold_min": 0.18, "hand_foot_dist_max": 0.32, "head_down_tol_legacy": 0.08,
    },
    "paschimottanasana": {
        
        "fold_ideal": 45,        "fold_tol": 45,         "fold_w": 0.35,
        "reach_ideal": 0.0,      "reach_tol": 0.32,      "reach_w": 0.30,
        "seated_ceiling": 0.0,   "seated_tol": 0.14,     "seated_w": 0.15,
        "head_down_ideal": 1.0,  "head_down_tol": 1.0,   "head_down_w": 0.20,
        "fold_min": 0.12, "hand_foot_dist_max": 0.42, "spine_tol": 0.18,
    },
    "paschim_namaskarasana": {
       
        "elbow_ideal": 45,        "elbow_tol": 45,        "elbow_w": 0.20,
        "wrists_behind_ideal": 1.0, "wrists_behind_tol": 1.0, "wrists_behind_w": 0.35,
        "hands_close_ideal": 0.0, "hands_close_tol": 0.22,  "hands_close_w": 0.25,
        "shoulder_level_ceiling": 0.0, "shoulder_level_tol": 0.10, "shoulder_level_w": 0.20,
        "hands_behind_min": 0.04, "torso_tol": 0.14, "shoulder_open_min": 0.08,
    },
    "pranayama": {
      
        "torso_ceiling": 0.0,     "torso_tol": 0.16,      "torso_w": 0.55,
        "shoulder_level_ceiling": 0.0, "shoulder_level_tol": 0.10, "shoulder_level_w": 0.35,
        "shoulder_level_tol_legacy": 0.10,
    },
}

class PoseChecker:
    def __init__(self):
        self._stability: dict[str, int] = {}

    def score(self, pose_name: str, landmarks: list) -> float:
        if not landmarks or len(landmarks) < REQUIRED_LANDMARKS:
            return 0.0
        fn = {
            "tree": self._score_tree,
            "warrior": self._score_warrior,
            "padmasana": self._score_padmasana,
            "vajrasana": self._score_vajrasana,
            "baddha_konasana": self._score_baddha_konasana,
            "tadasana": self._score_tadasana,
            "trikonasana": self._score_trikonasana,
            "balasana": self._score_balasana,
            "bhujangasana": self._score_bhujangasana,
            "wall_plank_chaturanga": self._score_wall_plank_chaturanga,
            "padahastasana": self._score_padahastasana,
            "paschimottanasana": self._score_paschimottanasana,
            "paschim_namaskarasana": self._score_paschim_namaskarasana,
            "pranayama": self._score_pranayama,
        }.get(pose_name)
        if fn is None:
            return 0.0
        if pose_name != "trikonasana" and not _strict_shape_ok(pose_name, landmarks):
            return 0.0
        return round(min(100.0, max(0.0, fn(landmarks) * 100)), 1)

    def validate(self, pose_name: str, landmarks: list) -> dict:
        score = self.score(pose_name, landmarks)
        threshold = POSE_PASS_THRESHOLDS.get(pose_name, 45)

        dispatch = {
            "tree": self._validate_tree,
            "warrior": self._validate_warrior,
            "padmasana": self._validate_padmasana,
            "vajrasana": self._validate_vajrasana,
            "baddha_konasana": self._validate_baddha_konasana,
            "tadasana": self._validate_tadasana,
            "trikonasana": self._validate_trikonasana,
            "balasana": self._validate_balasana,
            "bhujangasana": self._validate_bhujangasana,
            "wall_plank_chaturanga": self._validate_wall_plank_chaturanga,
            "padahastasana": self._validate_padahastasana,
            "paschimottanasana": self._validate_paschimottanasana,
            "paschim_namaskarasana": self._validate_paschim_namaskarasana,
            "pranayama": self._validate_pranayama,
        }
        
        fn = dispatch.get(pose_name)
        if fn is None:
            return {"score": score, "passed": False, "stable": False,
                    "criteria": [], "overall_hint": "Unknown pose.",
                    "is_hold_pose": False}

        criteria, hint = fn(landmarks, score)

        key = pose_name
        if score >= threshold:
            self._stability[key] = self._stability.get(key, 0) + 1
        else:
            self._stability[key] = 0
        stable = self._stability.get(key, 0) >= STABILITY_FRAMES

        return {
            "score": score,
            "passed": score >= threshold,
            "stable": stable,
            "criteria": criteria,
            "overall_hint": hint,
            "is_hold_pose": pose_name in HOLD_POSES,
        }

    def reset_stability(self, pose_name: str):
        self._stability[pose_name] = 0

   
    def _score_tree(self, lm: list) -> float:
        t = POSE_TOLERANCES["tree"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        l_knee_ang = angle_between(l_hi, l_kn, l_an)
        r_knee_ang = angle_between(r_hi, r_kn, r_an)
        standing_knee = max(l_knee_ang, r_knee_ang)   
        bent_knee = min(l_knee_ang, r_knee_ang)       

        standing_score = _target_score(standing_knee, t["standing_knee_ideal"], t["standing_knee_tol"])
        bent_score = _target_score(bent_knee, t["bent_knee_ideal"], t["bent_knee_tol"])

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        l_raise_ang = angle_between(l_hi, l_sh, l_wr)
        r_raise_ang = angle_between(r_hi, r_sh, r_wr)
        raise_score = (_target_score(l_raise_ang, t["arm_raise_ideal"], t["arm_raise_tol"]) +
                       _target_score(r_raise_ang, t["arm_raise_ideal"], t["arm_raise_tol"])) / 2.0

        hip_sym = _max_score(lateral_distance(l_hi, r_hi), t["hip_sym_ceiling"], t["hip_sym_tol"])

        return _weighted([
            (standing_score, t["standing_knee_w"]),
            (bent_score, t["bent_knee_w"]),
            (elbow_score, t["elbow_w"]),
            (raise_score, t["arm_raise_w"]),
            (hip_sym, t["hip_sym_w"]),
        ])

    def _validate_tree(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - stand in front of your camera."
        t = POSE_TOLERANCES["tree"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        arms_up   = is_above(l_wr, l_sh) and is_above(r_wr, r_sh)
        arms_str  = (angle_between(l_sh, l_el, l_wr) > t["arm_raised_elbow_min"] and
                     angle_between(r_sh, r_el, r_wr) > t["arm_raised_elbow_min"])
        knee_bent = min(angle_between(l_hi, l_kn, l_an),angle_between(r_hi, r_kn, r_an)) < t["knee_bent_max_angle"]

        criteria = [
            {"name": "Arms raised overhead",  "passed": arms_up,   "hint": "Lift both arms straight above your head"},
            {"name": "Elbows fully extended",  "passed": arms_str,  "hint": "Straighten your elbows - reach tall"},
            {"name": "One knee bent (balance)","passed": knee_bent, "hint": "Lift one foot and press it to your inner leg"},
        ]

        if not arms_up:
            hint = "Raise both arms above your head with palms together."
        elif not knee_bent:
            hint = "Lift your right foot and press it to your left inner thigh."
        elif not arms_str:
            hint = "Straighten your arms - reach up as tall as possible."
        else:
            hint = "Great balance! Keep breathing and hold steady."
        return criteria, hint


    
    def _score_warrior(self, lm: list) -> float:
        t = POSE_TOLERANCES["warrior"]

        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        l_knee_ang = angle_between(l_hi, l_kn, l_an)
        r_knee_ang = angle_between(r_hi, r_kn, r_an)
        front_knee = min(l_knee_ang, r_knee_ang)
        back_knee = max(l_knee_ang, r_knee_ang)
        knee_score = _target_score(front_knee, t["front_knee_ideal"], t["front_knee_tol"])
        back_knee_score = _target_score(back_knee, t["back_knee_ideal"], t["back_knee_tol"])

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        l_height_ang = angle_between(l_hi, l_sh, l_wr)
        r_height_ang = angle_between(r_hi, r_sh, r_wr)
        height_score = (_target_score(l_height_ang, t["arm_height_ideal"], t["arm_height_tol"]) +
                        _target_score(r_height_ang, t["arm_height_ideal"], t["arm_height_tol"])) / 2.0

        lat_gap  = lateral_distance(l_an, r_an)
        euc_gap  = euclidean_distance(l_an, r_an)
       
        shoulder_w = max(lateral_distance(l_sh, r_sh), 0.05)
        stance_ratio = max(lat_gap, euc_gap * 0.90) / shoulder_w
        stance_score = _min_score(stance_ratio, t["stance_ideal"], t["stance_tol"])

       
        vis_landmarks = [l_sh, r_sh, l_hi, r_hi, l_kn, r_kn, l_an, r_an, l_el, r_el, l_wr, r_wr]
        avg_vis = sum(lk.get("visibility", 1.0) for lk in vis_landmarks) / len(vis_landmarks)
        conf = max(0.85, min(1.0, (avg_vis - 0.20) / 0.40))

        total = _weighted([
            (knee_score, t["front_knee_w"]),
            (back_knee_score, t["back_knee_w"]),
            (elbow_score, t["elbow_w"]),
            (height_score, t["arm_height_w"]),
            (stance_score, t["stance_w"]),
        ])
        return total * conf

    def _validate_warrior(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - stand in front of your camera."
        t = POSE_TOLERANCES["warrior"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        l_knee_ang = angle_between(l_hi, l_kn, l_an)
        r_knee_ang = angle_between(r_hi, r_kn, r_an)
        best_knee  = min(l_knee_ang, r_knee_ang)
        knee_bent  = best_knee < (t["knee_target_angle"] + t["knee_tolerance"])

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        
        arms_ext = ((l_elbow_ang + r_elbow_ang) / 2 > 110 and
                    min(l_elbow_ang, r_elbow_ang) > t["arm_ext_min"])

       
        shoulder_w = max(lateral_distance(l_sh, r_sh), 0.05)
        wide_stance = (lateral_distance(l_an, r_an) / shoulder_w) > 1.0

        criteria = [
            {"name": "Front knee at 90°",    "passed": knee_bent,   "hint": "Bend your front knee until thigh is parallel to floor"},
            {"name": "Arms extended wide",   "passed": arms_ext,    "hint": "Stretch both arms to the sides at shoulder height"},
            {"name": "Wide warrior stance",  "passed": wide_stance, "hint": "Step your feet further apart - 3 to 4 feet wide"},
        ]

        if not wide_stance:
            hint = "Widen your stance - step your feet about 3-4 feet apart."
        elif not knee_bent:
            hint = "Bend your front knee deeper - aim for a 90 degree angle."
        elif not arms_ext:
            hint = "Extend both arms strongly to the sides, parallel to the floor."
        else:
            hint = "Strong warrior! Gaze forward and breathe into the pose."
        return criteria, hint


    
    def _score_padmasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["padmasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        mid_sh_y = (l_sh["y"] + r_sh["y"]) / 2
        mid_hi_y = (l_hi["y"] + r_hi["y"]) / 2
        an_avg_y = (l_an["y"] + r_an["y"]) / 2

        knee_spread_score = _min_score(lateral_distance(l_kn, r_kn), t["knee_spread_ideal"], t["knee_spread_tol"])
        torso_score = _max_score(mid_sh_y - mid_hi_y, t["torso_ceiling"], t["torso_tol"])
        ankle_elev_score = _min_score(mid_hi_y - an_avg_y, t["ankle_elev_ideal"], t["ankle_elev_tol"])

        return _weighted([
            (knee_spread_score, t["knee_spread_w"]),
            (torso_score, t["torso_w"]),
            (ankle_elev_score, t["ankle_elev_w"]),
        ])

    def _validate_padmasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - sit in front of your camera."
        t = POSE_TOLERANCES["padmasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        knees_wide    = lateral_distance(l_kn, r_kn) > t["knee_spread_min"]
        torso_up      = ((l_sh["y"] + r_sh["y"]) / 2) < ((l_hi["y"] + r_hi["y"]) / 2 + t["torso_tol"])
        ankle_avg_y   = (l_an["y"] + r_an["y"]) / 2
        hip_avg_y     = (l_hi["y"] + r_hi["y"]) / 2
        feet_elevated = ankle_avg_y < hip_avg_y + t["ankle_elev_tol_legacy"]

        criteria = [
            {"name": "Knees wide open", "passed": knees_wide, "hint": "Let both knees drop wide to the sides"},
            {"name": "Spine tall and upright", "passed": torso_up, "hint": "Sit tall - lengthen your spine upward"},
            {"name": "Feet elevated (crossed)", "passed": feet_elevated, "hint": "Cross your legs and lift your feet onto your thighs"},
        ]

        if not torso_up:
            hint = "Sit tall and upright - lengthen your spine toward the ceiling."
        elif not knees_wide:
            hint = "Let both knees open wide out to the sides."
        elif not feet_elevated:
            hint = "Cross your legs and gently place each foot on the opposite thigh."
        else:
            hint = "Beautiful stillness! Breathe deeply and hold."
        return criteria, hint


   
    def _score_vajrasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["vajrasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]

        kn_avg_y = (l_kn["y"] + r_kn["y"]) / 2
        hi_avg_y = (l_hi["y"] + r_hi["y"]) / 2
        mid_sh_y = (l_sh["y"] + r_sh["y"]) / 2

        knee_fold_score = _min_score(kn_avg_y - hi_avg_y, t["knee_fold_ideal"], t["knee_fold_tol"])
        torso_score = _max_score(mid_sh_y - hi_avg_y, t["torso_ceiling"], t["torso_tol"])
        knees_close_score = _max_score(lateral_distance(l_kn, r_kn), t["knees_close_ideal"], t["knees_close_tol"])

        return _weighted([
            (knee_fold_score, t["knee_fold_w"]),
            (torso_score, t["torso_w"]),
            (knees_close_score, t["knees_close_w"]),
        ])

    def _validate_vajrasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - kneel in front of your camera."
        t = POSE_TOLERANCES["vajrasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]

        kn_avg_y  = (l_kn["y"] + r_kn["y"]) / 2
        hi_avg_y  = (l_hi["y"] + r_hi["y"]) / 2
        knees_folded = (kn_avg_y - hi_avg_y) >= t["knee_below_hip_min"]
        torso_up     = ((l_sh["y"] + r_sh["y"]) / 2) < hi_avg_y + t["torso_tol"]
        knees_close  = lateral_distance(l_kn, r_kn) < t["feet_together_max"]

        criteria = [
            {"name": "Kneeling - knees folded under", "passed": knees_folded, "hint": "Kneel and sit back so knees are well below your hips"},
            {"name": "Spine tall and upright",         "passed": torso_up,     "hint": "Straighten your back like a thunderbolt"},
            {"name": "Knees and feet together",        "passed": knees_close,  "hint": "Keep both knees and feet close together"},
        ]

        if not knees_folded:
            hint = "Kneel on the floor and sit back onto your heels."
        elif not torso_up:
            hint = "Straighten your spine - sit tall with your back erect."
        elif not knees_close:
            hint = "Bring your knees and feet closer together."
        else:
            hint = "Strong and grounded! Breathe steadily and hold."
        return criteria, hint


    
    def _score_baddha_konasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["baddha_konasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        mid_sh_y = (l_sh["y"] + r_sh["y"]) / 2
        mid_hi_y = (l_hi["y"] + r_hi["y"]) / 2

        knee_spread_score = _min_score(lateral_distance(l_kn, r_kn), t["knee_spread_ideal"], t["knee_spread_tol"])
        feet_close_score = _max_score(lateral_distance(l_an, r_an), t["feet_close_ideal"], t["feet_close_tol"])
        torso_score = _max_score(mid_sh_y - mid_hi_y, t["torso_ceiling"], t["torso_tol"])

        return _weighted([
            (knee_spread_score, t["knee_spread_w"]),
            (feet_close_score, t["feet_close_w"]),
            (torso_score, t["torso_w"]),
        ])

    def _validate_baddha_konasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - sit in front of your camera."
        t = POSE_TOLERANCES["baddha_konasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        knees_wide = lateral_distance(l_kn, r_kn) > t["knee_spread_min"]
        feet_close = lateral_distance(l_an, r_an) < t["feet_together_max"]
        torso_up   = ((l_sh["y"] + r_sh["y"]) / 2) < ((l_hi["y"] + r_hi["y"]) / 2 + t["torso_tol"])

        criteria = [
            {"name": "Knees spread wide",  "passed": knees_wide, "hint": "Let both knees fall out wide to the sides"},
            {"name": "Soles of feet together",  "passed": feet_close, "hint": "Bring the soles of your feet together in front of you"},
            {"name": "Spine tall and upright",  "passed": torso_up,   "hint": "Sit tall - lengthen your spine upward"},
        ]

        if not torso_up:
            hint = "Sit tall and upright - lift through the crown of your head."
        elif not knees_wide:
            hint = "Let both knees fall out wide like butterfly wings."
        elif not feet_close:
            hint = "Bring the soles of your feet together and hold them with your hands."
        else:
            hint = "Beautiful butterfly wings! Keep breathing and hold open."
        return criteria, hint


   
    def _score_tadasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["tadasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]

        left_knee = angle_between(l_hi, l_kn, l_an)
        right_knee = angle_between(r_hi, r_kn, r_an)
        knee_score = (_target_score(left_knee, t["knee_ideal"], t["knee_tol"]) +
                      _target_score(right_knee, t["knee_ideal"], t["knee_tol"])) / 2.0

        mid_sh_x = (l_sh["x"] + r_sh["x"]) / 2
        mid_hi_x = (l_hi["x"] + r_hi["x"]) / 2
        torso_score = _max_score(abs(mid_sh_x - mid_hi_x), t["torso_ceiling"], t["torso_tol"])

        feet_width_score = _max_score(lateral_distance(l_an, r_an), t["feet_width_ceiling"], t["feet_width_tol"])
        shoulder_level_score = _max_score(abs(l_sh["y"] - r_sh["y"]), t["shoulder_level_ceiling"], t["shoulder_level_tol"])

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        return _weighted([
            (knee_score, t["knee_w"]),
            (torso_score, t["torso_w"]),
            (feet_width_score, t["feet_width_w"]),
            (shoulder_level_score, t["shoulder_level_w"]),
            (elbow_score, t["elbow_w"]),
        ])

    def _validate_tadasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - stand tall in front of your camera."
        
        t = POSE_TOLERANCES["tadasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        shoulders_level = abs(l_sh["y"] - r_sh["y"]) <= t["shoulder_level_tol_legacy"]
        feet_grounded = abs(l_an["y"] - r_an["y"]) <= 0.08
        knees_straight = angle_between(l_hi, l_kn, l_an) >= t["knee_straight_min"] and angle_between(r_hi, r_kn, r_an) >= t["knee_straight_min"]
        mid_sh_x = (l_sh["x"] + r_sh["x"]) / 2
        mid_hi_x = (l_hi["x"] + r_hi["x"]) / 2
        torso_tall = abs(mid_sh_x - mid_hi_x) <= t["torso_vertical_tol"]

        criteria = [
            {"name": "Both feet grounded", "passed": feet_grounded, "hint": "Ground both feet evenly like a mountain base."},
            {"name": "Knees straight and steady", "passed": knees_straight, "hint": "Lengthen both legs without locking harshly."},
            {"name": "Tall vertical spine", "passed": torso_tall, "hint": "Stack shoulders over hips and grow taller."},
            {"name": "Shoulders level", "passed": shoulders_level, "hint": "Relax and level both shoulders."},
        ]

        if not feet_grounded: hint = "Ground both feet evenly to calm the Cloud Peak mist."
        elif not knees_straight: hint = "Straighten both legs and stand steady."
        elif not torso_tall: hint = "Lift through your spine; keep shoulders over hips."
        elif not shoulders_level: hint = "Relax your shoulders evenly."
        else: hint = "Strong Mountain Pose - the Cloud Peak is awakening."
        return criteria, hint

    
    def _score_trikonasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["trikonasana"]

        l_sh, r_sh = lm[11], lm[12]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]
        shx, shy = _avg_x(l_sh, r_sh), _avg_y(l_sh, r_sh)
        hix, hiy = _avg_x(l_hi, r_hi), _avg_y(l_hi, r_hi)
        kny, any_ = _avg_y(l_kn, r_kn), _avg_y(l_an, r_an)

        left_knee = angle_between(l_hi, l_kn, l_an)
        right_knee = angle_between(r_hi, r_kn, r_an)
        avg_knee = (left_knee + right_knee) / 2
        ankle_dist = lateral_distance(l_an, r_an)
        arm_span = euclidean_distance(l_wr, r_wr)
        wrist_gap = abs(l_wr["y"] - r_wr["y"])
        low_wrist_y = max(l_wr["y"], r_wr["y"])
        shoulder_tilt = abs(l_sh["y"] - r_sh["y"])
        torso_lean = abs(shx - hix)

        full_standing = _body_height(lm) > 0.34 and shy < hiy < kny < any_
        wide_base = ankle_dist >= 0.26
        arms_open = arm_span >= 0.30
        one_hand_down = low_wrist_y >= hiy - 0.02
        triangle_tilt = wrist_gap >= 0.11 or shoulder_tilt >= 0.055 or torso_lean >= 0.075

        if not (full_standing and wide_base and arms_open and one_hand_down and triangle_tilt):
            return 0.0

        stance_score = _min_score(ankle_dist, t["stance_ideal"], t["stance_tol"])
        knee_score = _target_score(avg_knee, t["knee_ideal"], t["knee_tol"])
        arm_line_ang = (angle_between(l_sh, lm[13], l_wr) + angle_between(r_sh, lm[14], r_wr)) / 2
        arm_line_score = _target_score(arm_line_ang, t["arm_line_ideal"], t["arm_line_tol"])
        tilt_metric = max(shoulder_tilt, torso_lean, wrist_gap * 0.5)
        tilt_score = _min_score(tilt_metric, t["tilt_ideal"], t["tilt_tol"])
        reach_score = _min_score(low_wrist_y - hiy, t["reach_ideal"], t["reach_tol"])

        return _weighted([
            (stance_score, t["stance_w"]),
            (knee_score, t["knee_w"]),
            (arm_line_score, t["arm_line_w"]),
            (tilt_score, t["tilt_w"]),
            (reach_score, t["reach_w"]),
        ])

    def _validate_trikonasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - stand clearly in a wide Triangle stance."
        
        t = POSE_TOLERANCES["trikonasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]
        
        shx, shy = _avg_x(l_sh, r_sh), _avg_y(l_sh, r_sh)
        hix, hiy = _avg_x(l_hi, r_hi), _avg_y(l_hi, r_hi)
        kny, any_ = _avg_y(l_kn, r_kn), _avg_y(l_an, r_an)

        ankle_dist = lateral_distance(l_an, r_an)
        arm_span = euclidean_distance(l_wr, r_wr)
        wrist_gap = abs(l_wr["y"] - r_wr["y"])
        low_wrist_y = max(l_wr["y"], r_wr["y"])
        high_wrist_y = min(l_wr["y"], r_wr["y"])
        shoulder_tilt = abs(l_sh["y"] - r_sh["y"])
        torso_lean = abs(shx - hix)
        avg_knee = (angle_between(l_hi, l_kn, l_an) + angle_between(r_hi, r_kn, r_an)) / 2

        full_standing = _body_height(lm) > 0.34 and shy < hiy < kny < any_
        wide = ankle_dist >= 0.26
        arms_open = arm_span >= 0.30
        legs_straight = avg_knee >= 145
        side_bend = wrist_gap >= 0.11 or shoulder_tilt >= 0.055 or torso_lean >= 0.075
        hand_down = low_wrist_y >= hiy - 0.02
        top_arm_open = high_wrist_y <= shy + 0.08

        criteria = [
            {"name": "Full standing body visible", "passed": full_standing, "hint": "Stand fully in frame; sitting cannot count."},
            {"name": "Wide triangle stance", "passed": wide, "hint": "Step your feet wider."},
            {"name": "Arms extended open", "passed": arms_open, "hint": "Stretch both arms strongly."},
            {"name": "Legs active and mostly straight", "passed": legs_straight, "hint": "Keep both legs straighter."},
            {"name": "Side bend / triangle tilt", "passed": side_bend, "hint": "Bend sideways, not forward."},
            {"name": "Lower hand reaching down", "passed": hand_down, "hint": "Reach one hand toward shin/ankle."},
            {"name": "Top arm opened upward", "passed": top_arm_open, "hint": "Open the top arm near/above shoulder level."},
        ]
        
        if not full_standing: hint = "Stand fully in the camera frame before starting Triangle Pose."
        elif not wide: hint = "Widen your stance to create the Prism Valley triangle base."
        elif not arms_open: hint = "Extend both arms fully to activate the crystal line."
        elif not side_bend: hint = "Bend sideways so one wrist lowers and the other arm opens."
        elif not hand_down: hint = "Reach one hand down toward your shin or ankle."
        elif not legs_straight: hint = "Straighten both legs and stay grounded."
        else: hint = "Strong Triangle Pose - the prisms are lighting up."
        return criteria, hint

    def _score_balasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["balasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]

        mid_sh = {"x": (l_sh["x"] + r_sh["x"]) / 2, "y": (l_sh["y"] + r_sh["y"]) / 2}
        mid_hi = {"x": (l_hi["x"] + r_hi["x"]) / 2, "y": (l_hi["y"] + r_hi["y"]) / 2}
        l_an, r_an = lm[27], lm[28]
        mid_an = {"x": (l_an["x"] + r_an["x"]) / 2, "y": (l_an["y"] + r_an["y"]) / 2}

        hip_heel_score = _max_score(euclidean_distance(mid_hi, mid_an), t["hip_heel_ideal"], t["hip_heel_tol"])

        fold_angle = (angle_between(l_sh, l_hi, l_kn) + angle_between(r_sh, r_hi, r_kn)) / 2
        fold_score = _target_score(fold_angle, t["fold_angle_ideal"], t["fold_angle_tol"])
        head_low_score = _max_score(mid_hi["y"] - mid_sh["y"], t["head_low_ideal"], t["head_low_tol"])

        elbow_ang = (angle_between(l_sh, l_el, l_wr) + angle_between(r_sh, r_el, r_wr)) / 2
        elbow_score = _target_score(elbow_ang, t["elbow_ideal"], t["elbow_tol"])
        reach = (euclidean_distance(l_sh, l_wr) + euclidean_distance(r_sh, r_wr)) / 2
        reach_score = _min_score(reach, t["arm_reach_ideal"], t["arm_reach_tol"])

        symmetry_gap = (abs(l_sh["y"] - r_sh["y"]) + abs(l_hi["y"] - r_hi["y"])) / 2
        symmetry_score = _max_score(symmetry_gap, t["symmetry_ideal"], t["symmetry_tol"])

        return _weighted([
            (hip_heel_score, t["hip_heel_w"]),
            (fold_score, t["fold_angle_w"]),
            (head_low_score, t["head_low_w"]),
            (elbow_score, t["elbow_w"]),
            (reach_score, t["arm_reach_w"]),
            (symmetry_score, t["symmetry_w"]),
        ])

    def _validate_balasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - kneel where your shoulders, hips, knees, and wrists are all visible."
        t = POSE_TOLERANCES["balasana"]

        l_sh, r_sh = lm[11], lm[12]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_an, r_an = lm[27], lm[28]
        mid_sh_y = (l_sh["y"] + r_sh["y"]) / 2
        mid_hi = {"x": (l_hi["x"] + r_hi["x"]) / 2, "y": (l_hi["y"] + r_hi["y"]) / 2}
        mid_an = {"x": (l_an["x"] + r_an["x"]) / 2, "y": (l_an["y"] + r_an["y"]) / 2}

        hips_close_to_heels = euclidean_distance(mid_hi, mid_an) <= t["hip_heel_max"]
        torso_folded_forward = (mid_hi["y"] - mid_sh_y) <= t["fold_min_gap"]
        reach = (euclidean_distance(l_sh, l_wr) + euclidean_distance(r_sh, r_wr)) / 2
        arms_extended = reach >= t["arm_reach_min"]

        criteria = [
            {"name": "Hips close to heels", "passed": hips_close_to_heels, "hint": "Sit your hips back onto your heels."},
            {"name": "Torso folded forward, head lowered", "passed": torso_folded_forward, "hint": "Fold your torso down and let your head rest low."},
            {"name": "Arms extended forward", "passed": arms_extended, "hint": "Stretch both arms forward along the mat."},
        ]

        if not hips_close_to_heels: hint = "Sit back so your hips settle close to your heels."
        elif not torso_folded_forward: hint = "Fold your torso forward and lower your head toward the mat."
        elif not arms_extended: hint = "Stretch your arms forward and relax into the fold."
        else: hint = "Peaceful Balasana - stay soft here and breathe."
        return criteria, hint

   
    def _score_bhujangasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["bhujangasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]

        shoulder_y = (l_sh["y"] + r_sh["y"]) / 2
        hip_y = (l_hi["y"] + r_hi["y"]) / 2
        chest_lift_score = _min_score(hip_y - shoulder_y, t["chest_lift_ideal"], t["chest_lift_tol"])

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        shoulder_level_score = _max_score(abs(l_sh["y"] - r_sh["y"]), t["shoulder_level_ceiling"], t["shoulder_level_tol"])
        hip_level_score = _max_score(abs(l_hi["y"] - r_hi["y"]), t["hip_level_ceiling"], t["hip_level_tol"])

        return _weighted([
            (chest_lift_score, t["chest_lift_w"]),
            (elbow_score, t["elbow_w"]),
            (shoulder_level_score, t["shoulder_level_w"]),
            (hip_level_score, t["hip_level_w"]),
        ])

    def _validate_bhujangasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - lie sideways enough for Bhujangasana."
        
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]

        shoulder_y = (l_sh["y"] + r_sh["y"]) / 2
        hip_y = (l_hi["y"] + r_hi["y"]) / 2
        lift = (hip_y - shoulder_y) >= 0.08
        stable = abs(l_hi["y"] - r_hi["y"]) < 0.12

        criteria = [
            {"name":"Chest lifted", "passed": lift, "hint":"Lift your chest gently like cobra pose."},
            {"name":"Hips stable", "passed": stable, "hint":"Keep hips and legs grounded."},
        ]
        return criteria, "Strong Bhujangasana - the jungle temple awakens." if lift and stable else "Lift chest while keeping hips steady."

    
    def _score_wall_plank_chaturanga(self, lm: list) -> float:
        t = POSE_TOLERANCES["wall_plank_chaturanga"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_an, r_an = lm[27], lm[28]

        l_line_ang = angle_between(l_sh, l_hi, l_an)
        r_line_ang = angle_between(r_sh, r_hi, r_an)
        body_line_score = (_target_score(l_line_ang, t["body_line_ideal"], t["body_line_tol"]) +
                           _target_score(r_line_ang, t["body_line_ideal"], t["body_line_tol"])) / 2.0

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        feet_score = _max_score(lateral_distance(l_an, r_an), t["feet_close_ideal"], t["feet_close_tol"])
        reach_score = _min_score(max(lateral_distance(l_sh, l_an), lateral_distance(r_sh, r_an)), t["reach_ideal"], t["reach_tol"])

        return _weighted([
            (body_line_score, t["body_line_w"]),
            (elbow_score, t["elbow_w"]),
            (feet_score, t["feet_close_w"]),
            (reach_score, t["reach_w"]),
        ])

    def _validate_wall_plank_chaturanga(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - face the camera side/front clearly."
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]
        l_an, r_an = lm[27], lm[28]

        line = max(lateral_distance(l_sh, l_an), lateral_distance(r_sh, r_an)) >= 0.30
        arms = (angle_between(l_sh,l_el,l_wr)+angle_between(r_sh,r_el,r_wr))/2 >= 115

        criteria = [
            {"name":"Long plank line", "passed": line, "hint":"Step back and keep body long."},
            {"name":"Arms supporting", "passed": arms, "hint":"Press palms into the wall and keep elbows controlled."},
        ]
        return criteria, "Controlled Wall-Plank Chaturanga - the dojo strengthens." if line and arms else "Keep a long wall-plank line with controlled arms."

   
    def _score_padahastasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["padahastasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_kn, r_kn = lm[25], lm[26]
        l_an, r_an = lm[27], lm[28]

        l_fold_ang = angle_between(l_sh, l_hi, l_kn)
        r_fold_ang = angle_between(r_sh, r_hi, r_kn)
        fold_score = (_target_score(l_fold_ang, t["fold_ideal"], t["fold_tol"]) +
                      _target_score(r_fold_ang, t["fold_ideal"], t["fold_tol"])) / 2.0

        reach_score = _min_score(0.40 - min(lateral_distance(l_wr, l_an), lateral_distance(r_wr, r_an)), t["reach_ideal"], t["reach_tol"])
        head_val = 1.0 if lm[0]["y"] > (l_sh["y"] + r_sh["y"]) / 2 - 0.03 else 0.0
        head_score = _min_score(head_val, t["head_down_ideal"], t["head_down_tol"])

        l_knee_ang = angle_between(l_hi, l_kn, l_an)
        r_knee_ang = angle_between(r_hi, r_kn, r_an)
        knee_score = (_target_score(l_knee_ang, t["knee_ideal"], t["knee_tol"]) +
                      _target_score(r_knee_ang, t["knee_ideal"], t["knee_tol"])) / 2.0

        return _weighted([
            (fold_score, t["fold_w"]),
            (reach_score, t["reach_w"]),
            (head_score, t["head_down_w"]),
            (knee_score, t["knee_w"]),
        ])

    def _validate_padahastasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - stand fully visible for forward fold."
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]

        shoulder_y = (l_sh['y']+r_sh['y'])/2
        hip_y = (l_hi['y']+r_hi['y'])/2
        folded = shoulder_y > hip_y - 0.08
        head = lm[0]['y'] > shoulder_y - 0.06

        criteria = [
            {"name":"Forward fold", "passed": folded, "hint":"Fold further from your hips."},
            {"name":"Head relaxed", "passed": head, "hint":"Relax neck downward."},
        ]
        return criteria, "Beautiful Padahastasana - autumn light returns." if folded and head else "Fold forward and relax your head downward."

   
    def _score_paschimottanasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["paschimottanasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_wr, r_wr = lm[15], lm[16]
        l_hi, r_hi = lm[23], lm[24]
        l_an, r_an = lm[27], lm[28]

        l_fold_ang = angle_between(l_sh, l_hi, lm[25])
        r_fold_ang = angle_between(r_sh, r_hi, lm[26])
        fold_score = (_target_score(l_fold_ang, t["fold_ideal"], t["fold_tol"]) +
                      _target_score(r_fold_ang, t["fold_ideal"], t["fold_tol"])) / 2.0

        reach_score = _min_score(0.46 - min(lateral_distance(l_wr, l_an), lateral_distance(r_wr, r_an)), t["reach_ideal"], t["reach_tol"])
        seated_score = _max_score(abs(l_hi['y'] - r_hi['y']), t["seated_ceiling"], t["seated_tol"])
        shoulder_y = (l_sh['y'] + r_sh['y']) / 2
        head_val = 1.0 if lm[0]['y'] > shoulder_y - 0.06 else 0.0
        head_score = _min_score(head_val, t["head_down_ideal"], t["head_down_tol"])

        return _weighted([
            (fold_score, t["fold_w"]),
            (reach_score, t["reach_w"]),
            (seated_score, t["seated_w"]),
            (head_score, t["head_down_w"]),
        ])

    def _validate_paschimottanasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - sit fully visible for Paschimottanasana."
        
        shoulder_y = (lm[11]['y'] + lm[12]['y']) / 2
        hip_y = (lm[23]['y'] + lm[24]['y']) / 2
        folded = shoulder_y > hip_y - 0.06
        stable = abs(lm[23]['y'] - lm[24]['y']) < 0.14

        criteria = [
            {"name":"Forward fold", "passed": folded, "hint":"Fold forward gently from the hips."},
            {"name":"Seated stability", "passed": stable, "hint":"Keep hips grounded and steady."},
        ]
        
        return criteria, "Beautiful Paschimottanasana - the theater lights return." if folded and stable else "Fold forward while keeping the seat stable."

   
    def _score_paschim_namaskarasana(self, lm: list) -> float:
        t = POSE_TOLERANCES["paschim_namaskarasana"]
        l_sh, r_sh = lm[11], lm[12]
        l_el, r_el = lm[13], lm[14]
        l_wr, r_wr = lm[15], lm[16]

        shoulder_y = (l_sh['y'] + r_sh['y']) / 2

        l_elbow_ang = angle_between(l_sh, l_el, l_wr)
        r_elbow_ang = angle_between(r_sh, r_el, r_wr)
        elbow_score = (_target_score(l_elbow_ang, t["elbow_ideal"], t["elbow_tol"]) +
                       _target_score(r_elbow_ang, t["elbow_ideal"], t["elbow_tol"])) / 2.0

        wrists_behind_val = 1.0 if (l_wr['y'] > shoulder_y and r_wr['y'] > shoulder_y) else 0.0
        wrists_behind_score = _min_score(wrists_behind_val, t["wrists_behind_ideal"], t["wrists_behind_tol"])
        hands_close_score = _max_score(lateral_distance(l_wr, r_wr), t["hands_close_ideal"], t["hands_close_tol"])
        shoulder_level_score = _max_score(abs(l_sh['y'] - r_sh['y']), t["shoulder_level_ceiling"], t["shoulder_level_tol"])

        return _weighted([
            (elbow_score, t["elbow_w"]),
            (wrists_behind_score, t["wrists_behind_w"]),
            (hands_close_score, t["hands_close_w"]),
            (shoulder_level_score, t["shoulder_level_w"]),
        ])

    def _validate_paschim_namaskarasana(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No pose detected - keep upper body visible."
        
        shoulder_y = (lm[11]['y'] + lm[12]['y']) / 2
        hands_back = lm[15]['y'] > shoulder_y and lm[16]['y'] > shoulder_y
        upright = abs(((lm[11]['x']+lm[12]['x'])/2) - ((lm[23]['x']+lm[24]['x'])/2)) < 0.20

        criteria = [
            {"name":"Hands behind back", "passed": hands_back, "hint":"Move both hands behind your back."},
            {"name":"Tall posture", "passed": upright, "hint":"Stand tall and open the chest."},
        ]
        
        return criteria, "Graceful Paschim Namaskarasana - the peacock garden blooms." if hands_back and upright else "Take hands behind the back and stand tall."

    
    def _score_pranayama(self, lm: list) -> float:
        t = POSE_TOLERANCES["pranayama"]
        l_sh, r_sh = lm[11], lm[12]
        l_hi, r_hi = lm[23], lm[24]

        torso_score = _max_score(abs(((l_sh['x']+r_sh['x'])/2) - ((l_hi['x']+r_hi['x'])/2)), t["torso_ceiling"], t["torso_tol"])
        shoulder_score = _max_score(abs(l_sh['y'] - r_sh['y']), t["shoulder_level_ceiling"], t["shoulder_level_tol"])

        return _weighted([
            (torso_score, t["torso_w"]),
            (shoulder_score, t["shoulder_level_w"]),
        ])

    def _validate_pranayama(self, lm, score):
        if len(lm) < REQUIRED_LANDMARKS:
            return [], "No body detected - sit clearly in frame for Pranayama."
        
        upright = abs(((lm[11]['x']+lm[12]['x'])/2) - ((lm[23]['x']+lm[24]['x'])/2)) < 0.22
        shoulders = abs(lm[11]['y'] - lm[12]['y']) < 0.12

        criteria = [
            {"name":"Upright seat", "passed": upright, "hint":"Sit tall and centered."},
            {"name":"Relaxed shoulders", "passed": shoulders, "hint":"Keep shoulders relaxed and level."},
        ]

        return criteria, "Calm Pranayama - the Prana Nexus expands." if upright and shoulders else "Sit steady, relax shoulders, and breathe slowly."
