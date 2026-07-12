(function () {
  const el = document.getElementById("gameData");
  if (!el)
    return;
  
  window.POSE_NAME = el.getAttribute("data-pose-name") || "unknown_pose";
  try {
    window.POSE_CONFIG = JSON.parse(el.getAttribute("data-pose") || "{}");
  }
  catch {
    window.POSE_CONFIG = {};
  }
  try {
    window.LEVELS_DATA = JSON.parse(el.getAttribute("data-levels") || "{}");
  }
  catch {
    window.LEVELS_DATA = {};
  }

  window.IS_HOLD_POSE = !!(window.LEVELS_DATA && window.LEVELS_DATA.is_hold_pose);

  window.STEP_TITLES = {
    tree: ["Find Your Root", "Shift Your Weight", "Place Your Foot", "Raise Your Branches"],
    warrior: ["Wide Warrior Stance", "Turn Your Front Foot", "Bend the Front Knee", "Open Your Wings"],
    padmasana: ["Sit Tall", "Cross Your Right Leg", "Cross Your Left Leg", "Rest and Breathe"],
    vajrasana: ["Kneel Down", "Sit on Your Heels", "Straighten Your Spine", "Rest Your Hands"],
    baddha_konasana: ["Sit Upright", "Bend Both Knees", "Spread Your Wings", "Hold and Breathe"],
    tadasana: ["Ground Your Feet", "Lengthen Spine", "Level Shoulders", "Awaken Peak"],
    trikonasana: ["Wide Triangle Base", "Straighten Legs", "Reach Sideways", "Open the Prism Line"],
    balasana: ["Kneel on the Mat", "Sit Back on Heels", "Fold Torso Forward", "Stretch Arms and Hold"],
  };

  const btn = document.getElementById("btnPracticeAgain");
  if (btn) btn.addEventListener("click", () => { window.location = "/game/" + window.POSE_NAME; });
}());

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const SKELETON_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];

const SMOOTH_ALPHA = 0.35;
let _smoothedLm = null;

function smoothLandmarks(rawLm) {
  if (!rawLm || rawLm.length === 0)
    return rawLm;
  if (!_smoothedLm || _smoothedLm.length !== rawLm.length) {
    _smoothedLm = rawLm.map(p => ({ x: p.x, y: p.y, z: p.z || 0, visibility: p.visibility }));
    return _smoothedLm;
  }
  for (let i = 0; i < rawLm.length; i++) {
    const a = SMOOTH_ALPHA;
    _smoothedLm[i] = {
      x: _smoothedLm[i].x * (1 - a) + rawLm[i].x * a,
      y: _smoothedLm[i].y * (1 - a) + rawLm[i].y * a,
      z: (_smoothedLm[i].z || 0) * (1 - a) + (rawLm[i].z || 0) * a,
      visibility: rawLm[i].visibility,
    };
  }
  return _smoothedLm;
}

window.resetLandmarkSmoother = function () { _smoothedLm = null; };

