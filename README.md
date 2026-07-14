# YogGyaan

YogGyaan is a gamified yoga practice app that uses real-time pose detection and pre recorded input analysis to guide users through asanas - built with a focus on the geriatric population, combining accurate pose correction with an engaging, motivating experience.

---

## Live Demo :
https://yoggyaan.onrender.com

---

## Features

- Real-time pose detection and scoring across 14 yoga asanas, using MediaPipe
- Step-by-step tutorials with stick-figure guidance before live practice
- XP and progression system based on accuracy, reps, hold time, and consistency
- Separate Activity Streak and Daily Challenge Streak tracking
- Health-aware recommendations based on user goals, injuries, and conditions
- Session history, wellness analytics, and progress tracking
- Support for pre-recorded video analysis
- Leaderboard, achievements, and badges
- Installable PWA from the browser 

---

## Tech Stack

- **Backend:** Flask (Python)
- **Pose Detection:** MediaPipe Pose Landmarker
- **Database:** PostgreSQL (hosted on Neon)
- **Frontend:** HTML, CSS, JavaScript, Canvas API
- **Auth:** Werkzeug password hashing
- **Deployment:** Render

---

## Project Structure

```
YogGyaan/
├── app.py                      # Main Flask app
├── db_compat.py                # PostgreSQL compatibility layer
├── requirements.txt
├── pose_detection/
│   ├── angle_calculator.py
│   └── pose_checker.py
├── data/
│   ├── poses.json
│   ├── levels.json
│   └── asana_metadata.txt
├── static/
│   ├── js/
│   ├── css/
│   ├── manifest.json
│   └── service-worker.js
└── templates/
```

---

## Getting Started

### Prerequisites
- Python 3.9+
- A PostgreSQL database (e.g. a free Neon instance)

### Setup

```bash
git clone https://github.com/yogaverse-team/YogGyaan.git
cd YogGyaan
pip install -r requirements.txt
```

Set the following environment variables:

```
DATABASE_URL
SESSION_SECRET
```

Run the app:

```bash
python app.py
```

The app will be available at `http://localhost:5000`.

---

## How It Works

Pose detection follows a simple pipeline: MediaPipe extracts body landmarks, which are smoothed to reduce jitter, checked for visibility/coverage quality, converted into joint angles and distances, and scored against pose-specific rules. A pose only counts as completed once it holds correct form for several consecutive frames, reducing false positives.


