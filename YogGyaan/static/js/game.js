const HOLD_POSE_NAMES = new Set(["tree", "padmasana", "baddha_konasana", "vajrasana", "tadasana", "balasana", "bhujangasana", "wall_plank_chaturanga", "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama", "warrior"]);
const BALANCED_REP_POSE_NAMES = new Set(["trikonasana"]);

let SESSION_LEVELS = [];

const BASE_REP_ACCURACY = 65;
const REP_HOLD_SECONDS = 4;
const REP_RESET_SECONDS = 1.5;
const SIDE_STABILITY_SECONDS = 1.0;
const SIDE_LOST_GRACE_SECONDS = 0.35;

const HOLD_MIN_ACCURACY = 65;
const STABILITY_WINDOW = 0.8;
const ACCURACY_JITTER_TOL = 8;

const LEVEL_MILESTONES = {
  tree: ["Grow Roots...", "Survive Gentle Wind...", "Birds Build Nests...", "Survive the Storm!"],
  warrior: ["Repair Village Gate...", "Rebuild Houses...", "Light the Watchtowers...", "Protect the Village!"],
  padmasana: ["Calm the Waters...", "Lotus Bud Appears...", "Lotus Blooms...", "Sacred Lotus Awakens!"],
  vajrasana: ["Summon Clouds...", "Call the Thunder...", "Open the Rain Gates...", "Healing Monsoon!"],
  baddha_konasana: ["Plant Wildflowers...", "Garden Blooms...", "Butterflies Return...", "Enchanted Sanctuary!"],
  tadasana: ["Calm the Mist...", "Restore the Cloud Path...", "Reach the Sky Gate...", "Awaken the Cloud Peak!"],
  trikonasana: ["Discover the Crystal Path...", "Restore the Prism Towers...", "Reignite the Rainbow Beams...", "Prism Valley Restored!"],
  balasana: ["Reconnect the Village...", "Restore the Trading Route...", "Unite the Settlements...", "Kingdom Alliance Restored!"],
  bhujangasana: ["Forgotten Ruins...", "Jungle Awakens...", "Sacred Life Returns...", "Temple Restored!"],
  wall_plank_chaturanga: ["Broken Gates...", "Bamboo Groves Return...", "Cherry Blossom Dojo...", "Grand Dojo Completed!"],
  padahastasana: ["Dry Trees...", "Autumn Stream...", "Forest Wildlife Returns...", "Golden Valley Restored!"],
  
  default: ["Level 1 Complete", "Level 2 Complete", "Level 3 Complete", "Level 4 Complete"],
};

let landmarker = null;
let webcamStream = null;
let animFrameId = null;
let phase = "tutorial";

let isHoldPose = false;
let isBalancedRepPose = false;
let selectedHoldReps = 3;
let completedHoldReps = 0;
let leftSideReps = 0;
let rightSideReps = 0;
let currentDetectedSide = "center";
let pendingSides = { left: false, right: false };
let sideJustCounted = false;
let sideSwitchState = "WAITING_FOR_LEFT";
let sideStableTime = 0;
let sideLastObserved = "none";
let sideLostTime = 0;
let sideSwitchFirstRawSide = null;
let totalCyclesCompleted = 0;
let totalCyclesSession = 0;
let totalLeftSidesCompleted = 0;
let totalRightSidesCompleted = 0;

let currentLevel = 1;
let totalElapsed = 0;
let sessionStart = 0;
let lastTick = 0;
let peakAccuracy = 0;
let currentAccuracy = 0;
let sessionActive = false;

let successfulReps = 0;
let repHoldTime = 0;
let repResetTime = 0;
let inPose = false;
let repJustCounted = false;
let repFlashTimer = 0;

let holdAccumTime = 0;
let totalHoldTime = 0;
let holdFlashTimer = 0;

let recentAccuracy = [];
let validationAccuracy = 0;
const VALIDATION_AVG_FRAMES = 7;
const DEBUG_POSE_MODE = new URLSearchParams(window.location.search).get("debugPose") === "1";
let debugOverlayEl = null;

const tutorialPhase = document.getElementById("tutorialPhase");
const practicePhase = document.getElementById("practicePhase");
const resultPhase = document.getElementById("resultPhase");

const videoEl = document.getElementById("webcamVideo");
const canvasEl = document.getElementById("poseCanvas");
const ctx = canvasEl ? canvasEl.getContext("2d") : null;

