import json
import os
import secrets
import random
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, session, redirect, url_for, jsonify, g, flash, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import db_compat
import psycopg2

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", os.environ.get("SECRET_KEY", "yoggyaan-lotus-secret-2024"))
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["SESSION_REFRESH_EACH_REQUEST"] = True

DATABASE_URL = os.environ.get("DATABASE_URL")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgdEOcEjScHyYPSzzJ
fZj1u250sScgCSqFxC1PE7BeeH2hRANCAAQp5vIqBkkDnpbQyH3z01kCl87OVN+D
WNflebt0IQqqXd7fMxGSTz9sL4zInYkHtxXweubiMJpQlw+PSCMhT8fb
-----END PRIVATE KEY-----
""")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "BCnm8ioGSQOeltDIffPTWQKXzs5U34NY1-V5u3QhCqpd3t8zEZJPP2wvjMidiQe3FfB65uIwmlCXD49IIyFPx9s")
VAPID_CLAIM_EMAIL = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:yoggyaan@example.com")

from py_vapid import Vapid01 as _Vapid01
VAPID_INSTANCE = _Vapid01.from_pem(VAPID_PRIVATE_KEY.encode())

PUSH_CRON_SECRET = os.environ.get("PUSH_CRON_SECRET", "yoggyaan-cron-secret-change-me")

HOLD_POSES = {"tree", "padmasana", "baddha_konasana", "vajrasana", "tadasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama", "warrior"}
BALANCED_REP_POSES = {"trikonasana"}

RESTRICTION_TAGS = [
    ("none", "None"),
    ("spine_injury", "Spine injury"),
    ("knee_injury", "Knee injury"),
    ("ankle_injury", "Ankle injury"),
    ("wrist_injury", "Wrist injury"),
    ("shoulder_injury", "Shoulder injury"),
    ("neck_injury", "Neck injury"),
    ("vertigo", "Vertigo"),
    ("pregnancy", "Pregnancy"),
    ("recent_surgery", "Recent surgery"),
    ("lower_back_pain", "Lower back pain"),
]

@app.context_processor
def inject_restriction_tags():
    return {"RESTRICTION_TAGS": RESTRICTION_TAGS}

def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = db_compat.connect(DATABASE_URL)
    return db

@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()

def init_db():
    db = db_compat.connect(DATABASE_URL)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            auth_token TEXT,
            phone TEXT,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak INTEGER DEFAULT 0,
            last_active TEXT,
            daily_challenge_streak INTEGER DEFAULT 0,
            daily_challenge_last_date TEXT,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS pose_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            pose_name TEXT NOT NULL,
            accuracy REAL NOT NULL,
            duration_seconds INTEGER NOT NULL,
            levels_completed INTEGER NOT NULL DEFAULT 1,
            successful_reps INTEGER NOT NULL DEFAULT 0,
            hold_duration INTEGER NOT NULL DEFAULT 0,
            xp_earned INTEGER NOT NULL DEFAULT 0,
            improvement_bonus INTEGER NOT NULL DEFAULT 0,
            completed_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS pose_mastery (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            pose_name TEXT NOT NULL,
            total_sessions INTEGER DEFAULT 0,
            total_reps INTEGER DEFAULT 0,
            total_hold_seconds INTEGER DEFAULT 0,
            best_accuracy REAL DEFAULT 0,
            avg_accuracy REAL DEFAULT 0,
            mastery_level TEXT DEFAULT 'Novice',
            restoration_stage TEXT DEFAULT '',
            updated_at TEXT DEFAULT (NOW()),
            UNIQUE(user_id, pose_name)
        );
        CREATE TABLE IF NOT EXISTS world_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            forest_restoration INTEGER DEFAULT 0,
            village_restoration INTEGER DEFAULT 0,
            lotus_restoration INTEGER DEFAULT 0,
            temple_restoration INTEGER DEFAULT 0,
            butterfly_restoration INTEGER DEFAULT 0,
            desert_restoration INTEGER DEFAULT 0,
            moon_restoration INTEGER DEFAULT 0,
            cloud_peak_restoration INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS achievements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            badge_name TEXT NOT NULL,
            badge_description TEXT,
            badge_icon TEXT DEFAULT 'star',
            earned_at TEXT DEFAULT (NOW()),
            UNIQUE(user_id, badge_name)
        );
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id SERIAL PRIMARY KEY,
            pose_name TEXT NOT NULL,
            description TEXT NOT NULL,
            target_accuracy INTEGER NOT NULL,
            target_duration INTEGER NOT NULL,
            xp_reward INTEGER NOT NULL,
            challenge_date TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS video_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            video_name TEXT,
            pose_name TEXT NOT NULL,
            duration INTEGER NOT NULL DEFAULT 0,
            accuracy REAL NOT NULL DEFAULT 0,
            repetitions INTEGER NOT NULL DEFAULT 0,
            hold_time INTEGER NOT NULL DEFAULT 0,
            xp_earned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (NOW())
        );

        CREATE TABLE IF NOT EXISTS questionnaire_answers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            age_range TEXT, biological_sex TEXT, activity_level TEXT, yoga_experience TEXT,
            current_asanas TEXT, session_duration_preference TEXT, weekly_practice_frequency TEXT,
            pain_scale INTEGER DEFAULT 0, healthcare_recommended TEXT, restrictions TEXT,
            medical_recovery_type TEXT, surgery_or_condition TEXT, doctor_restrictions TEXT,
            goals TEXT, feature_preferences TEXT, expectations TEXT,
            baseline_stress INTEGER DEFAULT 0, baseline_mood INTEGER DEFAULT 0,
            baseline_sleep INTEGER DEFAULT 0, baseline_flexibility INTEGER DEFAULT 0,
            baseline_balance INTEGER DEFAULT 0, preferred_times TEXT, available_days TEXT,
            sessions_per_day INTEGER DEFAULT 1, cooldown_hours INTEGER DEFAULT 1,
            custom_session_times TEXT DEFAULT '[]',
            reminder_enabled INTEGER DEFAULT 1, practice_mode TEXT DEFAULT 'session',
            recovery_json TEXT, completed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (NOW()), updated_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS health_conditions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            condition_name TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS routine_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            routine_json TEXT NOT NULL,
            generated_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS daily_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            session_date TEXT NOT NULL,
            slot_name TEXT NOT NULL,
            scheduled_time TEXT,
            status TEXT DEFAULT 'pending',
            completed_at TEXT,
            min_duration_minutes INTEGER DEFAULT 15,
            accumulated_practice_seconds INTEGER DEFAULT 0,
            UNIQUE(user_id, session_date, slot_name)
        );
        CREATE TABLE IF NOT EXISTS session_cooldowns (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            last_completed_at TEXT,
            next_unlock_at TEXT,
            cooldown_hours INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS weekly_schedule (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            day_name TEXT NOT NULL,
            slot_name TEXT NOT NULL,
            scheduled_time TEXT,
            enabled INTEGER DEFAULT 1,
            UNIQUE(user_id, day_name, slot_name)
        );
        CREATE TABLE IF NOT EXISTS followup_assessments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            stress INTEGER, mood INTEGER, sleep INTEGER, flexibility INTEGER, balance INTEGER,
            notes TEXT, created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS feedback_forms (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            satisfaction INTEGER, instruction_quality INTEGER, difficulty_fit INTEGER,
            skipped_reasons TEXT, continue_likelihood INTEGER, recommend_likelihood INTEGER,
            liked_most TEXT, desired_features TEXT, health_issues_unaddressed TEXT,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS progress_analytics (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            metric_name TEXT NOT NULL, metric_value REAL DEFAULT 0,
            metric_date TEXT DEFAULT (CURRENT_DATE), details_json TEXT
        );


        CREATE TABLE IF NOT EXISTS session_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            daily_session_id INTEGER,
            session_date TEXT NOT NULL,
            slot_name TEXT NOT NULL,
            scheduled_start TEXT,
            scheduled_end TEXT,
            started_at TEXT,
            ended_at TEXT,
            status TEXT DEFAULT 'active',
            duration_seconds INTEGER DEFAULT 0,
            total_asanas INTEGER DEFAULT 0,
            unique_asanas INTEGER DEFAULT 0,
            most_practiced_pose TEXT,
            total_hold_time INTEGER DEFAULT 0,
            average_accuracy REAL DEFAULT 0,
            xp_earned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS session_pose_logs (
            id SERIAL PRIMARY KEY,
            session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            pose_name TEXT NOT NULL,
            repetitions INTEGER DEFAULT 0,
            hold_duration INTEGER DEFAULT 0,
            accuracy REAL DEFAULT 0,
            xp_earned INTEGER DEFAULT 0,
            practice_seconds INTEGER DEFAULT 0,
            started_at TEXT,
            ended_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS session_timer (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            daily_session_id INTEGER,
            session_log_id INTEGER,
            starts_at TEXT,
            ends_at TEXT,
            remaining_seconds INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            updated_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS session_summary (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
            summary_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );

        CREATE TABLE IF NOT EXISTS health_assessment_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            snapshot_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS feedback_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            snapshot_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS reassessment_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            snapshot_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS session_preferences_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            snapshot_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW())
        );
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW()),
            UNIQUE(user_id, endpoint)
        );
        CREATE TABLE IF NOT EXISTS push_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            notif_date TEXT NOT NULL,
            window_name TEXT NOT NULL,
            sent_at TEXT DEFAULT (NOW()),
            UNIQUE(user_id, notif_date, window_name)
        );
    """)

    migrations = [
        ("users", "ALTER TABLE users ADD COLUMN password_hash TEXT"),
        ("users", "ALTER TABLE users ADD COLUMN auth_token TEXT"),
        ("users", "ALTER TABLE users ADD COLUMN phone TEXT"),
        ("users", "ALTER TABLE users ADD COLUMN daily_challenge_streak INTEGER DEFAULT 0"),
        ("users", "ALTER TABLE users ADD COLUMN daily_challenge_last_date TEXT"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN scheduled_end TEXT"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN duration_minutes INTEGER DEFAULT 30"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN started_at TEXT"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN expires_at TEXT"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN min_duration_minutes INTEGER DEFAULT 15"),
        ("daily_sessions", "ALTER TABLE daily_sessions ADD COLUMN accumulated_practice_seconds INTEGER DEFAULT 0"),
        ("session_pose_logs", "ALTER TABLE session_pose_logs ADD COLUMN practice_seconds INTEGER DEFAULT 0"),
        ("questionnaire_answers", "ALTER TABLE questionnaire_answers ADD COLUMN practice_mode TEXT DEFAULT 'session'"),
        ("questionnaire_answers", "ALTER TABLE questionnaire_answers ADD COLUMN recovery_json TEXT"),
        ("questionnaire_answers", "ALTER TABLE questionnaire_answers ADD COLUMN custom_session_times TEXT DEFAULT '[]'"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN successful_reps INTEGER NOT NULL DEFAULT 0"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN improvement_bonus INTEGER NOT NULL DEFAULT 0"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN hold_duration INTEGER NOT NULL DEFAULT 0"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN left_reps INTEGER NOT NULL DEFAULT 0"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN right_reps INTEGER NOT NULL DEFAULT 0"),
        ("pose_sessions", "ALTER TABLE pose_sessions ADD COLUMN best_accuracy REAL NOT NULL DEFAULT 0"),
        ("pose_mastery", "ALTER TABLE pose_mastery ADD COLUMN total_hold_seconds INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN lotus_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN temple_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN butterfly_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN desert_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN moon_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN cloud_peak_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN prism_valley_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN coral_reef_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN wind_valley_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN kingdoms_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN jungle_temple_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN samurai_dojo_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN autumn_valley_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN puppet_kingdom_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN peacock_garden_restoration INTEGER DEFAULT 0"),
        ("world_progress", "ALTER TABLE world_progress ADD COLUMN prana_nexus_restoration INTEGER DEFAULT 0"),
    ]
    for _, sql in migrations:
        try:
            db.execute(sql)
        except Exception:
            pass
    try:
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_unique_time ON daily_sessions(user_id, session_date, scheduled_time)")
    except Exception:
        pass
    db.close()

@app.before_request
def validate_session():
    if "user_id" in session:
        try:
            user = get_db().execute("SELECT id, auth_token FROM users WHERE id=?", (session["user_id"],)).fetchone()
            if (not user) or (user["auth_token"] and session.get("auth_token") != user["auth_token"]):
                session.clear()
        except Exception:
            session.clear()


QUESTIONNAIRE_EXEMPT_ENDPOINTS = {
    "index", "login", "logout", "static",
    "questionnaire", "save_questionnaire",
    "health_assessment", "save_health_assessment"
}

def json_dumps(value):
    return json.dumps(value or [], ensure_ascii=False)

def json_loads(value, default=None):
    if default is None:
        default = []
    try:
        return json.loads(value) if value else default
    except Exception:
        return default

def get_questionnaire(db, uid):
    return db.execute("SELECT * FROM questionnaire_answers WHERE user_id=?", (uid,)).fetchone()

def has_completed_questionnaire(db, uid):
    row = get_questionnaire(db, uid)
    return bool(row and row["completed"])

@app.before_request
def require_initial_assessment():
    if "user_id" not in session:
        return None
    endpoint = request.endpoint or ""
    if endpoint in QUESTIONNAIRE_EXEMPT_ENDPOINTS or endpoint.startswith("static") or endpoint.startswith("api_"):
        return None
    try:
        if not has_completed_questionnaire(get_db(), session["user_id"]):
            return redirect(url_for("questionnaire"))
    except Exception:
        return None
    return None

def _slugify_tag(value):
    return str(value or "").strip().lower().replace(" / ", "_").replace("-", "_").replace(" ", "_")

GOAL_TO_META = {
    "Stress relief": "stress_relief", "Flexibility": "flexibility", "Strength": "strength",
    "Weight management": "strength", "Better sleep": "sleep", "Posture correction": "posture",
    "Pain management": "pain_management", "Mental health support": "mindfulness", "Mindfulness": "mindfulness",
    "General fitness": "strength", "Spiritual practice": "mindfulness", "Community": "stress_relief",
}
CONDITION_TO_META = {
    "Back pain": ["lower_back_pain", "spine_injury"],
    "Joint pain": ["knee_injury", "ankle_injury", "wrist_injury", "shoulder_injury"],
    "Recent injury": ["recent_surgery", "spine_injury", "knee_injury", "ankle_injury", "wrist_injury", "shoulder_injury"],
    "Blood pressure issues": ["mild_hypertension"],
    "Cardiovascular condition": ["recent_surgery"],
    "Respiratory condition": ["respiratory_health"],
    "Neurological condition": ["vertigo"],
    "Pregnancy/Postpartum": ["pregnancy", "recent_surgery"],
}
DIFFICULTY_RANK = {"beginner": 1, "intermediate": 2, "advanced": 3}
RISK_RANK = {"low": 1, "moderate": 2, "high": 3}


def load_asana_metadata():
    path = os.path.join(os.path.dirname(__file__), "data", "asana_metadata.txt")
    poses = {}
    if not os.path.exists(path):
        return poses
    route_to_key = {
        "/game/tadasana": "tadasana", "/game/bhujangasana": "bhujangasana",
        "/game/balasana": "balasana", "/game/padahastasana": "padahastasana",
        "/game/paschimottanasana": "paschimottanasana", "/game/wall_plank_chaturanga": "wall_plank_chaturanga",
        "/game/paschim_namaskarasana": "paschim_namaskarasana", "/game/pranayama": "pranayama",
        "/game/tree": "tree", "/game/warrior": "warrior", "/game/padmasana": "padmasana",
        "/game/vajrasana": "vajrasana", "/game/baddha_konasana": "baddha_konasana", "/game/trikonasana": "trikonasana",
    }
    current = None
    for raw in open(path, encoding="utf-8").read().splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Route:"):
            route = line.split("|", 1)[0].replace("Route:", "").strip()
            world = line.split("World:", 1)[1].strip() if "World:" in line else ""
            key = route_to_key.get(route)
            if key:
                current = poses.setdefault(key, {"pose_key": key, "route": route, "world": world})
            continue
        if not current or ":" not in line:
            continue
        field, val = [x.strip() for x in line.split(":", 1)]
        field = field.lower().replace(" ", "_")
        if field in {"difficulty", "risk_level"}:
            current[field] = _slugify_tag(val)
        elif field in {"goals", "body_regions", "conditions_helped", "contraindications", "surgery_safety"}:
            if "none" in val.lower() or "universally safe" in val.lower():
                items = []
            else:
                val = val.split("—", 1)[0]
                items = [_slugify_tag(x) for x in val.split(",") if x.strip()]
            current[field] = items
    
    try:
        with open(os.path.join(os.path.dirname(__file__), "data", "poses.json"), encoding="utf-8") as f:
            pose_json = json.load(f)
        for key, meta in poses.items():
            meta["display_name"] = pose_json.get(key, {}).get("name", key.replace("_", " ").title())
    except Exception:
        for key, meta in poses.items():
            meta["display_name"] = key.replace("_", " ").title()
    return poses


def _user_recommendation_profile(answer, conditions):
    goals = json_loads(answer["goals"] if answer else "[]")
    meta_goals = [_slugify_tag(GOAL_TO_META.get(g, g)) for g in goals]
    condition_tags = []
    for c in conditions:
        condition_tags.extend(CONDITION_TO_META.get(c, [_slugify_tag(c)]))
    restrictions = " ".join([
        str(answer["restrictions"] if answer and "restrictions" in answer.keys() else ""),
        str(answer["doctor_restrictions"] if answer and "doctor_restrictions" in answer.keys() else ""),
        str(answer["surgery_or_condition"] if answer and "surgery_or_condition" in answer.keys() else ""),
    ]).lower()
    for tag in ["spine_injury", "knee_injury", "ankle_injury", "wrist_injury", "shoulder_injury", "neck_injury", "vertigo", "pregnancy", "recent_surgery", "lower_back_pain"]:
        if tag.replace("_", " ") in restrictions or tag.split("_")[0] in restrictions:
            condition_tags.append(tag)
    exp = _slugify_tag(answer["yoga_experience"] if answer else "never")
    user_level = 1 if exp in ["never", "beginner", ""] else (2 if exp == "occasionally" else 3)
    medical = _slugify_tag(answer["medical_recovery_type"] if answer else "no")
    surgery_mode = "general_wellness"
    if "pre" in medical:
        surgery_mode = "pre_surgery"
        condition_tags.append("recent_surgery")
    elif "post" in medical:
        surgery_mode = "post_surgery"
        condition_tags.append("recent_surgery")
    elif "condition" in medical or "chronic" in medical:
        surgery_mode = "condition_management"
    pain = int(answer["pain_scale"] if answer and answer["pain_scale"] is not None else 0)
    return {"goals": goals, "meta_goals": list(dict.fromkeys(meta_goals)), "conditions": conditions,
            "condition_tags": list(dict.fromkeys(condition_tags)), "user_level": user_level,
            "surgery_mode": surgery_mode, "pain": pain,
            "duration": duration_minutes_from_pref(answer["session_duration_preference"] if answer else None, 30)}


def generate_recommendation_engine(db, uid):
    answer = get_questionnaire(db, uid)
    conditions = [r["condition_name"] for r in db.execute("SELECT condition_name FROM health_conditions WHERE user_id=?", (uid,)).fetchall()]
    profile = _user_recommendation_profile(answer, conditions)
    metadata = load_asana_metadata()
    recommended, caution, blocked = [], [], []
    for key, meta in metadata.items():
        reasons, cautions, blocks = [], [], []
        score = 45
        goal_matches = [g for g in profile["meta_goals"] if g in meta.get("goals", [])]
        if goal_matches:
            score += 12 * len(goal_matches)
            for g in goal_matches[:3]: reasons.append("Matches your " + g.replace("_", " ") + " goal")
        helped = [c for c in profile["condition_tags"] if c in meta.get("conditions_helped", [])]
        if helped:
            score += 8 * len(helped)
            reasons.append("Supports " + ", ".join(h.replace("_", " ") for h in helped[:2]))
        conflicts = [c for c in profile["condition_tags"] if c in meta.get("contraindications", [])]
        if conflicts:
            score -= 35 * len(conflicts)
            msg = "Contraindication conflict: " + ", ".join(c.replace("_", " ") for c in conflicts[:3])
            if meta.get("risk_level") == "low" and len(conflicts) == 1:
                cautions.append(msg)
            else:
                blocks.append(msg)
        if profile["surgery_mode"] != "general_wellness" and profile["surgery_mode"] not in meta.get("surgery_safety", []):
            score -= 45
            blocks.append("Not marked safe for " + profile["surgery_mode"].replace("_", " ") + " in asana metadata")
        diff = DIFFICULTY_RANK.get(meta.get("difficulty", "beginner"), 1)
        if diff <= profile["user_level"]:
            score += 10; reasons.append("Appropriate for your experience level")
        elif diff == profile["user_level"] + 1:
            score -= 10; cautions.append("Slightly above your current experience level")
        else:
            score -= 28; blocks.append("Difficulty is too high for your current experience level")
        risk = RISK_RANK.get(meta.get("risk_level", "low"), 1)
        if profile["pain"] >= 7 and risk >= 2:
            score -= 25; cautions.append("Higher pain score detected; use only with professional guidance")
        if risk == 1:
            score += 8; reasons.append("Low risk in the metadata")
        elif risk == 3:
            score -= 18; cautions.append("High risk pose in the metadata")
        score = max(0, min(100, score))
        card = {"key": key, "name": meta.get("display_name", key.replace("_", " ").title()), "route": meta.get("route", "/game/"+key),
                "world": meta.get("world", ""), "match": score, "risk": meta.get("risk_level", "low"),
                "difficulty": meta.get("difficulty", "beginner"), "reasons": reasons[:4] or ["Safe general wellness practice based on metadata"],
                "cautions": cautions[:3], "blocks": blocks[:3]}
        if blocks:
            blocked.append(card)
        elif cautions or score < 60:
            caution.append(card)
        else:
            recommended.append(card)
    recommended.sort(key=lambda x: x["match"], reverse=True)
    caution.sort(key=lambda x: x["match"], reverse=True)
    blocked.sort(key=lambda x: x["match"])
    routine_seconds = profile["duration"] * 60
    picked = recommended[:]
    if len(picked) < 4:
        picked += [c for c in caution if c["risk"] == "low"]
    routine = picked[:max(3, min(6, profile["duration"] // 5 or 3))]
    minutes_each = max(3, profile["duration"] // max(1, len(routine)))
    return {"profile": profile, "recommended": recommended[:5], "caution": caution[:5], "blocked": blocked[:5],
            "routine": [{**r, "minutes": minutes_each} for r in routine]}

def generate_personalized_routine(answer):
    
    metadata = load_asana_metadata()
    goals = json_loads(answer["goals"] if answer else "[]")
    meta_goals = [_slugify_tag(GOAL_TO_META.get(g, g)) for g in goals]
    exp = _slugify_tag(answer["yoga_experience"] if answer else "never")
    user_level = 1 if exp in ["never", "beginner", ""] else (2 if exp == "occasionally" else 3)
    scored = []
    for key, meta in metadata.items():
        score = 0
        score += 10 * len([g for g in meta_goals if g in meta.get("goals", [])])
        if DIFFICULTY_RANK.get(meta.get("difficulty", "beginner"), 1) <= user_level:
            score += 5
        if meta.get("risk_level") == "low":
            score += 3
        scored.append((score, key))
    scored.sort(reverse=True)
    selected = [k for _, k in scored[:5] if k in ALL_POSES] or ["tadasana", "pranayama", "vajrasana"]
    difficulty = "Beginner" if user_level == 1 else ("Intermediate" if user_level == 2 else "Advanced")
    return {"difficulty": difficulty, "poses": selected[:5], "generated_for_goals": goals[:3], "metadata_driven": True}

def duration_minutes_from_pref(pref, default=30):
    try:
        return int(str(pref or '').split()[0])
    except Exception:
        return default

def is_guided_recovery_answer(answer):
    if not answer:
        return False
    recovery = (answer["medical_recovery_type"] if "medical_recovery_type" in answer.keys() else "") or ""
    healthcare = (answer["healthcare_recommended"] if "healthcare_recommended" in answer.keys() else "") or ""
    goals = json_loads(answer["goals"] if "goals" in answer.keys() else "[]")
    triggers = [recovery, healthcare] + goals
    trigger_text = " ".join(str(x).lower() for x in triggers)
    return ("yes" in healthcare.lower()
            or "recommended" in healthcare.lower()
            or "surgery" in trigger_text
            or "rehab" in trigger_text
            or "condition management" in trigger_text
            or "chronic condition" in trigger_text
            or "pain management" in trigger_text)

def get_practice_mode(answer):
    if is_guided_recovery_answer(answer):
        return "guided_recovery"
    mode = (answer["practice_mode"] if answer and "practice_mode" in answer.keys() else "session") or "session"
    return "free" if mode == "free" else "session"

def generate_recovery_profile(answer, conditions=None):
    conditions = conditions or []
    if not answer:
        return {}
    return {
        "guided_recovery_mode": is_guided_recovery_answer(answer),
        "doctor_recommended": ((answer["healthcare_recommended"] if "healthcare_recommended" in answer.keys() else "") or "").lower().startswith("yes"),
        "medical_recovery_type": answer["medical_recovery_type"] if "medical_recovery_type" in answer.keys() else "",
        "surgery_or_condition": answer["surgery_or_condition"] if "surgery_or_condition" in answer.keys() else "",
        "doctor_restrictions": answer["doctor_restrictions"] if "doctor_restrictions" in answer.keys() else "",
        "recovery_goals": json_loads(answer["goals"] if "goals" in answer.keys() else "[]"),
        "condition_details": conditions,
        "sessions_per_day": int((answer["sessions_per_day"] if "sessions_per_day" in answer.keys() else 1) or 1),
        "preferred_times": json_loads(answer["preferred_times"] if "preferred_times" in answer.keys() else "[]"),
        "minimum_gap_hours": max(1, int((answer["cooldown_hours"] if "cooldown_hours" in answer.keys() else 1) or 1)),
        "cooldown_reminders": bool(answer["reminder_enabled"] if "reminder_enabled" in answer.keys() else 1),
        "prepared_for_recommendation_engine": True,
    }

def _minutes_to_hhmm(minutes):
    minutes = max(0, min(23*60+59, int(minutes)))
    return f"{minutes//60:02d}:{minutes%60:02d}"

def generate_session_slots(preferred_times, sessions_per_day, min_gap_minutes=30, selected_times=None):
    windows = {
        "Morning": (6*60, 11*60),
        "Afternoon": (12*60, 16*60),
        "Evening": (17*60, 21*60),
        "Night": (21*60, 23*60),
    }
    try:
        requested = max(1, min(int(sessions_per_day or 1), 12))
    except Exception:
        requested = 1
    min_gap = max(30, int(min_gap_minutes or 30))

    def parse_time_to_min(t):
        try:
            h, m = parse_hhmm(str(t))
            return h*60 + m
        except Exception:
            return None

    preferred = [t for t in (preferred_times or []) if t in windows]
    if not preferred:
        preferred = ["Morning"]

    explicit = []
    for raw in (selected_times or []):
        mins = parse_time_to_min(raw)
        if mins is None:
            continue
        if any(windows[w][0] <= mins <= windows[w][1] for w in preferred):
            explicit.append(mins)
    explicit = sorted(set(explicit))
    if explicit:
        clean = []
        for t in explicit:
            if all(abs(t - x) >= min_gap for x in clean):
                clean.append(t)
            if len(clean) == requested:
                break
        return [{"slot_name": f"Session {i+1}", "time": _minutes_to_hhmm(t), "preference": "Selected"} for i, t in enumerate(clean)]

    clean = []
    for pref in preferred:
        start_min, end_min = windows[pref]
        probe = start_min
        while probe <= end_min and len(clean) < requested:
            if all(abs(probe - x) >= min_gap for x in clean):
                clean.append(probe)
            probe += min_gap
        if len(clean) >= requested:
            break
    return [{"slot_name": f"Session {i+1}", "time": _minutes_to_hhmm(t), "preference": "Selected"} for i, t in enumerate(sorted(clean)[:requested])]

def rebuild_weekly_schedule(db, uid, answer):
    mode = get_practice_mode(answer)
   
    if mode == "free":
        db.execute("DELETE FROM weekly_schedule WHERE user_id=?", (uid,))
        db.execute("DELETE FROM daily_sessions WHERE user_id=? AND status IN ('pending','upcoming','active')", (uid,))
        return
    days = [d for d in json_loads(answer["available_days"], []) if d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]]
    if not days:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    duration = duration_minutes_from_pref(answer["session_duration_preference"] if answer else None, 30)
    min_duration = max(1, min(duration, int(round(duration * 0.5))))
    slot_gap_minutes = duration + 30
    slots = generate_session_slots(json_loads(answer["preferred_times"]), answer["sessions_per_day"], slot_gap_minutes, json_loads(answer["custom_session_times"] if "custom_session_times" in answer.keys() else "[]"))
    db.execute("DELETE FROM weekly_schedule WHERE user_id=?", (uid,))
    for day in days:
        for slot in slots:
            db.execute("""INSERT INTO weekly_schedule (user_id, day_name, slot_name, scheduled_time, enabled) VALUES (?,?,?,?,1)
                ON CONFLICT (user_id, day_name, slot_name) DO UPDATE SET scheduled_time=EXCLUDED.scheduled_time, enabled=EXCLUDED.enabled""", (uid, day, slot["slot_name"], slot["time"]))
    today = date.today().isoformat()
    db.execute("DELETE FROM daily_sessions WHERE user_id=? AND session_date=? AND status IN ('pending','upcoming','active','missed','expired')", (uid, today))
    for slot in slots:
        start, end = slot_window(slot["slot_name"], slot["time"], duration)
        db.execute("""INSERT INTO daily_sessions
            (user_id, session_date, slot_name, scheduled_time, scheduled_end, duration_minutes, min_duration_minutes, expires_at, status)
            VALUES (?,?,?,?,?,?,?,?, 'pending')
            ON CONFLICT (user_id, session_date, slot_name) DO NOTHING""",
            (uid, today, slot["slot_name"], slot["time"], end.strftime("%H:%M"), duration, min_duration, end.isoformat(timespec="seconds")))
def get_today_session_summary(db, uid):
    today = date.today().isoformat()
    rows = db.execute("SELECT * FROM daily_sessions WHERE user_id=? AND session_date=? ORDER BY scheduled_time", (uid, today)).fetchall()
    if not rows:
        ans = get_questionnaire(db, uid)
        if ans:
            rebuild_weekly_schedule(db, uid, ans); db.commit()
            rows = db.execute("SELECT * FROM daily_sessions WHERE user_id=? AND session_date=? ORDER BY scheduled_time", (uid, today)).fetchall()
    completed = sum(1 for r in rows if r["status"] == "completed")
    return {"rows": [dict(r) for r in rows], "completed": completed, "target": len(rows), "pct": int((completed / len(rows))*100) if rows else 0}

def get_followup_status(db, uid):
    ans = get_questionnaire(db, uid)
    if not ans:
        return {"due": False, "days_left": 14, "message": "Complete initial assessment"}
    try:
        created = datetime.fromisoformat((ans["created_at"] or datetime.now().isoformat()).replace("Z", "")).date()
    except Exception:
        created = date.today()
    days = (date.today() - created).days
    done = db.execute("SELECT COUNT(*) AS c FROM followup_assessments WHERE user_id=?", (uid,)).fetchone()["c"]
    return {"due": days >= 14 and done == 0, "days_left": max(0, 14-days), "done": done}

def get_wellness_insights(db, uid):
    ans = get_questionnaire(db, uid)
    latest = db.execute("SELECT * FROM followup_assessments WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (uid,)).fetchone()
    insights, trends = [], {}
    if ans and latest:
        for key in ["stress", "mood", "sleep", "flexibility", "balance"]:
            base = ans[f"baseline_{key}"]
            now = latest[key]
            if base is not None and now is not None:
                trends[key] = {"before": base, "after": now, "change": now - base}
        if "stress" in trends and trends["stress"]["change"] < 0:
            insights.append(f"Stress improved by {abs(trends['stress']['change'])} points.")
        if "flexibility" in trends and trends["flexibility"]["change"] > 0:
            insights.append(f"Flexibility increased from {trends['flexibility']['before']} to {trends['flexibility']['after']}.")
    best_slot = db.execute("SELECT slot_name, COUNT(*) c FROM daily_sessions WHERE user_id=? AND status='completed' GROUP BY slot_name ORDER BY c DESC LIMIT 1", (uid,)).fetchone()
    if best_slot:
        insights.append(f"{best_slot['slot_name']} sessions are your most consistent.")
    return {"trends": trends, "insights": insights[:4]}



def _parse_dt(value):
    try:
        return datetime.fromisoformat(str(value or '').replace('Z',''))
    except Exception:
        try:
            return datetime.strptime(str(value or '')[:19], '%Y-%m-%d %H:%M:%S')
        except Exception:
            return datetime.now()

def _pct_change(metric, before, after):
    before = float(before or 0); after = float(after or 0)
    if before <= 0:
        return 0
    if metric == 'stress':
        return round(((before - after) / before) * 100, 1)
    return round(((after - before) / before) * 100, 1)

def _metric_improved(metric, before, after):
    if before is None or after is None:
        return False
    return after < before if metric == 'stress' else after > before

def _metric_label(metric):
    return {
        'stress':'Stress', 'mood':'Mood', 'sleep':'Sleep', 'flexibility':'Flexibility', 'balance':'Balance'
    }.get(metric, metric.title())

def _metric_icon(metric):
    return {'stress':'🧠','mood':'😊','sleep':'😴','flexibility':'🤸','balance':'⚖️'}.get(metric,'✨')

def _pose_display_name(pose):
    return str(pose or '').replace('_',' ').title()

def ensure_analytics_achievements(db, uid):
    sessions = db.execute("SELECT * FROM pose_sessions WHERE user_id=?", (uid,)).fetchall()
    total_minutes = sum((s['duration_seconds'] or 0) for s in sessions) // 60 if sessions else 0
    best_acc = max([s['accuracy'] or 0 for s in sessions], default=0)
    pose_count = db.execute("SELECT COUNT(DISTINCT pose_name) AS c FROM pose_sessions WHERE user_id=?", (uid,)).fetchone()['c']
    pranayama_count = db.execute("SELECT COUNT(*) AS c FROM pose_sessions WHERE user_id=? AND pose_name='pranayama'", (uid,)).fetchone()['c']
    user = db.execute("SELECT streak FROM users WHERE id=?", (uid,)).fetchone()
    streak = int(user['streak'] or 0) if user else 0
    unlocks = []
    if sessions: unlocks.append(('First Session','Completed your first YogGyaan practice.','seedling'))
    if streak >= 7: unlocks.append(('7-Day Streak','Practiced for seven days in a row.','fire'))
    if total_minutes >= 100: unlocks.append(('100 Minutes Practiced','Crossed 100 total practice minutes.','clock'))
    if best_acc >= 90: unlocks.append(('90% Accuracy Master','Reached 90%+ pose accuracy.','target'))
    if pose_count >= len(ALL_POSES): unlocks.append(('Completed All Worlds','Practiced every YogGyaan world/asana.','globe'))
    if pranayama_count >= 5: unlocks.append(('Pranayama Master','Completed five breathing practice sessions.','wind'))
    
    for name, desc, icon in unlocks:
        db.execute("INSERT INTO achievements (user_id,badge_name,badge_description,badge_icon) VALUES (?,?,?,?) ON CONFLICT (user_id, badge_name) DO NOTHING", (uid,name,desc,icon))

def build_wellness_analytics(db, uid):
    ans = get_questionnaire(db, uid)
    metrics = ['stress','mood','sleep','flexibility','balance']
    baseline = {}
    timeline = []
    if ans:
        base_date = (ans['created_at'] or datetime.now().isoformat())[:10]
        point = {'date': base_date, 'label': 'Initial assessment'}
        for m in metrics:
            baseline[m] = int(ans[f'baseline_{m}'] or 0)
            point[m] = baseline[m]
        timeline.append(point)
    rows = [dict(r) for r in db.execute("SELECT * FROM followup_assessments WHERE user_id=? ORDER BY created_at ASC", (uid,)).fetchall()]
    for i, r in enumerate(rows, start=1):
        point = {'date': (r.get('created_at') or '')[:10], 'label': '2-week assessment' if i == 1 else f'Assessment {i+1}'}
        for m in metrics:
            point[m] = int(r.get(m) or 0)
        timeline.append(point)
    latest = timeline[-1] if timeline else {m:0 for m in metrics}
    if not baseline:
        baseline = {m:int(latest.get(m,0) or 0) for m in metrics}
    cards = []
    for m in metrics:
        before = int(baseline.get(m,0) or 0)
        after = int(latest.get(m,0) or 0)
        previous = int(timeline[-2].get(m, before) if len(timeline) > 1 else before)
        pct = _pct_change(m, before, after)
        improved = _metric_improved(m, before, after)
        direction = 'down' if m == 'stress' and improved else ('up' if improved else ('same' if after == previous else 'decline'))
        cards.append({'key':m,'label':_metric_label(m),'icon':_metric_icon(m),'current':after,'previous':previous,'before':before,'pct':abs(pct),'improved': improved, 'direction': direction, 'word': 'reduction' if m == 'stress' and improved else ('improvement' if improved else 'decline')})

    cur_norm = {}
    for m in metrics:
        val = max(0, min(10, int(latest.get(m,0) or 0)))
        cur_norm[m] = (10 - val) * 10 if m == 'stress' else val * 10
    sessions = [dict(r) for r in db.execute("SELECT * FROM pose_sessions WHERE user_id=? ORDER BY completed_at ASC", (uid,)).fetchall()]
    days = {str(s.get('completed_at',''))[:10] for s in sessions if s.get('completed_at')}
    consistency = min(100, len(days) * 12)
    wellness_score = round((cur_norm.get('stress',0)*0.20 + cur_norm.get('mood',0)*0.15 + cur_norm.get('sleep',0)*0.15 + cur_norm.get('flexibility',0)*0.15 + cur_norm.get('balance',0)*0.10 + consistency*0.25), 1)
    total_sessions = len(sessions)
    total_minutes = sum(int(s.get('duration_seconds') or 0) for s in sessions) // 60
    
    date_objs = sorted({_parse_dt(d).date() for d in days})
    longest = cur = 0; prev = None
    for d in date_objs:
        cur = cur + 1 if prev and (d-prev).days == 1 else 1
        longest = max(longest, cur); prev = d
    today = date.today(); current_streak = 0
    dset = set(date_objs); d = today
    while d in dset:
        current_streak += 1; d -= timedelta(days=1)
    if current_streak == 0 and (today - timedelta(days=1)) in dset:
        d = today - timedelta(days=1)
        while d in dset:
            current_streak += 1; d -= timedelta(days=1)
            
    fav = db.execute("SELECT pose_name, COUNT(*) c FROM pose_sessions WHERE user_id=? GROUP BY pose_name ORDER BY c DESC LIMIT 1", (uid,)).fetchone()
    category_map = {'pranayama':'Breath Practice','padmasana':'Meditation','vajrasana':'Meditation','tree':'Balance','trikonasana':'Balance','warrior':'Strength',
                    'wall_plank_chaturanga':'Strength',
                    'balasana':'Strength','bhujangasana':'Flexibility','baddha_konasana':'Flexibility',
                    'padahastasana':'Flexibility','paschimottanasana':'Flexibility','paschim_namaskarasana':'Posture','tadasana':'Posture'}
    cats = {}
    for s in sessions:
        c = category_map.get(s.get('pose_name'),'General'); cats[c] = cats.get(c,0)+1
    now = datetime.now()

    week_start = (now - timedelta(days=now.weekday())).date()
    month_start = now.replace(day=1).date()
    sess_week = sum(1 for s in sessions if _parse_dt(s.get('completed_at')).date() >= week_start)
    sess_month = sum(1 for s in sessions if _parse_dt(s.get('completed_at')).date() >= month_start)
    avg_acc = round(sum(float(s.get('accuracy') or 0) for s in sessions)/total_sessions, 1) if total_sessions else 0
    best_session = max(sessions, key=lambda x: float(x.get('accuracy') or 0), default=None)

    pose_groups = {}
    for s in sessions:
        pose_groups.setdefault(s.get('pose_name'), []).append(s)
    improved_pose = None; improved_delta = -999
    asanas = []
    
    for pose, arr in pose_groups.items():
        arr = sorted(arr, key=lambda x: x.get('completed_at') or '')
        avg = round(sum(float(x.get('accuracy') or 0) for x in arr)/len(arr),1)
        first = float(arr[0].get('accuracy') or 0); last = float(arr[-1].get('accuracy') or 0)
        delta = round(last-first,1)

        if delta > improved_delta:
            improved_delta = delta; improved_pose = pose

        best = max(arr, key=lambda x: float(x.get('accuracy') or 0))
        asanas.append({'pose':pose,'name':_pose_display_name(pose),'times':len(arr),
                       'avg_accuracy':avg,'longest_hold':max(int(x.get('hold_duration') or 0) for x in arr),
                       'best_session':round(float(best.get('accuracy') or 0),1),
                       'level':get_or_create_mastery(db, uid, pose).get('mastery_level','Novice'),
                       'xp':sum(int(x.get('xp_earned') or 0) for x in arr),'history':[{'date':(x.get('completed_at') or '')[:10], 'accuracy':round(float(x.get('accuracy') or 0),1)} for x in arr]})
    asanas.sort(key=lambda x: (x['times'], x['avg_accuracy']), reverse=True)
    completed = sum(1 for s in sessions if float(s.get('accuracy') or 0) >= 60)
    
    completion_rate = round((completed/total_sessions)*100,1) if total_sessions else 0
    
    acc_trend = [{'date':(s.get('completed_at') or '')[:10], 'accuracy':round(float(s.get('accuracy') or 0),1), 'pose':_pose_display_name(s.get('pose_name'))} for s in sessions]
    badges = [dict(b) for b in db.execute("SELECT * FROM achievements WHERE user_id=? ORDER BY earned_at ASC", (uid,)).fetchall()]
    wtimeline = []

    for idx, p in enumerate(timeline):
        pdate = p['date']
        s_done = sum(1 for s in sessions if str(s.get('completed_at',''))[:10] <= pdate)
        major = []
        for m in metrics:
            b = baseline.get(m,0); val = p.get(m,0)
            if _metric_improved(m,b,val):
                major.append(f"{_metric_label(m)} {abs(_pct_change(m,b,val)):.0f}%")
        
        try:
            first_date = datetime.fromisoformat(str(timeline[0]['date'])).date()
            cur_date = datetime.fromisoformat(str(pdate)).date()
            day_label = f"Day {(cur_date - first_date).days + 1}"
        except Exception:
            day_label = f"Day {idx + 1}"
        wtimeline.append({'label': day_label, 'date':pdate, 'assessment':p, 'sessions_completed':s_done, 'achievements': [b for b in badges if (b.get('earned_at') or '')[:10] <= pdate][:3], 'improvements': major[:3]})
    return {'metrics':metrics,'cards':cards,'timeline':timeline,'before':baseline,'latest':{m:int(latest.get(m,0) or 0) for m in metrics}, 'wellness_score':wellness_score, 'score_parts':cur_norm, 'consistency':consistency, 'session':{'total_sessions':total_sessions,'total_minutes':total_minutes,'longest_streak':longest,'current_streak':current_streak,'favorite_asana':_pose_display_name(fav['pose_name']) if fav else 'None yet','most_practiced_category':max(cats, key=cats.get) if cats else 'None yet','sessions_week':sess_week,'sessions_month':sess_month}, 'accuracy':{'average':avg_acc,'best_accuracy':round(float(best_session.get('accuracy') or 0),1) if best_session else 0,'best_pose':_pose_display_name(best_session.get('pose_name')) if best_session else 'None yet','most_improved':_pose_display_name(improved_pose) if improved_pose else 'None yet','most_improved_delta':max(0, improved_delta if improved_delta!=-999 else 0),'completion_rate':completion_rate,'trend':acc_trend}, 'asanas':asanas, 'badges':badges, 'wellness_timeline':wtimeline}


def parse_hhmm(value):
    try:
        h, m = str(value or "00:00").split(":")[:2]
        return int(h), int(m)
    except Exception:
        return 0, 0

SESSION_WINDOWS = {
    "Morning": ("06:00", "11:00"),
    "Afternoon": ("12:00", "16:00"),
    "Evening": ("17:00", "21:00"),
    "Night": ("21:00", "23:00"),
}

def session_status_label(status):
    return {
        "upcoming": "🔒 Upcoming",
        "active": "⏳ Active",
        "completed": "✔️ Completed",
        "missed": "⚠️ Missed",
        "expired": "⏰ Expired",
    }.get(status, status.title())

def slot_window(slot_name, scheduled_time=None, duration_minutes=30):
    
    if scheduled_time:
        h, m = parse_hhmm(scheduled_time)
        start_dt = datetime.combine(date.today(), datetime.min.time()).replace(hour=h, minute=m)
    else:
        s, _ = SESSION_WINDOWS.get(slot_name, ("00:00", "00:30"))
        sh, sm = parse_hhmm(s)
        start_dt = datetime.combine(date.today(), datetime.min.time()).replace(hour=sh, minute=sm)

    end_dt = start_dt + timedelta(minutes=int(duration_minutes or 30))

    if end_dt.date() != date.today():
        end_dt = datetime.combine(date.today(), datetime.max.time()).replace(microsecond=0)
    return start_dt, end_dt

def _fmt_time(dt):
    return dt.strftime("%I:%M %p").lstrip("0")

def _fmt_range(start, end):
    return f"{_fmt_time(start)} - {_fmt_time(end)}"

def _seconds_left(end):
    return max(0, int((end - datetime.now()).total_seconds()))

def _ensure_daily_sessions_for_today(db, uid):
    today = date.today().isoformat()
    rows = db.execute("SELECT * FROM daily_sessions WHERE user_id=? AND session_date=? ORDER BY scheduled_time", (uid, today)).fetchall()
    ans = get_questionnaire(db, uid)
    if ans:
        mode = get_practice_mode(ans)
        if mode == "free":
            if rows:
                db.execute("DELETE FROM daily_sessions WHERE user_id=? AND session_date=? AND status IN ('pending','upcoming','active','missed','expired')", (uid, today))
                db.commit()
            return []
        try:
            requested = max(1, int(ans["sessions_per_day"] or 1))
        except Exception:
            requested = 1
        non_completed_count = sum(1 for r in rows if (r["status"] or "pending") != "completed")
       
        if (not rows) or (non_completed_count and len(rows) != requested):
            rebuild_weekly_schedule(db, uid, ans)
            db.commit()
            rows = db.execute("SELECT * FROM daily_sessions WHERE user_id=? AND session_date=? ORDER BY scheduled_time", (uid, today)).fetchall()
    return rows

def _active_session_log(db, uid):
    return db.execute("""
        SELECT * FROM session_logs
        WHERE user_id=? AND status='active'
        ORDER BY started_at DESC LIMIT 1
    """, (uid,)).fetchone()

def _daily_session_from_log(db, log):
    if not log:
        return None
    if "daily_session_id" in log.keys() and log["daily_session_id"]:
        return db.execute("SELECT * FROM daily_sessions WHERE id=?", (log["daily_session_id"],)).fetchone()
    return None

def _finalize_session_log(db, uid, log_id, status="completed"):
    log = db.execute("SELECT * FROM session_logs WHERE id=? AND user_id=?", (log_id, uid)).fetchone()
    if not log or log["status"] != "active":
        return None
    now = datetime.now()
    started_at = datetime.fromisoformat((log["started_at"] or now.isoformat()).replace("Z",""))
    pose_rows = db.execute("SELECT * FROM session_pose_logs WHERE session_log_id=? ORDER BY ended_at", (log_id,)).fetchall()
    duration_seconds = sum(int((r["practice_seconds"] if "practice_seconds" in r.keys() else 0) or 0) for r in pose_rows)
    if duration_seconds <= 0:
        duration_seconds = max(1, int((now - started_at).total_seconds()))
    total_asanas = sum((r["repetitions"] or 0) for r in pose_rows) or len(pose_rows)
    unique_asanas = len({r["pose_name"] for r in pose_rows})
    total_hold = sum((r["hold_duration"] or 0) for r in pose_rows)
    avg_acc = round(sum((r["accuracy"] or 0) for r in pose_rows) / len(pose_rows), 1) if pose_rows else 0
    xp_earned = sum((r["xp_earned"] or 0) for r in pose_rows)
    most = None
    if pose_rows:
        counts = {}
        for r in pose_rows:
            counts[r["pose_name"]] = counts.get(r["pose_name"], 0) + ((r["repetitions"] or 0) or 1)
        most = max(counts, key=counts.get)
    db.execute("""
        UPDATE session_logs
        SET status=?, ended_at=?, duration_seconds=?, total_asanas=?, unique_asanas=?,
            most_practiced_pose=?, total_hold_time=?, average_accuracy=?, xp_earned=?
        WHERE id=? AND user_id=?
    """, (status, now.isoformat(timespec="seconds"), duration_seconds, total_asanas, unique_asanas,
          most, total_hold, avg_acc, xp_earned, log_id, uid))
    daily_id = log["daily_session_id"] if "daily_session_id" in log.keys() else None
    if daily_id:
        daily = db.execute("SELECT * FROM daily_sessions WHERE id=? AND user_id=?", (daily_id, uid)).fetchone()
        final_status = "completed" if status == "completed" else "missed"
        db.execute("UPDATE daily_sessions SET status=?, completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END WHERE id=? AND user_id=?",
                   (final_status, final_status, now.isoformat(timespec="seconds"), daily_id, uid))
    summary = {
        "session_duration_seconds": duration_seconds,
        "asanas_practiced": total_asanas,
        "unique_asanas": unique_asanas,
        "most_practiced_pose": most,
        "total_hold_time": total_hold,
        "average_accuracy": avg_acc,
        "xp_earned": xp_earned,
    }
    db.execute("INSERT INTO session_summary (user_id, session_log_id, summary_json) VALUES (?,?,?)",
               (uid, log_id, json.dumps(summary)))
    db.execute("UPDATE session_timer SET status=?, remaining_seconds=0, updated_at=NOW() WHERE session_log_id=?", (status, log_id))
    return summary

def refresh_today_session_statuses(db, uid):
    rows = [dict(r) for r in _ensure_daily_sessions_for_today(db, uid)]
    now = datetime.now()
    today_end = datetime.combine(date.today(), datetime.max.time()).replace(microsecond=0)

    db.execute("""
        UPDATE daily_sessions SET status='missed'
        WHERE user_id=? AND session_date < ? AND status IN ('pending','active','upcoming')
    """, (uid, date.today().isoformat()))
    
    active_log = _active_session_log(db, uid)
    if active_log:
        daily = _daily_session_from_log(db, active_log)
        if daily:
            st, en = slot_window(daily["slot_name"], daily["scheduled_time"], dict(daily).get("duration_minutes", 30))
            if now >= en:
                accumulated = int(daily["accumulated_practice_seconds"] or 0)
                target = int(dict(daily).get("duration_minutes") or 30) * 60
                _finalize_session_log(db, uid, active_log["id"], "completed" if accumulated >= target else "missed")
                db.commit()
                rows = [dict(r) for r in db.execute("SELECT * FROM daily_sessions WHERE user_id=? AND session_date=? ORDER BY scheduled_time", (uid, date.today().isoformat())).fetchall()]

    result = []
    for r in rows:
        duration = int(r.get("duration_minutes") or 30)
        start, end = slot_window(r.get("slot_name"), r.get("scheduled_time"), duration)
        stored = r.get("status") or "pending"
        computed = stored
        if stored == "completed":
            computed = "completed"
        elif stored == "missed":
            computed = "missed"
        elif stored == "active":
            computed = "active" if now < end else "missed"
        elif stored == "expired":
            computed = "expired"
        elif now < start:
            computed = "upcoming"
        elif start <= now <= end:
            computed = "active"
        elif now <= today_end:
            computed = "missed"
            if stored == "pending":
                db.execute("UPDATE daily_sessions SET status='missed' WHERE id=?", (r["id"],))
                r["status"] = "missed"
        else:
            computed = "expired"

        accumulated = int(r.get("accumulated_practice_seconds") or 0)
        target_seconds = max(60, duration * 60)
        seconds_remaining = max(0, target_seconds - accumulated) if computed == "active" else 0
        unlock_seconds = max(0, int((start - now).total_seconds())) if computed == "upcoming" else 0
        progress = min(100, int((accumulated / target_seconds) * 100)) if target_seconds else 0
        if computed in ("upcoming",):
            progress = 0
        elif computed == "completed":
            progress = 100
        elif computed == "missed":
            progress = min(progress, 99)

        r.update({
            "computed_status": computed,
            "status_label": session_status_label(computed),
            "window_start": _fmt_time(start),
            "window_end": _fmt_time(end),
            "time_range": _fmt_range(start, end),
            "duration_minutes": duration,
            "seconds_remaining": seconds_remaining,
            "unlock_seconds": unlock_seconds,
            "unlock_message": f"Session unlocks at {_fmt_time(start)}.",
            "can_start": computed == "active",
            "progress": progress,
            "target_seconds": target_seconds,
            "accumulated_practice_seconds": accumulated,
            "min_duration_minutes": int(r.get("min_duration_minutes") or max(1, duration//2)),
        })
        result.append(r)
    db.commit()
    completed = sum(1 for r in result if r.get("computed_status") == "completed")
    active = next((r for r in result if r.get("computed_status") == "active"), None)
    upcoming = next((r for r in result if r.get("computed_status") == "upcoming"), None)
    missed = [r for r in result if r.get("computed_status") == "missed"]
    return {
        "rows": result, "completed": completed, "target": len(result),
        "pct": int((completed / len(result))*100) if result else 0,
        "current": active, "active": active, "upcoming": upcoming, "missed": missed,
        "next_unlock_seconds": upcoming.get("unlock_seconds", 0) if upcoming else 0,
        "mode": get_practice_mode(get_questionnaire(db, uid)),
    }

def get_today_session_summary(db, uid):
    return refresh_today_session_statuses(db, uid)

def can_start_practice_now(db, uid):
    ans = get_questionnaire(db, uid)
    if get_practice_mode(ans) == "free":
        return True, None, {"rows": [], "completed": 0, "target": 0, "pct": 0, "mode": "free", "active": None, "current": None, "upcoming": None, "missed": []}
    summary = refresh_today_session_statuses(db, uid)
    if not summary["rows"]:
        return True, None, summary
    if any(r.get("can_start") for r in summary["rows"]):
        return True, None, summary
    upcoming = summary.get("upcoming")
    if upcoming:
        return False, upcoming.get("unlock_message") or "Your next session is locked.", summary
    return False, "No active or missed session is available today.", summary

def get_or_start_time_block_session(db, uid):
    if get_practice_mode(get_questionnaire(db, uid)) == "free":
        return None
    active_log = _active_session_log(db, uid)
    if active_log:
        return dict(active_log)
    summary = refresh_today_session_statuses(db, uid)
    candidate = next((r for r in summary["rows"] if r.get("computed_status") == "active"), None)
    if not candidate:
        return None
    now = datetime.now().isoformat(timespec="seconds")
    daily_id = candidate["id"]
    db.execute("UPDATE daily_sessions SET status='active', started_at=COALESCE(started_at, ?) WHERE id=?", (now, daily_id))
    db.execute("""
        INSERT INTO session_logs
        (user_id, daily_session_id, session_date, slot_name, scheduled_start, scheduled_end, started_at, status)
        VALUES (?,?,?,?,?,?,?, 'active')
    """, (uid, daily_id, date.today().isoformat(), candidate["slot_name"],
          candidate["window_start"], candidate["window_end"], now))
    log_id = db.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    db.execute("INSERT INTO session_timer (user_id, daily_session_id, session_log_id, starts_at, ends_at, remaining_seconds, status) VALUES (?,?,?,?,?,?, 'active')",
               (uid, daily_id, log_id, now, candidate["window_end"], candidate.get("seconds_remaining", 0)))
    db.commit()
    return dict(db.execute("SELECT * FROM session_logs WHERE id=?", (log_id,)).fetchone())

def log_pose_inside_time_block(db, uid, pose_name, reps, hold_duration, accuracy, xp_earned, practice_seconds=0):
    log = get_or_start_time_block_session(db, uid)
    if not log:
        return None
    now = datetime.now().isoformat(timespec="seconds")
    db.execute("""
        INSERT INTO session_pose_logs
        (session_log_id, user_id, pose_name, repetitions, hold_duration, accuracy, xp_earned, practice_seconds, started_at, ended_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (log["id"], uid, pose_name, int(reps or 0), int(hold_duration or 0), float(accuracy or 0), int(xp_earned or 0), int(practice_seconds or hold_duration or 0), now, now))
    daily_id = log["daily_session_id"] if "daily_session_id" in log.keys() else None
    if daily_id:
        inc = int(practice_seconds or hold_duration or 0)
        db.execute("UPDATE daily_sessions SET accumulated_practice_seconds=COALESCE(accumulated_practice_seconds,0)+? WHERE id=? AND user_id=?", (inc, daily_id, uid))
        daily = db.execute("SELECT * FROM daily_sessions WHERE id=? AND user_id=?", (daily_id, uid)).fetchone()
        if daily and int(daily["accumulated_practice_seconds"] or 0) >= int(daily["duration_minutes"] or 30) * 60:
            _finalize_session_log(db, uid, log["id"], "completed")
    return log

def mark_one_daily_session_completed(db, uid):
    active_log = _active_session_log(db, uid)
    if active_log:
        return _finalize_session_log(db, uid, active_log["id"], "completed")
    return None

def row_to_safe_dict(row):
    return dict(row) if row else {}

def selected_json(row, key):
    return json_loads(row[key] if row and key in row.keys() else "[]")

def compute_level(xp):
    return max(1, int(xp / 500) + 1)

def xp_to_next_level(xp):
    return max(0, compute_level(xp) * 500 - xp)

def compute_xp(accuracy, duration_seconds, levels_completed, streak,
               successful_reps=0, hold_duration=0, improvement_pct=0, is_hold_pose=False):
    base = 50
    acc_mult = 1.0 + accuracy / 200
    level_mult = 1.0 + (levels_completed - 1) * 0.30
    consistency_mult = 1.0 + min(successful_reps, 10) * 0.03
    streak_mult = 1.0 + min(streak, 7) * 0.05

    rep_bonus = successful_reps * 10
    hold_bonus = min(30, int(hold_duration * 0.20))
    improve_bonus = int(improvement_pct * 30) if improvement_pct > 0 else 0

    xp = max(10, int(base * acc_mult * level_mult * consistency_mult * streak_mult)
             + rep_bonus + hold_bonus + improve_bonus)
    return xp, improve_bonus

def level_xp_pct(xp):
    level   = compute_level(xp)
    xp_in   = xp - (level - 1) * 500
    return min(100, round((xp_in / 500) * 100))

MASTERY_LEVELS = ["Novice", "Apprentice", "Practitioner", "Master", "Legend"]

def compute_mastery_level(total_sessions, avg_accuracy, total_reps, total_hold_seconds=0, is_hold_pose=False):
    score = (total_sessions * 2
             + int(avg_accuracy / 10)
             + int(total_reps / 4)
             + int(total_hold_seconds / 45))
    if score >= 120:
        return "Legend"
    elif score >= 70:
        return "Master"
    elif score >= 35:
        return "Practitioner"
    elif score >= 12:
        return "Apprentice"
    return "Novice"

TREE_RESTORATION_STAGES = [
    (0, ""),
    (5, "Sapling"),
    (10,"Young Tree"),
    (20, "Flowering Tree"),
    (30, "Sacred Tree"),
]
WARRIOR_RESTORATION_STAGES = [
    (0, ""),
    (5, "Small Village"),
    (15, "Growing Village"),
    (25, "Prosperous Town"),
    (40, "Capital City"),
]
PADMASANA_RESTORATION_STAGES = [
    (0,""),
    (5, "Small Lotus Pond"),
    (10, "Blooming Lake"),
    (20, "Sacred Lotus Garden"),
    (30, "Lotus Lake Fully Restored"),
]
VAJRASANA_RESTORATION_STAGES = [
    (0, ""),
    (5,"Clouds Return"),
    (10, "First Rainfall"),
    (20, "Rivers Refilled"),
    (30, "Sacred Monsoon Restored"),
]
BADDHA_KONASANA_RESTORATION_STAGES = [
    (0,""),
    (5, "Flower Patch"),
    (10, "Blooming Garden"),
    (20, "Butterfly Sanctuary"),
    (30, "Enchanted Garden Restored"),
]

TADASANA_RESTORATION_STAGES = [
    (0, ""),
    (5, "Mist Cleared"),
    (10, "Cloud Bridges Restored"),
    (20, "Sky Gate Activated"),
    (30, "Cloud Peak Fully Awakened"),
]

TRIKONASANA_RESTORATION_STAGES = [
    (0, ""),
    (5, "Crystal Path Discovered"),
    (10, "Prism Towers Restored"),
    (20, "Rainbow Beams Reignited"),
    (30, "Prism Valley Restored"),
]

BHUJANGASANA_RESTORATION_STAGES = [
    (0, ""), (5, "Forgotten Ruins"), (10, "Jungle Awakens"), (20, "Sacred Life Returns"), (30, "The Serpent Awakens"),
]
WALL_PLANK_CHATURANGA_RESTORATION_STAGES = [
    (0, ""), (5, "Broken Gates"), (10, "Bamboo Groves Return"), (20, "Cherry Blossom Dojo"), (30, "Festival of the Warriors"),
]
PADAHASTASANA_RESTORATION_STAGES = [
    (0, ""), (5, "Dry Trees"), (10, "Autumn Stream"), (20, "Forest Wildlife Returns"), (30, "Autumn Blessing"),
]

PASCHIMOTTANASANA_RESTORATION_STAGES = [
    (0, ""), (5, "Silent Stage"), (10, "Music Returns"), (20, "Marionette Festival"), (30, "The Final Performance"),
]
PASCHIM_NAMASKARASANA_RESTORATION_STAGES = [
    (0, ""), (5, "Dry Gardens"), (10, "Roses Bloom"), (20, "Peacock Garden Awakens"), (30, "Festival of Feathers"),
]
PRANAYAMA_RESTORATION_STAGES = [
    (0, ""), (5, "Dormant Self"), (10, "Energy Flow"), (20, "Inner Harmony"), (30, "Harmony State"),
]
BALASANA_RESTORATION_STAGES = [
    (0, ""),
    (5, "Village Reconnected"),
    (10, "Trading Route Restored"),
    (20, "Settlements United"),
    (30, "Kingdom Alliance Restored"),
]
RESTORATION_STAGES_MAP = {
    "tree": TREE_RESTORATION_STAGES,
    "warrior": WARRIOR_RESTORATION_STAGES,
    "padmasana": PADMASANA_RESTORATION_STAGES,
    "vajrasana": VAJRASANA_RESTORATION_STAGES,
    "baddha_konasana": BADDHA_KONASANA_RESTORATION_STAGES,
    "tadasana": TADASANA_RESTORATION_STAGES,
    "trikonasana": TRIKONASANA_RESTORATION_STAGES,
    "balasana": BALASANA_RESTORATION_STAGES,
    "bhujangasana": BHUJANGASANA_RESTORATION_STAGES,
    "wall_plank_chaturanga": WALL_PLANK_CHATURANGA_RESTORATION_STAGES,
    "padahastasana": PADAHASTASANA_RESTORATION_STAGES,
    "paschimottanasana": PASCHIMOTTANASANA_RESTORATION_STAGES,
    "paschim_namaskarasana": PASCHIM_NAMASKARASANA_RESTORATION_STAGES,
    "pranayama": PRANAYAMA_RESTORATION_STAGES,
}

def get_restoration_stage(pose_name, total_sessions):
    stages  = RESTORATION_STAGES_MAP.get(pose_name, [])
    current = ""
    for threshold, label in stages:
        if total_sessions >= threshold:
            current = label
    return current

def get_or_create_mastery(db, user_id, pose_name):
    row = db.execute(
        "SELECT * FROM pose_mastery WHERE user_id=? AND pose_name=?", (user_id, pose_name)
    ).fetchone()
    if not row:
        db.execute(
            "INSERT INTO pose_mastery (user_id, pose_name) VALUES (?,?)", (user_id, pose_name)
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM pose_mastery WHERE user_id=? AND pose_name=?", (user_id, pose_name)
        ).fetchone()
    return dict(row)

def update_pose_mastery(db, user_id, pose_name, accuracy, successful_reps, hold_duration=0):
    is_hold = pose_name in HOLD_POSES
    m = get_or_create_mastery(db, user_id, pose_name)
    new_sessions = m["total_sessions"] + 1
    new_reps = m["total_reps"] + successful_reps
    new_hold_seconds = m.get("total_hold_seconds", 0) + (hold_duration if is_hold else 0)
    best_acc = max(m["best_accuracy"], accuracy)
    avg_acc = round(
        (m["avg_accuracy"] * m["total_sessions"] + accuracy) / new_sessions, 1
    )
    mastery = compute_mastery_level(new_sessions, avg_acc, new_reps, new_hold_seconds, is_hold)
    stage = get_restoration_stage(pose_name, new_sessions)

    db.execute("""
        UPDATE pose_mastery
        SET total_sessions=?, total_reps=?, total_hold_seconds=?,
            best_accuracy=?, avg_accuracy=?,
            mastery_level=?, restoration_stage=?, updated_at=NOW()
        WHERE user_id=? AND pose_name=?
    """, (new_sessions, new_reps, new_hold_seconds, best_acc, avg_acc,
          mastery, stage, user_id, pose_name))

    return {
        "total_sessions": new_sessions,
        "total_reps": new_reps,
        "total_hold_seconds":new_hold_seconds,
        "best_accuracy": best_acc,
        "avg_accuracy": avg_acc,
        "mastery_level": mastery,
        "restoration_stage": stage,
        "prev_mastery": m["mastery_level"],
        "prev_stage": m["restoration_stage"],
    }

def compute_improvement(db, user_id, pose_name, current_accuracy):
    prev = db.execute("""
        SELECT accuracy FROM pose_sessions
        WHERE user_id=? AND pose_name=?
        ORDER BY completed_at DESC LIMIT 3
    """, (user_id, pose_name)).fetchall()
    if not prev:
        return 0.0
    prev_avg = sum(r["accuracy"] for r in prev) / len(prev)
    if prev_avg <= 0:
        return 0.0
    improvement = (current_accuracy - prev_avg) / max(prev_avg, 1)
    return max(0.0, improvement)

def check_achievements(db, user_id, pose_name, accuracy, levels_completed,
                       successful_reps, hold_duration, mastery_info, streak):
    new_badges = []

    def award(name, desc, icon):
        try:
            db.execute(
                "INSERT INTO achievements (user_id, badge_name, badge_description, badge_icon) VALUES (?,?,?,?)",
                (user_id, name, desc, icon)
            )
            new_badges.append({"name": name, "description": desc, "icon": icon})
        except psycopg2.IntegrityError:
            pass

    is_hold = pose_name in HOLD_POSES

    if pose_name == "tree":
        award("Sapling Keeper", "Completed your first Tree Pose",        "leaf")
    elif pose_name == "warrior":
        award("Village Guardian", "Completed your first Warrior Pose",     "shield")
    elif pose_name == "padmasana":
        award("Lotus Seeker", "Completed your first Lotus Pose",       "flower")
    elif pose_name == "vajrasana":
        award("Thunder Caller", "Completed your first Thunderbolt Pose", "zap")
    elif pose_name == "baddha_konasana":
        award("Butterfly Awakener", "Completed your first Butterfly Pose",   "wind")
    elif pose_name == "tadasana":
        award("Cloud Walker", "Completed your first Mountain Pose and began calming the mist", "cloud")
    elif pose_name == "trikonasana":
        award("Prism Explorer", "Completed your first Triangle Pose and discovered the crystal path", "gem")
    elif pose_name == "bhujangasana":
        award("Temple Seeker", "Completed your first Bhujangasana and found the Lost Jungle Temple", "leaf")
    elif pose_name == "wall_plank_chaturanga":
        award("Dojo Initiate", "Completed your first Wall-Plank Chaturanga and repaired the dojo gates", "shield")
    elif pose_name == "padahastasana":
        award("Autumn Wanderer", "Completed your first Padahastasana and awakened the autumn valley", "leaf")
    elif pose_name == "balasana":
        award("Bridge Builder", "Completed your first Balasana (Child Pose) and began reconnecting the kingdom", "route")
    
    if levels_completed >= 4:
        award("Sacred Yogi", "Reached Level 4 in a pose", "star")

   
    if accuracy >= 90:
        award("Precision Master", "Achieved 90%+ accuracy", "target")
    if accuracy >= 80 and pose_name == "warrior":
        award("Steady Warrior", "Achieved 80%+ accuracy in Warrior Pose",     "shield")
    if accuracy >= 85 and pose_name == "padmasana":
        award("Lotus Grace", "Achieved 85%+ accuracy in Lotus Pose",        "flower")
    if accuracy >= 85 and pose_name == "vajrasana":
        award("Thunder Strength", "Achieved 85%+ accuracy in Thunderbolt Pose",  "zap")
    if accuracy >= 85 and pose_name == "baddha_konasana":
        award("Butterfly Flow", "Achieved 85%+ accuracy in Butterfly Pose",    "wind")
    if accuracy >= 85 and pose_name == "tadasana":
        award("Mist Breaker", "Achieved 85%+ accuracy in Mountain Pose and cleared the Cloud Peak mist", "cloud")
    if accuracy >= 85 and pose_name == "trikonasana":
        award("Rainbow Keeper", "Achieved 85%+ accuracy in Triangle Pose", "sparkles")
    if accuracy >= 85 and pose_name == "balasana":
        award("Pathfinder", "Achieved 85%+ accuracy in Balasana (Child Pose)", "bridge")
    if accuracy >= 85 and pose_name == "bhujangasana":
        award("Serpent Awakener", "Achieved 85%+ accuracy in Bhujangasana", "leaf")
    if accuracy >= 85 and pose_name == "wall_plank_chaturanga":
        award("Samurai Strength", "Achieved 85%+ accuracy in Wall-Plank Chaturanga", "shield")
    if accuracy >= 85 and pose_name == "padahastasana":
        award("Autumn Blessing", "Achieved 85%+ accuracy in Padahastasana", "leaf")
    
    if not is_hold and successful_reps >= 10:
        award("Rep Master", "Completed 10 successful reps in one session", "zap")

    if is_hold and hold_duration >= 60:
        award("Stillness Keeper", "Held a pose for 60 seconds total in one session", "clock")

    poses_done = {r["pose_name"] for r in db.execute(
        "SELECT DISTINCT pose_name FROM pose_sessions WHERE user_id=?", (user_id,)
    ).fetchall()}
    if {"tree", "warrior"}.issubset(poses_done):
        award("Dual Restorer", "Practiced both Tree Pose and Warrior Pose", "globe")
    if {"tree", "warrior", "padmasana", "vajrasana", "baddha_konasana"}.issubset(poses_done):
        award("Five Realms", "Practiced all five original restoration poses",                  "globe")
    if {"tree", "warrior", "padmasana", "vajrasana", "baddha_konasana", "tadasana", "trikonasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama"}.issubset(poses_done):
        award("YogGyaan Restorer", "Practiced every finalized Lotus Haven realm", "globe")

    user = db.execute("SELECT xp, streak FROM users WHERE id=?", (user_id,)).fetchone()
    if user and user["xp"] >= 1000:
        award("Lotus Champion", "Earned 1000 XP total", "award")
    if user and user["streak"] >= 3:
        award("Steady Flame",   "Maintained a 3-day streak",  "flame")
    if user and user["streak"] >= 7:
        award("Iron Will", "7-day practice streak", "flame")

    
    sessions = mastery_info["total_sessions"]
    if pose_name == "tree":
        if sessions >= 10:  award("Tree Master", "10 Tree Pose sessions completed",  "leaf")
        if sessions >= 20:  award("Flowering Tree", "20 Tree Pose sessions",             "leaf")
        if sessions >= 30:  award("Sacred Tree Guardian", "30 Tree Pose sessions",             "leaf")
    elif pose_name == "warrior":
        if sessions >= 10:  award("Warrior Elite", "10 Warrior Pose sessions",          "shield")
        if sessions >= 25:  award("Town Protector", "25 Warrior Pose sessions",          "shield")
        if sessions >= 40:  award("Capital Defender", "40 Warrior Pose sessions",          "shield")
    elif pose_name == "padmasana":
        if sessions >= 10:  award("Lotus Devotee", "10 Lotus Pose sessions",            "flower")
        if sessions >= 20:  award("Lotus Sage", "20 Lotus Pose sessions",            "flower")
        if sessions >= 30:  award("Sacred Lotus Keeper", "30 Lotus Pose sessions",            "flower")
    elif pose_name == "vajrasana":
        if sessions >= 10:  award("Rain Summoner", "10 Thunderbolt Pose sessions",      "zap")
        if sessions >= 20:  award("Monsoon Master", "20 Thunderbolt Pose sessions",      "zap")
        if sessions >= 30:  award("Sacred Rain Keeper", "30 Thunderbolt Pose sessions",      "zap")
    elif pose_name == "baddha_konasana":
        if sessions >= 10:  award("Garden Tender", "10 Butterfly Pose sessions",        "wind")
        if sessions >= 20:  award("Butterfly Guardian", "20 Butterfly Pose sessions",        "wind")
        if sessions >= 30:  award("Enchanted Keeper", "30 Butterfly Pose sessions",        "wind")
    elif pose_name == "tadasana":
        if sessions >= 5:   award("Mist Breaker", "5 Mountain Pose sessions — mist cleared", "cloud")
        if sessions >= 10:  award("Sky Pathfinder", "10 Mountain Pose sessions — cloud bridges restored", "cloud")
        if sessions >= 20:  award("Guardian of the Peak", "20 Mountain Pose sessions — Sky Gate activated", "cloud")
        if sessions >= 30:  award("Cloud Peak Legend", "30 Mountain Pose sessions — Cloud Peak fully awakened", "cloud")
    
    new_ml  = mastery_info["mastery_level"]
    prev_ml = mastery_info["prev_mastery"]
    if new_ml != prev_ml:
        icons = {"Apprentice": "award", "Practitioner": "star", "Master": "crown", "Legend": "trophy"}
        if new_ml in icons:
            pose_display = {
                "tree": "Tree", "warrior": "Warrior",
                "padmasana": "Lotus", "vajrasana": "Thunder",
                "baddha_konasana": "Butterfly",
                "tadasana": "Mountain",
                "trikonasana": "Triangle",
                "balasana": "Balasana",
                "bhujangasana": "Bhujangasana",
                "wall_plank_chaturanga": "Wall-Plank Chaturanga",
                "padahastasana": "Padahastasana",
                "paschimottanasana": "Paschimottanasana",
                "paschim_namaskarasana": "Paschim Namaskarasana",
                "pranayama": "Pranayama",
            }.get(pose_name, pose_name.title())
            award(f"{pose_display} {new_ml}",
                  f"Reached {new_ml} mastery in {pose_display} Pose", icons[new_ml])

    new_stage  = mastery_info["restoration_stage"]
    prev_stage = mastery_info["prev_stage"]
    if new_stage and new_stage != prev_stage:
        award(new_stage, f"Restored: {new_stage}", "globe")

    return new_badges

WORLD_REGIONS = [
    {"pose":"tree", "region":"Sacred Forest", "biome":"Ancient forest", "theme":"Rooted woodland sanctuary", "icon":"🌳", "color":"#4ade80", "x":12, "y":28, "col":"forest_restoration", "desc":"A corrupted forest heals as Tree Pose restores balance, roots, nests, and glowing canopies."},
    {"pose":"warrior", "region":"Guardian Village", "biome":"Fortified valley", "theme":"Courage and protection", "icon":"🛡️", "color":"#f59e0b", "x":27, "y":18, "col":"village_restoration", "desc":"Broken gates, watchtowers, and homes rebuild as Warrior practice strengthens the settlement."},
    {"pose":"padmasana", "region":"Lotus Lake", "biome":"Moonlit wetlands", "theme":"Calm and meditation", "icon":"🪷", "color":"#f472b6", "x":43, "y":30, "col":"lotus_restoration", "desc":"Still waters bloom with lotuses, fireflies, and temple lights through Lotus Pose mastery."},
    {"pose":"vajrasana", "region":"Rain Temple", "biome":"Storm shrine", "theme":"Thunder and renewal", "icon":"⛈️", "color":"#60a5fa", "x":61, "y":20, "col":"temple_restoration", "desc":"Dry stone temples awaken with rain, bells, streams, and monsoon clouds through Vajrasana."},
    {"pose":"baddha_konasana", "region":"Butterfly Garden", "biome":"Wildflower meadow", "theme":"Gentle opening", "icon":"🦋", "color":"#a78bfa", "x":78, "y":32, "col":"butterfly_restoration", "desc":"A silent garden fills with petals, butterflies, and floating pollen through Butterfly Pose."},
    {"pose":"tadasana", "region":"Cloud Peak", "biome":"High mountain", "theme":"Stillness and elevation", "icon":"🏔️", "color":"#93c5fd", "x":20, "y":62, "col":"cloud_peak_restoration", "desc":"Mist clears, sky paths return, and mountain bells ring through Mountain Pose."},
    {"pose":"trikonasana", "region":"Prism Valley", "biome":"Crystal valley", "theme":"Angles, light, and clarity", "icon":"🔺", "color":"#38bdf8", "x":42, "y":68, "col":"prism_valley_restoration", "desc":"Dormant crystals rise into aurora towers as Triangle Pose restores geometric harmony."},
    {"pose":"balasana", "region":"United Kingdoms", "biome":"Bridge kingdom", "theme":"Connection and support", "icon":"🌉", "color":"#fb7185", "x":64, "y":72, "col":"kingdoms_restoration", "desc":"Separated kingdoms rebuild bridges, roads, markets, ships, and flags through Balasana (Child Pose)."},
    {"pose":"bhujangasana", "region":"Lost Jungle Temple", "biome":"Dense jungle ruins", "theme":"Serpent awakening", "icon":"🐍", "color":"#22c55e", "x":84, "y":56, "col":"jungle_temple_restoration", "desc":"Broken jungle ruins awaken with vines, waterfalls, wildlife, and a glowing serpent temple through Bhujangasana."},
    {"pose":"wall_plank_chaturanga", "region":"Sacred Samurai Dojo", "biome":"Japanese mountain dojo", "theme":"Strength and discipline", "icon":"🏯", "color":"#f97316", "x":34, "y":88, "col":"samurai_dojo_restoration", "desc":"Broken gates, bamboo groves, koi ponds, sakura petals, and lantern festivals return through Wall-Plank Chaturanga."},
    {"pose":"padahastasana", "region":"Sacred Autumn Valley", "biome":"Golden maple valley", "theme":"Forward fold and release", "icon":"🍁", "color":"#f59e0b", "x":72, "y":88, "col":"autumn_valley_restoration", "desc":"Dry autumn woods turn golden with flowing streams, wildlife, waterfalls, and sunset light through Padahastasana."},
    {"pose":"paschimottanasana", "region":"Forgotten Puppet Kingdom", "biome":"Clockwork theater kingdom", "theme":"Forward fold, release and rhythm", "icon":"🎭", "color":"#c084fc", "x":18, "y":88, "col":"puppet_kingdom_restoration", "desc":"A silent clockwork theater returns with gears, marionettes, floating notes, chandeliers, and final fireworks through Paschimottanasana."},
    {"pose":"paschim_namaskarasana", "region":"Royal Peacock Garden", "biome":"Palace garden", "theme":"Shoulder opening and grace", "icon":"🦚", "color":"#14b8a6", "x":52, "y":90, "col":"peacock_garden_restoration", "desc":"Dry palace gardens bloom with roses, fountains, lotus ponds, peacocks, marble bridges, and rainbow reflections through Paschim Namaskarasana."},
    {"pose":"pranayama", "region":"Inner Prana Nexus", "biome":"Cosmic breath realm", "theme":"Breath, energy and inner harmony", "icon":"🌌", "color":"#818cf8", "x":91, "y":86, "col":"prana_nexus_restoration", "desc":"A meditating cosmic silhouette awakens focus circles, energy pathways, nebula aura, and harmony waves through Pranayama."},
]

POSE_DISPLAY_NAMES = {
    "tree":"Tree Pose", "warrior":"Warrior Pose", "padmasana":"Padmasana / Lotus Pose",
    "vajrasana":"Vajrasana / Thunderbolt Pose", "baddha_konasana":"Baddha Konasana / Butterfly Pose",
    "tadasana":"Tadasana / Mountain Pose", "trikonasana":"Trikonasana / Triangle Pose",
    "balasana":"Balasana / Child Pose", "bhujangasana":"Bhujangasana / Cobra Pose",
    "wall_plank_chaturanga":"Wall-Plank Chaturanga", "padahastasana":"Padahastasana / Hand-to-Foot Pose",
    "paschimottanasana":"Paschimottanasana / Seated Forward Bend",
    "paschim_namaskarasana":"Paschim Namaskarasana / Reverse Prayer Pose",
    "pranayama":"Pranayama / Breath Practice",
}

def world_stage_from_pct(pct):
    pct = int(pct or 0)
    if pct >= 85:
        return {"num":4, "name":"Fully Restored", "mood":"Vibrant, alive, magical"}
    if pct >= 55:
        return {"num":3, "name":"Flourishing", "mood":"Healing strongly"}
    if pct >= 25:
        return {"num":2, "name":"Awakening", "mood":"Signs of life returning"}
    if pct > 0:
        return {"num":1, "name":"First Spark", "mood":"Corruption weakening"}
    return {"num":0, "name":"Corrupted", "mood":"Dark and dormant"}

def build_world_map_context(db, uid):
    wp = db.execute("SELECT * FROM world_progress WHERE user_id=?", (uid,)).fetchone()
    wpd = dict(wp) if wp else {}
    badges = [dict(b) for b in db.execute("SELECT * FROM achievements WHERE user_id=? ORDER BY earned_at DESC", (uid,)).fetchall()]
    regions=[]
    restored=0
    total_pct=0
    previous_unlocked=True
    for idx, base in enumerate(WORLD_REGIONS):
        pct = int(wpd.get(base["col"], 0) or 0)
        total_pct += pct
        if pct >= 85: restored += 1
        m = get_or_create_mastery(db, uid, base["pose"])
        hist = [dict(r) for r in db.execute("SELECT accuracy, completed_at FROM pose_sessions WHERE user_id=? AND pose_name=? ORDER BY completed_at DESC LIMIT 8", (uid, base["pose"])).fetchall()]
        region_badges = [b for b in badges if base["pose"].replace('_',' ') in (b.get('badge_description') or '').lower() or base["region"].lower() in (b.get('badge_name') or '').lower()]
        unlocked = previous_unlocked or pct > 0
        previous_unlocked = pct >= 20 or idx == 0
        r = dict(base)
        r.update({
            "pose_name": POSE_DISPLAY_NAMES.get(base["pose"], base["pose"].replace('_',' ').title()),
            "pct": pct,
            "stage": world_stage_from_pct(pct),
            "mastery_level": m.get("mastery_level", "Novice"),
            "avg_accuracy": round(m.get("avg_accuracy", 0) or 0, 1),
            "best_accuracy": round(m.get("best_accuracy", 0) or 0, 1),
            "total_sessions": m.get("total_sessions", 0) or 0,
            "total_reps": m.get("total_reps", 0) or 0,
            "total_hold_seconds": m.get("total_hold_seconds", 0) or 0,
            "locked": not unlocked,
            "accuracy_history": list(reversed(hist)),
            "badges": region_badges[:4],
        })
        regions.append(r)
    overall = round(total_pct / max(1, len(WORLD_REGIONS)))
    next_region = next((r for r in regions if not r["locked"] and r["pct"] < 85), None)
    return {"regions": regions, "overall": overall, "restored_count": restored, "total_regions": len(regions), "next_region": next_region}

POSE_TO_REGION = {
    "tree": "forest_restoration",
    "warrior": "village_restoration",
    "padmasana": "lotus_restoration",
    "vajrasana": "temple_restoration",
    "baddha_konasana": "butterfly_restoration",
    "tadasana": "cloud_peak_restoration",
    "trikonasana": "prism_valley_restoration",
    "balasana": "kingdoms_restoration",
    "bhujangasana": "jungle_temple_restoration",
    "wall_plank_chaturanga": "samurai_dojo_restoration",
    "padahastasana": "autumn_valley_restoration",
    "paschimottanasana": "puppet_kingdom_restoration",
    "paschim_namaskarasana": "peacock_garden_restoration",
    "pranayama": "prana_nexus_restoration",
}

def update_world_progress(db, user_id, pose_name, accuracy, levels_completed,
                           successful_reps, hold_duration=0):
    col = POSE_TO_REGION.get(pose_name)
    if not col:
        return
    row = db.execute("SELECT * FROM world_progress WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        db.execute("INSERT INTO world_progress (user_id) VALUES (?)", (user_id,))
        row = db.execute("SELECT * FROM world_progress WHERE user_id=?", (user_id,)).fetchone()

    is_hold = pose_name in HOLD_POSES
    if is_hold:
        contrib = max(1, int((accuracy / 100) * levels_completed * 3)) + int(hold_duration * 0.1)
    else:
        rep_contrib = successful_reps * 0.5
        acc_contrib = max(1, int((accuracy / 100) * levels_completed * 3))
        contrib = acc_contrib + rep_contrib

    current_val = row[col] if row[col] is not None else 0
    new_val     = min(100, current_val + contrib)
    db.execute(
        f"UPDATE world_progress SET {col}=?, updated_at=NOW() WHERE user_id=?",
        (new_val, user_id)
    )

def _effective_streak(streak, last_date_str):
    if not streak or not last_date_str:
        return 0
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    if last_date_str in (today, yesterday):
        return streak
    return 0

def update_streak(db, user_id):
    user = db.execute("SELECT streak, last_active FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        return 0
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    streak = user["streak"] or 0
    last = user["last_active"]
    if last == today:
        return streak
    streak = streak + 1 if last == yesterday else 1
    db.execute("UPDATE users SET streak=?, last_active=? WHERE id=?", (streak, today, user_id))
    return streak

REP_CHALLENGE_TARGET_REPS = 5

def _daily_challenge_target_met(challenge, pose_name, accuracy, hold_duration, successful_reps):
    if not challenge or pose_name != challenge["pose_name"]:
        return False
    if accuracy < (challenge["target_accuracy"] or 0):
        return False
    if pose_name in HOLD_POSES:
        return hold_duration >= (challenge["target_duration"] or 0)
    return successful_reps >= REP_CHALLENGE_TARGET_REPS

def update_daily_challenge_streak(db, user_id, pose_name, accuracy, hold_duration, successful_reps):
    challenge = get_or_create_daily_challenge(db)
    user = db.execute(
        "SELECT daily_challenge_streak, daily_challenge_last_date FROM users WHERE id=?", (user_id,)
    ).fetchone()
    if not user:
        return False, 0
    current = user["daily_challenge_streak"] or 0
    if not _daily_challenge_target_met(challenge, pose_name, accuracy, hold_duration, successful_reps):
        return False, current

    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    last = user["daily_challenge_last_date"]
    if last == today:
        return True, current
    streak = current + 1 if last == yesterday else 1
    db.execute(
        "UPDATE users SET daily_challenge_streak=?, daily_challenge_last_date=? WHERE id=?",
        (streak, today, user_id)
    )
    return True, streak

def get_or_create_daily_challenge(db):
    today = date.today().isoformat()
    row = db.execute("SELECT * FROM daily_challenges WHERE challenge_date=?", (today,)).fetchone()
    if row:
        return dict(row)
    poses = ["tree", "warrior", "padmasana", "vajrasana", "baddha_konasana", "tadasana", "trikonasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama"]
    pose  = poses[date.today().toordinal() % len(poses)]
    descriptions = {
        "tree": "Complete 5 reps of Tree Pose with 75%+ accuracy",
        "warrior": "Complete 5 reps of Warrior Pose with steady form",
        "padmasana": "Hold Lotus Pose for 20s with calm stillness",
        "vajrasana": "Hold Thunderbolt Pose for 20s with upright spine",
        "baddha_konasana": "Hold Butterfly Pose for 20s with open hips",
        "tadasana": "Complete 5 Mountain Pose reps to restore Cloud Peak pathways",
        "trikonasana": "Complete 5 Triangle Pose reps to restore Prism Valley",
        "balasana": "Complete 5 Balasana (Child Pose) reps to unite the kingdom",
        "bhujangasana": "Hold Bhujangasana to awaken the Lost Jungle Temple",
        "wall_plank_chaturanga": "Hold Wall-Plank Chaturanga with steady strength",
        "padahastasana": "Hold Padahastasana to restore the Autumn Valley",
        "paschimottanasana": "Hold Paschimottanasana to restart the Puppet Kingdom theater",
        "paschim_namaskarasana": "Hold Paschim Namaskarasana to revive the Peacock Garden",
        "pranayama": "Complete a Pranayama breathing session to activate the Prana Nexus",
    }
    db.execute(
        "INSERT INTO daily_challenges (pose_name, description, target_accuracy, target_duration, xp_reward, challenge_date) VALUES (?,?,?,?,?,?)",
        (pose, descriptions[pose], 70, 15, 150, today)
    )
    db.commit()
    return dict(db.execute("SELECT * FROM daily_challenges WHERE challenge_date=?", (today,)).fetchone())


def get_daily_challenges_board():
    poses = [
        ("tadasana", "Mountain Pose", "Complete steady alignment reps with calm breathing."),
        ("tree", "Tree Pose", "Balance without wobbling and hold the final posture."),
        ("warrior", "Warrior Pose", "Build strength with clean front-knee alignment."),
        ("baddha_konasana", "Butterfly Pose", "Open hips gently and hold with a tall spine."),
        ("padmasana", "Lotus Pose", "Sit steady, relax shoulders, and breathe slowly."),
        ("vajrasana", "Thunderbolt Pose", "Hold upright posture with relaxed breathing."),
        ("trikonasana", "Triangle Pose", "Reach sideways with wide legs and open chest."),
        ("balasana", "Balasana (Child Pose)", "Kneel, fold forward, and stretch your arms out."),
        ("bhujangasana", "Cobra Pose", "Lift chest smoothly while keeping legs grounded."),
        ("wall_plank_chaturanga", "Wall Plank Chaturanga", "Step into wall plank and hold strong form."),
        ("padahastasana", "Hand-to-Foot Pose", "Fold forward with controlled breathing."),
        ("paschimottanasana", "Seated Forward Bend", "Lengthen spine, fold forward, and hold."),
        ("paschim_namaskarasana", "Reverse Prayer Pose", "Join palms behind back and lift chest."),
        ("pranayama", "Pranayama", "Complete a slow inhale-exhale breathing round."),
    ]
    idx = date.today().toordinal() % len(poses)
    pose, name, desc = poses[idx]
    return [{"index": idx+1, "pose": pose, "name": name, "description": desc, "target_accuracy": 75, "xp_reward": 100}]


SESSION_LEVELS = {
    "tree": [
        {"level": 1, "name": "Grow Roots", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Survive Gentle Wind", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Birds Build Nests", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Survive the Storm", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "padmasana": [
        {"level": 1, "name": "Calm Waters", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Lotus Bud Appears", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Blooming Lotus", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Sacred Lotus Awakens", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "vajrasana": [
        {"level": 1, "name": "Summon Clouds", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Call the Thunder", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Open the Rain Gates", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Healing Monsoon", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "baddha_konasana": [
        {"level": 1, "name": "Plant Wildflowers", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Garden Blooms", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Butterflies Return", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Enchanted Sanctuary", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "tadasana": [
        {"level": 1, "name": "Calm the Mist", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Restore the Cloud Path", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Reach the Sky Gate", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Awaken the Cloud Peak", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "balasana": [
        {"level": 1, "name": "Reconnect the Village", "hold_seconds": 5, "min_accuracy": 40, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Restore the Trading Route", "hold_seconds": 7, "min_accuracy": 65, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Unite the Settlements", "hold_seconds": 10, "min_accuracy": 75, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Kingdom Alliance Restored", "hold_seconds": 12, "min_accuracy": 80, "description": "Rep cycle: hold 12s"},
    ],
    "warrior": [
        {"level": 1, "name": "Repair Village Gate", "hold_seconds": 5, "min_accuracy": 35, "description": "Rep cycle: hold 5s"},
        {"level": 2, "name": "Rebuild Houses", "hold_seconds": 7, "min_accuracy": 40, "description": "Rep cycle: hold 7s"},
        {"level": 3, "name": "Light the Watchtowers", "hold_seconds": 10, "min_accuracy": 45, "description": "Rep cycle: hold 10s"},
        {"level": 4, "name": "Protect the Village", "hold_seconds": 12, "min_accuracy": 50, "description": "Rep cycle: hold 12s"},
    ],
    "trikonasana": [
        {"level": 1, "name": "Discover the Crystal Path", "reps": 2, "min_accuracy": 40, "description": "2 balanced left+right reps"},
        {"level": 2, "name": "Restore the Prism Towers", "reps": 4, "min_accuracy": 75, "description": "4 balanced left+right reps"},
        {"level": 3, "name": "Reignite the Rainbow Beams", "reps": 6, "min_accuracy": 80, "description": "6 balanced left+right reps"},
        {"level": 4, "name": "Prism Valley Restored", "reps": 8, "min_accuracy": 85, "description": "8 balanced left+right reps"},
    ],
    "bhujangasana": [
        {"level": 1, "name": "Forgotten Ruins", "hold_seconds": 5, "min_accuracy": 45, "description": "Hold 5s to reveal the ruined temple"},
        {"level": 2, "name": "Jungle Awakens", "hold_seconds": 7, "min_accuracy": 45, "description": "Hold 7s as vines and water return"},
        {"level": 3, "name": "Sacred Life Returns", "hold_seconds": 10, "min_accuracy": 45, "description": "Hold 10s to awaken wildlife and crystals"},
        {"level": 4, "name": "Temple Restored", "hold_seconds": 12, "min_accuracy": 45, "description": "Hold 12s for The Serpent Awakens"},
    ],
    "wall_plank_chaturanga": [
        {"level": 1, "name": "Broken Gates", "hold_seconds": 5, "min_accuracy": 45, "description": "Hold 5s while accuracy stays above threshold"},
        {"level": 2, "name": "Bamboo Groves Return", "hold_seconds": 7, "min_accuracy": 45, "description": "Hold 7s while accuracy stays above threshold"},
        {"level": 3, "name": "Cherry Blossom Dojo", "hold_seconds": 10, "min_accuracy": 45, "description": "Hold 10s while accuracy stays above threshold"},
        {"level": 4, "name": "Grand Dojo Completed", "hold_seconds": 12, "min_accuracy": 45, "description": "Hold 12s while accuracy stays above threshold"},
    ],
    "padahastasana": [
        {"level": 1, "name": "Dry Trees", "hold_seconds": 5, "min_accuracy": 45, "description": "Hold 5s"},
        {"level": 2, "name": "Autumn Stream", "hold_seconds": 7, "min_accuracy": 45, "description": "Hold 7s"},
        {"level": 3, "name": "Forest Wildlife Returns", "hold_seconds": 10, "min_accuracy": 45, "description": "Hold 10s"},
        {"level": 4, "name": "Golden Valley Restored", "hold_seconds": 12, "min_accuracy": 45, "description": "Hold 12s for Autumn Blessing"},
    ],
}

ALL_POSES = {"tree", "warrior", "padmasana", "vajrasana", "baddha_konasana", "tadasana", "trikonasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama"}


SESSION_LEVELS.update({
    "paschimottanasana": [
        {"level": 1, "name": "Silent Stage", "hold_seconds": 5, "min_accuracy": 40, "description": "Hold 5s to clear dust from the stage."},
        {"level": 2, "name": "Music Returns", "hold_seconds": 7, "min_accuracy": 65, "description": "Hold 7s to restart music boxes."},
        {"level": 3, "name": "Marionette Festival", "hold_seconds": 10, "min_accuracy": 75, "description": "Hold 10s to animate the puppets."},
        {"level": 4, "name": "Endless Performance", "hold_seconds": 12, "min_accuracy": 80, "description": "Hold 12s to open the grand theater."},
    ],
    "paschim_namaskarasana": [
        {"level": 1, "name": "Dry Gardens", "hold_seconds": 5, "min_accuracy": 40, "description": "Hold 5s to awaken the palace garden."},
        {"level": 2, "name": "Roses Bloom", "hold_seconds": 7, "min_accuracy": 65, "description": "Hold 7s to restore roses and water channels."},
        {"level": 3, "name": "Peacock Garden Awakens", "hold_seconds": 10, "min_accuracy": 75, "description": "Hold 10s to bring peacocks and lotus ponds."},
        {"level": 4, "name": "Festival of Feathers", "hold_seconds": 12, "min_accuracy": 80, "description": "Hold 12s to activate fountains and rainbow reflections."},
    ],
    "pranayama": [
        {"level": 1, "name": "Dormant Self", "hold_seconds": 5, "min_accuracy": 40, "description": "Complete calm breath cycles to reveal the cosmic outline."},
        {"level": 2, "name": "Energy Flow", "hold_seconds": 7, "min_accuracy": 65, "description": "Continue breathing to activate lower energy cores."},
        {"level": 3, "name": "Inner Harmony", "hold_seconds": 10, "min_accuracy": 75, "description": "Sustain breath rhythm to expand the aura."},
        {"level": 4, "name": "Prana Ascension", "hold_seconds": 12, "min_accuracy": 80, "description": "Complete the breath cycle to enter Harmony State."},
    ],
})

@app.route("/service-worker.js")
def service_worker():
    response = send_from_directory("static", "service-worker.js", mimetype="application/javascript")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("index.html")

@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    phone = request.form.get("phone", "").strip()
    mode = request.form.get("mode", "login")
    if len(username) < 3:
        return render_template("index.html", error="Username must be at least 3 characters.")
    if len(password) < 6:
        return render_template("index.html", error="Password must be at least 6 characters.")

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()

    if mode == "register":
        if user:
            return render_template("index.html", error="This username is already taken. Try another one or login.")
        for row in db.execute("SELECT username, password_hash FROM users WHERE password_hash IS NOT NULL").fetchall():
            try:
                if check_password_hash(row["password_hash"], password):
                    return render_template("index.html", error="Please choose a more unique password.")
            except Exception:
                pass
        token = secrets.token_urlsafe(32)
        db.execute("INSERT INTO users (username, password_hash, auth_token, phone, last_active) VALUES (?, ?, ?, ?, ?)",
                   (username, generate_password_hash(password), token, phone, date.today().isoformat()))
        db.execute("INSERT INTO world_progress (user_id) SELECT id FROM users WHERE username=?", (username,))
        db.commit()
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    else:
        if not user or not user["password_hash"] or not check_password_hash(user["password_hash"], password):
            return render_template("index.html", error="Invalid username or password.")
        token = user["auth_token"] or secrets.token_urlsafe(32)
        db.execute("UPDATE users SET auth_token=?, last_active=? WHERE id=?", (token, date.today().isoformat(), user["id"]))
        db.commit()
        user = db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()

    session.clear()
    session.permanent = True  
    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    session["auth_token"] = user["auth_token"]
    if not has_completed_questionnaire(db, user["id"]):
        return redirect(url_for("questionnaire"))
    return redirect(url_for("dashboard"))

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route("/api/change-password", methods=["POST"])
def api_change_password():
    if "user_id" not in session:
        return jsonify({"error": "Please log in again."}), 401

    current_password = request.form.get("current_password", "")
    new_password = request.form.get("new_password", "")
    confirm_password = request.form.get("confirm_password", "")

    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if new_password != confirm_password:
        return jsonify({"error": "New password and confirmation do not match."}), 400

    db = get_db()
    uid = session["user_id"]
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not user or not user["password_hash"] or not check_password_hash(user["password_hash"], current_password):
        return jsonify({"error": "Current password is incorrect."}), 400
    if check_password_hash(user["password_hash"], new_password):
        return jsonify({"error": "New password must be different from the current password."}), 400

    db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(new_password), uid))
    db.commit()
    return jsonify({"status": "ok", "message": "Password updated successfully."})

@app.route("/dashboard/set-practice-mode", methods=["POST"])
def set_practice_mode():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    requested_mode = "free" if request.form.get("mode") == "free" else "session"

    answer = get_questionnaire(db, uid)
    if not answer:
        return redirect(url_for("dashboard"))

    if is_guided_recovery_answer(answer):
        return redirect(url_for("dashboard"))

    db.execute("UPDATE questionnaire_answers SET practice_mode=?, updated_at=? WHERE user_id=?",
               (requested_mode, datetime.now().isoformat(timespec="seconds"), uid))

    saved = get_questionnaire(db, uid)
    recovery_profile = generate_recovery_profile(saved, [])
    db.execute("UPDATE questionnaire_answers SET recovery_json=? WHERE user_id=?",
               (json.dumps(recovery_profile), uid))
    saved = get_questionnaire(db, uid)
    rebuild_weekly_schedule(db, uid, saved)
    db.commit()
    return redirect(url_for("dashboard"))

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db  = get_db()
    uid = session["user_id"]
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    wp   = db.execute("SELECT * FROM world_progress WHERE user_id=?", (uid,)).fetchone()
    world_ctx = build_world_map_context(db, uid)

    def _wp(col):
        return wp[col] if wp and col in wp.keys() and wp[col] is not None else 0

    forest  = _wp("forest_restoration")
    village  = _wp("village_restoration")
    lotus = _wp("lotus_restoration")
    temple = _wp("temple_restoration")
    butterfly = _wp("butterfly_restoration")
    jungle_temple = _wp("jungle_temple_restoration")
    samurai_dojo = _wp("samurai_dojo_restoration")
    autumn_valley = _wp("autumn_valley_restoration")
    puppet_kingdom = _wp("puppet_kingdom_restoration")
    peacock_garden = _wp("peacock_garden_restoration")
    prana_nexus = _wp("prana_nexus_restoration")
    cloud_peak = _wp("cloud_peak_restoration")
    prism_valley = _wp("prism_valley_restoration")
    kingdoms = _wp("kingdoms_restoration")
    xp = user["xp"]
    level = compute_level(xp)
    overall = world_ctx.get("overall", 0)
    activity_streak = _effective_streak(user["streak"], user["last_active"])
    daily_challenge_streak = _effective_streak(user["daily_challenge_streak"], user["daily_challenge_last_date"])

    tree_mastery = get_or_create_mastery(db, uid, "tree")
    warrior_mastery = get_or_create_mastery(db, uid, "warrior")
    padmasana_mastery = get_or_create_mastery(db, uid, "padmasana")
    vajrasana_mastery = get_or_create_mastery(db, uid, "vajrasana")
    butterfly_mastery = get_or_create_mastery(db, uid, "baddha_konasana")
    bhujangasana_mastery = get_or_create_mastery(db, uid, "bhujangasana")
    wall_plank_mastery = get_or_create_mastery(db, uid, "wall_plank_chaturanga")
    padahastasana_mastery = get_or_create_mastery(db, uid, "padahastasana")
    pranayama_mastery = get_or_create_mastery(db, uid, "pranayama")
    paschim_namaskarasana_mastery = get_or_create_mastery(db, uid, "paschim_namaskarasana")
    paschimottanasana_mastery = get_or_create_mastery(db, uid, "paschimottanasana")
    tadasana_mastery = get_or_create_mastery(db, uid, "tadasana")
    trikonasana_mastery = get_or_create_mastery(db, uid, "trikonasana")
    balasana_mastery = get_or_create_mastery(db, uid, "balasana")
    questionnaire = get_questionnaire(db, uid)
    today_sessions = refresh_today_session_statuses(db, uid)
    followup_status = get_followup_status(db, uid)
    wellness = get_wellness_insights(db, uid)
    routine_row = db.execute("SELECT * FROM routine_preferences WHERE user_id=?", (uid,)).fetchone()
    routine = json_loads(routine_row["routine_json"], {}) if routine_row else {}
    recommendation_engine = generate_recommendation_engine(db, uid)
    feedback_pending = bool(followup_status.get("done", 0) and not db.execute("SELECT id FROM feedback_forms WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (uid,)).fetchone())

    return render_template("dashboard.html",
        user=dict(user),
        level=level,
        xp_next=xp_to_next_level(xp),
        xp_pct=level_xp_pct(xp),
        activity_streak=activity_streak,
        daily_challenge_streak=daily_challenge_streak,
        total_sessions=db.execute(
            "SELECT COUNT(*) as cnt FROM pose_sessions WHERE user_id=?", (uid,)
        ).fetchone()["cnt"],
        recent_sessions=[dict(r) for r in db.execute(
            "SELECT * FROM pose_sessions WHERE user_id=? ORDER BY completed_at DESC LIMIT 5",
            (uid,)).fetchall()],
        badges=[dict(b) for b in db.execute(
            "SELECT * FROM achievements WHERE user_id=? ORDER BY earned_at DESC LIMIT 6",
            (uid,)).fetchall()],
        challenge=get_or_create_daily_challenge(db),
        daily_challenges=get_daily_challenges_board(),
        forest=forest, village=village, lotus=lotus,
        temple=temple, butterfly=butterfly, cloud_peak=cloud_peak,
        prism_valley=prism_valley, kingdoms=kingdoms, jungle_temple=jungle_temple, samurai_dojo=samurai_dojo, autumn_valley=autumn_valley, puppet_kingdom=puppet_kingdom, peacock_garden=peacock_garden, prana_nexus=prana_nexus,
        overall=overall,
        tree_mastery=tree_mastery,
        warrior_mastery=warrior_mastery,
        padmasana_mastery=padmasana_mastery,
        vajrasana_mastery=vajrasana_mastery,
        butterfly_mastery=butterfly_mastery,
        bhujangasana_mastery=bhujangasana_mastery, wall_plank_mastery=wall_plank_mastery, padahastasana_mastery=padahastasana_mastery,
        paschimottanasana_mastery=paschimottanasana_mastery, paschim_namaskarasana_mastery=paschim_namaskarasana_mastery, pranayama_mastery=pranayama_mastery,
        tadasana_mastery=tadasana_mastery,
        trikonasana_mastery=trikonasana_mastery,
        balasana_mastery=balasana_mastery,
        hold_poses=list(HOLD_POSES),
        world_ctx=world_ctx,
        questionnaire=dict(questionnaire) if questionnaire else {},
        recovery_profile=json_loads(questionnaire["recovery_json"] if questionnaire and "recovery_json" in questionnaire.keys() else "{}", {}),
        practice_mode=get_practice_mode(questionnaire),
        today_sessions=today_sessions,
        followup_status=followup_status,
        wellness=wellness,
        routine=routine,
        feedback_pending=feedback_pending,
        recommendations=recommendation_engine,
    )

@app.route("/yoga-library")
def yoga_library():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db()
    uid = session["user_id"]
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return render_template("yoga_library.html", user=dict(user), world_ctx=build_world_map_context(db, uid))

@app.route("/game/<pose_name>")
def game(pose_name):
    if "user_id" not in session:
        return redirect(url_for("index"))
    if pose_name not in ALL_POSES:
        return redirect(url_for("dashboard"))
    db = get_db()
    allowed, message, sched = can_start_practice_now(db, session["user_id"])
    if not allowed:
        return render_template("session_locked.html", message=message, schedule=sched)
    return render_template("game.html", session_schedule=sched)

@app.route("/api/game-data/<pose_name>")
def api_game_data(pose_name):
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    if pose_name not in ALL_POSES:
        return jsonify({"error": "invalid pose"}), 400
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    with open(os.path.join(data_dir, "poses.json"),  encoding="utf-8") as f:
        poses = json.load(f)
    with open(os.path.join(data_dir, "levels.json"), encoding="utf-8") as f:
        levels = json.load(f)

    levels["session_levels"] = SESSION_LEVELS.get(pose_name, [])
    levels["is_hold_pose"]   = pose_name in HOLD_POSES
    levels["is_balanced_rep_pose"] = pose_name in BALANCED_REP_POSES

    return jsonify({
        "pose_name": pose_name,
        "pose":      poses.get(pose_name, {}),
        "levels":    levels,
    })


@app.route("/world-map")
def world_map_page():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db()
    uid = session["user_id"]
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    ctx = build_world_map_context(db, uid)
    return render_template("world_map.html", user=dict(user), world=ctx)

@app.route("/leaderboard")
def leaderboard():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db()
    rows = db.execute(
        "SELECT username, xp, level, streak FROM users ORDER BY xp DESC LIMIT 500"
    ).fetchall()
    return render_template("leaderboard.html",
        entries=[{"rank": i + 1, **dict(r)} for i, r in enumerate(rows)],
        current_user=session["username"]
    )


@app.route("/wellness-analytics")
def wellness_analytics():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    ensure_analytics_achievements(db, uid)
    db.commit()
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    analytics = build_wellness_analytics(db, uid)
    return render_template("wellness_analytics.html", user=dict(user), analytics=analytics)

@app.route("/profile")
def profile():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db  = get_db()
    uid = session["user_id"]
    user  = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    sessions_all = db.execute(
        "SELECT * FROM pose_sessions WHERE user_id=? ORDER BY completed_at DESC", (uid,)
    ).fetchall()
    badges = db.execute(
        "SELECT * FROM achievements WHERE user_id=? ORDER BY earned_at DESC", (uid,)
    ).fetchall()
    wp = db.execute("SELECT * FROM world_progress WHERE user_id=?", (uid,)).fetchone()
    world_ctx = build_world_map_context(db, uid)

    xp = user["xp"]
    level = compute_level(xp)
    total = len(sessions_all)
    avg_accuracy = round(sum(s["accuracy"] for s in sessions_all) / total, 1) if sessions_all else 0
    total_reps = sum(s["successful_reps"] for s in sessions_all)
    total_hold = sum((dict(s).get("hold_duration", 0) or 0) for s in sessions_all)

    tree_mastery = get_or_create_mastery(db, uid, "tree")
    warrior_mastery = get_or_create_mastery(db, uid, "warrior")
    padmasana_mastery = get_or_create_mastery(db, uid, "padmasana")
    vajrasana_mastery = get_or_create_mastery(db, uid, "vajrasana")
    butterfly_mastery = get_or_create_mastery(db, uid, "baddha_konasana")
    bhujangasana_mastery = get_or_create_mastery(db, uid, "bhujangasana")
    wall_plank_mastery = get_or_create_mastery(db, uid, "wall_plank_chaturanga")
    padahastasana_mastery = get_or_create_mastery(db, uid, "padahastasana")
    pranayama_mastery = get_or_create_mastery(db, uid, "pranayama")
    paschim_namaskarasana_mastery = get_or_create_mastery(db, uid, "paschim_namaskarasana")
    paschimottanasana_mastery = get_or_create_mastery(db, uid, "paschimottanasana")
    tadasana_mastery  = get_or_create_mastery(db, uid, "tadasana")
    trikonasana_mastery = get_or_create_mastery(db, uid, "trikonasana")
    balasana_mastery = get_or_create_mastery(db, uid, "balasana")
    questionnaire = get_questionnaire(db, uid)
    health_conditions = [r["condition_name"] for r in db.execute("SELECT condition_name FROM health_conditions WHERE user_id=?", (uid,)).fetchall()]
    routine_row = db.execute("SELECT * FROM routine_preferences WHERE user_id=?", (uid,)).fetchone()
    routine = json_loads(routine_row["routine_json"], {}) if routine_row else {}
    weekly_rows = [dict(r) for r in db.execute("SELECT * FROM weekly_schedule WHERE user_id=? ORDER BY id", (uid,)).fetchall()]
    followups = [dict(r) for r in db.execute("SELECT * FROM followup_assessments WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall()]
    feedbacks = [dict(r) for r in db.execute("SELECT * FROM feedback_forms WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall()]

    return render_template("profile.html",
        user=dict(user), level=level,
        xp_next=xp_to_next_level(xp), xp_pct=level_xp_pct(xp),
        sessions=[dict(s) for s in sessions_all],
        badges=[dict(b) for b in badges],
        wp=dict(wp) if wp else {},
        tree_mastery=tree_mastery,
        warrior_mastery=warrior_mastery,
        padmasana_mastery=padmasana_mastery,
        vajrasana_mastery=vajrasana_mastery,
        butterfly_mastery=butterfly_mastery,
        bhujangasana_mastery=bhujangasana_mastery, wall_plank_mastery=wall_plank_mastery, padahastasana_mastery=padahastasana_mastery,
        paschimottanasana_mastery=paschimottanasana_mastery, paschim_namaskarasana_mastery=paschim_namaskarasana_mastery, pranayama_mastery=pranayama_mastery,
        tadasana_mastery=tadasana_mastery,
        trikonasana_mastery=trikonasana_mastery,
        balasana_mastery=balasana_mastery,
        hold_poses=list(HOLD_POSES),
        world_ctx=world_ctx,
        stats={
            "total_sessions": total,
            "avg_accuracy": avg_accuracy,
            "total_time": sum(s["duration_seconds"] for s in sessions_all),
            "total_reps": total_reps,
            "total_hold": total_hold,
        },
        questionnaire=dict(questionnaire) if questionnaire else {},
        health_conditions=health_conditions,
        routine=routine,
        weekly_rows=weekly_rows,
        followups=followups,
        feedbacks=feedbacks,
        wellness_analytics=build_wellness_analytics(db, uid),
    )

@app.route("/video-analysis")
def video_analysis():
    if "user_id" not in session:
        return redirect(url_for("index"))
    return render_template("video_analysis.html", poses=sorted(list(ALL_POSES)), hold_poses=list(HOLD_POSES))

def _server_min_accuracy(pose_name):
    return 60 if pose_name == "pranayama" else 65

def _sanitize_session_payload(pose_name, accuracy, levels_completed, successful_reps, hold_duration):
    min_acc = _server_min_accuracy(pose_name)
    accuracy = max(0.0, min(100.0, float(accuracy or 0)))
    levels_completed = max(1, min(4, int(levels_completed or 1)))
    successful_reps = max(0, int(successful_reps or 0))
    hold_duration = max(0, int(hold_duration or 0))
    if accuracy < min_acc:
        return False, "Accuracy is below the strict pose threshold. Session was not awarded XP.", accuracy, levels_completed, successful_reps, hold_duration
    if pose_name in HOLD_POSES and hold_duration < 5:
        return False, "Hold duration was too short to count. Keep the real pose above threshold.", accuracy, levels_completed, successful_reps, hold_duration
    if pose_name not in HOLD_POSES and successful_reps < 1:
        return False, "No validated repetition was completed. XP was not awarded.", accuracy, levels_completed, successful_reps, hold_duration
    return True, "", accuracy, levels_completed, successful_reps, hold_duration

@app.route("/api/video-session", methods=["POST"])
def api_video_session():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True)
    pose_name = data.get("pose_name")
    if pose_name not in ALL_POSES:
        return jsonify({"error": "invalid pose"}), 400

    accuracy = float(data.get("accuracy", 0))
    duration_seconds = int(data.get("duration_seconds", 1))
    levels_completed = int(data.get("levels_completed", 1))
    successful_reps = int(data.get("successful_reps", 0))
    hold_duration = int(data.get("hold_duration", 0))
    left_reps = int(data.get("left_reps", 0))
    right_reps = int(data.get("right_reps", 0))
    best_accuracy = float(data.get("best_accuracy", accuracy))
    video_name = data.get("video_name", "uploaded-video")
    is_hold = pose_name in HOLD_POSES
    ok, reason, accuracy, levels_completed, successful_reps, hold_duration = _sanitize_session_payload(pose_name, accuracy, levels_completed, successful_reps, hold_duration)
    best_accuracy = max(best_accuracy, accuracy) if ok else accuracy
    if not ok:
        return jsonify({"error": reason, "xp_gained": 0, "new_badges": [], "rejected": True}), 422

    db = get_db()
    uid = session["user_id"]
    streak = update_streak(db, uid)
    daily_challenge_completed, daily_challenge_streak = update_daily_challenge_streak(
        db, uid, pose_name, accuracy, hold_duration, successful_reps
    )
    improve_pct = compute_improvement(db, uid, pose_name, accuracy)
    xp_gained, improve_bonus = compute_xp(accuracy, duration_seconds, levels_completed, streak,
                                          successful_reps, hold_duration, improve_pct, is_hold)

    db.execute("""INSERT INTO pose_sessions
       (user_id, pose_name, accuracy, duration_seconds, levels_completed,
        successful_reps, hold_duration, left_reps, right_reps, best_accuracy, xp_earned, improvement_bonus)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
       (uid, pose_name, accuracy, duration_seconds, levels_completed, successful_reps,
        hold_duration, left_reps, right_reps, best_accuracy, xp_gained, improve_bonus))
    db.execute("""INSERT INTO video_sessions
       (user_id, video_name, pose_name, duration, accuracy, repetitions, hold_time, xp_earned)
       VALUES (?,?,?,?,?,?,?,?)""",
       (uid, video_name, pose_name, duration_seconds, accuracy, successful_reps, hold_duration, xp_gained))

    mastery_info = update_pose_mastery(db, uid, pose_name, accuracy, successful_reps, hold_duration)
    update_world_progress(db, uid, pose_name, accuracy, levels_completed, successful_reps, hold_duration)
    old_xp = db.execute("SELECT xp FROM users WHERE id=?", (uid,)).fetchone()["xp"]
    new_xp = old_xp + xp_gained
    old_level = compute_level(old_xp)
    new_level = compute_level(new_xp)
    db.execute("UPDATE users SET xp=?, level=? WHERE id=?", (new_xp, new_level, uid))
    new_badges = check_achievements(db, uid, pose_name, accuracy, levels_completed,
                                    successful_reps, hold_duration, mastery_info, streak)
    active_time_block = log_pose_inside_time_block(
        db, uid, pose_name, successful_reps, hold_duration, accuracy, xp_gained, duration_seconds
    )
    db.commit()

    return jsonify({
        "xp_gained": xp_gained, "new_xp": new_xp, "new_level": new_level,
        "leveled_up": new_level > old_level, "new_badges": new_badges,
        "streak": streak, "improve_bonus": improve_bonus,
        "mastery_level": mastery_info["mastery_level"],
        "restoration_stage": mastery_info["restoration_stage"],
        "is_hold_pose": is_hold, "hold_duration": hold_duration,
        "left_reps": left_reps, "right_reps": right_reps,
        "daily_challenge_completed": daily_challenge_completed,
        "daily_challenge_streak": daily_challenge_streak,
    })

@app.route("/api/session", methods=["POST"])
def api_session():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True)
    pose_name = data.get("pose_name")
    if pose_name not in ALL_POSES:
        return jsonify({"error": "invalid pose"}), 400

    accuracy = float(data.get("accuracy", 0))
    duration_seconds = int(data.get("duration_seconds", 1))
    levels_completed = int(data.get("levels_completed", 1))
    successful_reps  = int(data.get("successful_reps", 0))
    hold_duration = int(data.get("hold_duration", 0))
    left_reps = int(data.get("left_reps", 0))
    right_reps = int(data.get("right_reps", 0))
    best_accuracy = float(data.get("best_accuracy", accuracy))
    is_hold = pose_name in HOLD_POSES
    ok, reason, accuracy, levels_completed, successful_reps, hold_duration = _sanitize_session_payload(pose_name, accuracy, levels_completed, successful_reps, hold_duration)
    best_accuracy = max(best_accuracy, accuracy) if ok else accuracy
    if not ok:
        return jsonify({"error": reason, "xp_gained": 0, "new_badges": [], "rejected": True}), 422

    db  = get_db()
    uid = session["user_id"]

    streak = update_streak(db, uid)
    daily_challenge_completed, daily_challenge_streak = update_daily_challenge_streak(
        db, uid, pose_name, accuracy, hold_duration, successful_reps
    )
    improve_pct = compute_improvement(db, uid, pose_name, accuracy)
    xp_gained, improve_bonus = compute_xp(
        accuracy, duration_seconds, levels_completed, streak,
        successful_reps, hold_duration, improve_pct, is_hold
    )

    db.execute(
        """INSERT INTO pose_sessions
           (user_id, pose_name, accuracy, duration_seconds, levels_completed,
            successful_reps, hold_duration, left_reps, right_reps, best_accuracy, xp_earned, improvement_bonus)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (uid, pose_name, accuracy, duration_seconds, levels_completed,
         successful_reps, hold_duration, left_reps, right_reps, best_accuracy, xp_gained, improve_bonus)
    )

    mastery_info = update_pose_mastery(db, uid, pose_name, accuracy, successful_reps, hold_duration)
    update_world_progress(db, uid, pose_name, accuracy, levels_completed, successful_reps, hold_duration)

    old_xp = db.execute("SELECT xp FROM users WHERE id=?", (uid,)).fetchone()["xp"]
    new_xp = old_xp + xp_gained
    old_level = compute_level(old_xp)
    new_level = compute_level(new_xp)
    db.execute("UPDATE users SET xp=?, level=? WHERE id=?", (new_xp, new_level, uid))

    new_badges = check_achievements(db, uid, pose_name, accuracy, levels_completed,
                                    successful_reps, hold_duration, mastery_info, streak)
    active_time_block = log_pose_inside_time_block(
        db, uid, pose_name, successful_reps, hold_duration, accuracy, xp_gained, duration_seconds
    )
    db.commit()

    return jsonify({
        "xp_gained":  xp_gained,
        "new_xp": new_xp,
        "new_level":  new_level,
        "leveled_up": new_level > old_level,
        "new_badges": new_badges,
        "streak":  streak,
        "improve_bonus": improve_bonus,
        "mastery_level": mastery_info["mastery_level"],
        "mastery_changed": mastery_info["mastery_level"] != mastery_info["prev_mastery"],
        "restoration_stage": mastery_info["restoration_stage"],
        "stage_changed":  mastery_info["restoration_stage"] != mastery_info["prev_stage"],
        "is_hold_pose": is_hold,
        "hold_duration": hold_duration,
        "left_reps": left_reps,
        "right_reps": right_reps,
        "daily_challenge_completed": daily_challenge_completed,
        "daily_challenge_streak": daily_challenge_streak,
        "session_log_id": active_time_block["id"] if active_time_block else None,
        "session_still_active": True,
        "session_note": "Pose logged inside the current time-block session. End Session or timer expiry completes the session.",
    })


@app.route("/api/session-status")
def api_session_status():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    summary = refresh_today_session_statuses(get_db(), session["user_id"])
    return jsonify(summary)

@app.route("/api/start-time-block-session", methods=["POST"])
def api_start_time_block_session():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    allowed, message, sched = can_start_practice_now(db, session["user_id"])
    
    if not allowed:
        return jsonify({"ok": False, "message": message, "schedule": sched}), 403
    if sched.get("mode") == "free":
        return jsonify({"ok": True, "mode": "free", "session": None, "schedule": sched})
    log = get_or_start_time_block_session(db, session["user_id"])
    
    return jsonify({"ok": True, "session": log, "schedule": refresh_today_session_statuses(db, session["user_id"])})

@app.route("/api/end-time-block-session", methods=["POST"])
def api_end_time_block_session():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    db = get_db(); uid = session["user_id"]
    active = _active_session_log(db, uid)
    if not active:
        return jsonify({"ok": False, "message": "No active time-block session found."}), 404
        
    daily = _daily_session_from_log(db, active)
    if daily:
        accumulated = int(daily["accumulated_practice_seconds"] or 0)
        minimum = int(daily["min_duration_minutes"] or max(1, int(daily["duration_minutes"] or 30)//2)) * 60
        if accumulated < minimum:
            return jsonify({"ok": False, "message": f"Minimum practice time not met yet. Practice at least {minimum//60} minutes before ending this session."}), 400
            
    summary = _finalize_session_log(db, uid, active["id"], "completed")
    db.commit()
    return jsonify({"ok": True, "summary": summary, "schedule": refresh_today_session_statuses(db, uid)})

@app.route("/session-history")
def session_history():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    
    logs = [dict(r) for r in db.execute("""
        SELECT * FROM session_logs
        WHERE user_id=?
        ORDER BY COALESCE(started_at, created_at) DESC LIMIT 60
    """, (uid,)).fetchall()]
    pose_logs = {}
    
    for log in logs:
        rows = [dict(r) for r in db.execute("""
            SELECT * FROM session_pose_logs
            WHERE session_log_id=?
            ORDER BY ended_at DESC
        """, (log["id"],)).fetchall()]
        pose_logs[log["id"]] = rows
        if rows:
            log["total_asanas_live"] = sum((r.get("repetitions") or 0) for r in rows) or len(rows)
            log["unique_asanas_live"] = len({r.get("pose_name") for r in rows if r.get("pose_name")})
            log["total_hold_time_live"] = sum((r.get("hold_duration") or 0) for r in rows)
            log["average_accuracy_live"] = round(sum((r.get("accuracy") or 0) for r in rows) / len(rows), 1)
        else:
            log["total_asanas_live"] = log.get("total_asanas") or 0
            log["unique_asanas_live"] = log.get("unique_asanas") or 0
            log["total_hold_time_live"] = log.get("total_hold_time") or 0
            log["average_accuracy_live"] = log.get("average_accuracy") or 0
            
    return render_template("session_history.html", logs=logs, pose_logs=pose_logs, pose_names=POSE_DISPLAY_NAMES)

@app.route("/api/pose-check", methods=["POST"])
def api_pose_check():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True)
    pose_name = data.get("pose_name")
    landmarks = data.get("landmarks", [])
    
    if pose_name not in ALL_POSES:
        return jsonify({"error": "invalid pose"}), 400
    try:
        from pose_detection.pose_checker import PoseChecker
        result = PoseChecker().validate(pose_name, landmarks)
    except Exception as e:
        result = {"score": 0, "passed": False, "stable": False,
                  "criteria": [], "overall_hint": str(e), "is_hold_pose": False}
    return jsonify(result)


def _render_health_assessment(onboarding=False):
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    ans = get_questionnaire(db, uid)

    conditions = [r["condition_name"] for r in db.execute("SELECT condition_name FROM health_conditions WHERE user_id=?", (uid,)).fetchall()]
    history = [dict(r) for r in db.execute("SELECT * FROM health_assessment_history WHERE user_id=? ORDER BY created_at DESC LIMIT 5", (uid,)).fetchall()]
    
    return render_template(
        "health_assessment.html",
        answer=dict(ans) if ans else {},
        selected_conditions=conditions,
        selected_goals=selected_json(ans, "goals"),
        selected_times=selected_json(ans, "preferred_times"),
        selected_days=selected_json(ans, "available_days"),
        selected_asanas=selected_json(ans, "current_asanas"),
        all_poses=sorted(list(ALL_POSES)),
        history=history,
        onboarding=onboarding,
    )

@app.route("/questionnaire", methods=["GET"])
def questionnaire():
    return _render_health_assessment(onboarding=True)

@app.route("/health-assessment", methods=["GET"])
def health_assessment():
    return _render_health_assessment(onboarding=False)

def _save_assessment_and_redirect(target="dashboard"):
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]; form = request.form
    multi = lambda name: form.getlist(name)
    practice_mode = form.get("practice_mode") or "session"
    
    required_single = ["age_range","biological_sex","activity_level","yoga_experience","session_duration_preference","weekly_practice_frequency","healthcare_recommended","medical_recovery_type","practice_mode"]
    required_multi = ["current_asanas","health_conditions","surgery_or_condition","goals"]
    
    if practice_mode != "free":
        required_single.append("sessions_per_day")
        required_multi += ["preferred_times","available_days","selected_session_times"]
    for f in required_single:
        if not str(form.get(f, "")).strip():
            return render_template("health_assessment.html", answer=dict(get_questionnaire(db, uid)) if get_questionnaire(db, uid) else {}, selected_conditions=[], selected_goals=[], selected_times=[], selected_days=[], selected_asanas=[], all_poses=sorted(list(ALL_POSES)), history=[], onboarding=False, error="Please complete all required fields.")
    for f in required_multi:
        if not multi(f):
            return render_template("health_assessment.html", answer=dict(get_questionnaire(db, uid)) if get_questionnaire(db, uid) else {}, selected_conditions=[], selected_goals=[], selected_times=[], selected_days=[], selected_asanas=[], all_poses=sorted(list(ALL_POSES)), history=[], onboarding=False, error="Please complete all required multi-select fields.")
    if practice_mode != "free":
        try:
            requested_sessions = max(1, int(form.get("sessions_per_day") or 1))
        except Exception:
            requested_sessions = 1
        chosen_times = sorted(set(multi("selected_session_times")))
        if len(chosen_times) != requested_sessions:
            return render_template("health_assessment.html", answer=dict(get_questionnaire(db, uid)) if get_questionnaire(db, uid) else {}, selected_conditions=[], selected_goals=[], selected_times=multi("preferred_times"), selected_days=multi("available_days"), selected_asanas=multi("current_asanas"), all_poses=sorted(list(ALL_POSES)), history=[], onboarding=False, error=f"Please select exactly {requested_sessions} session time(s).")
        selected_windows = multi("preferred_times")
        window_map = {"Morning": (6*60, 11*60), "Afternoon": (12*60, 16*60), "Evening": (17*60, 21*60), "Night": (21*60, 23*60)}
        
        mins=[]
        for t in chosen_times:
            try:
                h, m = parse_hhmm(t); total = h*60 + m
            except Exception:
                total = -1
            duration_for_gap = duration_minutes_from_pref(form.get("session_duration_preference"), 30)
            if not any(w in window_map and window_map[w][0] <= total and total + duration_for_gap <= window_map[w][1] for w in selected_windows):
                return render_template("health_assessment.html", answer=dict(get_questionnaire(db, uid)) if get_questionnaire(db, uid) else {}, selected_conditions=[], selected_goals=[], selected_times=selected_windows, selected_days=multi("available_days"), selected_asanas=multi("current_asanas"), all_poses=sorted(list(ALL_POSES)), history=[], onboarding=False, error="Selected session times must start and finish inside the chosen time window.")
            mins.append(total)
        duration_for_gap = duration_minutes_from_pref(form.get("session_duration_preference"), 30)
        required_start_gap = duration_for_gap + 30
        
        if any((b-a) < required_start_gap for a,b in zip(sorted(mins), sorted(mins)[1:])):
            return render_template("health_assessment.html", answer=dict(get_questionnaire(db, uid)) if get_questionnaire(db, uid) else {}, selected_conditions=[], selected_goals=[], selected_times=selected_windows, selected_days=multi("available_days"), selected_asanas=multi("current_asanas"), all_poses=sorted(list(ALL_POSES)), history=[], onboarding=False, error=f"Please keep each selected session at least {required_start_gap} minutes apart (session duration + 30 minute cool-off).")
    conditions = multi("health_conditions")
    goals = multi("goals")
    feature_preferences = {k: form.get(k, "3") for k in ["voice_guidance","visual_demonstrations","personalized_difficulty","progress_reports","reminders","community","health_app_integration"]}
    
    payload = {
        "age_range": form.get("age_range"), "biological_sex": form.get("biological_sex"),
        "activity_level": form.get("activity_level"), "yoga_experience": form.get("yoga_experience"),
        "current_asanas": json_dumps(multi("current_asanas")),
        
        "session_duration_preference": form.get("session_duration_preference"),
        "weekly_practice_frequency": form.get("weekly_practice_frequency"),

        "pain_scale": 0, "healthcare_recommended": form.get("healthcare_recommended"),
        "restrictions": ", ".join([v for v in multi("restrictions") if v.strip().lower() != "none"]),
        "medical_recovery_type": form.get("medical_recovery_type", "No"),
        "surgery_or_condition": ", ".join(multi("surgery_or_condition")),
        "doctor_restrictions": ", ".join([v for v in multi("doctor_restrictions") if v.strip().lower() != "none"]),
        "goals": json_dumps(goals), "feature_preferences": json.dumps(feature_preferences), "expectations": form.get("expectations", ""),
        "baseline_stress": int(form.get("baseline_stress") or 0), "baseline_mood": int(form.get("baseline_mood") or 0),
        
        "baseline_sleep": int(form.get("baseline_sleep") or 0), "baseline_flexibility": int(form.get("baseline_flexibility") or 0),
        "baseline_balance": int(form.get("baseline_balance") or 0), "preferred_times": json_dumps(multi("preferred_times")),
        "available_days": json_dumps(multi("available_days") if practice_mode != "free" else []), "sessions_per_day": int(form.get("sessions_per_day") or 1) if practice_mode != "free" else 0,
        "cooldown_hours": 1, "custom_session_times": json_dumps(multi("selected_session_times") if practice_mode != "free" else []), "reminder_enabled": 0,
        "practice_mode": form.get("practice_mode") or "session",

        "recovery_json": json.dumps({
            "guided_recovery_mode": False,
            "doctor_recommended": str(form.get("healthcare_recommended") or "").lower().startswith("yes"),
            "medical_recovery_type": form.get("medical_recovery_type", "No"),
            "surgery_or_condition": ", ".join(multi("surgery_or_condition")),
            "doctor_restrictions": ", ".join([v for v in multi("doctor_restrictions") if v.strip().lower() != "none"]),
            "recovery_goals": goals,
            "condition_details": conditions,
            "sessions_per_day": int(form.get("sessions_per_day") or 1) if practice_mode != "free" else 0,
            "preferred_times": multi("preferred_times") if practice_mode != "free" else [],
            "selected_session_times": multi("selected_session_times") if practice_mode != "free" else [],
            "minimum_gap_minutes": 30,
            "cooldown_reminders": False,
            "prepared_for_recommendation_engine": True
        }),
        "completed": 1, "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    cols = list(payload.keys())
    if get_questionnaire(db, uid):
        db.execute(f"UPDATE questionnaire_answers SET {', '.join([c+'=?' for c in cols])} WHERE user_id=?", [payload[c] for c in cols]+[uid])
    else:
        db.execute(f"INSERT INTO questionnaire_answers (user_id, {', '.join(cols)}) VALUES ({', '.join(['?']*(len(cols)+1))})", [uid]+[payload[c] for c in cols])
    db.execute("DELETE FROM health_conditions WHERE user_id=?", (uid,))
    for c in conditions:
        db.execute("INSERT INTO health_conditions (user_id, condition_name) VALUES (?,?)", (uid, c))

    saved = get_questionnaire(db, uid)
    recovery_profile = generate_recovery_profile(saved, conditions)
    db.execute("UPDATE questionnaire_answers SET practice_mode=?, recovery_json=? WHERE user_id=?",
               (payload["practice_mode"], json.dumps(recovery_profile), uid))
    saved = get_questionnaire(db, uid)
    routine = generate_personalized_routine(saved)
    recommendation_preview = generate_recommendation_engine(db, uid)
    
    routine["poses"] = [p["key"] for p in recommendation_preview.get("routine", [])] or routine.get("poses", ["pranayama", "tadasana"])
    routine["health_notes"] = conditions
    routine["session_duration"] = payload["session_duration_preference"]
    routine["metadata_driven"] = True
    
    db.execute("""INSERT INTO routine_preferences (user_id, routine_json, generated_at) VALUES (?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET routine_json=excluded.routine_json, generated_at=excluded.generated_at""",
        (uid, json.dumps(routine), datetime.now().isoformat(timespec="seconds")))

    snapshot = dict(payload)
    snapshot["health_conditions"] = conditions
    db.execute("INSERT INTO health_assessment_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps(snapshot)))

    db.execute("INSERT INTO session_preferences_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps({
        "preferred_times": multi("preferred_times") if practice_mode != "free" else [],
        "available_days": multi("available_days") if practice_mode != "free" else [],
        "selected_session_times": multi("selected_session_times") if practice_mode != "free" else [],
        "sessions_per_day": payload["sessions_per_day"],
        "cooldown_minutes": 30,
        "updated_at": payload["updated_at"],
    })))
    
    rebuild_weekly_schedule(db, uid, saved)
    db.commit()
    return redirect(url_for(target))

@app.route("/questionnaire", methods=["POST"])
def save_questionnaire():
    return _save_assessment_and_redirect("dashboard")

@app.route("/health-assessment", methods=["POST"])
def save_health_assessment():
    return _save_assessment_and_redirect("health_assessment")

@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    if request.method == "POST":
        data = request.form
        payload = {
            "satisfaction": int(data.get("satisfaction",0)),
            "instruction_quality": int(data.get("instruction_quality",0)),
            "difficulty_fit": int(data.get("difficulty_fit",0)),
            "skipped_reasons": data.get("skipped_reasons",""),
            "continue_likelihood": int(data.get("continue_likelihood",0)),
            "recommend_likelihood": int(data.get("recommend_likelihood",0)),
            "liked_most": data.get("liked_most",""),
            "desired_features": data.get("desired_features",""),
            "health_issues_unaddressed": data.get("health_issues_unaddressed",""),
        }
        db.execute("""INSERT INTO feedback_forms (user_id, satisfaction, instruction_quality, difficulty_fit, skipped_reasons,
            continue_likelihood, recommend_likelihood, liked_most, desired_features, health_issues_unaddressed) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (uid, payload["satisfaction"], payload["instruction_quality"], payload["difficulty_fit"], payload["skipped_reasons"],
             payload["continue_likelihood"], payload["recommend_likelihood"], payload["liked_most"], payload["desired_features"], payload["health_issues_unaddressed"]))
        
        db.execute("INSERT INTO feedback_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps(payload)))
        db.commit()
        flash("Feedback saved.")
        return redirect(url_for("feedback"))
    rows = [dict(r) for r in db.execute("SELECT * FROM feedback_forms WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall()]
    return render_template("feedback.html", feedback_rows=rows)

@app.route("/wellness-reassessment", methods=["GET", "POST"])
def wellness_reassessment():
    if "user_id" not in session:
        return redirect(url_for("index"))
    db = get_db(); uid = session["user_id"]
    if request.method == "POST":
        payload = {
            "stress": int(request.form.get("stress",0)),
            "mood": int(request.form.get("mood",0)),
            "sleep": int(request.form.get("sleep",0)),
            "flexibility": int(request.form.get("flexibility",0)),
            "balance": int(request.form.get("balance",0)),
            "notes": request.form.get("notes",""),
        }
        db.execute("INSERT INTO followup_assessments (user_id, stress, mood, sleep, flexibility, balance, notes) VALUES (?,?,?,?,?,?,?)",
            (uid, payload["stress"], payload["mood"], payload["sleep"], payload["flexibility"], payload["balance"], payload["notes"]))
        db.execute("INSERT INTO reassessment_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps(payload)))
        db.commit()
        flash("Wellness reassessment saved.")
        return redirect(url_for("wellness_reassessment"))
        
    ans = get_questionnaire(db, uid)
    rows = [dict(r) for r in db.execute("SELECT * FROM followup_assessments WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall()]
    baseline = row_to_safe_dict(ans)
    return render_template("wellness_reassessment.html", baseline=baseline, reassessments=rows, status=get_followup_status(db, uid))

@app.route("/api/followup-assessment", methods=["POST"])
def api_followup_assessment():
    if "user_id" not in session:
        return jsonify({"error":"unauthorized"}), 401
    data = request.get_json(force=True) if request.is_json else request.form
    db = get_db(); uid = session["user_id"]

    payload = {
        "stress": int(data.get("stress",0)), "mood": int(data.get("mood",0)),
        "sleep": int(data.get("sleep",0)), "flexibility": int(data.get("flexibility",0)),
        "balance": int(data.get("balance",0)), "notes": data.get("notes","")
    }

    db.execute("INSERT INTO followup_assessments (user_id, stress, mood, sleep, flexibility, balance, notes) VALUES (?,?,?,?,?,?,?)",
        (uid, payload["stress"], payload["mood"], payload["sleep"], payload["flexibility"], payload["balance"], payload["notes"]))
    db.execute("INSERT INTO reassessment_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps(payload)))
    db.commit()
    return jsonify({"ok": True}) if request.is_json else redirect(url_for("wellness_reassessment"))

@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    if "user_id" not in session:
        return jsonify({"error":"unauthorized"}), 401
    data = request.get_json(force=True) if request.is_json else request.form
    db = get_db(); uid = session["user_id"]
    payload = {
        "satisfaction": int(data.get("satisfaction",0)),
        "instruction_quality": int(data.get("instruction_quality",0)),
        "difficulty_fit": int(data.get("difficulty_fit",0)),
        "skipped_reasons": data.get("skipped_reasons",""),
        "continue_likelihood": int(data.get("continue_likelihood",0)),
        "recommend_likelihood": int(data.get("recommend_likelihood",0)),
        "liked_most": data.get("liked_most",""),
        "desired_features": data.get("desired_features",""),
        "health_issues_unaddressed": data.get("health_issues_unaddressed",""),
    }
    db.execute("""INSERT INTO feedback_forms (user_id, satisfaction, instruction_quality, difficulty_fit, skipped_reasons,
        continue_likelihood, recommend_likelihood, liked_most, desired_features, health_issues_unaddressed) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (uid, payload["satisfaction"], payload["instruction_quality"], payload["difficulty_fit"], payload["skipped_reasons"],
         payload["continue_likelihood"], payload["recommend_likelihood"], payload["liked_most"], payload["desired_features"], payload["health_issues_unaddressed"]))
    db.execute("INSERT INTO feedback_history (user_id, snapshot_json) VALUES (?,?)", (uid, json.dumps(payload)))
    db.commit()
    return jsonify({"ok": True}) if request.is_json else redirect(url_for("feedback"))

def send_push_notification(db, user_id, title, body, url="/dashboard"):
    from pywebpush import webpush, WebPushException

    subs = db.execute("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?", (user_id,)).fetchall()
    sent = 0
    errors = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_INSTANCE,
                vapid_claims={"sub": VAPID_CLAIM_EMAIL},
            )
            sent += 1
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            body_text = getattr(e.response, "text", None)
            print(f"[push] WebPushException for sub id={sub['id']} status={status} body={body_text} err={e}")
            errors.append(f"HTTP {status}: {body_text or e}")
            if status in (404, 410):
                db.execute("DELETE FROM push_subscriptions WHERE id=?", (sub["id"],))
        except Exception as e:
            print(f"[push] Unexpected error sending to sub id={sub['id']}: {type(e).__name__}: {e}")
            errors.append(f"{type(e).__name__}: {e}")
    return sent, len(subs), errors


@app.route("/api/push/vapid-public-key")
def api_push_vapid_public_key():
    return jsonify({"publicKey": VAPID_PUBLIC_KEY})


@app.route("/api/push/subscribe", methods=["POST"])
def api_push_subscribe():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True)
    endpoint = data.get("endpoint")
    keys = data.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not endpoint or not p256dh or not auth:
        return jsonify({"error": "Invalid subscription payload."}), 400

    db = get_db()
    db.execute("""INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?,?,?,?)
        ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth""",
        (session["user_id"], endpoint, p256dh, auth))
    db.commit()
    return jsonify({"ok": True})

@app.route("/api/push/unsubscribe", methods=["POST"])
def api_push_unsubscribe():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True)
    endpoint = data.get("endpoint")
    db = get_db()
    db.execute("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?", (session["user_id"], endpoint))
    db.commit()
    return jsonify({"ok": True})

@app.route("/api/push/test", methods=["POST"])
def api_push_test():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    sent, total_subs, errors = send_push_notification(db, session["user_id"], "YogaSaathi", "Notifications are set up correctly! 🧘")
    db.commit()
    if total_subs == 0:
        return jsonify({"error": "No active subscription found - try enabling notifications again."}), 400
    if sent == 0:
        return jsonify({"error": "Found your subscription, but delivery failed.", "details": errors}), 502
    return jsonify({"ok": True, "sent": sent, "total": total_subs})

_GREETING_MESSAGES = {
    "morning": [
        "Good morning! A few mindful minutes now can set the tone for your whole day.",
        "Good morning! Your mat is waiting whenever you're ready.",
        "Rise and stretch - good morning! Even 10 minutes of practice counts.",
    ],
    "afternoon": [
        "Good afternoon! A short stretch break can ease the midday slump.",
        "Good afternoon! Take a few minutes to breathe and reset.",
        "Good afternoon! Your body will thank you for a quick practice break.",
    ],
    "evening": [
        "Good evening! Wind down the day with some gentle movement.",
        "Good evening! A calm practice now can help you sleep better tonight.",
        "Good evening! Time to unroll the mat and let the day go.",
    ],
}

def _current_ist_time():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _time_window(hour):
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return None

def _minutes_since_midnight(hhmm):
    try:
        h, m = str(hhmm).split(":")[:2]
        return int(h) * 60 + int(m)
    except Exception:
        return None

REMINDER_TOLERANCE_MINUTES = 10

@app.route("/api/push/send-reminders", methods=["POST", "GET"])
def api_push_send_reminders():
    if request.args.get("key") != PUSH_CRON_SECRET:
        return jsonify({"error": "unauthorized"}), 401

    now = _current_ist_time()
    now_minutes = now.hour * 60 + now.minute
    today_str = now.strftime("%Y-%m-%d")
    day_name = now.strftime("%A")

    db = get_db()
    slots = db.execute("""
        SELECT DISTINCT u.id AS user_id, u.username, ws.slot_name, ws.scheduled_time
        FROM users u
        JOIN push_subscriptions ps ON ps.user_id = u.id
        JOIN weekly_schedule ws ON ws.user_id = u.id AND ws.day_name = ? AND ws.enabled = 1
        LEFT JOIN questionnaire_answers qa ON qa.user_id = u.id
        WHERE COALESCE(qa.reminder_enabled, 1) = 1 AND ws.scheduled_time IS NOT NULL
    """, (day_name,)).fetchall()

    checked = 0
    sent_count = 0
    for row in slots:
        scheduled_minutes = _minutes_since_midnight(row["scheduled_time"])
        if scheduled_minutes is None:
            continue
        checked += 1

        if abs(now_minutes - scheduled_minutes) > REMINDER_TOLERANCE_MINUTES:
            continue

        uid = row["user_id"]
        slot_name = row["slot_name"]
        claim = db.execute("""INSERT INTO push_log (user_id, notif_date, window_name) VALUES (?,?,?)
            ON CONFLICT (user_id, notif_date, window_name) DO NOTHING RETURNING id""",
            (uid, today_str, slot_name)).fetchone()
        if not claim:
            continue 
        window = _time_window(scheduled_minutes // 60) or "evening"
        greeting = random.choice(_GREETING_MESSAGES[window])
        body = f"{greeting} Your {slot_name} session is scheduled at {row['scheduled_time']}."
        title_map = {"morning": "Good Morning \U0001F33C", "afternoon": "Good Afternoon \u2600\ufe0f", "evening": "Good Evening \U0001F319"}
        sent, _total, _errors = send_push_notification(db, uid, title_map[window], body)
        sent_count += sent

    db.commit()
    return jsonify({"ok": True, "slots_checked": checked, "notifications_sent": sent_count})


try:
    init_db()
except Exception:
    pass

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)