function angleAt(a, b, c) {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(rad * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function drawSkeleton(ctx, landmarks, W, H) {
  ctx.strokeStyle = "rgba(74,222,128,0.75)";
  ctx.lineWidth = 2.5;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const A = landmarks[a], B = landmarks[b];
    if (!A || !B)
      continue;
    ctx.beginPath();
    ctx.moveTo((1 - A.x) * W, A.y * H);
    ctx.lineTo((1 - B.x) * W, B.y * H);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,100,100,0.9)";
  for (const lm of landmarks) {
    if (!lm)
      continue;
    ctx.beginPath();
    ctx.arc((1 - lm.x) * W, lm.y * H, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}


const POSE_TOLERANCES_JS = {
  tree: {
    standingKneeIdeal: 175, standingKneeTol: 25, standingKneeW: 0.20,
    bentKneeIdeal: 55, bentKneeTol: 45, bentKneeW: 0.25,
    elbowIdeal: 170, elbowTol: 35, elbowW: 0.20,
    armRaiseIdeal: 170, armRaiseTol: 35, armRaiseW: 0.25,
    hipSymCeiling: 0.08, hipSymTol: 0.10, hipSymW: 0.10,
  },
  warrior: {
    frontKneeIdeal: 90, frontKneeTol: 85, frontKneeW: 0.28,
    backKneeIdeal: 160, backKneeTol: 75, backKneeW: 0.14,
    elbowIdeal: 165, elbowTol: 75, elbowW: 0.20,
    armHeightIdeal: 90, armHeightTol: 70, armHeightW: 0.20,
    stanceIdeal: 1.1, stanceTol: 0.8, stanceW: 0.18,
  },
  padmasana: {
    kneeSpreadIdeal: 0.32, kneeSpreadTol: 0.18, kneeSpreadW: 0.35,
    torsoCeiling: 0.0, torsoTol: 0.10, torsoW: 0.35,
    ankleElevIdeal: 0.08, ankleElevTol: 0.18, ankleElevW: 0.30,
  },
  vajrasana: {
    kneeFoldIdeal: 0.30, kneeFoldTol: 0.20, kneeFoldW: 0.35,
    torsoCeiling: 0.0, torsoTol: 0.10, torsoW: 0.35,
    kneesCloseIdeal: 0.0, kneesCloseTol: 0.18, kneesCloseW: 0.30,
  },
  baddha_konasana: {
    kneeSpreadIdeal: 0.30, kneeSpreadTol: 0.18, kneeSpreadW: 0.40,
    feetCloseIdeal: 0.0, feetCloseTol: 0.14, feetCloseW: 0.30,
    torsoCeiling: 0.0, torsoTol: 0.10, torsoW: 0.30,
  },
  tadasana: {
    kneeIdeal: 178, kneeTol: 20, kneeW: 0.30,
    torsoCeiling: 0.0, torsoTol: 0.14, torsoW: 0.30,
    feetWidthCeiling: 0.10, feetWidthTol: 0.16, feetWidthW: 0.15,
    shoulderLevelCeiling: 0.0, shoulderLevelTol: 0.10, shoulderLevelW: 0.15,
    elbowIdeal: 172, elbowTol: 35, elbowW: 0.10,
  },
  trikonasana: {
    stanceIdeal: 0.55, stanceTol: 0.30, stanceW: 0.20,
    kneeIdeal: 172, kneeTol: 28, kneeW: 0.15,
    armLineIdeal: 175, armLineTol: 40, armLineW: 0.20,
    tiltIdeal: 0.20, tiltTol: 0.16, tiltW: 0.30,
    reachIdeal: 0.0, reachTol: 0.18, reachW: 0.15,
  },
  balasana: {
    hipHeelIdeal: 0.0, hipHeelTol: 0.24, hipHeelW: 0.35,
    foldAngleIdeal: 35, foldAngleTol: 45, foldAngleW: 0.18,
    headLowIdeal: 0.0, headLowTol: 0.20, headLowW: 0.12,
    elbowIdeal: 165, elbowTol: 45, elbowW: 0.10,
    armReachIdeal: 0.30, armReachTol: 0.25, armReachW: 0.10,
    symmetryIdeal: 0.0, symmetryTol: 0.12, symmetryW: 0.15,
  },
  bhujangasana: {
    chestLiftIdeal: 0.16, chestLiftTol: 0.16, chestLiftW: 0.35,
    elbowIdeal: 150, elbowTol: 40, elbowW: 0.25,
    shoulderLevelCeiling: 0.0, shoulderLevelTol: 0.12, shoulderLevelW: 0.20,
    hipLevelCeiling: 0.0, hipLevelTol: 0.12, hipLevelW: 0.20,
  },
  wall_plank_chaturanga: {
    bodyLineIdeal: 175, bodyLineTol: 30, bodyLineW: 0.40,
    elbowIdeal: 150, elbowTol: 40, elbowW: 0.30,
    feetCloseIdeal: 0.0, feetCloseTol: 0.20, feetCloseW: 0.15,
    reachIdeal: 0.40, reachTol: 0.22, reachW: 0.15,
  },
  padahastasana: {
    foldIdeal: 40, foldTol: 45, foldW: 0.35,
    reachIdeal: 0.0, reachTol: 0.30, reachW: 0.30,
    headDownW: 0.15,
    kneeIdeal: 165, kneeTol: 35, kneeW: 0.20,
  },
  paschimottanasana: {
    foldIdeal: 45, foldTol: 45, foldW: 0.35,
    reachIdeal: 0.0, reachTol: 0.32, reachW: 0.30,
    seatedCeiling: 0.0, seatedTol: 0.14, seatedW: 0.15,
    headDownW: 0.20,
  },
  paschim_namaskarasana: {
    handsCloseIdeal: 0.0, handsCloseTol: 0.22, handsCloseW: 0.25,
    wristsBehindW: 0.35,
    shoulderLevelCeiling: 0.0, shoulderLevelTol: 0.10, shoulderLevelW: 0.20,
    torsoCeiling: 0.0, torsoTol: 0.14, torsoW: 0.20,
  },
  pranayama: {
    torsoCeiling: 0.0, torsoTol: 0.16, torsoW: 0.55,
    shoulderLevelCeiling: 0.0, shoulderLevelTol: 0.10, shoulderLevelW: 0.35,
    stableSeatW: 0.10,
  },
};


function targetScore(actual, ideal, tol) {
  if (tol <= 0) return actual === ideal ? 1 : 0;
  return clamp01(1 - Math.abs(actual - ideal) / tol);
}
function minScore(actual, floor, tol) {
  if (actual >= floor) return 1;
  if (tol <= 0) return 0;
  return clamp01(1 - (floor - actual) / tol);
}
function maxScore(actual, ceiling, tol) {
  if (actual <= ceiling) return 1;
  if (tol <= 0) return 0;
  return clamp01(1 - (actual - ceiling) / tol);
}
function weighted(parts) {
  let totalW = 0, sum = 0;
  for (const [s, w] of parts) { sum += s * w; totalW += w; }
  return totalW > 0 ? sum / totalW : 0;
}


function dist2(a, b) {
  if (!a || !b) return 999;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function scoreNear(value, target, tol) { return clamp01(1 - Math.abs(value - target) / tol); }
function scoreRange(value, min, max) {
  if (max === min) return value >= min ? 1 : 0;
  return clamp01((value - min) / (max - min));
}
let _lastPoseDebug = { accuracy: 0, threshold: 0, angles: {}, valid: false, reason: "" };
window.getPoseDebugInfo = function () { return _lastPoseDebug; };
function setPoseDebug(poseName, accuracy, angles, reason) {
  _lastPoseDebug = {
    pose: poseName,
    accuracy: Math.round(accuracy),
    threshold: (window.getCurrentPoseThreshold ? window.getCurrentPoseThreshold() : 0),
    angles: angles || {},
    valid: accuracy >= (window.getCurrentPoseThreshold ? window.getCurrentPoseThreshold() : 0),
    reason: reason || ""
  };
}

function landmarkVisible(p, minVis = 0.45) {
  return !!p && p.x >= -0.08 && p.x <= 1.08 && p.y >= -0.08 && p.y <= 1.08 && (p.visibility == null || p.visibility >= minVis);
}
function qualityGate(lm, poseName) {
  const standingKeys = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const seatedKeys = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
  
  const balasanaKeys = [11, 12, 23, 24, 25, 26, 15, 16];
 
  const forwardFoldKeys = [11, 12, 13, 14, 23, 24, 25, 26, 27, 28];

  let required = standingKeys, minVis = 0.45, coverage = 0.78, minBoxW = 0.10, minBoxH = 0.16;
  if (["padmasana", "vajrasana", "baddha_konasana", "pranayama"].includes(poseName)) {
    required = seatedKeys; minVis = 0.45; coverage = 0.78;
  } else if (poseName === "balasana") {
    required = balasanaKeys; minVis = 0.22; coverage = 0.55; minBoxW = 0.08; minBoxH = 0.10;
  } else if (poseName === "padahastasana") {
    required = forwardFoldKeys; minVis = 0.35; coverage = 0.65;
  }

  const visible = required.filter(i => landmarkVisible(lm[i], minVis)).length;
  const ratio = visible / required.length;
  const xs = required.map(i => lm[i]).filter(Boolean).map(p => p.x);
  const ys = required.map(i => lm[i]).filter(Boolean).map(p => p.y);
  const boxW = Math.max(...xs) - Math.min(...xs);
  const boxH = Math.max(...ys) - Math.min(...ys);
  if (ratio < coverage) return { ok: false, factor: 0, reason: "Full body is not visible clearly" };
  if (boxW < minBoxW || boxH < minBoxH) return { ok: false, factor: 0, reason: "Move back so your body fills the camera correctly" };
  return { ok: true, factor: clamp01((ratio - coverage) / (1 - coverage || 1)), reason: "" };
}

function lineDeviation(a, b, c) {
  if (!a || !b || !c) return 1;
  const dx = c.x - a.x, dy = c.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * b.x - dx * b.y + c.x * a.y - c.y * a.x) / len;
}

function bodyHeight(lm) {
  return Math.abs(((lm[11].y + lm[12].y) / 2) - ((lm[27].y + lm[28].y) / 2));
}
function torsoHeight(lm) {
  return Math.abs(((lm[11].y + lm[12].y) / 2) - ((lm[23].y + lm[24].y) / 2));
}
function avg(a, b) { return (a + b) / 2; }

function computeAccuracy(lm, poseName) {
  if (!lm || lm.length < 33) return 0;

  const q = qualityGate(lm, poseName);
  if (!q.ok) { setPoseDebug(poseName, 0, {}, q.reason); return 0; }

  const lSh = lm[11], rSh = lm[12], lEl = lm[13], rEl = lm[14], lWr = lm[15], rWr = lm[16];
  const lHi = lm[23], rHi = lm[24], lKn = lm[25], rKn = lm[26], lAn = lm[27], rAn = lm[28];
  const nose = lm[0];
  const shX = avg(lSh.x, rSh.x), shY = avg(lSh.y, rSh.y);
  const hiX = avg(lHi.x, rHi.x), hiY = avg(lHi.y, rHi.y);
  const knY = avg(lKn.y, rKn.y), anY = avg(lAn.y, rAn.y);
  const t = POSE_TOLERANCES_JS[poseName] || {};
  let score = 0, reason = "Pose valid", angles = {};
  const lKnAng = angleAt(lHi, lKn, lAn), rKnAng = angleAt(rHi, rKn, rAn);
  const lElAng = angleAt(lSh, lEl, lWr), rElAng = angleAt(rSh, rEl, rWr);

  if (poseName === "tadasana") {
    const fullStanding = bodyHeight(lm) > 0.42 && shY < hiY && hiY < knY && knY < anY;
    if (!fullStanding) { setPoseDebug(poseName, 0, {}, "Stand fully upright; sitting cannot count as Tadasana"); return 0; }
    score = weighted([
      [(targetScore(lKnAng, t.kneeIdeal, t.kneeTol) + targetScore(rKnAng, t.kneeIdeal, t.kneeTol)) / 2, t.kneeW],
      [maxScore(Math.abs(shX - hiX), t.torsoCeiling, t.torsoTol), t.torsoW],
      [maxScore(dist2(lAn, rAn), t.feetWidthCeiling, t.feetWidthTol), t.feetWidthW],
      [maxScore(Math.abs(lSh.y - rSh.y), t.shoulderLevelCeiling, t.shoulderLevelTol), t.shoulderLevelW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
    ]);
    angles = { leftKnee: Math.round(lKnAng), rightKnee: Math.round(rKnAng) };
  }
  else if (poseName === "tree") {
    const standing = bodyHeight(lm) > 0.36 && shY < hiY && hiY < anY;
    const oneKneeBent = Math.min(lKnAng, rKnAng) < 135;
    const oneAnkleHigh = Math.min(lAn.y, rAn.y) < hiY + 0.22;
    if (!standing || !oneKneeBent || !oneAnkleHigh) {
      setPoseDebug(poseName, 0, {}, "Lift one foot into Tree Pose; sitting/standing still will not count"); return 0;
    }
    const standingKnee = Math.max(lKnAng, rKnAng), bentKnee = Math.min(lKnAng, rKnAng);
    score = weighted([
      [targetScore(standingKnee, t.standingKneeIdeal, t.standingKneeTol), t.standingKneeW],
      [targetScore(bentKnee, t.bentKneeIdeal, t.bentKneeTol), t.bentKneeW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
      [(targetScore(angleAt(lHi, lSh, lWr), t.armRaiseIdeal, t.armRaiseTol) + targetScore(angleAt(rHi, rSh, rWr), t.armRaiseIdeal, t.armRaiseTol)) / 2, t.armRaiseW],
      [maxScore(Math.abs(lHi.x - rHi.x), t.hipSymCeiling, t.hipSymTol), t.hipSymW],
    ]);
  }
  else if (poseName === "warrior") {
    
    const ankleDist = dist2(lAn, rAn);
    const shoulderWidth = Math.max(dist2(lSh, rSh), 0.05);
    const stanceRatio = ankleDist / shoulderWidth;
    const bestKnee = Math.min(lKnAng, rKnAng);
    const worstKnee = Math.max(lKnAng, rKnAng);
    
    const armsExt = (lElAng + rElAng) / 2 > 110 && Math.min(lElAng, rElAng) > 75;
    const wideStanceOk = stanceRatio > 1.0;
    const frontBentOk = bestKnee >= 45 && bestKnee <= 165;
    const backStraightOk = worstKnee > 115;
   
    const passCount = [wideStanceOk, frontBentOk, backStraightOk, armsExt].filter(Boolean).length;
    if (passCount < 2) {
      setPoseDebug(poseName, 0, {}, "Use a wide lunge and extend both arms; sitting will not count"); return 0;
    }
    const frontKnee = bestKnee, backKnee = worstKnee;
    score = weighted([
      [targetScore(frontKnee, t.frontKneeIdeal, t.frontKneeTol), t.frontKneeW],
      [targetScore(backKnee, t.backKneeIdeal, t.backKneeTol), t.backKneeW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
      [(targetScore(angleAt(lHi, lSh, lWr), t.armHeightIdeal, t.armHeightTol) + targetScore(angleAt(rHi, rSh, rWr), t.armHeightIdeal, t.armHeightTol)) / 2, t.armHeightW],
      [minScore(stanceRatio, t.stanceIdeal, t.stanceTol), t.stanceW],
    ]);
  }
  else if (poseName === "trikonasana") {
    const ankleDist = Math.abs(lAn.x - rAn.x);
    const avgKnee = (lKnAng + rKnAng) / 2;
    const wristVerticalGap = Math.abs(lWr.y - rWr.y);
    const lowWristY = Math.max(lWr.y, rWr.y);
    const shoulderTilt = Math.abs(lSh.y - rSh.y);
    const torsoLean = Math.abs(shX - hiX);
    const fullStandingBody = bodyHeight(lm) > 0.34 && shY < hiY && hiY < knY && knY < anY;
    const wideBase = ankleDist >= 0.26;
    const armsOpen = dist2(lWr, rWr) >= 0.30;
    const oneHandDown = lowWristY >= hiY - 0.02;
    const triangleTilt = wristVerticalGap >= 0.11 || shoulderTilt >= 0.055 || torsoLean >= 0.075;
    if (!fullStandingBody || !wideBase || !armsOpen || !oneHandDown || !triangleTilt) {
      setPoseDebug(poseName, 0, {}, "Make a real Triangle: stand wide, extend arms, bend sideways with one hand down");
      return 0;
    }
    const armLineAvg = (lElAng + rElAng) / 2;
    const tiltMetric = Math.max(shoulderTilt, torsoLean, wristVerticalGap * 0.5);
    score = weighted([
      [minScore(ankleDist, t.stanceIdeal, t.stanceTol), t.stanceW],
      [targetScore(avgKnee, t.kneeIdeal, t.kneeTol), t.kneeW],
      [targetScore(armLineAvg, t.armLineIdeal, t.armLineTol), t.armLineW],
      [minScore(tiltMetric, t.tiltIdeal, t.tiltTol), t.tiltW],
      [minScore(lowWristY - hiY, t.reachIdeal, t.reachTol), t.reachW],
    ]);
  }
  else if (poseName === "balasana") {
    
    const hipHeelDist = dist2({ x: hiX, y: hiY }, { x: avg(lAn.x, rAn.x), y: anY });
    const hipsCloseToHeels = hipHeelDist < 0.40;
    const torsoFoldedDown = shY >= hiY - 0.06;
    const bodyCompact = bodyHeight(lm) < 0.42;
    const armsReachingForward = Math.max(dist2(lSh, lWr), dist2(rSh, rWr)) > 0.16;
    const passCount = [hipsCloseToHeels, torsoFoldedDown, bodyCompact, armsReachingForward].filter(Boolean).length;
    if (passCount < 2) {
      setPoseDebug(poseName, 0, {}, "Kneel, fold your torso forward, and stretch your arms out for Child's Pose");
      return 0;
    }
    const foldAngle = (angleAt(lSh, lHi, lKn) + angleAt(rSh, rHi, rKn)) / 2;
    const headLowGap = hiY - shY;
    const reach = (dist2(lSh, lWr) + dist2(rSh, rWr)) / 2;
    const symmetryGap = (Math.abs(lSh.y - rSh.y) + Math.abs(lHi.y - rHi.y)) / 2;
    score = weighted([
      [maxScore(hipHeelDist, t.hipHeelIdeal, t.hipHeelTol), t.hipHeelW],
      [targetScore(foldAngle, t.foldAngleIdeal, t.foldAngleTol), t.foldAngleW],
      [maxScore(headLowGap, t.headLowIdeal, t.headLowTol), t.headLowW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
      [minScore(reach, t.armReachIdeal, t.armReachTol), t.armReachW],
      [maxScore(symmetryGap, t.symmetryIdeal, t.symmetryTol), t.symmetryW],
    ]);
  }
  else if (poseName === "bhujangasana") {
    const horizontalBody = Math.abs(lAn.y - rAn.y) < 0.16;
    const chestLift = hiY - shY;
    const proneSpread = dist2(lSh, lAn) > 0.32 || dist2(rSh, rAn) > 0.32;
    if (!horizontalBody || chestLift < 0.06 || !proneSpread) {
      setPoseDebug(poseName, 0, {}, "Lie on stomach and lift chest; sitting upright will not count"); return 0;
    }
    score = weighted([
      [minScore(chestLift, t.chestLiftIdeal, t.chestLiftTol), t.chestLiftW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
      [maxScore(Math.abs(lSh.y - rSh.y), t.shoulderLevelCeiling, t.shoulderLevelTol), t.shoulderLevelW],
      [maxScore(Math.abs(lHi.y - rHi.y), t.hipLevelCeiling, t.hipLevelTol), t.hipLevelW],
    ]);
  }
  else if (poseName === "wall_plank_chaturanga") {
    const bodyLen = Math.max(dist2(lSh, lAn), dist2(rSh, rAn));
    const diagonal = Math.abs(shY - anY) > 0.06 && bodyLen > 0.30;
    const hipsOnLine = Math.min(lineDeviation(lSh, lHi, lAn), lineDeviation(rSh, rHi, rAn));
    if (!diagonal || hipsOnLine > 0.20) {
      setPoseDebug(poseName, 0, {}, "Step back into a long wall-plank line; sitting will not count");
      return 0;
    }
    score = weighted([
      [targetScore((angleAt(lSh, lHi, lAn) + angleAt(rSh, rHi, rAn)) / 2, t.bodyLineIdeal, t.bodyLineTol), t.bodyLineW],
      [(targetScore(lElAng, t.elbowIdeal, t.elbowTol) + targetScore(rElAng, t.elbowIdeal, t.elbowTol)) / 2, t.elbowW],
      [maxScore(Math.abs(lAn.x - rAn.x), t.feetCloseIdeal, t.feetCloseTol), t.feetCloseW],
      [minScore(bodyLen, t.reachIdeal, t.reachTol), t.reachW],
    ]);
  }
  else if (poseName === "padahastasana") {
    
    const legScale = Math.max(dist2(lHi, lAn), dist2(rHi, rAn));
    const standingBase = legScale > 0.24 && hiY < anY;
    const fold = shY - hiY;
    if (!standingBase || fold < -0.05 || nose.y < shY - 0.06) {
      setPoseDebug(poseName, 0, {}, "Stand and fold forward; sitting will not count"); return 0;
    }
    const foldAngle = (angleAt(lSh, lHi, lKn) + angleAt(rSh, rHi, rKn)) / 2;
    const handFoot = Math.min(dist2(lWr, lAn), dist2(rWr, rAn));
    score = weighted([
      [targetScore(foldAngle, t.foldIdeal, t.foldTol), t.foldW],
      [minScore(0.40 - handFoot, t.reachIdeal, t.reachTol), t.reachW],
      [nose.y > shY - 0.03 ? 1 : 0, t.headDownW],
      [(targetScore(lKnAng, t.kneeIdeal, t.kneeTol) + targetScore(rKnAng, t.kneeIdeal, t.kneeTol)) / 2, t.kneeW],
    ]);
  }
  else if (poseName === "paschimottanasana") {
    const seated = hiY > shY && Math.abs(lAn.y - rAn.y) < 0.16;
    const fold = shY - hiY;
    if (!seated || fold < -0.08) {
      setPoseDebug(poseName, 0, {}, "Sit with legs extended and fold forward");
      return 0;
    }
    const foldAngle = (angleAt(lSh, lHi, lKn) + angleAt(rSh, rHi, rKn)) / 2;
    const handFoot = Math.min(dist2(lWr, lAn), dist2(rWr, rAn));
    score = weighted([
      [targetScore(foldAngle, t.foldIdeal, t.foldTol), t.foldW],
      [minScore(0.46 - handFoot, t.reachIdeal, t.reachTol), t.reachW],
      [maxScore(Math.abs(lHi.y - rHi.y), t.seatedCeiling, t.seatedTol), t.seatedW],
      [nose.y > shY - 0.06 ? 1 : 0, t.headDownW],
    ]);
  }
  else if (poseName === "padmasana") {
    const seated = hiY > shY && bodyHeight(lm) < 0.52;
    const kneesWide = Math.abs(lKn.x - rKn.x) > Math.abs(lHi.x - rHi.x) * 1.4;
    if (!seated || !kneesWide) {
      setPoseDebug(poseName, 0, {}, "Cross legs into Lotus; normal sitting will not count");
      return 0;
    }
    score = weighted([
      [minScore(Math.abs(lKn.x - rKn.x), t.kneeSpreadIdeal, t.kneeSpreadTol), t.kneeSpreadW],
      [maxScore(shY - hiY, t.torsoCeiling, t.torsoTol), t.torsoW],
      [minScore(hiY - Math.min(lAn.y, rAn.y), t.ankleElevIdeal, t.ankleElevTol), t.ankleElevW],
    ]);
  }
  else if (poseName === "vajrasana") {
    const seated = hiY > shY;
    const kneesBelowHip = Math.max(lKn.y, rKn.y) > hiY + 0.06;
    if (!seated || !kneesBelowHip) {
      setPoseDebug(poseName, 0, {}, "Kneel and sit on heels for Vajrasana");
      return 0;
    }
    score = weighted([
      [minScore((lKn.y + rKn.y) / 2 - hiY, t.kneeFoldIdeal, t.kneeFoldTol), t.kneeFoldW],
      [maxScore(shY - hiY, t.torsoCeiling, t.torsoTol), t.torsoW],
      [maxScore(Math.abs(lKn.x - rKn.x), t.kneesCloseIdeal, t.kneesCloseTol), t.kneesCloseW],
    ]);
  }
  else if (poseName === "baddha_konasana") {
    const seated = hiY > shY;
    const kneesWide = Math.abs(lKn.x - rKn.x) > Math.abs(lHi.x - rHi.x) * 1.5;
    if (!seated || !kneesWide) {
      setPoseDebug(poseName, 0, {}, "Bring soles together and open knees like butterfly"); return 0;
    }
    score = weighted([
      [minScore(Math.abs(lKn.x - rKn.x), t.kneeSpreadIdeal, t.kneeSpreadTol), t.kneeSpreadW],
      [maxScore(dist2(lAn, rAn), t.feetCloseIdeal, t.feetCloseTol), t.feetCloseW],
      [maxScore(shY - hiY, t.torsoCeiling, t.torsoTol), t.torsoW],
    ]);
  }
  else if (poseName === "paschim_namaskarasana") {
    const standing = bodyHeight(lm) > 0.34 && shY < hiY && hiY < anY;
    const wristsBehind = lWr.y > shY && rWr.y > shY;
    if (!standing || !wristsBehind) {
      setPoseDebug(poseName, 0, {}, "Stand tall and join palms behind your back"); return 0;
    }
    score = weighted([
      [maxScore(dist2(lWr, rWr), t.handsCloseIdeal, t.handsCloseTol), t.handsCloseW],
      [1, t.wristsBehindW],
      [maxScore(Math.abs(lSh.y - rSh.y), t.shoulderLevelCeiling, t.shoulderLevelTol), t.shoulderLevelW],
      [maxScore(Math.abs(shX - hiX), t.torsoCeiling, t.torsoTol), t.torsoW],
    ]);
  }
  else if (poseName === "pranayama") {
    score = weighted([
      [maxScore(Math.abs(shX - hiX), t.torsoCeiling, t.torsoTol), t.torsoW],
      [maxScore(Math.abs(lSh.y - rSh.y), t.shoulderLevelCeiling, t.shoulderLevelTol), t.shoulderLevelW],
      [hiY > shY ? 1 : 0.4, t.stableSeatW],
    ]);
  }

  let finalAcc = Math.min(100, Math.round(score * 100));
  setPoseDebug(poseName, finalAcc, angles, finalAcc >= (window.getCurrentPoseThreshold ? window.getCurrentPoseThreshold() : 65) ? reason : "Below strict pose threshold");
  return finalAcc;
}
async function initMediaPipe() {
  for (let i = 0; i < 60; i++) {
    if (window.MediaPipeVision) break;
    await new Promise(r => setTimeout(r, 200));
  }

  if (!window.MediaPipeVision) 
    return null;
  const { PoseLandmarker, FilesetResolver } = window.MediaPipeVision;
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });
  } 
  catch (e) {
    console.warn("GPU pose model failed, retrying on CPU", e);
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.30,
      minPosePresenceConfidence: 0.30,
      minTrackingConfidence: 0.30,
    });
  }
}

window._poseUtils = { computeAccuracy, smoothLandmarks, angleAt, drawSkeleton }