const accValueEl = document.getElementById("accValue");
const holdTimerDisplayEl = document.getElementById("holdTimerDisplay");
const xpDisplayEl = document.getElementById("xpDisplay");
const levelEl = document.getElementById("currentLevel");
const levelBarEl = document.getElementById("levelProgressBar");
const worldMilestoneEl = document.getElementById("worldMilestone");
const hintBarEl = document.getElementById("hintBar");
const timerEl = document.getElementById("timerDisplay");
const btnFinish = document.getElementById("btnFinish");
const levelupTextEl = document.getElementById("levelupText");

const repPanelEl = document.getElementById("repPanelWrap");
const repCountEl = document.getElementById("repCount");
const repTargetEl = document.getElementById("repTarget");
const repFlashEl = document.getElementById("repFlash");
const repHoldBarEl = document.getElementById("repHoldBar");
const repStatusEl = document.getElementById("repStatus");

const holdPanelEl = document.getElementById("holdPanelWrap");
const holdTimerEl = document.getElementById("holdTimerValue");
const holdTargetEl = document.getElementById("holdTargetValue");
const holdBarEl = document.getElementById("holdProgressBar");
const holdFlashEl = document.getElementById("holdFlash");

const resultXP = document.getElementById("resultXP");
const resultLevel = document.getElementById("resultLevel");
const resultAccuracy = document.getElementById("resultAccuracy");
const resultDuration = document.getElementById("resultDuration");
const resultReps = document.getElementById("resultReps");
const resultHoldWrap = document.getElementById("resultHoldWrap");
const resultHoldTime = document.getElementById("resultHoldTime");
const resultRepsWrap = document.getElementById("resultRepsWrap");
const leveledUpEl = document.getElementById("leveledUpNotice");
const badgesWrapEl = document.getElementById("newBadgesWrap");
const badgesListEl = document.getElementById("newBadgesList");
const masteryChangeEl = document.getElementById("masteryChange");
const stageChangeEl = document.getElementById("stageChange");
const improveBonusEl = document.getElementById("improveBonus");

function detectPoseSide(lm, poseName) {
  if (!lm || lm.length < 33) return "center";

  const lAn = lm[27], rAn = lm[28];
  const lWr = lm[15], rWr = lm[16];

  if (poseName === "trikonasana") {
    if (Math.abs(lWr.y - rWr.y) > 0.05) return lWr.y > rWr.y ? "left" : "right";
    return lAn.x < rAn.x ? "left" : "right";
  }


  return "center";
}

window.startPractice = async function () {
  tutorialPhase.style.display = "none";
  practicePhase.style.display = "block";
  if (btnFinish) btnFinish.style.display = "inline-flex";
  phase = "practice";

  isHoldPose = HOLD_POSE_NAMES.has(POSE_NAME);
  isBalancedRepPose = BALANCED_REP_POSE_NAMES.has(POSE_NAME);
  if (isHoldPose) {
    
    selectedHoldReps = (typeof window.__PRESELECTED_REP_TARGET__ === "number")
      ? window.__PRESELECTED_REP_TARGET__
      : 3;
  }

  if (repPanelEl) repPanelEl.style.display = isHoldPose ? "none" : "flex";
  if (holdPanelEl) holdPanelEl.style.display = isHoldPose ? "flex" : "none";

  if (window._yvShared && window._yvShared.landmarker) {
    landmarker = window._yvShared.landmarker;
    webcamStream = window._yvShared.stream;
    if (videoEl && webcamStream) {
      videoEl.srcObject = webcamStream;
      try { await videoEl.play(); } catch (_) { }
    }
  } else {
    landmarker = await initMediaPipe();
    await startWebcam();
  }

  if (typeof window.resetLandmarkSmoother === "function") window.resetLandmarkSmoother();

  const gwCanvas = document.getElementById("gameWorldCanvas");
  if (gwCanvas && typeof window.initGameWorld === "function") {
    window.initGameWorld(gwCanvas, POSE_NAME);
  }

  beginSession();
};

if (btnFinish) {
  btnFinish.addEventListener("click", () => {
    if (phase === "practice") {
      finishSession();
    } else if (phase === "tutorial") {
      if (typeof window.endTutorial === "function") window.endTutorial();
      window.location = "/dashboard";
    }
  });
}

async function startWebcam() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    if (!videoEl) return;
    videoEl.srcObject = webcamStream;
    await new Promise((res) => { videoEl.onloadeddata = res; });
    await videoEl.play();
  } catch {
    if (hintBarEl) {
      hintBarEl.textContent = "Webcam access denied. Please allow camera access and reload.";
      hintBarEl.className = "hint-bar hint-bar-warn";
    }
  }
}

