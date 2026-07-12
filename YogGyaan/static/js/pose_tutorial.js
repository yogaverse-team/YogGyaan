(function () {
  "use strict";

  const TRAIN_HOLD_REQUIRED = 2.2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 27;

  const POSE = (typeof POSE_NAME !== "undefined" && POSE_NAME) ? POSE_NAME : "unknown_pose";
  const POSE_LABEL = (typeof POSE_CONFIG !== "undefined" && POSE_CONFIG.name) ? POSE_CONFIG.name : POSE;

  const tutVideoEl = document.getElementById("tutorialVideo");
  const tutCanvasEl = document.getElementById("tutorialCanvas");
  const tutCtx = tutCanvasEl ? tutCanvasEl.getContext("2d") : null;
  const tutStatusEl = document.getElementById("tutorialStatus");
  const stepNumberEl = document.getElementById("stepNumber");
  const stepTitleEl = document.getElementById("stepTitle");
  const stepInstEl = document.getElementById("stepInstruction");
  const btnSkip = document.getElementById("btnSkipStep");
  const validateRing = document.getElementById("validateRingCircle");
  const validateLabel = document.getElementById("validateLabel");
  const dotsEl = document.getElementById("stepDots");
  const tutorialCard = document.querySelector(".tutorial-card");
  const dummyGuideCard = document.getElementById("dummyGuideCard");
  const dummyGuideTitle = document.getElementById("dummyGuideTitle");
  const dummyGuideText = document.getElementById("dummyGuideText");
  const dummyStage = document.getElementById("dummyStage");

  const guideSteps = (window.POSE_CONFIG && Array.isArray(window.POSE_CONFIG.accuracy_guide_steps))
    ? window.POSE_CONFIG.accuracy_guide_steps
    : ((window.POSE_CONFIG && Array.isArray(window.POSE_CONFIG.tutorial_steps)) ? window.POSE_CONFIG.tutorial_steps : []);

  const stepText = (idx, fallback) => guideSteps[idx] || fallback;

  const missions = {
    tadasana: {
      title: "Tadasana (Mountain Pose) - Step Missions",
      intro: "Stand tall with feet grounded, spine long, core engaged, and arms reaching up only after each earlier mission is validated.",
      reward: "+20 Training XP • Mountain Badge",
      steps: [
        { title: "Mission 1: Stand Tall", instruction: "Stand tall with both feet together/hip-width apart and arms relaxed at your sides.", xp: 4, check: checkFullBody },
        { title: "Mission 2: Straighten Spine", instruction: "Lengthen your spine upward and relax your shoulders down and back.", xp: 5, check: checkTadasanaAlignment },
        { title: "Mission 3: Engage Core", instruction: "Keep your body steady, tighten your core gently, and breathe normally.", xp: 5, check: checkStableStanding },
        { title: "Mission 4: Raise Arms", instruction: "Raise both arms overhead and reach up while keeping your body tall and balanced.", xp: 6, check: checkGenericReady },
      ],
    },
    tree: {
      title: "Vrikshasana (Tree Pose) - Step Missions",
      intro: "First build a steady Tadasana base, then shift weight, place the opposite foot, and finally join palms overhead.",
      reward: "+20 Training XP • Tree Badge",
      steps: [
        { title: "Mission 1: Stand Steady", instruction: "Stand in Tadasana with both feet grounded and body centered.", xp: 4, check: checkTadasanaAlignment },
        { title: "Mission 2: Shift Weight", instruction: "Shift your weight onto one standing leg without wobbling.", xp: 5, check: checkStableStanding },
        { title: "Mission 3: Place Foot", instruction: "Place the opposite foot on the inner calf or thigh - never on the knee.", xp: 5, check: checkTreeFootLift },
        { title: "Mission 4: Join Palms", instruction: "Join palms overhead and hold balance with a fixed gaze.", xp: 6, check: checkTreeBalance },
      ],
    },
    warrior: {
      title: "Virabhadrasana (Warrior Pose) - Step Missions",
      intro: "Create a strong wide stance, step one foot back, bend the front knee, then extend both arms sideways.",
      reward: "+20 Training XP • Warrior Badge",
      steps: [
        { title: "Mission 1: Wide Stance", instruction: "Take a wide stance with both feet firmly on the ground.", xp: 4, check: checkGenericReady },
        { title: "Mission 2: Step Back", instruction: "Step one foot back and turn your body into a stable lunge base.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Bend Front Knee", instruction: "Bend the front knee while keeping the back leg long and strong.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Extend Arms", instruction: "Extend both arms sideways at shoulder height and look forward.", xp: 6, check: checkGenericReady },
      ],
    },
    trikonasana: {
      title: "Trikonasana (Triangle Pose) - Step Missions",
      intro: "Learn Triangle Pose step by step: wide legs, arms sideways, bend to one side, then keep the other arm lifted.",
      reward: "+20 Training XP • Triangle Badge",
      steps: [
        { title: "Mission 1: Wide Legs", instruction: "Stand with your feet wide apart and keep both legs straight.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Extend Arms", instruction: "Stretch both arms sideways at shoulder height.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Bend Sideways", instruction: "Reach one hand down toward your shin or ankle without collapsing forward.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Keep Arm Up", instruction: "Lift the opposite arm up and keep chest open in the triangle shape.", xp: 5, check: checkGenericReady },
      ],
    },
    padmasana: {
      title: "Padmasana (Lotus Pose) - Step Missions",
      intro: "Build Lotus Pose slowly: sit on the floor, cross one foot, cross the other foot, place hands on knees, then sit tall and breathe.",
      reward: "+25 Training XP • Lotus Badge",
      steps: [
        { title: "Mission 1: Sit On Floor", instruction: "Sit on the floor with your spine tall and legs relaxed in front.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Cross One Foot", instruction: "Place one foot gently toward the opposite thigh. Do not force the knee.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Cross Other Foot", instruction: "Place the other foot on top/toward the opposite thigh to form Lotus.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Hands On Knees", instruction: "Rest both hands on your knees and keep shoulders relaxed.", xp: 5, check: checkGenericReady },
        { title: "Mission 5: Sit Tall & Breathe", instruction: "Hold the final Lotus shape, spine upright, calm breathing.", xp: 5, check: checkGenericReady },
      ],
    },
    vajrasana: {
      title: "Vajrasana (Thunderbolt Pose) - Step Missions",
      intro: "Learn Vajrasana step by step: kneel, sit on heels, straighten the spine, then hold and breathe.",
      reward: "+20 Training XP • Thunderbolt Badge",
      steps: [
        { title: "Mission 1: Kneel On Floor", instruction: "Kneel on the floor with knees close and shins down.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Sit On Heels", instruction: "Lower your hips back and sit on your heels.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Spine Upright", instruction: "Lift your chest and keep your spine straight.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Hold & Breathe", instruction: "Rest hands on thighs, relax shoulders, and breathe steadily.", xp: 5, check: checkGenericReady },
      ],
    },
    baddha_konasana: {
      title: "Baddha Konasana (Butterfly Pose) - Step Missions",
      intro: "Sit comfortably, bring soles together, hold the feet, and open the knees outward while staying tall.",
      reward: "+20 Training XP • Butterfly Badge",
      steps: [
        { title: "Mission 1: Sit Down", instruction: "Sit down comfortably with your spine tall.", xp: 4, check: checkGenericReady },
        { title: "Mission 2: Soles Together", instruction: "Bend both knees and bring the soles of your feet together.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Hold Feet", instruction: "Hold both feet with your hands and keep your chest lifted.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Open Knees", instruction: "Open knees outward like butterfly wings and sit tall calmly.", xp: 6, check: checkGenericReady },
      ],
    },
    bhujangasana: {
      title: "Bhujangasana (Cobra Pose) - Step Missions",
      intro: "Learn Cobra step by step: lie on stomach, place palms beside chest, press palms down, then lift chest and look forward.",
      reward: "+20 Training XP • Cobra Badge",
      steps: [
        { title: "Mission 1: Lie On Stomach", instruction: "Lie on your stomach with legs long and body relaxed.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Palms Beside Chest", instruction: "Place both palms beside your chest under the shoulders.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Press Palms", instruction: "Press palms into the floor and begin lifting the chest gently.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Lift Chest", instruction: "Lift chest up, keep hips grounded, shoulders back, and look forward.", xp: 5, check: checkGenericReady },
      ],
    },
    balasana: {
      title: "Balasana (Child Pose) - Step Missions",
      intro: "Learn Child's Pose step by step: kneel on the mat, sit back onto your heels, fold your torso forward, then stretch your arms out and hold.",
      reward: "+20 Training XP • Child's Pose Badge",
      steps: [
        { title: "Mission 1: Kneel on the Mat", instruction: "Kneel down on the mat with your knees hip-width apart.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Sit Back on Your Heels", instruction: "Sit your hips back so they rest close to your heels.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Fold Your Torso Forward", instruction: "Hinge forward and lower your torso and head down toward the mat.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Stretch Your Arms and Hold", instruction: "Stretch both arms forward along the mat and hold the pose while you breathe.", xp: 5, check: checkGenericReady },
      ],
    },
    padahastasana: {
      title: "Padahastasana (Hand-to-Foot Pose) - Step Missions",
      intro: "Learn the forward fold step by step: stand tall, lengthen spine, hinge at hips, then reach hands toward feet and relax.",
      reward: "+20 Training XP • Forward Fold Badge",
      steps: [
        { title: "Mission 1: Stand Tall", instruction: "Stand tall with legs steady and arms relaxed.", xp: 5, check: checkTadasanaAlignment },
        { title: "Mission 2: Lengthen Spine", instruction: "Inhale and lengthen your spine upward before folding.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Hinge & Fold", instruction: "Exhale, hinge at the hips, and fold forward with a long back.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Reach & Relax", instruction: "Reach hands toward feet/floor and relax the head and neck.", xp: 5, check: checkGenericReady },
      ],
    },
    paschimottanasana: {
      title: "Paschimottanasana (Seated Forward Bend) - Step Missions",
      intro: "Learn the seated forward bend: sit with legs extended, lengthen spine, inhale and raise arms, then fold forward and hold.",
      reward: "+20 Training XP • Flexibility Badge",
      steps: [
        { title: "Mission 1: Legs Extended", instruction: "Sit with both legs extended straight in front of you.", xp: 5, check: checkSeatedLegsExtended },
        { title: "Mission 2: Lengthen Spine", instruction: "Keep your spine tall and chest lifted.", xp: 5, check: checkSeatedLegsExtended },
        { title: "Mission 3: Raise Arms", instruction: "Inhale and raise both arms up while keeping legs long.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Fold Forward", instruction: "Fold forward over the legs and reach toward feet, ankles, or shins.", xp: 5, check: checkPaschimottanasanaFold },
      ],
    },
    paschim_namaskarasana: {
      title: "Paschim Namaskarasana (Reverse Prayer Pose) - Step Missions",
      intro: "Learn Reverse Prayer step by step: stand tall, bring arms behind the back, rotate shoulders inward, then join palms and lift the chest.",
      reward: "+20 Training XP • Reverse Prayer Badge",
      steps: [
        { title: "Mission 1: Stand Tall", instruction: stepText(0, "Stand tall with feet grounded and spine long."), xp: 5, check: checkFullBody },
        { title: "Mission 2: Arms Behind", instruction: stepText(1, "Bring both arms behind your back."), xp: 5, check: checkArmsGoingBehind },
        { title: "Mission 3: Rotate Shoulders", instruction: stepText(2, "Roll shoulders back and inward so the elbows move toward each other."), xp: 5, check: checkArmsGoingBehind },
        { title: "Mission 4: Join Palms", instruction: stepText(3, "Join palms behind your back, lift the chest, and hold."), xp: 5, check: checkReversePrayerHeld },
      ],
    },
    wall_plank_chaturanga: {
      title: "Wall Plank Chaturanga - Step Missions",
      intro: "Learn the wall plank safely: stand facing wall, place palms, step back into plank, then bend elbows into half chaturanga. Final practice holds/counts XP while accuracy stays above threshold.",
      reward: "+20 Training XP • Dojo Badge",
      steps: [
        { title: "Mission 1: Face Wall", instruction: "Stand facing the wall with feet grounded and spine tall.", xp: 5, check: checkGenericReady },
        { title: "Mission 2: Palms On Wall", instruction: "Place both palms on the wall at shoulder height.", xp: 5, check: checkGenericReady },
        { title: "Mission 3: Step Back", instruction: "Step back into a diagonal plank line from head to heels.", xp: 5, check: checkGenericReady },
        { title: "Mission 4: Half Chaturanga", instruction: "Bend elbows slightly, keep body straight, and hold the position.", xp: 5, check: checkGenericReady },
      ],
    },
    pranayama: {
      title: "Pranayama (Breath Practice) - Step Missions",
      intro: "Learn the breathing practice step by step: sit comfortably, close your eyes, inhale slowly and deeply, then exhale slowly and relax.",
      reward: "+20 Training XP • Breath Badge",
      steps: [
        { title: "Mission 1: Sit Comfortably", instruction: stepText(0, "Sit comfortably cross-legged or in a chair with your body visible."), xp: 5, check: checkFullBody },
        { title: "Mission 2: Close Eyes", instruction: stepText(1, "Keep your spine tall, shoulders relaxed, and close your eyes gently."), xp: 5, check: checkPranayamaSeat },
        { title: "Mission 3: Inhale Deeply", instruction: stepText(2, "Inhale slowly and deeply while keeping shoulders relaxed."), xp: 5, check: checkPranayamaBreathing },
        { title: "Mission 4: Exhale & Relax", instruction: stepText(3, "Exhale slowly, relax the body, and stay steady."), xp: 5, check: checkPranayamaBreathing },
      ],
    },
    default: {
      title: "YogGyaan Accuracy Mission",
      intro: "Complete the posture using the selected asana guide only.",
      reward: "+10 Training XP • Ready Badge",
      steps: [
        { title: "Mission 1: Enter the Frame", instruction: stepText(0, "Show your body clearly to the camera."), xp: 5, check: checkFullBody },
        { title: "Mission 2: Follow the Guide", instruction: stepText(1, "Settle into the instructed pose and remain stable."), xp: 5, check: checkGenericReady },
      ],
    },
  };

  const mission = missions[POSE] || missions.default;
  const totalSteps = mission.steps.length;
  let currentStep = 0;
  let stepHold = 0;
  let lastTick = Date.now();
  let trainingActive = true;
  let tutLandmarker = null;
  let tutStream = null;
  let tutAnimId = null;
  let stepCompleted = false;
  let trainingXP = 0;
  let lastCenter = null;
  let stableClock = 0;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function visible(p, min = 0.35) { return !!p && ((p.visibility == null) || p.visibility >= min); }
  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function getBodyCenter(lm) {
    if (!lm || lm.length < 29) return null;
    return midpoint(midpoint(lm[11], lm[12]), midpoint(lm[23], lm[24]));
  }

  function checkFullBody(lm) {
    const needed = [0, 11, 12, 23, 24, 25, 26, 27, 28];
    const hits = needed.filter(i => visible(lm[i])).length;
    return {
      score: hits / needed.length,
      label: hits === needed.length ? "Full body detected ✔️" : `Body scan ${hits}/${needed.length}`,
      details: [
        visible(lm[0]) ? "✔️ Head detected" : "⭕ Head detected",
        (visible(lm[11]) && visible(lm[12])) ? "✔️ Shoulders detected" : "⭕ Shoulders detected",
        (visible(lm[23]) && visible(lm[24])) ? "✔️ Hips detected" : "⭕ Hips detected",
        (visible(lm[27]) && visible(lm[28])) ? "✔️ Feet detected" : "⭕ Feet detected",
      ],
    };
  }

  function checkTadasanaAlignment(lm) {
    const full = checkFullBody(lm).score;
    if (full < 0.85) return { score: full * 0.6, label: "Show full body first", details: checkFullBody(lm).details };
    const nose = lm[0], lSh = lm[11], rSh = lm[12], lHip = lm[23], rHip = lm[24], lAn = lm[27], rAn = lm[28];
    const shoulderLevel = 1 - clamp01(Math.abs(lSh.y - rSh.y) / 0.08);
    const hipMid = midpoint(lHip, rHip);
    const shMid = midpoint(lSh, rSh);
    const spineVertical = 1 - clamp01(Math.abs(shMid.x - hipMid.x) / 0.10);
    const headCenter = 1 - clamp01(Math.abs(nose.x - shMid.x) / 0.12);
    const feetBase = clamp01(Math.abs(lAn.x - rAn.x) / 0.16);
    const score = shoulderLevel * 0.28 + spineVertical * 0.32 + headCenter * 0.25 + feetBase * 0.15;
    return {
      score,
      label: score > 0.82 ? "Mountain alignment locked ✔️" : "Align head, shoulders, and spine",
      details: [
        headCenter > 0.72 ? "✔️ Head centered" : "⭕ Center your head",
        shoulderLevel > 0.72 ? "✔️ Shoulders level" : "⭕ Level your shoulders",
        spineVertical > 0.72 ? "✔️ Spine aligned" : "⭕ Stand taller through spine",
        feetBase > 0.45 ? "✔️ Foundation visible" : "⭕ Set your feet clearly",
      ],
    };
  }

  function checkStableStanding(lm, dt) {
    const align = checkTadasanaAlignment(lm);
    const center = getBodyCenter(lm);
    if (!center || align.score < 0.65) {
      stableClock = Math.max(0, stableClock - dt * 0.8);
      lastCenter = center;
      return { score: Math.min(align.score, stableClock / 1.6), label: "Mountain energy fading - correct posture", details: align.details };
    }
    if (lastCenter) {
      const movement = dist(center, lastCenter);
      if (movement < 0.018) stableClock += dt;
      else stableClock = Math.max(0, stableClock - dt * 0.9);
    } else stableClock += dt * 0.5;
    lastCenter = center;
    const score = Math.min(1, stableClock / 1.8) * 0.65 + align.score * 0.35;
    return {
      score,
      label: score > 0.82 ? "Stillness verified ✔️" : "Hold steady like a mountain",
      details: [
        align.score > 0.7 ? "✔️ Posture active" : "⭕ Restore alignment",
        stableClock > 0.8 ? "✔️ Stability building" : "⭕ Reduce movement",
        stableClock > 1.6 ? "✔️ Stillness locked" : "⭕ Keep holding",
      ],
    };
  }

  function checkTreeFootLift(lm) {
    const full = checkFullBody(lm).score;
    if (full < 0.85) return { score: full * 0.55, label: "Show full body first", details: checkFullBody(lm).details };
    const lAn = lm[27], rAn = lm[28], lKn = lm[25], rKn = lm[26];
    const leftLift = Math.abs(lAn.y - rAn.y);
    const bent = Math.min(angleAt(lm[23], lKn, lAn), angleAt(lm[24], rKn, rAn));
    const liftScore = clamp01(leftLift / 0.12);
    const bendScore = bent < 155 ? 1 : clamp01(1 - (bent - 155) / 30);
    const score = liftScore * 0.55 + bendScore * 0.45;
    return {
      score,
      label: score > 0.82 ? "Sacred foot placement detected ✔️" : "Lift one foot toward calf/thigh",
      details: [
        liftScore > 0.55 ? "✔️ One foot lifted" : "⭕ Lift one foot",
        bendScore > 0.6 ? "✔️ Knee opened" : "⭕ Bend the lifted leg",
        score > 0.75 ? "✔️ Tree shape forming" : "⭕ Keep finding tree pose",
      ],
    };
  }

  function checkTreeBalance(lm, dt) {
    const tree = checkTreeFootLift(lm);
    const center = getBodyCenter(lm);
    if (!center || tree.score < 0.62) {
      stableClock = Math.max(0, stableClock - dt * 0.8);
      lastCenter = center;
      return { score: Math.min(tree.score, stableClock / 1.8), label: "Leaves falling - regain balance", details: tree.details };
    }
    if (lastCenter) {
      const movement = dist(center, lastCenter);
      if (movement < 0.026) stableClock += dt;
      else stableClock = Math.max(0, stableClock - dt * 0.8);
    } else stableClock += dt * 0.5;
    lastCenter = center;
    const score = Math.min(1, stableClock / 1.9) * 0.65 + tree.score * 0.35;
    return {
      score,
      label: score > 0.82 ? "Balance verified ✔️" : "Protect the forest - hold balance",
      details: [
        tree.score > 0.65 ? "✔️ Tree pose active" : "⭕ Return to Tree Pose",
        stableClock > 0.8 ? "✔️ Balance building" : "⭕ Stay still",
        stableClock > 1.7 ? "✔️ Guardian balance locked" : "⭕ Hold a little longer",
      ],
    };
  }

  function checkSeatedLegsExtended(lm) {
    const full = checkFullBody(lm);
    if (full.score < 0.8) return { score: full.score * 0.6, label: "Show full body first", details: full.details };
    const lHi = lm[23], rHi = lm[24], lKn = lm[25], rKn = lm[26], lAn = lm[27], rAn = lm[28];
    const lSh = lm[11], rSh = lm[12];
    const shoulderY = (lSh.y + rSh.y) / 2;
    const hipY = (lHi.y + rHi.y) / 2;
    const seatedSc = clamp01((hipY - shoulderY + 0.05) / 0.20);
    const lKneeAng = angleAt(lHi, lKn, lAn);
    const rKneeAng = angleAt(rHi, rKn, rAn);
    const legSc = clamp01((Math.min(lKneeAng, rKneeAng) - 120) / 50);
    const score = seatedSc * 0.55 + legSc * 0.45;
    return {
      score,
      label: score > 0.80 ? "Seated position ready ✔️" : "Sit with legs extended forward",
      details: [
        seatedSc > 0.6 ? "✔️ Seated on the floor" : "⭕ Sit down on the floor",
        legSc > 0.6 ? "✔️ Legs extended" : "⭕ Stretch legs straight ahead",
      ],
    };
  }

  function checkPaschimottanasanaFold(lm, dt) {
    const seated = checkSeatedLegsExtended(lm);
    const center = getBodyCenter(lm);
    if (!center || seated.score < 0.55) {
      stableClock = Math.max(0, stableClock - dt * 0.7);
      lastCenter = center;
      return { score: seated.score * 0.75, label: "Get seated first", details: seated.details };
    }
    const lSh = lm[11], rSh = lm[12], lHi = lm[23], rHi = lm[24], lWr = lm[15], rWr = lm[16], lAn = lm[27], rAn = lm[28];
    const shoulderY = (lSh.y + rSh.y) / 2;
    const hipY = (lHi.y + rHi.y) / 2;
    const foldSc = clamp01((shoulderY - hipY + 0.14) / 0.38);
    const handFootDist = Math.min(
      Math.hypot(lWr.x - lAn.x, lWr.y - lAn.y),
      Math.hypot(rWr.x - rAn.x, rWr.y - rAn.y)
    );
    const reachSc = clamp01(1 - handFootDist / 0.50);
    const score = foldSc * 0.60 + reachSc * 0.40;
    if (score >= 0.72) stableClock += dt;
    else stableClock = Math.max(0, stableClock - dt * 0.6);
    lastCenter = center;
    return {
      score: Math.min(1, stableClock / 1.5) * 0.6 + score * 0.4,
      label: score > 0.72 ? "Fold detected - hold it ✔️" : "Fold forward toward your feet",
      details: [
        foldSc > 0.55 ? "✔️ Torso folding forward" : "⭕ Lean forward over your legs",
        reachSc > 0.45 ? "✔️ Hands reaching feet" : "⭕ Reach hands toward ankles/feet",
        stableClock > 1.2 ? "✔️ Holding the fold" : "⭕ Hold position",
      ],
    };
  }

  function checkArmsGoingBehind(lm) {
    const full = checkFullBody(lm);
    if (full.score < 0.8) return { score: full.score * 0.6, label: "Show full body first", details: full.details };
    const lSh = lm[11], rSh = lm[12], lWr = lm[15], rWr = lm[16];
    const shoulderY = (lSh.y + rSh.y) / 2;
    const wristsMovingDown = ((lWr.y > shoulderY - 0.06) && (rWr.y > shoulderY - 0.06));
    const wristMidX = (lWr.x + rWr.x) / 2;
    const shMidX = (lSh.x + rSh.x) / 2;
    const centreSc = clamp01(1 - Math.abs(wristMidX - shMidX) / 0.25);
    const score = (wristsMovingDown ? 0.6 : 0.2) + centreSc * 0.4;
    return {
      score,
      label: score > 0.72 ? "Arms moving behind ✔️" : "Move both arms behind your back",
      details: [
        wristsMovingDown ? "✔️ Wrists at back level" : "⭕ Swing both arms behind your back",
        centreSc > 0.6 ? "✔️ Hands near spine" : "⭕ Bring hands toward the centre of your back",
      ],
    };
  }

  function checkReversePrayerHeld(lm, dt) {
    const behind = checkArmsGoingBehind(lm);
    const center = getBodyCenter(lm);
    if (!center || behind.score < 0.60) {
      stableClock = Math.max(0, stableClock - dt * 0.7);
      lastCenter = center;
      return { score: behind.score * 0.7, label: "Get arms behind first", details: behind.details };
    }
    const lWr = lm[15], rWr = lm[16];
    const wristsDist = Math.hypot(lWr.x - rWr.x, lWr.y - rWr.y);
    const prayerSc = clamp01(1 - wristsDist / 0.28);
    if (prayerSc >= 0.60) stableClock += dt;
    else stableClock = Math.max(0, stableClock - dt * 0.6);
    lastCenter = center;
    const score = Math.min(1, stableClock / 1.5) * 0.55 + prayerSc * 0.45;
    return {
      score,
      label: prayerSc > 0.60 ? "Reverse Prayer detected - hold ✔️" : "Press palms together behind back",
      details: [
        behind.score > 0.65 ? "✔️ Arms behind back" : "⭕ Keep arms behind your back",
        prayerSc > 0.55 ? "✔️ Palms close together" : "⭕ Press palms closer together",
        stableClock > 1.1 ? "✔️ Holding Reverse Prayer" : "⭕ Keep holding",
      ],
    };
  }

  function checkPranayamaSeat(lm) {
    const full = checkFullBody(lm);
    if (full.score < 0.75) return { score: full.score * 0.7, label: "Show full body first", details: full.details };
    const lSh = lm[11], rSh = lm[12], lHi = lm[23], rHi = lm[24];
    const midShX = (lSh.x + rSh.x) / 2, midHiX = (lHi.x + rHi.x) / 2;
    const torsoSc = clamp01(1 - Math.abs(midShX - midHiX) / 0.22);
    const shoulderSc = clamp01(1 - Math.abs(lSh.y - rSh.y) / 0.11);
    const score = torsoSc * 0.55 + shoulderSc * 0.30 + full.score * 0.15;
    return {
      score,
      label: score > 0.78 ? "Pranayama posture ready ✔️" : "Sit tall with level, relaxed shoulders",
      details: [
        torsoSc > 0.70 ? "✔️ Spine upright and centered" : "⭕ Sit taller - align shoulders over hips",
        shoulderSc > 0.70 ? "✔️ Shoulders level and relaxed" : "⭕ Relax and level both shoulders",
      ],
    };
  }

  function checkPranayamaBreathing(lm, dt) {
    const seat = checkPranayamaSeat(lm);
    const center = getBodyCenter(lm);
    if (!center || seat.score < 0.62) {
      stableClock = Math.max(0, stableClock - dt * 0.6);
      lastCenter = center;
      return { score: seat.score * 0.8, label: "Hold posture first", details: seat.details };
    }
    if (lastCenter && dist(center, lastCenter) < 0.018) stableClock += dt;
    else stableClock = Math.max(0, stableClock - dt * 0.5);
    lastCenter = center;
    const score = Math.min(1, stableClock / 2.0) * 0.65 + seat.score * 0.35;
    return {
      score,
      label: score > 0.78 ? "Calm Pranayama posture held ✔️" : "Stay still and breathe slowly",
      details: [
        seat.score > 0.68 ? "✔️ Posture aligned" : "⭕ Restore upright posture",
        stableClock > 0.8 ? "✔️ Stillness building" : "⭕ Reduce movement",
        stableClock > 1.8 ? "✔️ Prana Nexus expanding" : "⭕ Keep breathing steadily",
      ],
    };
  }

  function checkGenericReady(lm, dt) {
    const full = checkFullBody(lm);
    const center = getBodyCenter(lm);
    if (!center || full.score < 0.8) return { score: full.score * 0.8, label: "Show your body clearly", details: full.details };
    if (lastCenter && dist(center, lastCenter) < 0.025) stableClock += dt;
    else stableClock = Math.max(0, stableClock - dt * 0.7);
    lastCenter = center;
    return {
      score: Math.min(1, stableClock / 1.8) * 0.7 + full.score * 0.3,
      label: stableClock > 1.5 ? "Training readiness verified ✔️" : "Hold steady",
      details: ["✔️ Body detected", stableClock > 0.7 ? "✔️ Stability building" : "⭕ Stay still", stableClock > 1.5 ? "✔️ Ready" : "⭕ Keep holding"],
    };
  }

  function decorateTrainingUI() {
   
    if (btnSkip) btnSkip.remove();
    if (tutorialCard) tutorialCard.classList.add("mission-instruction-panel");
    if (tutorialCard && !document.getElementById("trainingChecklist")) {
      const list = document.createElement("div");
      list.id = "trainingChecklist";
      list.className = "training-checklist";
      const ringWrap = tutorialCard.querySelector(".validate-ring-wrap");
      if (ringWrap) ringWrap.insertAdjacentElement("afterend", list);
      else tutorialCard.appendChild(list);
    }
    if (stepInstEl && !document.getElementById("trainingStepReward")) {
      stepInstEl.insertAdjacentHTML("afterend", '<div id="trainingStepReward" class="training-step-reward"></div>');
    }
  }

  const POSE_STEPS = {
    tadasana: [
      { arms: { la: [78, 74, 68, 125], ra: [142, 74, 152, 125], lf: [68, 125, 74, 176], rf: [152, 125, 146, 176], ll: [91, 123, 88, 178], rl: [129, 123, 132, 178], lc: [88, 178, 84, 220], rc: [132, 178, 136, 220] }, guide: "1/4: Stand tall with both feet together. Green glow marks the posture line.", focus: [[110, 80, 4], [110, 125, 4], [110, 170, 4]], move: [[110, 220, 110, 170]] },
      { arms: { la: [78, 74, 76, 135], ra: [142, 74, 144, 135], lf: [76, 135, 78, 183], rf: [144, 135, 142, 183] }, guide: "2/4: Straighten spine and relax shoulders. Purple glow shows current alignment.", focus: [[110, 58, 4], [110, 92, 4], [110, 122, 4]], move: [[96, 92, 76, 112], [124, 92, 144, 112]] },
      { arms: { la: [78, 74, 76, 135], ra: [142, 74, 144, 135], lf: [76, 135, 78, 183], rf: [144, 135, 142, 183] }, guide: "3/4: Engage core and hold steady. Yellow glow highlights the core area.", focus: [[110, 118, 7], [110, 132, 5]], move: [] },
      { arms: { la: [78, 74, 88, 35], ra: [142, 74, 132, 35], lf: [88, 35, 104, 16], rf: [132, 35, 116, 16] }, guide: "4/4: Raise arms overhead and reach upward. Blue arrows show movement direction.", focus: [[110, 122, 4]], move: [[78, 128, 78, 62], [142, 128, 142, 62]] },
    ],
    tree: [
      { arms: {}, guide: "1/4: Stand tall and steady in Tadasana.", focus: [[110, 122, 4]], move: [] },
      { arms: { la: [78, 74, 70, 132], ra: [142, 74, 150, 132], lf: [70, 132, 76, 178], rf: [150, 132, 144, 178], rl: [129, 123, 145, 170], rc: [145, 170, 132, 215] }, guide: "2/4: Shift weight onto one leg; the other leg prepares to lift.", focus: [[110, 215, 5]], move: [[124, 165, 160, 165]] },
      { arms: { rl: [129, 123, 154, 152], rc: [154, 152, 106, 167] }, guide: "3/4: Place opposite foot on inner calf/thigh. Yellow focus line marks the lifted leg.", focus: [[132, 150, 5], [116, 166, 5]], move: [[154, 170, 118, 150]] },
      { arms: { la: [78, 74, 90, 37], ra: [142, 74, 130, 37], lf: [90, 37, 106, 19], rf: [130, 37, 114, 19], rl: [129, 123, 154, 152], rc: [154, 152, 106, 167] }, guide: "4/4: Join palms overhead and balance calmly.", focus: [[110, 22, 5], [132, 150, 5]], move: [[92, 90, 92, 38], [128, 90, 128, 38]] },
    ],
    warrior: [
      { arms: { ll: [91, 123, 66, 170], lc: [66, 170, 42, 220], rl: [129, 123, 154, 170], rc: [154, 170, 178, 220], la: [78, 74, 58, 120], ra: [142, 74, 162, 120], lf: [58, 120, 45, 160], rf: [162, 120, 175, 160] }, guide: "1/4: Take a wide stance. Orange glow marks both feet.", focus: [[42, 220, 5], [178, 220, 5]], move: [[62, 220, 158, 220]] },
      { arms: { ll: [91, 123, 62, 165], lc: [62, 165, 42, 220], rl: [129, 123, 154, 175], rc: [154, 175, 178, 220] }, guide: "2/4: Step one foot back into a strong base.", focus: [[178, 220, 5]], move: [[110, 220, 178, 220]] },
      { arms: { ll: [91, 123, 72, 165], lc: [72, 165, 42, 220], rl: [129, 123, 160, 165], rc: [160, 165, 178, 220] }, guide: "3/4: Bend the front knee; keep back leg strong.", focus: [[72, 165, 5]], move: [[92, 145, 72, 165]] },
      { arms: { la: [78, 74, 38, 74], ra: [142, 74, 182, 74], lf: [38, 74, 18, 74], rf: [182, 74, 202, 74], ll: [91, 123, 72, 165], lc: [72, 165, 42, 220], rl: [129, 123, 160, 165], rc: [160, 165, 178, 220] }, guide: "4/4: Extend arms sideways and look forward.", focus: [[72, 165, 5]], move: [[76, 74, 18, 74], [144, 74, 202, 74]] },
    ],
    padmasana: [
      { body: { head: [110, 66, 15], spine: [110, 82, 110, 135], shoulders: [78, 96, 142, 96], hips: [83, 145, 137, 145], ground: [110, 206, 82, 8] }, arms: { la: [78, 98, 66, 133], lf: [66, 133, 62, 166], ra: [142, 98, 154, 133], rf: [154, 133, 158, 166], ll: [88, 145, 70, 178], lc: [70, 178, 48, 178], rl: [132, 145, 150, 178], rc: [150, 178, 172, 178] }, guide: "1/5: Sit on the floor with spine tall and legs relaxed.", focus: [[110, 134, 5]], move: [] },
      { body: { head: [110, 66, 15], spine: [110, 82, 110, 135], shoulders: [78, 96, 142, 96], hips: [83, 145, 137, 145], ground: [110, 206, 82, 8] }, arms: { la: [78, 98, 66, 133], lf: [66, 133, 78, 168], ra: [142, 98, 154, 133], rf: [154, 133, 158, 166], ll: [88, 145, 68, 176], lc: [68, 176, 120, 184], rl: [132, 145, 150, 178], rc: [150, 178, 172, 178] }, guide: "2/5: Cross one foot toward the opposite thigh.", focus: [[120, 184, 6]], move: [[74, 184, 116, 184]] },
      { body: { head: [110, 66, 15], spine: [110, 82, 110, 135], shoulders: [78, 96, 142, 96], hips: [83, 145, 137, 145], ground: [110, 206, 82, 8] }, arms: { la: [78, 98, 66, 133], lf: [66, 133, 78, 168], ra: [142, 98, 154, 133], rf: [154, 133, 142, 168], ll: [88, 145, 68, 176], lc: [68, 176, 120, 184], rl: [132, 145, 152, 176], rc: [152, 176, 100, 184] }, guide: "3/5: Cross the other foot on top to form the lotus shape.", focus: [[100, 184, 6], [120, 184, 6]], move: [[148, 184, 104, 184]] },
      { body: { head: [110, 66, 15], spine: [110, 82, 110, 135], shoulders: [78, 96, 142, 96], hips: [83, 145, 137, 145], ground: [110, 206, 82, 8] }, arms: { la: [78, 98, 72, 132], lf: [72, 132, 84, 166], ra: [142, 98, 148, 132], rf: [148, 132, 136, 166], ll: [88, 145, 68, 176], lc: [68, 176, 120, 184], rl: [132, 145, 152, 176], rc: [152, 176, 100, 184] }, guide: "4/5: Place both hands gently on the knees.", focus: [[84, 166, 5], [136, 166, 5]], move: [[66, 150, 84, 166], [154, 150, 136, 166]] },
      { body: { head: [110, 62, 15], spine: [110, 78, 110, 135], shoulders: [78, 94, 142, 94], hips: [83, 145, 137, 145], ground: [110, 206, 82, 8] }, arms: { la: [78, 96, 72, 132], lf: [72, 132, 84, 166], ra: [142, 96, 148, 132], rf: [148, 132, 136, 166], ll: [88, 145, 68, 176], lc: [68, 176, 120, 184], rl: [132, 145, 152, 176], rc: [152, 176, 100, 184] }, guide: "5/5: Sit tall and breathe in the final Padmasana.", focus: [[110, 100, 6]], move: [] },
    ],
    vajrasana: [
      { body: { head: [110, 44, 15], spine: [110, 60, 110, 126], shoulders: [78, 76, 142, 76], hips: [88, 130, 132, 130], ground: [110, 226, 70, 8] }, arms: { la: [78, 78, 70, 130], lf: [70, 130, 78, 172], ra: [142, 78, 150, 130], rf: [150, 130, 142, 172], ll: [91, 130, 88, 170], lc: [88, 170, 78, 215], rl: [129, 130, 132, 170], rc: [132, 170, 142, 215] }, guide: "1/4: Kneel on the floor with both shins down.", focus: [[84, 214, 5], [136, 214, 5]], move: [[110, 210, 110, 226]] },
      { body: { head: [110, 52, 15], spine: [110, 68, 110, 132], shoulders: [78, 84, 142, 84], hips: [88, 142, 132, 142], ground: [110, 226, 70, 8] }, arms: { la: [78, 86, 72, 128], lf: [72, 128, 84, 154], ra: [142, 86, 148, 128], rf: [148, 128, 136, 154], ll: [91, 142, 88, 174], lc: [88, 174, 74, 214], rl: [129, 142, 132, 174], rc: [132, 174, 146, 214] }, guide: "2/4: Sit back onto your heels.", focus: [[74, 214, 5], [146, 214, 5]], move: [[110, 136, 110, 160]] },
      { body: { head: [110, 42, 15], spine: [110, 58, 110, 132], shoulders: [78, 76, 142, 76], hips: [88, 142, 132, 142], ground: [110, 226, 70, 8] }, arms: { la: [78, 78, 74, 126], lf: [74, 126, 86, 154], ra: [142, 78, 146, 126], rf: [146, 126, 134, 154], ll: [91, 142, 88, 174], lc: [88, 174, 74, 214], rl: [129, 142, 132, 174], rc: [132, 174, 146, 214] }, guide: "3/4: Lift chest and keep the spine upright.", focus: [[110, 96, 6]], move: [[110, 132, 110, 58]] },
      { body: { head: [110, 42, 15], spine: [110, 58, 110, 132], shoulders: [78, 76, 142, 76], hips: [88, 142, 132, 142], ground: [110, 226, 70, 8] }, arms: { la: [78, 78, 74, 126], lf: [74, 126, 86, 154], ra: [142, 78, 146, 126], rf: [146, 126, 134, 154], ll: [91, 142, 88, 174], lc: [88, 174, 74, 214], rl: [129, 142, 132, 174], rc: [132, 174, 146, 214] }, guide: "4/4: Rest hands on thighs and breathe steadily.", focus: [[86, 154, 5], [134, 154, 5]], move: [] },
    ],
    baddha_konasana: [
      { arms: { ll: [91, 123, 80, 160], lc: [80, 160, 68, 194], rl: [129, 123, 140, 160], rc: [140, 160, 152, 194], la: [78, 74, 68, 122], ra: [142, 74, 152, 122], lf: [68, 122, 76, 160], rf: [152, 122, 144, 160] }, guide: "1/4: Sit down comfortably with a tall spine.", focus: [[110, 118, 4]], move: [] },
      { arms: { ll: [91, 123, 65, 158], lc: [65, 158, 110, 178], rl: [129, 123, 155, 158], rc: [155, 158, 110, 178], la: [78, 74, 70, 125], ra: [142, 74, 150, 125], lf: [70, 125, 84, 162], rf: [150, 125, 136, 162] }, guide: "2/4: Bring soles of the feet together in front of you.", focus: [[105, 178, 5], [115, 178, 5]], move: [[80, 190, 110, 178], [140, 190, 110, 178]] },
      { arms: { ll: [91, 123, 65, 158], lc: [65, 158, 110, 178], rl: [129, 123, 155, 158], rc: [155, 158, 110, 178], la: [78, 74, 70, 125], ra: [142, 74, 150, 125], lf: [70, 125, 103, 176], rf: [150, 125, 117, 176] }, guide: "3/4: Hold both feet with your hands. Yellow focus marks the feet.", focus: [[110, 178, 7]], move: [] },
      { arms: { ll: [91, 123, 52, 158], lc: [52, 158, 110, 178], rl: [129, 123, 168, 158], rc: [168, 158, 110, 178], la: [78, 74, 70, 125], ra: [142, 74, 150, 125], lf: [70, 125, 103, 176], rf: [150, 125, 117, 176] }, guide: "4/4: Open knees outward like butterfly wings and sit tall.", focus: [[110, 178, 6]], move: [[72, 162, 44, 154], [148, 162, 176, 154]] },
    ],
    trikonasana: [
      {
        arms: {},
        guide: "Stand fully in frame - head, torso, legs all visible."
      },
      {
        arms: { ll: [91, 123, 70, 175], lc: [70, 175, 55, 220], rl: [129, 123, 150, 175], rc: [150, 175, 165, 220] },
        guide: "Step feet wide apart: about 3-4 feet. Keep toes pointing forward."
      },
      {
        arms: { la: [78, 74, 20, 95], ra: [142, 74, 200, 95], lf: [20, 95, 24, 115], rf: [200, 95, 196, 115], ll: [91, 123, 70, 175], lc: [70, 175, 55, 220], rl: [129, 123, 150, 175], rc: [150, 175, 165, 220] },
        guide: "Reach one hand to ankle, other arm stretching up - Triangle Pose!"
      },
    ],
   
    balasana: [
      { body: { head: [104, 84, 14], spine: [106, 100, 102, 158], shoulders: [90, 98, 120, 102], hips: [90, 156, 118, 160], ground: [110, 214, 90, 8] }, arms: { la: [92, 100, 84, 132], lf: [84, 132, 90, 158], ra: [118, 102, 126, 134], rf: [126, 134, 120, 160], ll: [96, 158, 142, 184], lc: [142, 184, 112, 206], rl: [100, 160, 146, 186], rc: [146, 186, 116, 208] }, guide: "1/4: Kneel on the mat with your knees hip-width apart.", focus: [[104, 68, 6]], move: [] },
      { body: { head: [104, 102, 14], spine: [106, 118, 102, 168], shoulders: [90, 116, 120, 120], hips: [90, 166, 118, 170], ground: [110, 214, 90, 8] }, arms: { la: [92, 118, 84, 148], lf: [84, 148, 90, 172], ra: [118, 120, 126, 150], rf: [126, 150, 120, 174], ll: [96, 168, 142, 188], lc: [142, 188, 114, 206], rl: [100, 170, 146, 190], rc: [146, 190, 118, 208] }, guide: "2/4: Sit back so your hips settle onto your heels.", focus: [[114, 206, 5], [118, 208, 5]], move: [[104, 158, 104, 168]] },
      { body: { head: [164, 196, 13], spine: [104, 168, 148, 192], shoulders: [118, 182, 150, 190], hips: [90, 166, 118, 170], ground: [110, 214, 90, 8] }, arms: { la: [120, 184, 140, 202], lf: [140, 202, 158, 206], ra: [148, 192, 164, 204], rf: [164, 204, 180, 206], ll: [96, 168, 142, 188], lc: [142, 188, 114, 206], rl: [100, 170, 146, 190], rc: [146, 190, 118, 208] }, guide: "3/4: Fold your torso forward and let your head lower toward the mat.", focus: [[164, 196, 6]], move: [[104, 118, 148, 190]] },
      { body: { head: [164, 196, 13], spine: [104, 168, 148, 192], shoulders: [118, 182, 150, 190], hips: [90, 166, 118, 170], ground: [110, 214, 90, 8] }, arms: { la: [120, 184, 158, 196], lf: [158, 196, 196, 200], ra: [148, 192, 178, 200], rf: [178, 200, 210, 202], ll: [96, 168, 142, 188], lc: [142, 188, 114, 206], rl: [100, 170, 146, 190], rc: [146, 190, 118, 208] }, guide: "4/4: Stretch both arms forward along the mat and hold the pose.", focus: [[196, 200, 5], [210, 202, 5]], move: [[158, 206, 196, 200], [180, 206, 210, 202]] },
    ],
   
    bhujangasana: [
      { body: { head: [42, 164, 13], spine: [56, 166, 126, 166], shoulders: [64, 164, 104, 164], hips: [126, 168, 152, 168], ground: [110, 214, 104, 8] }, arms: { la: [70, 166, 92, 185], lf: [92, 185, 120, 188], ra: [92, 166, 116, 184], rf: [116, 184, 148, 188], ll: [152, 168, 178, 168], lc: [178, 168, 206, 168], rl: [152, 172, 178, 172], rc: [178, 172, 206, 172] }, guide: "1/4: Lie on your stomach with legs long.", focus: [[42, 164, 5]], move: [] },
      { body: { head: [48, 160, 13], spine: [62, 162, 126, 166], shoulders: [66, 160, 102, 160], hips: [126, 168, 152, 168], ground: [110, 214, 104, 8] }, arms: { la: [66, 162, 76, 184], lf: [76, 184, 74, 204], ra: [102, 162, 112, 184], rf: [112, 184, 110, 204], ll: [152, 168, 178, 168], lc: [178, 168, 206, 168], rl: [152, 172, 178, 172], rc: [178, 172, 206, 172] }, guide: "2/4: Place palms beside the chest under shoulders.", focus: [[74, 204, 5], [110, 204, 5]], move: [[88, 170, 74, 204], [102, 170, 110, 204]] },
      { body: { head: [58, 142, 14], spine: [72, 150, 126, 166], shoulders: [74, 148, 112, 152], hips: [126, 168, 152, 168], ground: [110, 214, 104, 8] }, arms: { la: [74, 150, 76, 178], lf: [76, 178, 74, 204], ra: [112, 154, 112, 180], rf: [112, 180, 110, 204], ll: [152, 168, 178, 168], lc: [178, 168, 206, 168], rl: [152, 172, 178, 172], rc: [178, 172, 206, 172] }, guide: "3/4: Press palms into the floor and lift chest gently.", focus: [[74, 204, 5], [110, 204, 5]], move: [[66, 162, 58, 142]] },
      { body: { head: [62, 126, 14], spine: [76, 140, 128, 166], shoulders: [78, 138, 116, 146], hips: [128, 168, 152, 168], ground: [110, 214, 104, 8] }, arms: { la: [78, 140, 78, 174], lf: [78, 174, 74, 204], ra: [116, 148, 114, 178], rf: [114, 178, 110, 204], ll: [152, 168, 178, 168], lc: [178, 168, 206, 168], rl: [152, 172, 178, 172], rc: [178, 172, 206, 172] }, guide: "4/4: Lift chest, keep hips down, shoulders back, look forward.", focus: [[62, 126, 6]], move: [[62, 150, 62, 126]] },
    ],
    
    wall_plank_chaturanga: [
      { body: { head: [116, 44, 15], spine: [116, 60, 116, 130], shoulders: [94, 76, 138, 76], hips: [100, 134, 132, 134], ground: [128, 226, 82, 8] }, arms: { la: [94, 78, 88, 118], lf: [88, 118, 88, 166], ra: [138, 78, 144, 118], rf: [144, 118, 144, 166], ll: [102, 134, 102, 178], lc: [102, 178, 98, 220], rl: [130, 134, 132, 178], rc: [132, 178, 136, 220] }, wall: [58, 46, 58, 220], guide: "1/4: Stand facing the wall, feet grounded and spine tall.", focus: [[58, 112, 5]], move: [[116, 108, 62, 108]] },
      { body: { head: [116, 44, 15], spine: [116, 60, 116, 130], shoulders: [94, 76, 138, 76], hips: [100, 134, 132, 134], ground: [128, 226, 82, 8] }, arms: { la: [94, 78, 78, 82], lf: [78, 82, 58, 84], ra: [138, 78, 96, 96], rf: [96, 96, 58, 96], ll: [102, 134, 102, 178], lc: [102, 178, 98, 220], rl: [130, 134, 132, 178], rc: [132, 178, 136, 220] }, wall: [58, 46, 58, 220], guide: "2/4: Place both palms on the wall at shoulder height.", focus: [[58, 84, 5], [58, 96, 5]], move: [[94, 78, 58, 84], [138, 78, 58, 96]] },
      { body: { head: [92, 76, 14], spine: [104, 88, 150, 146], shoulders: [84, 92, 122, 108], hips: [150, 146, 178, 154], ground: [138, 226, 116, 8] }, arms: { la: [84, 94, 70, 88], lf: [70, 88, 58, 84], ra: [122, 108, 88, 102], rf: [88, 102, 58, 96], ll: [154, 148, 172, 180], lc: [172, 180, 190, 220], rl: [178, 154, 188, 184], rc: [188, 184, 204, 220] }, wall: [58, 46, 58, 220], guide: "3/4: Step both feet back until your body forms one straight diagonal plank line.", focus: [[104, 88, 5], [190, 220, 5]], move: [[116, 220, 190, 220], [150, 146, 178, 154]] },
      { body: { head: [88, 82, 14], spine: [102, 94, 150, 150], shoulders: [84, 100, 120, 114], hips: [150, 150, 178, 156], ground: [138, 226, 116, 8] }, arms: { la: [84, 102, 76, 106], lf: [76, 106, 58, 84], ra: [120, 116, 94, 118], rf: [94, 118, 58, 96], ll: [154, 152, 172, 180], lc: [172, 180, 190, 220], rl: [178, 156, 188, 184], rc: [188, 184, 204, 220] }, wall: [58, 46, 58, 220], guide: "4/4: Bend elbows into half chaturanga and HOLD. Stay in the pose while accuracy remains above threshold.", focus: [[76, 106, 6], [94, 118, 6]], move: [[104, 88, 92, 106], [120, 108, 94, 118]] },
    ],
   
    padahastasana: [
      { body: { head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [76, 72, 144, 72], hips: [88, 122, 132, 122], ground: [110, 226, 76, 8] }, arms: { la: [78, 74, 70, 132], lf: [70, 132, 76, 178], ra: [142, 74, 150, 132], rf: [150, 132, 144, 178], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "1/4: Stand tall with feet grounded.", focus: [[110, 86, 5]], move: [[110, 118, 110, 55]] },
      { body: { head: [108, 34, 16], spine: [110, 52, 110, 116], shoulders: [76, 68, 144, 68], hips: [88, 122, 132, 122], ground: [110, 226, 76, 8] }, arms: { la: [78, 70, 70, 128], lf: [70, 128, 76, 176], ra: [142, 70, 150, 128], rf: [150, 128, 144, 176], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "2/4: Lengthen the spine before folding.", focus: [[110, 72, 6]], move: [[110, 116, 110, 34]] },
      { body: { head: [144, 84, 16], spine: [132, 90, 104, 132], shoulders: [108, 94, 156, 104], hips: [88, 132, 132, 132], ground: [110, 226, 76, 8] }, arms: { la: [108, 96, 106, 134], lf: [106, 134, 98, 176], ra: [156, 106, 150, 144], rf: [150, 144, 142, 184], ll: [91, 133, 88, 178], lc: [88, 178, 84, 220], rl: [129, 133, 132, 178], rc: [132, 178, 136, 220] }, guide: "3/4: Hinge at hips and fold forward.", focus: [[104, 132, 5]], move: [[132, 90, 104, 132]] },
      { body: { head: [132, 150, 16], spine: [124, 116, 106, 150], shoulders: [112, 114, 144, 126], hips: [88, 132, 132, 132], ground: [110, 226, 76, 8] }, arms: { la: [112, 116, 106, 160], lf: [106, 160, 96, 210], ra: [144, 128, 136, 166], rf: [136, 166, 128, 210], ll: [91, 133, 88, 178], lc: [88, 178, 84, 220], rl: [129, 133, 132, 178], rc: [132, 178, 136, 220] }, guide: "4/4: Reach hands toward feet and relax the head.", focus: [[96, 210, 5], [128, 210, 5]], move: [[112, 150, 96, 210], [138, 150, 128, 210]] },
    ],
   
    paschimottanasana: [
      { body: { head: [50, 164, 13], spine: [64, 166, 116, 166], shoulders: [68, 164, 104, 164], hips: [118, 168, 148, 168], ground: [110, 214, 104, 8] }, arms: { la: [72, 166, 96, 188], lf: [96, 188, 126, 190], ra: [100, 166, 124, 188], rf: [124, 188, 154, 190], ll: [148, 168, 176, 168], lc: [176, 168, 206, 168], rl: [148, 172, 176, 172], rc: [176, 172, 206, 172] }, guide: "1/4: Sit with both legs extended.", focus: [[180, 168, 5], [206, 168, 5]], move: [] },
      { body: { head: [70, 112, 15], spine: [76, 130, 90, 166], shoulders: [56, 136, 96, 132], hips: [90, 168, 126, 168], ground: [110, 214, 104, 8] }, arms: { la: [58, 138, 70, 166], lf: [70, 166, 95, 184], ra: [96, 134, 112, 164], rf: [112, 164, 140, 184], ll: [126, 168, 158, 170], lc: [158, 170, 206, 170], rl: [126, 172, 158, 174], rc: [158, 174, 206, 174] }, guide: "2/4: Lengthen your spine upright.", focus: [[74, 130, 6]], move: [[76, 166, 70, 112]] },
      { body: { head: [70, 112, 15], spine: [76, 130, 90, 166], shoulders: [56, 136, 96, 132], hips: [90, 168, 126, 168], ground: [110, 214, 104, 8] }, arms: { la: [56, 136, 52, 86], lf: [52, 86, 52, 42], ra: [96, 132, 104, 82], rf: [104, 82, 108, 38], ll: [126, 168, 158, 170], lc: [158, 170, 206, 170], rl: [126, 172, 158, 174], rc: [158, 174, 206, 174] }, guide: "3/4: Inhale and raise both arms up.", focus: [[52, 42, 5], [108, 38, 5]], move: [[56, 136, 52, 42], [96, 132, 108, 38]] },
      { body: { head: [132, 164, 15], spine: [112, 150, 92, 166], shoulders: [104, 148, 140, 158], hips: [90, 168, 126, 168], ground: [110, 214, 104, 8] }, arms: { la: [104, 150, 138, 166], lf: [138, 166, 186, 170], ra: [140, 160, 160, 174], rf: [160, 174, 206, 172], ll: [126, 168, 158, 170], lc: [158, 170, 206, 170], rl: [126, 172, 158, 174], rc: [158, 174, 206, 174] }, guide: "4/4: Fold forward and reach toward the feet.", focus: [[206, 170, 5], [186, 170, 5]], move: [[108, 112, 186, 170]] },
    ],
    
    paschim_namaskarasana: [
      { body: { head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [76, 72, 144, 72], hips: [88, 122, 132, 122], ground: [110, 226, 74, 8] }, arms: { la: [78, 74, 70, 132], lf: [70, 132, 76, 178], ra: [142, 74, 150, 132], rf: [150, 132, 144, 178], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "1/4: Stand tall with spine long and feet grounded.", focus: [[110, 88, 5]], move: [[110, 118, 110, 55]] },
      { body: { head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [76, 72, 144, 72], hips: [88, 122, 132, 122], ground: [110, 226, 74, 8] }, arms: { la: [78, 74, 76, 108], lf: [76, 108, 96, 126], ra: [142, 74, 144, 108], rf: [144, 108, 124, 126], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "2/4: Bring both arms behind your back.", focus: [[96, 126, 5], [124, 126, 5]], move: [[70, 132, 96, 126], [150, 132, 124, 126]] },
      { body: { head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [78, 74, 142, 74], hips: [88, 122, 132, 122], ground: [110, 226, 74, 8] }, arms: { la: [78, 74, 88, 104], lf: [88, 104, 104, 124], ra: [142, 74, 132, 104], rf: [132, 104, 116, 124], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "3/4: Rotate shoulders inward/back and bring elbows closer.", focus: [[88, 104, 5], [132, 104, 5]], move: [[78, 80, 88, 104], [142, 80, 132, 104]] },
      { body: { head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [78, 74, 142, 74], hips: [88, 122, 132, 122], ground: [110, 226, 74, 8] }, arms: { la: [78, 74, 90, 104], lf: [90, 104, 110, 122], ra: [142, 74, 130, 104], rf: [130, 104, 110, 122], ll: [91, 123, 88, 178], lc: [88, 178, 84, 220], rl: [129, 123, 132, 178], rc: [132, 178, 136, 220] }, guide: "4/4: Join palms behind back, lift chest, and hold.", focus: [[110, 122, 6]], move: [[100, 126, 110, 122], [120, 126, 110, 122]] },
    ],
    pranayama: [
      { body: { head: [110, 58, 15], spine: [110, 74, 110, 136], shoulders: [80, 88, 140, 88], hips: [86, 146, 134, 146], ground: [110, 218, 86, 7] }, arms: { la: [82, 90, 74, 130], lf: [74, 130, 82, 160], ra: [138, 90, 146, 130], rf: [146, 130, 138, 160], ll: [86, 146, 64, 178], lc: [64, 178, 92, 178], rl: [134, 146, 156, 178], rc: [156, 178, 128, 178] }, guide: "1/4: Sit comfortably with legs crossed and spine tall.", focus: [[110, 104, 5]], move: [] },
      { body: { head: [110, 58, 15], spine: [110, 74, 110, 136], shoulders: [80, 88, 140, 88], hips: [86, 146, 134, 146], ground: [110, 218, 86, 7] }, arms: { la: [82, 90, 74, 130], lf: [74, 130, 82, 160], ra: [138, 90, 146, 130], rf: [146, 130, 138, 160], ll: [86, 146, 64, 178], lc: [64, 178, 92, 178], rl: [134, 146, 156, 178], rc: [156, 178, 128, 178] }, guide: "2/4: Close your eyes and relax the shoulders.", focus: [[104, 56, 3], [116, 56, 3]], move: [[110, 74, 110, 58]] },
      { body: { head: [110, 58, 15], spine: [110, 74, 110, 136], shoulders: [80, 88, 140, 88], hips: [86, 146, 134, 146], ground: [110, 218, 86, 7] }, arms: { la: [82, 90, 74, 130], lf: [74, 130, 82, 160], ra: [138, 90, 146, 130], rf: [146, 130, 138, 160], ll: [86, 146, 64, 178], lc: [64, 178, 92, 178], rl: [134, 146, 156, 178], rc: [156, 178, 128, 178] }, guide: "3/4: Inhale slowly and deeply - chest expands gently.", focus: [[110, 112, 7]], move: [[130, 112, 150, 98], [132, 128, 154, 128]] },
      { body: { head: [110, 58, 15], spine: [110, 74, 110, 136], shoulders: [80, 88, 140, 88], hips: [86, 146, 134, 146], ground: [110, 218, 86, 7] }, arms: { la: [82, 90, 74, 130], lf: [74, 130, 82, 160], ra: [138, 90, 146, 130], rf: [146, 130, 138, 160], ll: [86, 146, 64, 178], lc: [64, 178, 92, 178], rl: [134, 146, 156, 178], rc: [156, 178, 128, 178] }, guide: "4/4: Exhale slowly and relax; keep body still.", focus: [[110, 112, 6]], move: [[150, 98, 132, 112], [154, 128, 132, 128]] },
    ],
  };

  function updateDummyGuide(idx) {
    if (!dummyStage) return;
    const step = mission.steps[idx] || {};
    const poseClass = `dummy-${POSE}`;
    dummyStage.className = `dummy-stage ${poseClass} dummy-step-${idx + 1}`;
    const svg = document.getElementById("dummyPoseSvg");
    const setLine = (cls, pts) => {
      const el = svg ? svg.querySelector(cls) : null;
      if (!el || !pts) return;
      ["x1", "y1", "x2", "y2"].forEach((k, i) => el.setAttribute(k, pts[i]));
    };
    const defaults = {
      la: [78, 74, 70, 132], ra: [142, 74, 150, 132],
      lf: [70, 132, 76, 178], rf: [150, 132, 144, 178],
      ll: [91, 123, 88, 178], rl: [129, 123, 132, 178],
      lc: [88, 178, 84, 220], rc: [132, 178, 136, 220],
    };
    const setCircle = (cls, vals) => {
      const el = svg ? svg.querySelector(cls) : null;
      if (!el || !vals) return;
      if (vals.length >= 1) el.setAttribute("cx", vals[0]);
      if (vals.length >= 2) el.setAttribute("cy", vals[1]);
      if (vals.length >= 3) el.setAttribute("r", vals[2]);
    };
    const setEllipse = (cls, vals) => {
      const el = svg ? svg.querySelector(cls) : null;
      if (!el || !vals) return;
      ["cx", "cy", "rx", "ry"].forEach((k, i) => { if (vals[i] !== undefined) el.setAttribute(k, vals[i]); });
    };
    const bodyDefaults = {
      head: [110, 38, 16], spine: [110, 55, 110, 118], shoulders: [76, 72, 144, 72], hips: [88, 122, 132, 122], ground: [110, 226, 74, 8]
    };
    
    setCircle(".dummy-head", bodyDefaults.head);
    setLine(".dummy-spine", bodyDefaults.spine);
    setLine(".dummy-shoulders", bodyDefaults.shoulders);
    setLine(".dummy-hips", bodyDefaults.hips);
    setEllipse(".dummy-ground", bodyDefaults.ground);
    setLine(".dummy-left-arm", defaults.la);
    setLine(".dummy-right-arm", defaults.ra);
    setLine(".dummy-left-forearm", defaults.lf);
    setLine(".dummy-right-forearm", defaults.rf);
    setLine(".dummy-left-leg", defaults.ll);
    setLine(".dummy-right-leg", defaults.rl);
    setLine(".dummy-left-calf", defaults.lc);
    setLine(".dummy-right-calf", defaults.rc);
    const poseData = POSE_STEPS[POSE] || POSE_STEPS.tadasana;
    const stepData = poseData[idx] || poseData[poseData.length - 1];
    const b = stepData.body || {};
    if (b.head) setCircle(".dummy-head", b.head);
    if (b.spine) setLine(".dummy-spine", b.spine);
    if (b.shoulders) setLine(".dummy-shoulders", b.shoulders);
    if (b.hips) setLine(".dummy-hips", b.hips);
    if (b.ground) setEllipse(".dummy-ground", b.ground);
    const a = stepData.arms || {};
    if (a.la) setLine(".dummy-left-arm", a.la);
    if (a.ra) setLine(".dummy-right-arm", a.ra);
    if (a.lf) setLine(".dummy-left-forearm", a.lf);
    if (a.rf) setLine(".dummy-right-forearm", a.rf);
    if (a.ll) setLine(".dummy-left-leg", a.ll);
    if (a.rl) setLine(".dummy-right-leg", a.rl);
    if (a.lc) setLine(".dummy-left-calf", a.lc);
    if (a.rc) setLine(".dummy-right-calf", a.rc);

    const wallEl = svg ? svg.querySelector(".dummy-wall") : null;
    if (wallEl) {
      if (stepData.wall) {
        wallEl.style.display = "block";
        ["x1", "y1", "x2", "y2"].forEach((k, j) => wallEl.setAttribute(k, stepData.wall[j]));
      } else {
        wallEl.style.display = "none";
      }
    }

    const focusEls = svg ? Array.from(svg.querySelectorAll(".dummy-focus")) : [];
    const moveEls = svg ? Array.from(svg.querySelectorAll(".dummy-move")) : [];
    focusEls.forEach((el, i) => {
      const f = (stepData.focus || [])[i];
      el.style.display = f ? "block" : "none";
      if (f) { el.setAttribute("cx", f[0]); el.setAttribute("cy", f[1]); el.setAttribute("r", f[2] || 5); }
    });
    moveEls.forEach((el, i) => {
      const m = (stepData.move || [])[i];
      el.style.display = m ? "block" : "none";
      if (m) ["x1", "y1", "x2", "y2"].forEach((k, j) => el.setAttribute(k, m[j]));
    });

    if (dummyGuideTitle) dummyGuideTitle.textContent = (mission.steps[idx] && mission.steps[idx].title) || "Watch the guide";
    const guide = (stepData && stepData.guide) || "Watch the dummy figure first, then copy the shape in front of the camera.";
    if (dummyGuideText) dummyGuideText.textContent = guide;
  }

  function renderStep(idx) {
    const step = mission.steps[idx];
    updateDummyGuide(idx);
    if (stepNumberEl) stepNumberEl.textContent = `Mission ${idx + 1} of ${totalSteps}`;
    if (stepTitleEl) stepTitleEl.textContent = step.title;
    if (stepInstEl) stepInstEl.textContent = step.instruction;
    const rewardEl = document.getElementById("trainingStepReward");
    if (rewardEl) rewardEl.textContent = `Mission reward: +${step.xp} Training XP`;
    const xpEl = document.getElementById("trainingXpValue");
    if (xpEl) xpEl.textContent = trainingXP;

    stepHold = 0;
    stableClock = 0;
    lastCenter = null;
    stepCompleted = false;
    setRingProgress(0, false);
    setChecklist(["⭕ Waiting for camera validation"]);
    if (validateLabel) validateLabel.textContent = "Complete the objective using real pose validation.";

    if (dotsEl) {
      dotsEl.innerHTML = "";
      mission.steps.forEach((_, i) => {
        const dot = document.createElement("div");
        dot.className = "step-dot" + (i < idx ? " done" : i === idx ? " active" : "");
        dotsEl.appendChild(dot);
      });
    }
  }

  function setChecklist(items) {
    const el = document.getElementById("trainingChecklist");
    if (!el) return;
    el.innerHTML = items.map(item => `<div class="training-check-item ${item.startsWith("✔️") ? "done" : ""}">${item}</div>`).join("");
  }

  function setRingProgress(progress, good) {
    if (!validateRing) return;
    const clamped = clamp01(progress);
    validateRing.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - clamped);
    validateRing.style.stroke = good ? "var(--green)" : clamped > 0.5 ? "var(--gold)" : "var(--text-muted)";
  }

  function setStatus(text) { if (tutStatusEl) tutStatusEl.textContent = text; }

  function completeStep() {
    if (stepCompleted) return;
    stepCompleted = true;
    const step = mission.steps[currentStep];
    trainingXP += step.xp;
    const xpEl = document.getElementById("trainingXpValue");
    if (xpEl) xpEl.textContent = trainingXP;
    if (validateLabel) validateLabel.textContent = `Success! +${step.xp} Training XP`;
    setRingProgress(1, true);
    showPulse(`✔️ ${step.title} Complete`);
    setTimeout(() => {
      if (currentStep < totalSteps - 1) {
        currentStep++;
        renderStep(currentStep);
      } else {
        showTrainingComplete();
      }
    }, 850);
  }

  function showPulse(text) {
    const pulse = document.createElement("div");
    pulse.className = "training-success-pulse";
    pulse.textContent = text;
    document.body.appendChild(pulse);
    setTimeout(() => pulse.remove(), 850);
  }

  function showTrainingComplete() {
    if (tutorialCard) {
      tutorialCard.innerHTML = `
        <div class="training-complete-card">
          <div class="training-complete-icon">✨</div>
          <div class="training-kicker">Missions Complete</div>
          <h2>${mission.title}</h2>
          <p>You cleared every mission. The real ${POSE_LABEL} pose session will now begin.</p>
          <div class="training-reward">Total Mission XP: +${trainingXP}</div>
          <div class="training-launch-note">Launching pose session...</div>
        </div>`;
    }
    setTimeout(enterPractice, 1400);
  }

  function enterPractice() {
    trainingActive = false;
    if (tutAnimId) cancelAnimationFrame(tutAnimId);
    window._yvShared = { landmarker: tutLandmarker, stream: tutStream };
    if (typeof window.startPractice === "function") window.startPractice();
  }

  window.endTutorial = function () {
    trainingActive = false;
    if (tutAnimId) cancelAnimationFrame(tutAnimId);
    if (tutStream) tutStream.getTracks().forEach((t) => t.stop());
  };

  async function init() {
    decorateTrainingUI();
    renderStep(0);
    setStatus("Starting camera…");
    try {
      tutStream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720, facingMode: "user" } });
      if (!tutVideoEl) return;
      tutVideoEl.srcObject = tutStream;
      await new Promise(res => { tutVideoEl.onloadeddata = res; });
      await tutVideoEl.play();
      setStatus("Loading pose model…");
    } catch (err) {
      setStatus("Camera access is required for training validation.");
      if (validateLabel) validateLabel.textContent = "Allow camera access to complete training.";
      return;
    }

    try {
      tutLandmarker = await initMediaPipe();
      setStatus(tutLandmarker ? "" : "Pose model unavailable. Please refresh and try again.");
    } catch (err) {
      setStatus("Pose model failed. Please refresh and try again.");
      return;
    }
    startLoop();
  }

  function startLoop() {
    lastTick = Date.now();
    function loop() {
      if (!trainingActive) return;
      if (tutVideoEl && tutVideoEl.readyState >= 2 && tutCanvasEl && tutCtx) {
        const W = tutVideoEl.videoWidth || 640;
        const H = tutVideoEl.videoHeight || 480;
        tutCanvasEl.width = W;
        tutCanvasEl.height = H;
        tutCtx.save();
        tutCtx.scale(-1, 1);
        tutCtx.translate(-W, 0);
        tutCtx.drawImage(tutVideoEl, 0, 0, W, H);
        tutCtx.restore();

        const now = Date.now();
        const dt = Math.min(0.15, (now - lastTick) / 1000);
        lastTick = now;

        const result = tutLandmarker.detectForVideo(tutVideoEl, performance.now());
        if (result.landmarks && result.landmarks.length > 0) {
          const rawLm = result.landmarks[0];
          const lm = (window._poseUtils && window._poseUtils.smoothLandmarks) ? window._poseUtils.smoothLandmarks(rawLm) : rawLm;
          drawSkeleton(tutCtx, lm, W, H);
          const step = mission.steps[currentStep];
          const res = step.check(lm, dt) || { score: 0, label: "Keep adjusting", details: [] };
          const score = clamp01(res.score || 0);
          if (score >= 0.78) stepHold += dt;
          else stepHold = Math.max(0, stepHold - dt * 0.55);
          const progress = Math.min(1, stepHold / TRAIN_HOLD_REQUIRED);
          setRingProgress(progress, score >= 0.78);
          setChecklist(res.details || []);
          if (validateLabel) validateLabel.textContent = progress >= 1 ? "Objective complete!" : `${res.label} • ${(progress * 100).toFixed(0)}%`;
          if (progress >= 1) completeStep();
        } else {
          stepHold = Math.max(0, stepHold - dt * 0.6);
          setRingProgress(stepHold / TRAIN_HOLD_REQUIRED, false);
          setChecklist(["⭕ Body not detected", "⭕ Step into the camera frame"]);
          if (validateLabel) validateLabel.textContent = "Step into frame to continue training.";
        }
      }
      tutAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  init();
})();