function stopWebcam() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (typeof window.stopGameWorld === "function") window.stopGameWorld();
  if (webcamStream) webcamStream.getTracks().forEach((t) => t.stop());
}

function getCurrentLevelConfig() {
  const cfg = SESSION_LEVELS[currentLevel - 1] || (isHoldPose
    ? { hold_seconds: 10, min_accuracy: HOLD_MIN_ACCURACY }
    : { reps: 3, min_accuracy: BASE_REP_ACCURACY });

  const merged = { ...cfg, min_accuracy: Math.max(65, getConstantCycleThreshold()) };
  if (!isHoldPose && typeof window.__PRESELECTED_REP_TARGET__ === "number") {
    merged.reps = window.__PRESELECTED_REP_TARGET__;
  }
  return merged;
}

function getConstantCycleThreshold() {
  const first = SESSION_LEVELS[0] || {};
  return Math.max(65, first.min_accuracy || (isHoldPose ? HOLD_MIN_ACCURACY : BASE_REP_ACCURACY));
}

window.getCurrentPoseThreshold = function () {
  return getConstantCycleThreshold();
};

function beginSession() {
  sessionActive = true;
  sessionStart = Date.now();
  lastTick = Date.now();
  currentLevel = 1;
  totalElapsed = 0;
  peakAccuracy = 0;
  validationAccuracy = 0;
  recentAccuracy = [];

  successfulReps = 0;
  completedHoldReps = 0;
  leftSideReps = 0;
  rightSideReps = 0;
  pendingSides = { left: false, right: false };
  sideJustCounted = false;
  sideSwitchState = "WAITING_FOR_LEFT";
  sideStableTime = 0;
  sideLastObserved = "none";
  sideLostTime = 0;
  totalCyclesCompleted = 0;
  totalCyclesSession = 0;
  totalLeftSidesCompleted = 0;
  totalRightSidesCompleted = 0;
  currentDetectedSide = "center";
  repHoldTime = 0;
  repResetTime = 0;
  inPose = false;
  repJustCounted = false;
  repFlashTimer = 0;

  holdAccumTime = 0;
  totalHoldTime = 0;
  holdFlashTimer = 0;

  renderLevel();
  if (isHoldPose) updateHoldUI(); else updateRepUI();
  detect();
}

function detect() {
  if (!sessionActive) return;
  const now = performance.now();
  if (videoEl && videoEl.readyState >= 2 && landmarker && canvasEl && ctx) {
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasEl.width, 0);
    ctx.drawImage(videoEl, 0, 0);
    ctx.restore();

    const result = landmarker.detectForVideo(videoEl, now);
    if (result.landmarks.length > 0) {
      const rawLm = result.landmarks[0];
      const smoothedLm = (window._poseUtils && window._poseUtils.smoothLandmarks)
        ? window._poseUtils.smoothLandmarks(rawLm)
        : rawLm;

      drawSkeleton(ctx, smoothedLm, canvasEl.width, canvasEl.height);
      currentAccuracy = computeAccuracy(smoothedLm, POSE_NAME);
      validationAccuracy = getRollingAccuracy(currentAccuracy);
      currentDetectedSide = detectPoseSide(smoothedLm, POSE_NAME);
    } else {
      currentAccuracy = 0;
      validationAccuracy = getRollingAccuracy(0);
    }

    if (isStableAccuracy(validationAccuracy) && validationAccuracy > peakAccuracy) {
      peakAccuracy = validationAccuracy;
    }
    updateAccuracyUI(validationAccuracy);
    updateDebugOverlay(validationAccuracy);
    tickTimer(validationAccuracy);
  }
  animFrameId = requestAnimationFrame(detect);
}

function isStableAccuracy(acc) {
  if (recentAccuracy.length < 3) return false;
  const mn = Math.min(...recentAccuracy);
  const mx = Math.max(...recentAccuracy);
  return (mx - mn) <= ACCURACY_JITTER_TOL;
}


function getRollingAccuracy(acc) {
  recentAccuracy.push(acc);
  if (recentAccuracy.length > VALIDATION_AVG_FRAMES) recentAccuracy.shift();
  const sum = recentAccuracy.reduce((a, b) => a + b, 0);
  return Math.round(sum / recentAccuracy.length);
}

function ensureDebugOverlay() {
  if (!DEBUG_POSE_MODE) return null;
  if (debugOverlayEl) return debugOverlayEl;
  debugOverlayEl = document.createElement("div");
  debugOverlayEl.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99999;background:rgba(0,0,0,.76);color:#d8fbd8;padding:10px 12px;border:1px solid rgba(120,255,160,.35);border-radius:12px;font:12px/1.45 monospace;max-width:320px;white-space:pre-wrap;pointer-events:none";
  document.body.appendChild(debugOverlayEl);
  return debugOverlayEl;
}

function updateDebugOverlay(acc) {
  const el = ensureDebugOverlay();
  if (!el) return;
  const info = (window.getPoseDebugInfo && window.getPoseDebugInfo()) || {};
  const angles = info.angles ? Object.entries(info.angles).map(([k, v]) => `${k}: ${v}`).join("\\n") : "";
  el.textContent =
    `POSE DEBUG\\nPose: ${POSE_NAME}\\nAccuracy: ${acc}%\\nThreshold: ${getConstantCycleThreshold()}%\\nValid: ${acc >= getConstantCycleThreshold()}\\nReason: ${info.reason || ""}\\n${angles}`;
}

function tickTimer(accuracy) {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  totalElapsed = (now - sessionStart) / 1000;

  if (timerEl) timerEl.textContent = `${Math.round(totalElapsed)}s`;

  if (isHoldPose) {
    tickHoldMode(accuracy, dt);
  } else {
    tickRepMode(accuracy, dt);
  }

  updateXPEstimate(accuracy, totalElapsed, currentLevel,
    successfulReps, isHoldPose ? totalHoldTime : 0);

  const pct = isHoldPose ? getHoldLevelPct() : getRepLevelPct();
  if (typeof window.updateGameWorld === "function") {
    window.updateGameWorld(currentLevel, pct / 100, accuracy);
  }
  if (totalElapsed > 300) { finishSession(); return; }
}

function tickHoldMode(accuracy, dt) {
  const lvlCfg = getCurrentLevelConfig();
  const targetHold = lvlCfg.hold_seconds || 10;
  const minAcc = lvlCfg.min_accuracy || HOLD_MIN_ACCURACY;
  const holding = accuracy >= minAcc;

  if (holding) {
    holdAccumTime += dt;
    totalHoldTime += dt;
  }

  if (holdFlashTimer > 0) {
    holdFlashTimer -= dt;
    if (holdFlashTimer <= 0 && holdFlashEl) holdFlashEl.style.opacity = "0";
  }

  const holdPct = Math.min(100, (holdAccumTime / targetHold) * 100);
  if (holdBarEl) holdBarEl.style.width = holdPct + "%";
  if (levelBarEl) {
    const repBase = completedHoldReps / selectedHoldReps;
    const levelPart = ((currentLevel - 1) + holdPct / 100) / 4;
    levelBarEl.style.width = Math.min(100, (repBase + levelPart / selectedHoldReps) * 100) + "%";
  }

  if (holdTimerEl) 
    holdTimerEl.textContent = Math.round(holdAccumTime) + "s";
  if (holdTargetEl) 
    holdTargetEl.textContent = targetHold + "s";

  updateHoldHint(accuracy, holding, holdPct, minAcc);

  if (holdAccumTime >= targetHold) {
    holdAccumTime = 0;
    if (currentLevel < 4) {
      currentLevel++;
      renderLevel();
      showLevelUp();
      triggerHoldFlash("Level Up!");
      updateHoldUI();
      playAudio("/static/audio/levelup.mp3");
    } else {
      completedHoldReps++;
      successfulReps = completedHoldReps;
      triggerHoldFlash("Rep " + completedHoldReps + " Complete!");
      playAudio("/static/audio/success.mp3");
      if (completedHoldReps >= selectedHoldReps) {
        finishSession();
        return;
      }
      currentLevel = 1;
      renderLevel();
      updateHoldUI();
    }
  }
}

function getHoldLevelPct() {
  const lvlCfg = getCurrentLevelConfig();
  const target = lvlCfg.hold_seconds || 10;
  return Math.min(100, (holdAccumTime / target) * 100);
}

function triggerHoldFlash(msg) {
  if (!holdFlashEl) return;
  holdFlashEl.textContent = msg;
  holdFlashEl.style.opacity = "1";
  holdFlashEl.style.animation = "none";
  requestAnimationFrame(() => {
    holdFlashEl.style.animation = "levelPop 0.5s ease forwards";
  });
  holdFlashTimer = 1.5;
}

function updateHoldUI() {
  const lvlCfg = getCurrentLevelConfig();
  const target = lvlCfg.hold_seconds || 10;
  if (holdTargetEl) holdTargetEl.textContent = target + "s";
  if (holdTimerEl) holdTimerEl.textContent = "0s";
  const label = document.querySelector("#holdPanelWrap .hold-mode-badge");
  if (label) label.textContent = `Rep ${completedHoldReps + 1}/${selectedHoldReps}`;
}

function updateHoldHint(acc, holding, holdPct, minAcc) {
  if (!hintBarEl) return;
  if (acc >= minAcc && holding) {
    hintBarEl.className = "hint-bar hint-bar-good";
    hintBarEl.textContent = holdPct < 95
      ? `Holding beautifully... ${Math.round(holdPct)}%`
      : "Almost there - keep breathing!";
  } else if (acc >= minAcc * 0.7) {
    hintBarEl.className = "hint-bar hint-bar-ok";
    hintBarEl.textContent = `Improve form to ${minAcc}% accuracy to count hold time.`;
  } else {
    hintBarEl.className = "hint-bar hint-bar-warn";
    hintBarEl.textContent = "Adjust your position and settle into the pose.";
  }
}


function resetSideStability() {
  sideStableTime = 0;
  sideLastObserved = "none";
  sideLostTime = 0;
  if (repHoldBarEl) repHoldBarEl.style.width = "0%";
}

function completeSideSwitchLevel(targetCycles) {
  if (totalCyclesCompleted >= targetCycles) {
    if (currentLevel < 4) {
      currentLevel++;

      totalCyclesCompleted = 0;
      successfulReps = 0;
      pendingSides = { left: false, right: false };
      sideSwitchState = "WAITING_FOR_LEFT";
      sideSwitchFirstRawSide = null;
      resetSideStability();
      renderLevel();
      showLevelUp();
      updateRepUI();
    } else {
      finishSession();
      return true;
    }
  }
  return false;
}

function tickSideSwitchMode(accuracy, dt) {
  const lvlCfg = getCurrentLevelConfig();
  const minAcc = lvlCfg.min_accuracy || BASE_REP_ACCURACY;
  const targetCycles = lvlCfg.reps || 3;
  const aboveThreshold = accuracy >= minAcc;
  const rawSide = aboveThreshold ? currentDetectedSide : "none";


  let observedSide = rawSide;
  let expectedRawSide = null;

  if (sideSwitchState === "WAITING_FOR_LEFT") {
    expectedRawSide = rawSide !== "none" ? rawSide : null;
  } else {
    expectedRawSide = sideSwitchFirstRawSide === "left" ? "right" : "left";
  }

  const matchesExpected = aboveThreshold && rawSide !== "none" && expectedRawSide && rawSide === expectedRawSide;

  if (matchesExpected) {
    if (sideLastObserved === rawSide) {
      sideStableTime += dt;
    } else {
      sideLastObserved = rawSide;
      sideStableTime = dt;
    }
    sideLostTime = 0;
  } else {
    sideLostTime += dt;
    if (sideLostTime >= SIDE_LOST_GRACE_SECONDS) {
      sideStableTime = 0;
      sideLastObserved = rawSide;
    }
  }

  const stablePct = Math.min(100, (sideStableTime / SIDE_STABILITY_SECONDS) * 100);
  if (repHoldBarEl) repHoldBarEl.style.width = stablePct + "%";

  if (matchesExpected && sideStableTime >= SIDE_STABILITY_SECONDS) {
    if (sideSwitchState === "WAITING_FOR_LEFT") {
      sideSwitchFirstRawSide = rawSide;
      pendingSides.left = true;
      leftSideReps = totalLeftSidesCompleted + 1;
      totalLeftSidesCompleted++;
      sideSwitchState = "WAITING_FOR_RIGHT";
      triggerRepFlash("Left Side ✓ Now switch to opposite side");
      resetSideStability();

      sideSwitchFirstRawSide = rawSide;
      updateRepUI();
      playAudio("/static/audio/levelup.mp3");
    } else {
      pendingSides.right = true;
      rightSideReps = totalRightSidesCompleted + 1;
      totalRightSidesCompleted++;

      totalCyclesCompleted++;
      totalCyclesSession++;
      successfulReps = totalCyclesCompleted;
      pendingSides = { left: false, right: false };
      sideSwitchState = "WAITING_FOR_LEFT";
      sideSwitchFirstRawSide = null;
      triggerRepFlash("+1 Cycle Complete!");
      resetSideStability();
      updateRepUI();
      playAudio("/static/audio/success.mp3");

      if (completeSideSwitchLevel(targetCycles)) return;
    }
  }

  const levelPct = Math.min(100, (totalCyclesCompleted / targetCycles) * 100);
  if (levelBarEl) levelBarEl.style.width = levelPct + "%";

  updateSideSwitchHint(accuracy, rawSide, sideSwitchState, stablePct, minAcc);
}

function updateSideSwitchHint(acc, observedSide, state, stablePct, minAcc) {
  if (!hintBarEl) return;

  if (state === "WAITING_FOR_LEFT") {
    if (acc >= minAcc && observedSide !== "none") {
      hintBarEl.className = "hint-bar hint-bar-good";
      hintBarEl.textContent = `Hold first side steady... ${Math.round(stablePct)}%`;
    } else if (acc >= 30) {
      hintBarEl.className = "hint-bar hint-bar-ok";
      hintBarEl.textContent = `Reach ${minAcc}% accuracy and hold the first side.`;
    } else {
      hintBarEl.className = "hint-bar hint-bar-warn";
      hintBarEl.textContent = "Adjust posture. Waiting for first side.";
    }
    return;
  }

  const oppositeRaw = sideSwitchFirstRawSide === "left" ? "right" : "left";
  if (acc >= minAcc && observedSide === oppositeRaw) {
    hintBarEl.className = "hint-bar hint-bar-good";
    hintBarEl.textContent = `Opposite side detected. Hold steady... ${Math.round(stablePct)}%`;
  } else if (acc >= minAcc && observedSide !== "none") {
    hintBarEl.className = "hint-bar hint-bar-ok";
    hintBarEl.textContent = "Good pose, now switch to the opposite side to complete the cycle.";
  } else if (acc >= 30) {
    hintBarEl.className = "hint-bar hint-bar-ok";
    hintBarEl.textContent = `Reach ${minAcc}% accuracy on the opposite side.`;
  } else {
    hintBarEl.className = "hint-bar hint-bar-warn";
    hintBarEl.textContent = "Adjust posture. Waiting for opposite side.";
  }
}

function tickRepMode(accuracy, dt) {
  if (isBalancedRepPose) {
    tickSideSwitchMode(accuracy, dt);
    return;
  }
  const lvlCfg = getCurrentLevelConfig();
  const minAcc = lvlCfg.min_accuracy || BASE_REP_ACCURACY;
  const targetReps = lvlCfg.reps || 3;
  const aboveThreshold = accuracy >= minAcc;

  if (aboveThreshold && !repJustCounted) {
    repHoldTime += dt;
    repResetTime = 0;
    inPose = true;

    if (repHoldTime >= REP_HOLD_SECONDS) {
      if (isBalancedRepPose) {
        const side = currentDetectedSide === "right" ? "right" : "left";
        if (!pendingSides[side]) {
          pendingSides[side] = true;
          if (side === "left") leftSideReps++; else rightSideReps++;
          triggerRepFlash(side === "left" ? "Left Side ✓" : "Right Side ✓");
        }
        if (pendingSides.left && pendingSides.right) {
          successfulReps++;
          pendingSides = { left: false, right: false };
          triggerRepFlash("+1 Balanced Rep!");
        }
      } else {
        successfulReps++;
        triggerRepFlash("+1 Rep!");
      }

      repJustCounted = true;
      repHoldTime = 0;
      updateRepUI();
      playAudio("/static/audio/levelup.mp3");

      if (successfulReps >= targetReps) {
        if (currentLevel < 4) {
          successfulReps = 0;
          pendingSides = { left: false, right: false };
          currentLevel++;
          renderLevel();
          showLevelUp();
          updateRepUI();
        } else {
          finishSession();
          return;
        }
      }
    }
  } else if (repJustCounted) {
    if (!aboveThreshold || accuracy < minAcc * 0.7) {
      repResetTime += dt;
      inPose = false;
      if (repResetTime >= REP_RESET_SECONDS) {
        repJustCounted = false;
        repHoldTime = 0;
        repResetTime = 0;
      }
    }
  } else {
    if (!aboveThreshold) {
      repHoldTime = Math.max(0, repHoldTime - dt * 0.5);
      inPose = false;
    }
  }

  if (repFlashTimer > 0) {
    repFlashTimer -= dt;
    if (repFlashTimer <= 0 && repFlashEl) repFlashEl.style.opacity = "0";
  }

  const holdPct = Math.min(100, (repHoldTime / REP_HOLD_SECONDS) * 100);
  if (repHoldBarEl) repHoldBarEl.style.width = holdPct + "%";

  const levelPct = Math.min(100, (successfulReps / targetReps) * 100);
  if (levelBarEl) levelBarEl.style.width = levelPct + "%";

  updateRepHint(accuracy, repJustCounted, holdPct, minAcc);
}

function getRepLevelPct() {
  const lvlCfg = getCurrentLevelConfig();
  const target = lvlCfg.reps || 3;
  return Math.min(100, (successfulReps / target) * 100);
}

function triggerRepFlash(msg = "+1 Rep!") {
  if (!repFlashEl) return;
  repFlashEl.textContent = msg;
  repFlashEl.style.opacity = "1";
  repFlashEl.style.animation = "none";
  requestAnimationFrame(() => {
    repFlashEl.style.animation = "levelPop 0.5s ease forwards";
  });
  repFlashTimer = 1.5;
}

function updateRepUI() {
  const lvlCfg = getCurrentLevelConfig();
  const target = lvlCfg.reps || 3;

  if (isBalancedRepPose) {
    if (repCountEl) repCountEl.textContent = totalCyclesCompleted;
    if (repTargetEl) repTargetEl.textContent = target;
  } else {
    if (repCountEl) repCountEl.textContent = successfulReps;
    if (repTargetEl) repTargetEl.textContent = target;
  }

  const sub = document.getElementById("repStatusSub");
  if (sub && isBalancedRepPose) {
    const need = sideSwitchState === "WAITING_FOR_RIGHT" ? "Right Side" : "Left Side";
    sub.textContent = `Cycles: ${totalCyclesCompleted}/${target} | Left: ${totalLeftSidesCompleted} | Right: ${totalRightSidesCompleted} | Next: ${need}`;
  }
}

function updateRepHint(acc, justCounted, holdPct, minAcc) {
  if (!hintBarEl) return;
  if (justCounted) {
    hintBarEl.className = "hint-bar hint-bar-ok";
    hintBarEl.textContent = isBalancedRepPose ? "Side counted! Step out, then perform the opposite side to complete the rep." : "Rep counted! Step out of pose, then re-enter for the next rep.";
  } else if (acc >= minAcc) {
    hintBarEl.className = "hint-bar hint-bar-good";
    hintBarEl.textContent = holdPct < 100
      ? `Hold steady... ${Math.round(holdPct)}% - keep it up!`
      : "Great form! Hold for a moment to lock in the rep.";
  } else if (acc >= 30) {
    hintBarEl.className = "hint-bar hint-bar-ok";
    hintBarEl.textContent = `Good - reach ${minAcc}% accuracy to count a rep.`;
  } else {
    hintBarEl.className = "hint-bar hint-bar-warn";
    hintBarEl.textContent = "Adjust your position to begin counting reps.";
  }
}

function updateAccuracyUI(acc) {
  if (!accValueEl) return;
  accValueEl.textContent = `${acc}%`;
  accValueEl.style.color = acc >= 70 ? "var(--green)" : acc >= 40 ? "var(--gold)" : "var(--red)";
}

function updateXPEstimate(accuracy, duration, level, reps, holdSecs) {
  if (!xpDisplayEl) return;
  const base = 50 * (1.0 + accuracy / 200) * (1.0 + (level - 1) * 0.3) * (1.0 + Math.min(reps, 10) * 0.03);
  const est = Math.max(10, Math.round(base) + reps * 10 + Math.min(30, Math.round(holdSecs * 0.2)));
  xpDisplayEl.textContent = `+${est}`;
}

function renderLevel() {
  if (levelEl) levelEl.textContent = currentLevel;

  [1, 2, 3, 4].forEach((l) => {
    const pip = document.getElementById(`wpip${l}`);
    if (!pip) return;
    pip.className = l < currentLevel ? "world-pip done" : l === currentLevel ? "world-pip active" : "world-pip locked";
  });

  const milestones = LEVEL_MILESTONES[POSE_NAME] || LEVEL_MILESTONES.default;
  if (worldMilestoneEl) worldMilestoneEl.textContent = milestones[currentLevel - 1] || "";

  const lvlCfg = SESSION_LEVELS[currentLevel - 1] || {};
  if (holdTimerDisplayEl) holdTimerDisplayEl.textContent = lvlCfg.name || `Level ${currentLevel}`;

  [1, 2, 3, 4].forEach((l) => {
    const goal = document.getElementById(`goalCard${l}`);
    if (goal) goal.className = l < currentLevel ? "done" : l === currentLevel ? "current" : "locked";
  });

  const tag = document.getElementById("levelNameTag");
  if (tag) {
    const cfg = SESSION_LEVELS[currentLevel - 1] || {};
    const desc = isHoldPose ? (cfg.description || "") : (cfg.description || "");
    tag.textContent = cfg.name ? `${cfg.name} - ${desc}` : "";
  }
}

function showLevelUp() {
  if (!levelupTextEl) return;
  levelupTextEl.textContent = `Level ${currentLevel}!`;
  levelupTextEl.style.display = "block";
  levelupTextEl.style.animation = "none";
  requestAnimationFrame(() => {
    levelupTextEl.style.animation = "levelPop 0.5s ease forwards";
  });
  setTimeout(() => { levelupTextEl.style.display = "none"; }, 1800);
  playAudio("/static/audio/levelup.mp3");
}

async function finishSession() {
  if (!sessionActive) return;
  sessionActive = false;
  stopWebcam();

  const duration = Math.max(1, Math.round(totalElapsed));
  const holdDuration = Math.round(totalHoldTime);

  try {
    const resp = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pose_name: POSE_NAME,
        accuracy: peakAccuracy,
        duration_seconds: duration,
        levels_completed: currentLevel,
        successful_reps: isBalancedRepPose ? totalCyclesSession : successfulReps,
        hold_duration: isHoldPose ? holdDuration : 0,
        left_reps: isBalancedRepPose ? totalLeftSidesCompleted : leftSideReps,
        right_reps: isBalancedRepPose ? totalRightSidesCompleted : rightSideReps,
        best_accuracy: peakAccuracy,
        is_hold_pose: isHoldPose,
      }),
    });
    showResult(await resp.json(), peakAccuracy, duration, holdDuration);
  } catch {
    showResult(
      { xp_gained: 0, new_level: 1, leveled_up: false, new_badges: [] },
      peakAccuracy, duration, holdDuration
    );
  }
}

function showResult(data, accuracy, duration, holdDuration) {
  if (practicePhase) practicePhase.style.display = "none";
  if (resultPhase) resultPhase.style.display = "flex";
  phase = "result";

  if (resultXP) resultXP.textContent = `+${data.xp_gained ?? 0}`;
  if (resultLevel) resultLevel.textContent = `L${currentLevel}`;
  if (resultAccuracy) resultAccuracy.textContent = `${Math.round(accuracy)}%`;
  if (resultDuration) resultDuration.textContent = `${duration}s`;

  if (isHoldPose) {
    if (resultRepsWrap) resultRepsWrap.style.display = "flex";
    if (resultReps) resultReps.textContent = successfulReps;
    if (resultHoldWrap) resultHoldWrap.style.display = "flex";
    if (resultHoldTime) resultHoldTime.textContent = `${holdDuration}s`;
  } else {
    if (resultHoldWrap) resultHoldWrap.style.display = "none";
    if (resultRepsWrap) resultRepsWrap.style.display = "flex";
    if (resultReps) resultReps.textContent = isBalancedRepPose ? totalCyclesSession : successfulReps;
  }

  if (data.leveled_up && leveledUpEl) {
    leveledUpEl.style.display = "flex";
    playAudio("/static/audio/success.mp3");
  }

  if (data.improve_bonus > 0 && improveBonusEl) {
    improveBonusEl.style.display = "flex";
    improveBonusEl.textContent = `+${data.improve_bonus} XP improvement bonus!`;
  }

  if (data.mastery_changed && masteryChangeEl) {
    masteryChangeEl.style.display = "flex";
    masteryChangeEl.textContent = `New mastery: ${data.mastery_level}!`;
  }

  if (data.stage_changed && stageChangeEl && data.restoration_stage) {
    stageChangeEl.style.display = "flex";
    stageChangeEl.textContent = `Region restored to: ${data.restoration_stage}!`;
  }

  if (data.new_badges && data.new_badges.length > 0 && badgesWrapEl) {
    badgesWrapEl.style.display = "block";
    if (badgesListEl) {
      badgesListEl.innerHTML = data.new_badges
        .map((b) => `<span class="badge badge-gold">${b.name}</span>`)
        .join("");
    }
    playAudio("/static/audio/reward.mp3");
  }
}

document.addEventListener("DOMContentLoaded", () => { });
(function patchSessionLevels() {
  const tryPatch = () => {
    const el = document.getElementById("gameData");
    if (!el) { setTimeout(tryPatch, 100); return; }
    try {
      const levelsRaw = el.getAttribute("data-levels");
      if (levelsRaw) {
        const levels = JSON.parse(levelsRaw);
        if (levels.session_levels && levels.session_levels.length) {
          SESSION_LEVELS = levels.session_levels;
        }
      }
    } catch (_) { }
  };
  tryPatch();
}());

function playAudio(src) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => { });
  } catch { }
}
