(function () {
  "use strict";

  let gCanvas = null, gCtx = null;
  let gPose = null;
  let gLevel = 1, gProgress = 0, gTime = 0, gAnimId = null;
  let gAccuracy = 0;

  const KNOWN_WORLD_POSES = new Set([
    "tree", "warrior", "padmasana", "vajrasana", "baddha_konasana", "tadasana",
    "trikonasana", "balasana", "bhujangasana", "wall_plank_chaturanga",
    "padahastasana", "paschimottanasana", "paschim_namaskarasana", "pranayama",
  ]);

  window.initGameWorld = function (canvas, poseName) {
    if (gAnimId) cancelAnimationFrame(gAnimId);
    gCanvas = canvas; gCtx = canvas.getContext("2d");
    gPose = poseName || null;
    gLevel = 1; gProgress = 0; gTime = 0;
    if (!gPose || !KNOWN_WORLD_POSES.has(gPose)) {
      console.warn(`[game_world] No world registered for pose "${poseName}" - showing placeholder instead of defaulting to another pose's world.`);
    }
    _buildTree(); _buildWarrior(); _buildLotus(); _buildTemple(); _buildButterfly();
    loop();
  };

  window.updateGameWorld = function (level, progress, accuracy) {
    gLevel = level;
    gProgress = Math.max(0, Math.min(1, progress));
    gAccuracy = accuracy || 0;
  };

  window.stopGameWorld = function () {
    if (gAnimId) cancelAnimationFrame(gAnimId);
    gAnimId = null;
  };

  function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function remap(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function growth() { return clamp(((gLevel - 1) + gProgress) / 4, 0, 1); }

  function sRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  }

  const T = {};
  const TRUNK_END = 0.35;
  const BRANCH_END = 0.68;
  const TRUNK_H_MAX = 210;

  function _buildTree() {
    const rngB = sRng(77);
    T.branches = [
      { ang: 142, h: 0.38, len: 115, thick: 8.0, side: -1 },
      { ang: 38, h: 0.40, len: 110, thick: 7.5, side: 1 },
      { ang: 132, h: 0.54, len: 100, thick: 6.5, side: -1 },
      { ang: 48, h: 0.56, len: 95, thick: 6.0, side: 1 },
      { ang: 148, h: 0.68, len: 82, thick: 5.0, side: -1 },
      { ang: 32, h: 0.70, len: 77, thick: 4.5, side: 1 },
      { ang: 128, h: 0.80, len: 65, thick: 3.5, side: -1 },
      { ang: 52, h: 0.82, len: 60, thick: 3.0, side: 1 },
      { ang: 152, h: 0.90, len: 48, thick: 2.5, side: -1 },
      { ang: 28, h: 0.92, len: 43, thick: 2.0, side: 1 },
    ];
    T.branches.forEach(b => {
      b.ang += (rngB() - 0.5) * 8;
      b.len += (rngB() - 0.5) * 10;
      b.h += (rngB() - 0.5) * 0.025;
    });
    T.bp = T.branches.map((_, i) => {
      const pairDelay = Math.floor(i / 2) * 0.042;
      const sideDelay = (i % 2) * 0.010;
      const start = TRUNK_END + pairDelay + sideDelay;
      return { start, end: start + 0.16 };
    });
    function branchTip(bc) {
      const rad = bc.ang * Math.PI / 180;
      const bx = Math.cos(rad) * bc.len;
      const by = bc.h * TRUNK_H_MAX + Math.abs(Math.sin(rad)) * bc.len * 0.7;
      return { bx, by };
    }
    const rngL = sRng(42);
    T.leaves = [];
    for (let b = 0; b < T.branches.length; b++) {
      const bc = T.branches[b];
      const { bx, by } = branchTip(bc);
      const bEnd = T.bp[b].end;
      for (let k = 0; k < 28; k++) {
        const angle = rngL() * Math.PI * 2;
        const dist = rngL() * 88;
        T.leaves.push({
          bxOff: bx, byOff: by,
          ox: Math.cos(angle) * dist,
          oy: Math.sin(angle) * dist * 0.65 - 8,
          size: 9 + rngL() * 18,
          rot: rngL() * Math.PI * 2,
          hue: 85 + rngL() * 50,
          sat: 40 + rngL() * 32,
          lit: 20 + rngL() * 26,
          phOff: rngL() * 0.055,
          bEnd,
          isFruit: false,
        });
      }
    }
    const rngC = sRng(99);
    T.canopy = [];
    for (let k = 0; k < 90; k++) {
      const angle = rngC() * Math.PI * 2;
      const dist = rngC() * 68;
      T.canopy.push({
        bxOff: 0, byOff: TRUNK_H_MAX,
        ox: Math.cos(angle) * dist,
        oy: Math.sin(angle) * dist * 0.7 - 15,
        size: 9 + rngC() * 16,
        rot: rngC() * Math.PI * 2,
        hue: 92 + rngC() * 38,
        sat: 44 + rngC() * 28,
        lit: 22 + rngC() * 20,
        phOff: rngC() * 0.04,
        bEnd: BRANCH_END,
        isFruit: false,
      });
    }
    const rngF = sRng(13);
    T.fruits = [];
    for (let b = 2; b < T.branches.length; b++) {
      const bc = T.branches[b];
      const { bx, by } = branchTip(bc);
      for (let k = 0; k < 3; k++) {
        const angle = rngF() * Math.PI * 2;
        const dist = 20 + rngF() * 45;
        T.fruits.push({
          bxOff: bx, byOff: by,
          ox: Math.cos(angle) * dist,
          oy: Math.sin(angle) * dist * 0.5,
          size: 7 + rngF() * 6,
          hue: rngF() > 0.5 ? 0 : 35,
          phOff: rngF() * Math.PI * 2,
          threshold: 0.50 + rngF() * 0.08,
        });
      }
    }
    const rngBd = sRng(55);
    T.birds = [];
    for (let i = 0; i < 6; i++) {
      T.birds.push({
        xFrac: rngBd(),
        yFrac: 0.05 + rngBd() * 0.25,
        speed: 0.00015 + rngBd() * 0.0002,
        flapPhase: rngBd() * Math.PI * 2,
        size: 3 + rngBd() * 3,
        threshold: 0.25 + rngBd() * 0.20,
      });
    }
  }

  function renderUnknownPoseWorld(W, H) {
    const grd = gCtx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#1e2230");
    grd.addColorStop(1, "#12141c");
    gCtx.fillStyle = grd;
    gCtx.fillRect(0, 0, W, H);

    gCtx.save();
    gCtx.textAlign = "center";
    gCtx.textBaseline = "middle";
    gCtx.fillStyle = "rgba(226,232,240,0.85)";
    gCtx.font = `${Math.max(14, Math.round(Math.min(W, H) * 0.045))}px sans-serif`;
    gCtx.fillText("World not available for this pose yet", W / 2, H / 2 - 12);
    gCtx.font = `${Math.max(11, Math.round(Math.min(W, H) * 0.03))}px sans-serif`;
    gCtx.fillStyle = "rgba(148,163,184,0.75)";
    gCtx.fillText(`(${gPose || "unknown pose"})`, W / 2, H / 2 + 16);
    gCtx.restore();
  }

  function renderTree(W, H) {
    const g = growth();
    const s = Math.min(W, H) / 580;
    const GROUND_Y = H * 0.88;
    const TX = W * 0.50;
    const skyGrd = gCtx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrd.addColorStop(0, `rgb(${Math.round(6 + g * 22)},${Math.round(14 + g * 44)},${Math.round(6 + g * 18)})`);
    skyGrd.addColorStop(1, `rgb(${Math.round(12 + g * 38)},${Math.round(28 + g * 62)},${Math.round(10 + g * 28)})`);
    gCtx.fillStyle = skyGrd;
    gCtx.fillRect(0, 0, W, GROUND_Y);
    _treeStars(W, H, GROUND_Y, g);
    _treeSunRays(W, H, g);
    const groundGrd = gCtx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrd.addColorStop(0, "#172c07");
    groundGrd.addColorStop(1, "#091303");
    gCtx.fillStyle = groundGrd;
    gCtx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    const mossR = (25 + g * 190) * s;
    const mg = gCtx.createRadialGradient(TX, GROUND_Y + 9 * s, 2, TX, GROUND_Y + 9 * s, mossR);
    mg.addColorStop(0, "rgba(28,95,12,0.95)");
    mg.addColorStop(0.55, "rgba(18,65,8,0.55)");
    mg.addColorStop(1, "rgba(8,35,3,0)");
    gCtx.beginPath();
    gCtx.ellipse(TX, GROUND_Y + 9 * s, mossR * 1.5, mossR * 0.28, 0, 0, Math.PI * 2);
    gCtx.fillStyle = mg; gCtx.fill();
    const windAmt = g > 0.25 ? clamp((g - 0.25) * 4, 0, 1) : 0;
    const windSway = windAmt * Math.sin(gTime * 1.4) * 6 * s;
    _treeTrunk(TX, GROUND_Y, s, g, windSway);
    for (let i = 0; i < T.branches.length; i++) {
      _treeBranch(T.branches[i], T.bp[i], TX, GROUND_Y, s, g, windSway);
    }
    const allLeaves = [...T.leaves, ...T.canopy];
    for (const lf of allLeaves) { _treeLeaf(lf, TX, GROUND_Y, s, g, windSway); }
    for (const fr of T.fruits) { _treeFruit(fr, TX, GROUND_Y, s, g, windSway); }
    _treeParticles(TX, GROUND_Y, W, H, g);
    for (const bd of T.birds) { _treeBird(bd, W, H, g); }
    const vig = gCtx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.88);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.60)");
    gCtx.fillStyle = vig;
    gCtx.fillRect(0, 0, W, H);
    _drawLevelLabel(W, H, g);
  }

  function _treeStars(W, H, groundY, g) {
    const alpha = clamp(1 - g * 3, 0, 0.6);
    if (alpha <= 0) return;
    for (let i = 0; i < 50; i++) {
      const x = ((i * 137.5) % 1) * W;
      const y = ((i * 97.3) % 1) * groundY;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(gTime * (0.5 + i * 0.03) + i));
      gCtx.beginPath();
      gCtx.arc(x, y, 0.7 + (i % 3) * 0.4, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(200,240,200,${alpha * tw})`;
      gCtx.fill();
    }
  }

  function _treeSunRays(W, H, g) {
    if (g < 0.28) return;
    const alpha = (g - 0.28) / 0.72 * 0.09;
    const sx = W * 0.83, sy = H * 0.06;
    gCtx.save();
    gCtx.globalAlpha = alpha;
    for (let i = 0; i < 8; i++) {
      const a = (-0.7 + i * 0.2) * Math.PI;
      const len = Math.min(W, H) * (0.5 + i * 0.04);
      gCtx.strokeStyle = "rgba(180,255,130,0.7)";
      gCtx.lineWidth = (22 + i * 9) * (Math.min(W, H) / 580);
      gCtx.beginPath(); gCtx.moveTo(sx, sy);
      gCtx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      gCtx.stroke();
    }
    gCtx.restore();
  }

  function _treeTrunk(TX, groundY, s, g, sway) {
    const t = remap(g, 0, TRUNK_END);
    if (t <= 0) return;
    const tH = t * TRUNK_H_MAX * s;
    const topY = groundY - tH;
    const w0 = 19 * s, w1 = 5 * s;
    const wobX = 6 * t * s + sway;
    const tgr = gCtx.createLinearGradient(TX - w0, 0, TX + w0, 0);
    tgr.addColorStop(0, "#251006");
    tgr.addColorStop(0.35, "#5e3214");
    tgr.addColorStop(0.55, "#7d451c");
    tgr.addColorStop(0.75, "#5e3214");
    tgr.addColorStop(1, "#251006");
    gCtx.save();
    gCtx.beginPath();
    gCtx.moveTo(TX - w0, groundY);
    gCtx.bezierCurveTo(TX + wobX - w1 * 1.1, groundY - tH * 0.38, TX - wobX * 0.4 - w1 * 0.7, topY + tH * 0.22, TX - w1 * 0.3, topY);
    gCtx.lineTo(TX + w1 * 0.3, topY);
    gCtx.bezierCurveTo(TX - wobX * 0.4 + w1 * 0.7, topY + tH * 0.22, TX + wobX + w1 * 1.1, groundY - tH * 0.38, TX + w0, groundY);
    gCtx.closePath();
    gCtx.fillStyle = tgr; gCtx.fill();
    gCtx.strokeStyle = "rgba(10,4,1,0.28)"; gCtx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const yy = groundY - (i / 5) * tH;
      const xOff = Math.sin(i * 1.7) * 3 * s;
      gCtx.beginPath();
      gCtx.moveTo(TX - w0 * 0.6 + xOff, yy);
      gCtx.quadraticCurveTo(TX + xOff * 0.3, yy - 12 * s, TX + w0 * 0.5 + xOff, yy - 4 * s);
      gCtx.stroke();
    }
    gCtx.restore();
  }

  function _treeBranch(bc, phase, TX, groundY, s, g, sway) {
    const bt = remap(g, phase.start, phase.end);
    if (bt <= 0) return;
    const rad = bc.ang * Math.PI / 180;
    const oy = groundY - bc.h * TRUNK_H_MAX * s;
    const ex = TX + sway * (1 - bc.h) + Math.cos(rad) * bc.len * s * bt;
    const ey = oy - Math.abs(Math.sin(rad)) * bc.len * s * bt * 0.72;
    const cpx = TX + sway * (1 - bc.h) * 0.5 + Math.cos(rad) * bc.len * s * 0.48 * bt;
    const cpy = oy - Math.abs(Math.sin(rad)) * bc.len * s * 0.44 * bt - 20 * s * bt;
    gCtx.save();
    gCtx.strokeStyle = `hsl(24, 52%, ${16 + bt * 14}%)`;
    gCtx.lineWidth = bc.thick * s * (1 - bt * 0.32);
    gCtx.lineCap = "round";
    gCtx.beginPath(); gCtx.moveTo(TX, oy);
    gCtx.quadraticCurveTo(cpx, cpy, ex, ey); gCtx.stroke();
    if (bt > 0.55 && bc.thick > 3.5) {
      const srad = rad + bc.side * 0.40;
      const sbt = (bt - 0.55) / 0.45;
      gCtx.lineWidth = bc.thick * s * 0.38;
      gCtx.beginPath(); gCtx.moveTo(ex, ey);
      gCtx.lineTo(ex + Math.cos(srad) * bc.len * s * 0.28 * sbt, ey - Math.abs(Math.sin(srad)) * bc.len * s * 0.22 * sbt);
      gCtx.stroke();
    }
    gCtx.restore();
  }

  function _treeLeaf(lf, TX, groundY, s, g, sway) {
    const span = Math.max(0.12, 1.0 - lf.bEnd);
    const lt = remap(g, lf.bEnd + lf.phOff, lf.bEnd + lf.phOff + span * 0.78);
    if (lt <= 0) return;
    const alpha = Math.min(1, lt * 1.9) * 0.90;
    const windOff = sway * (1 - lf.byOff / TRUNK_H_MAX) * 0.6;
    const bx = TX + lf.bxOff * s + windOff;
    const by = groundY - lf.byOff * s;
    const sx = lf.size * s * (0.25 + lt * 0.75);
    const sy = lf.size * s * 0.52 * (0.15 + lt * 0.85);
    const unfurlRot = lf.rot + (1 - lt) * Math.PI * 0.45;
    const rustle = g > 0.25 ? Math.sin(gTime * 2.1 + lf.phOff * 40) * 0.05 : 0;
    gCtx.save();
    gCtx.globalAlpha = alpha;
    gCtx.translate(bx + lf.ox * s, by + lf.oy * s);
    gCtx.rotate(unfurlRot + rustle);
    gCtx.beginPath();
    gCtx.moveTo(0, -sy);
    gCtx.bezierCurveTo(sx * 0.7, -sy * 0.72, sx * 0.88, sy * 0.22, 0, sy);
    gCtx.bezierCurveTo(-sx * 0.88, sy * 0.22, -sx * 0.7, -sy * 0.72, 0, -sy);
    gCtx.fillStyle = `hsl(${lf.hue}, ${lf.sat}%, ${lf.lit}%)`;
    gCtx.fill();
    gCtx.beginPath();
    gCtx.moveTo(0, -sy * 0.88);
    gCtx.quadraticCurveTo(sx * 0.12, 0, 0, sy * 0.88);
    gCtx.strokeStyle = `hsl(${lf.hue - 8}, ${lf.sat - 12}%, ${lf.lit - 8}%)`;
    gCtx.lineWidth = 0.65; gCtx.globalAlpha = alpha * 0.55; gCtx.stroke();
    gCtx.restore();
  }

  function _treeFruit(fr, TX, groundY, s, g, sway) {
    if (g < fr.threshold) return;
    const ft = clamp((g - fr.threshold) / 0.06, 0, 1);
    const windOff = sway * (1 - fr.byOff / TRUNK_H_MAX) * 0.6;
    const bx = TX + fr.bxOff * s + windOff;
    const by = groundY - fr.byOff * s;
    const fx = bx + fr.ox * s;
    const fy = by + fr.oy * s + Math.sin(gTime * 1.2 + fr.phOff) * 2 * s;
    const r = fr.size * s * (0.3 + ft * 0.7);
    gCtx.save();
    gCtx.globalAlpha = ft * 0.92;
    const frGrd = gCtx.createRadialGradient(fx - r * 0.3, fy - r * 0.3, r * 0.1, fx, fy, r);
    frGrd.addColorStop(0, fr.hue === 0 ? "#ff6666" : "#ffcc44");
    frGrd.addColorStop(0.7, fr.hue === 0 ? "#cc2200" : "#ee8800");
    frGrd.addColorStop(1, fr.hue === 0 ? "#881100" : "#884400");
    gCtx.beginPath(); gCtx.arc(fx, fy, r, 0, Math.PI * 2);
    gCtx.fillStyle = frGrd; gCtx.fill();
    gCtx.beginPath(); gCtx.arc(fx - r * 0.28, fy - r * 0.28, r * 0.25, 0, Math.PI * 2);
    gCtx.fillStyle = "rgba(255,255,255,0.35)"; gCtx.fill();
    gCtx.strokeStyle = "#5a3214"; gCtx.lineWidth = 1.5 * s;
    gCtx.beginPath(); gCtx.moveTo(fx, fy - r); gCtx.lineTo(fx + 2 * s, fy - r - 5 * s); gCtx.stroke();
    gCtx.restore();
  }

  function _treeParticles(TX, groundY, W, H, g) {
    if (g < 0.48) return;
    const r2 = sRng(Math.floor(Date.now() / 90));
    const count = Math.floor((g - 0.48) / 0.52 * 30);
    gCtx.save();
    for (let i = 0; i < count; i++) {
      gCtx.globalAlpha = r2() * 0.45;
      gCtx.fillStyle = `hsl(${80 + r2() * 50}, 70%, 62%)`;
      gCtx.beginPath();
      gCtx.arc(TX + (r2() - 0.5) * W * 0.7, groundY - r2() * H * 0.7, (1.2 + r2() * 2.4) * (Math.min(W, H) / 580), 0, Math.PI * 2);
      gCtx.fill();
    }
    gCtx.restore();
  }

  function _treeBird(bd, W, H, g) {
    if (g < bd.threshold) return;
    const alpha = clamp((g - bd.threshold) / 0.08, 0, 0.9);
    bd.xFrac += bd.speed;
    if (bd.xFrac > 1.08) bd.xFrac = -0.08;
    const x = bd.xFrac * W;
    const y = bd.yFrac * H;
    const flap = Math.sin(gTime * 6 + bd.flapPhase) * bd.size;
    const sz = bd.size * (Math.min(W, H) / 580);
    gCtx.save();
    gCtx.globalAlpha = alpha;
    gCtx.strokeStyle = "rgba(200,240,200,0.8)";
    gCtx.lineWidth = 1.3;
    gCtx.beginPath();
    gCtx.moveTo(x - sz, y + flap);
    gCtx.quadraticCurveTo(x, y - flap * 0.5, x + sz, y + flap);
    gCtx.stroke();
    gCtx.restore();
  }

  const WR = {};

  function _buildWarrior() {
    const rngCl = sRng(17);
    WR.clouds = [];
    for (let i = 0; i < 7; i++) {
      WR.clouds.push({
        xFrac: rngCl() * 0.9 + 0.05,
        yFrac: 0.04 + rngCl() * 0.22,
        rx: 0.08 + rngCl() * 0.07,
        ry: 0.03 + rngCl() * 0.03,
        phase: rngCl() * Math.PI * 2,
        speed: 0.0001 + rngCl() * 0.00015,
        puffs: Math.floor(3 + rngCl() * 3),
      });
    }
    const rngSp = sRng(31);
    WR.spirits = [];
    for (let i = 0; i < 8; i++) {
      WR.spirits.push({
        xFrac: rngSp(),
        yFrac: 0.1 + rngSp() * 0.5,
        speed: (0.0003 + rngSp() * 0.0004) * (rngSp() > 0.5 ? 1 : -1),
        phaseY: rngSp() * Math.PI * 2,
        r: 0.012 + rngSp() * 0.01,
        hue: rngSp() > 0.4 ? 270 : 0,
      });
    }
    WR.lightning = { timer: 0, interval: 3.5, active: false, x: 0.5, segs: [] };
    const rngEm = sRng(63);
    WR.embers = [];
    for (let i = 0; i < 40; i++) {
      WR.embers.push({
        xFrac: rngEm(),
        yFrac: 0.5 + rngEm() * 0.4,
        vy: -(0.0002 + rngEm() * 0.0004),
        vx: (rngEm() - 0.5) * 0.0003,
        size: 1 + rngEm() * 2.5,
        phase: rngEm() * Math.PI * 2,
        threshold: 0.25 + rngEm() * 0.3,
      });
    }
  }

  function renderWarrior(W, H) {
    const g = growth();
    const groundY = H * 0.72;
    const skyGrd = gCtx.createLinearGradient(0, 0, 0, groundY);
    skyGrd.addColorStop(0, `rgb(${Math.round(lerp(18, 28, g))},${Math.round(lerp(8, 22, g))},${Math.round(lerp(8, 14, g))})`);
    skyGrd.addColorStop(1, `rgb(${Math.round(lerp(35, 20, g))},${Math.round(lerp(12, 12, g))},${Math.round(lerp(10, 10, g))})`);
    gCtx.fillStyle = skyGrd;
    gCtx.fillRect(0, 0, W, groundY);
    if (g < 0.5) {
      const sAlpha = 1 - g * 2;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 137.5) % 1) * W, sy = ((i * 97.3) % 1) * groundY * 0.7;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(gTime * (0.4 + i * 0.02) + i));
        gCtx.beginPath(); gCtx.arc(sx, sy, 0.7 + (i % 3) * 0.4, 0, Math.PI * 2);
        gCtx.fillStyle = `rgba(255,220,180,${sAlpha * tw * 0.6})`; gCtx.fill();
      }
    }
    _warriorClouds(W, H, groundY, g);
    _warriorLightning(W, H, groundY, g);
    _warriorCelestial(W, H, g);
    const grdG = gCtx.createLinearGradient(0, groundY, 0, H);
    grdG.addColorStop(0, g > 0.5 ? "#2a1d0e" : "#1a1208");
    grdG.addColorStop(1, "#080502");
    gCtx.fillStyle = grdG;
    gCtx.fillRect(0, groundY, W, H - groundY);
    const hGlow = gCtx.createLinearGradient(0, groundY - 30, 0, groundY + 30);
    hGlow.addColorStop(0, "transparent");
    hGlow.addColorStop(0.5, g > 0.5 ? `rgba(250,180,50,${0.08 + g * 0.12})` : `rgba(180,60,20,0.06)`);
    hGlow.addColorStop(1, "transparent");
    gCtx.fillStyle = hGlow;
    gCtx.fillRect(0, groundY - 30, W, 60);
    _warriorVillage(W, H, groundY, g);
    if (g > 0.22) _warriorTorches(W, H, groundY, g);
    _warriorEmbers(W, H, g);
    _warriorSpirits(W, H, g);
    const vig = gCtx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
    gCtx.fillStyle = vig; gCtx.fillRect(0, 0, W, H);
    _drawLevelLabel(W, H, g);
  }

  function _warriorClouds(W, H, groundY, g) {
    const cloudAlpha = clamp(1.2 - g * 2.2, 0, 0.85);
    if (cloudAlpha <= 0) return;
    gCtx.save();
    for (const cl of WR.clouds) {
      cl.xFrac += cl.speed;
      if (cl.xFrac > 1.1) cl.xFrac = -0.1;
      const cx = cl.xFrac * W;
      const cy = cl.yFrac * H + Math.sin(gTime * 0.3 + cl.phase) * H * 0.01;
      const rx = cl.rx * W, ry = cl.ry * H;
      gCtx.globalAlpha = cloudAlpha;
      for (let p = 0; p < cl.puffs; p++) {
        const pxOff = (p - cl.puffs / 2) * rx * 0.7;
        const pyOff = Math.sin(p * 1.2) * ry * 0.4;
        const pr = rx * (0.5 + Math.sin(p * 0.9) * 0.2);
        const cGrd = gCtx.createRadialGradient(cx + pxOff, cy + pyOff, 0, cx + pxOff, cy + pyOff, pr);
        cGrd.addColorStop(0, "rgba(40,25,25,0.9)");
        cGrd.addColorStop(0.6, "rgba(25,15,15,0.6)");
        cGrd.addColorStop(1, "transparent");
        gCtx.fillStyle = cGrd;
        gCtx.beginPath(); gCtx.arc(cx + pxOff, cy + pyOff, pr, 0, Math.PI * 2); gCtx.fill();
      }
    }
    gCtx.restore();
  }

  function _warriorLightning(W, H, groundY, g) {
    if (g > 0.55) return;
    WR.lightning.timer += 0.016;
    if (WR.lightning.timer >= WR.lightning.interval) {
      WR.lightning.timer = 0;
      WR.lightning.interval = 2 + Math.random() * 4;
      WR.lightning.active = true;
      WR.lightning.flashTime = 0.18;
      WR.lightning.x = 0.1 + Math.random() * 0.8;
      WR.lightning.segs = [];
      let lx = WR.lightning.x * W, ly = H * 0.05;
      for (let i = 0; i < 8; i++) {
        lx += (Math.random() - 0.5) * W * 0.08;
        ly += H * 0.07;
        WR.lightning.segs.push({ x: lx, y: ly });
      }
    }
    if (WR.lightning.active) {
      WR.lightning.flashTime -= 0.016;
      const alpha = clamp(WR.lightning.flashTime / 0.18, 0, 1) * clamp(1 - g * 2, 0.1, 1);
      if (WR.lightning.flashTime <= 0) WR.lightning.active = false;
      gCtx.save();
      gCtx.globalAlpha = alpha * 0.9;
      gCtx.strokeStyle = "rgba(200,180,255,0.95)";
      gCtx.lineWidth = 2;
      gCtx.shadowColor = "rgba(180,160,255,0.8)"; gCtx.shadowBlur = 8;
      gCtx.beginPath(); gCtx.moveTo(WR.lightning.x * W, H * 0.05);
      for (const seg of WR.lightning.segs) { gCtx.lineTo(seg.x, seg.y); }
      gCtx.stroke();
      gCtx.globalAlpha = alpha * 0.08;
      gCtx.fillStyle = "rgba(220,210,255,1)"; gCtx.fillRect(0, 0, W, groundY);
      gCtx.restore();
    }
  }

  function _warriorCelestial(W, H, g) {
    const cx = W * 0.75, cy = H * 0.16;
    const r = (22 + g * 8) * (Math.min(W, H) / 400);
    const glowColor = g > 0.4 ? `rgba(250,204,21,${0.12 + g * 0.18})` : `rgba(200,80,30,${0.1 + g * 0.1})`;
    const bodyColor = g > 0.4 ? `rgba(250,204,21,${0.6 + g * 0.4})` : `rgba(180,70,20,${0.3 + g * 0.3})`;
    const glow = gCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
    glow.addColorStop(0, glowColor); glow.addColorStop(1, "transparent");
    gCtx.fillStyle = glow;
    gCtx.beginPath(); gCtx.arc(cx, cy, r * 2.5, 0, Math.PI * 2); gCtx.fill();
    gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2);
    gCtx.fillStyle = bodyColor; gCtx.fill();
  }

  function _warriorVillage(W, H, groundY, g) {
    const houses = [
      { xF: 0.08, wF: 0.18, hF: 0.22, roofHue: 0 },
      { xF: 0.34, wF: 0.24, hF: 0.28, roofHue: 20 },
      { xF: 0.64, wF: 0.22, hF: 0.20, roofHue: 260 },
    ];
    houses.forEach(({ xF, wF, hF, roofHue }) => {
      const hx = xF * W, hw = wF * W, hh = hF * H;
      const wb = Math.round(lerp(18, 60, g));
      const wallColor = `rgb(${wb},${Math.round(wb * 0.7)},${Math.round(wb * 0.55)})`;
      const alpha = 0.3 + g * 0.7;
      gCtx.save();
      gCtx.globalAlpha = alpha;
      gCtx.fillStyle = wallColor;
      gCtx.fillRect(hx, groundY - hh, hw, hh);
      const roofLight = Math.round(lerp(14, 35, g));
      gCtx.fillStyle = `hsl(${roofHue}, 40%, ${roofLight}%)`;
      gCtx.beginPath();
      gCtx.moveTo(hx - hw * 0.05, groundY - hh);
      gCtx.lineTo(hx + hw + hw * 0.05, groundY - hh);
      gCtx.lineTo(hx + hw / 2, groundY - hh - H * 0.09);
      gCtx.closePath(); gCtx.fill();
      gCtx.fillStyle = g > 0.5 ? "rgba(80,40,20,0.9)" : "rgba(10,6,4,0.9)";
      const dw = hw * 0.18, dh = hh * 0.35;
      gCtx.fillRect(hx + hw / 2 - dw / 2, groundY - dh, dw, dh);
      const winAlpha = g > 0.25 ? clamp((g - 0.25) / 0.25, 0, 1) : 0;
      if (winAlpha > 0) {
        const winSize = hw * 0.15;
        const winY = groundY - hh + hh * 0.25;
        const winColor = `rgba(255,${Math.round(lerp(100, 220, g))},${Math.round(lerp(30, 90, g))},${winAlpha * 0.8})`;
        gCtx.fillStyle = winColor;
        gCtx.fillRect(hx + hw * 0.12, winY, winSize, winSize);
        gCtx.fillRect(hx + hw * 0.68, winY, winSize, winSize);
      }
      gCtx.restore();
    });
  }

  function _warriorTorches(W, H, groundY, g) {
    const positions = [W * 0.30, W * 0.60];
    const flicker = 0.7 + 0.3 * Math.sin(gTime * 9);
    const flicker2 = 0.6 + 0.4 * Math.sin(gTime * 13.7);
    const alpha = clamp((g - 0.22) / 0.15, 0, 1);
    positions.forEach((tx, idx) => {
      const ty = groundY - H * 0.07;
      gCtx.save();
      gCtx.globalAlpha = alpha * 0.8;
      gCtx.strokeStyle = "#443322"; gCtx.lineWidth = 3;
      gCtx.beginPath(); gCtx.moveTo(tx, ty + H * 0.07); gCtx.lineTo(tx, ty); gCtx.stroke();
      const flk = idx === 0 ? flicker : flicker2;
      const fH = H * 0.06 * flk, fR = H * 0.04 * flk;
      const og = gCtx.createRadialGradient(tx, ty, 0, tx, ty, fR * 2.5);
      og.addColorStop(0, `rgba(255,140,20,${0.2 * alpha})`); og.addColorStop(1, "transparent");
      gCtx.globalAlpha = 1;
      gCtx.fillStyle = og;
      gCtx.beginPath(); gCtx.arc(tx, ty, fR * 2.5, 0, Math.PI * 2); gCtx.fill();
      gCtx.globalAlpha = alpha;
      gCtx.beginPath();
      gCtx.moveTo(tx - fR * 0.5, ty);
      gCtx.bezierCurveTo(tx - fR * 0.8, ty - fH * 0.4, tx - fR * 0.3, ty - fH * 0.7, tx, ty - fH);
      gCtx.bezierCurveTo(tx + fR * 0.3, ty - fH * 0.7, tx + fR * 0.8, ty - fH * 0.4, tx + fR * 0.5, ty);
      gCtx.closePath();
      const fg = gCtx.createLinearGradient(tx, ty, tx, ty - fH);
      fg.addColorStop(0, "rgba(255,80,10,0.9)");
      fg.addColorStop(0.5, "rgba(255,180,30,0.8)");
      fg.addColorStop(1, "rgba(255,240,180,0.4)");
      gCtx.fillStyle = fg; gCtx.fill();
      gCtx.beginPath(); gCtx.arc(tx, ty - fH * 0.2, fR * 0.22, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(255,240,160,${alpha * 0.9})`; gCtx.fill();
      gCtx.restore();
    });
  }

  function _warriorEmbers(W, H, g) {
    if (g < 0.25) return;
    const alpha = clamp((g - 0.25) / 0.25, 0, 1);
    gCtx.save();
    for (const em of WR.embers) {
      if (g < em.threshold) continue;
      em.xFrac += em.vx; em.yFrac += em.vy;
      if (em.yFrac < -0.05 || em.xFrac < -0.05 || em.xFrac > 1.05) {
        em.xFrac = Math.random(); em.yFrac = 0.55 + Math.random() * 0.35;
      }
      const ex = em.xFrac * W, ey = em.yFrac * H;
      const ea = alpha * (0.4 + 0.6 * Math.sin(gTime * 4 + em.phase));
      gCtx.globalAlpha = ea * 0.7;
      gCtx.beginPath(); gCtx.arc(ex, ey, em.size * (Math.min(W, H) / 400), 0, Math.PI * 2);
      gCtx.fillStyle = g > 0.5 ? `hsl(45,90%,70%)` : `hsl(10,80%,55%)`;
      gCtx.fill();
    }
    gCtx.restore();
  }

  function _warriorSpirits(W, H, g) {
    const alpha = clamp(1.2 - g * 2.4, 0, 0.75);
    if (alpha <= 0) return;
    gCtx.save();
    for (const sp of WR.spirits) {
      sp.xFrac += sp.speed;
      if (sp.xFrac > 1.1) sp.xFrac = -0.1;
      if (sp.xFrac < -0.1) sp.xFrac = 1.1;
      const sx = sp.xFrac * W;
      const sy = sp.yFrac * H + Math.sin(gTime * 1.5 + sp.phaseY) * H * 0.03;
      const sr = sp.r * Math.min(W, H);
      const sa = alpha * (0.5 + 0.5 * Math.sin(gTime * 2 + sp.phaseY));
      const spGrd = gCtx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      spGrd.addColorStop(0, `hsla(${sp.hue}, 80%, 60%, ${sa})`);
      spGrd.addColorStop(0.5, `hsla(${sp.hue}, 70%, 40%, ${sa * 0.5})`);
      spGrd.addColorStop(1, "transparent");
      gCtx.fillStyle = spGrd;
      gCtx.beginPath(); gCtx.arc(sx, sy, sr, 0, Math.PI * 2); gCtx.fill();
    }
    gCtx.restore();
  }

  const LK = {};

  function _buildLotus() {
    const rngL = sRng(88);
    LK.lotuses = [];
    for (let i = 0; i < 12; i++) {
      LK.lotuses.push({
        xFrac: 0.1 + rngL() * 0.8,
        yFrac: 0.52 + rngL() * 0.32,
        size: 0.02 + rngL() * 0.025,
        phase: rngL() * Math.PI * 2,
        threshold: rngL() * 0.55,
        color: rngL() > 0.5 ? "#f472b6" : "#e879f9",
      });
    }
    LK.ripples = [];
    for (let i = 0; i < 5; i++) {
      LK.ripples.push({
        xFrac: 0.15 + rngL() * 0.7,
        yFrac: 0.58 + rngL() * 0.28,
        phase: rngL() * Math.PI * 2,
        speed: 0.4 + rngL() * 0.5,
        threshold: rngL() * 0.35,
      });
    }
    const rngP = sRng(44);
    LK.particles = [];
    for (let i = 0; i < 25; i++) {
      LK.particles.push({
        xFrac: rngP(),
        yFrac: 0.1 + rngP() * 0.5,
        vy: -(0.00015 + rngP() * 0.0002),
        vx: (rngP() - 0.5) * 0.00012,
        phase: rngP() * Math.PI * 2,
        size: 0.8 + rngP() * 1.6,
        threshold: 0.2 + rngP() * 0.4,
      });
    }
  }

  function renderLotus(W, H) {
    const g = growth();
    const waterY = H * 0.62;

    const skyR = Math.round(lerp(4, 18, g)), skyG = Math.round(lerp(6, 10, g)), skyB = Math.round(lerp(18, 22, g));
    const s2R = Math.round(lerp(8, 28, g)), s2G = Math.round(lerp(5, 12, g)), s2B = Math.round(lerp(22, 30, g));
    const skyGrd = gCtx.createLinearGradient(0, 0, 0, waterY);
    skyGrd.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
    skyGrd.addColorStop(1, `rgb(${s2R},${s2G},${s2B})`);
    gCtx.fillStyle = skyGrd;
    gCtx.fillRect(0, 0, W, waterY);

    const starAlpha = clamp(1.0 - g * 1.8, 0, 0.7);
    if (starAlpha > 0) {
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137.5) % 1) * W, sy = ((i * 89.3) % 1) * waterY;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(gTime * (0.3 + i * 0.02) + i));
        gCtx.beginPath(); gCtx.arc(sx, sy, 0.5 + (i % 3) * 0.35, 0, Math.PI * 2);
        gCtx.fillStyle = `rgba(230,200,255,${starAlpha * tw})`; gCtx.fill();
      }
    }

    const moonX = W * 0.72, moonY = H * 0.15;
    const moonR = 14 * (Math.min(W, H) / 400);
    if (g < 0.6) {
      gCtx.beginPath(); gCtx.arc(moonX, moonY, moonR * 1.8, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(230,210,255,${0.07 + g * 0.05})`; gCtx.fill();
      gCtx.beginPath(); gCtx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(240,230,255,${0.5 + g * 0.3})`; gCtx.fill();
    }
    if (g >= 0.4) {
      const sunAlpha = (g - 0.4) / 0.6;
      const sunGrd = gCtx.createRadialGradient(W * 0.25, H * 0.12, 0, W * 0.25, H * 0.12, moonR * 3);
      sunGrd.addColorStop(0, `rgba(244,114,182,${sunAlpha * 0.8})`);
      sunGrd.addColorStop(1, "transparent");
      gCtx.fillStyle = sunGrd;
      gCtx.beginPath(); gCtx.arc(W * 0.25, H * 0.12, moonR * 3, 0, Math.PI * 2); gCtx.fill();
    }

    const waterDepth = g * 0.3;
    const wGrd = gCtx.createLinearGradient(0, waterY, 0, H);
    wGrd.addColorStop(0, `rgba(${Math.round(8 + g * 20)},${Math.round(12 + g * 30)},${Math.round(40 + g * 50)},${0.2 + waterDepth})`);
    wGrd.addColorStop(0.4, `rgba(${Math.round(5 + g * 15)},${Math.round(8 + g * 20)},${Math.round(30 + g * 40)},${0.4 + waterDepth * 0.7})`);
    wGrd.addColorStop(1, `rgba(3,5,18,1)`);
    gCtx.fillStyle = wGrd;
    gCtx.fillRect(0, waterY, W, H - waterY);

    if (g > 0.1) {
      gCtx.save();
      gCtx.globalAlpha = Math.min(0.5, g * 0.6);
      for (let i = 0; i < 8; i++) {
        const lx = W * 0.1 + (i / 8) * W * 0.8;
        const ly = waterY + 8 + Math.sin(gTime * 1.2 + i * 0.7) * 5;
        gCtx.strokeStyle = "rgba(180,160,255,0.4)";
        gCtx.lineWidth = 1;
        gCtx.beginPath(); gCtx.moveTo(lx, ly); gCtx.lineTo(lx + W * 0.05, ly); gCtx.stroke();
      }
      gCtx.restore();
    }

    gCtx.save();
    for (const rp of LK.ripples) {
      if (g < rp.threshold) continue;
      const alpha = clamp((g - rp.threshold) / 0.3, 0, 0.35);
      const rx = rp.xFrac * W;
      const ry = waterY + rp.yFrac * (H - waterY) * 0.5;
      const phase = (gTime * rp.speed + rp.phase) % (Math.PI * 2);
      const r = (phase / (Math.PI * 2)) * Math.min(W, H) * 0.12;
      gCtx.globalAlpha = alpha * (1 - phase / (Math.PI * 2));
      gCtx.strokeStyle = "rgba(200,170,255,0.6)";
      gCtx.lineWidth = 1;
      gCtx.beginPath(); gCtx.ellipse(rx, ry, r, r * 0.35, 0, 0, Math.PI * 2); gCtx.stroke();
    }
    gCtx.restore();

    for (const lt of LK.lotuses) {
      if (g < lt.threshold) continue;
      const alpha = clamp((g - lt.threshold) / 0.25, 0, 1);
      const lx = lt.xFrac * W;
      const ly = waterY + lt.yFrac * (H - waterY) * 0.55;
      const sz = lt.size * Math.min(W, H);
      const bob = Math.sin(gTime * 0.8 + lt.phase) * 1.5;
      gCtx.save();
      gCtx.globalAlpha = alpha;
      gCtx.fillStyle = "rgba(22,80,22,0.75)";
      gCtx.beginPath(); gCtx.ellipse(lx, ly + bob, sz * 1.1, sz * 0.55, 0, 0, Math.PI * 2); gCtx.fill();
      const numPetals = 6;
      for (let p = 0; p < numPetals; p++) {
        const angle = (p / numPetals) * Math.PI * 2;
        const bloom = clamp((g - lt.threshold) / 0.4, 0, 1);
        const petalDist = sz * 0.6 * bloom;
        const px = lx + Math.cos(angle) * petalDist;
        const py = ly + bob + Math.sin(angle) * petalDist * 0.5;
        gCtx.fillStyle = lt.color;
        gCtx.beginPath(); gCtx.ellipse(px, py, sz * 0.35, sz * 0.22, angle, 0, Math.PI * 2); gCtx.fill();
      }
      gCtx.fillStyle = "rgba(254,240,138,0.9)";
      gCtx.beginPath(); gCtx.arc(lx, ly + bob, sz * 0.22, 0, Math.PI * 2); gCtx.fill();
      gCtx.restore();
    }

    gCtx.save();
    for (const pt of LK.particles) {
      if (g < pt.threshold) continue;
      pt.xFrac += pt.vx; pt.yFrac += pt.vy;
      if (pt.yFrac < -0.05) { pt.yFrac = 0.65; pt.xFrac = Math.random(); }
      const px = pt.xFrac * W, py = pt.yFrac * H;
      const pa = Math.min(0.7, (g - pt.threshold) / 0.3) * (0.5 + 0.5 * Math.sin(gTime * 2 + pt.phase));
      gCtx.globalAlpha = pa;
      gCtx.fillStyle = `hsl(${320 + Math.sin(gTime + pt.phase) * 20}, 80%, 75%)`;
      gCtx.beginPath(); gCtx.ellipse(px, py, pt.size * (Math.min(W, H) / 500), pt.size * 0.6 * (Math.min(W, H) / 500), gTime * 0.5, 0, Math.PI * 2); gCtx.fill();
    }
    gCtx.restore();

    const vig = gCtx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
    gCtx.fillStyle = vig; gCtx.fillRect(0, 0, W, H);
    _drawLevelLabel(W, H, g);
  }

  const RT = {};

  function _buildTemple() {
    const rngT = sRng(66);
    RT.rainDrops = [];
    for (let i = 0; i < 60; i++) {
      RT.rainDrops.push({
        xFrac: rngT(),
        yFrac: rngT(),
        speed: 0.003 + rngT() * 0.004,
        len: 6 + rngT() * 10,
        threshold: 0.18 + rngT() * 0.35,
      });
    }
    RT.clouds = [];
    const rngC = sRng(22);
    for (let i = 0; i < 5; i++) {
      RT.clouds.push({
        xFrac: rngC() * 0.9 + 0.05,
        yFrac: 0.04 + rngC() * 0.18,
        rx: 0.08 + rngC() * 0.06,
        ry: 0.025 + rngC() * 0.02,
        phase: rngC() * Math.PI * 2,
        speed: 0.00008 + rngC() * 0.0001,
        threshold: rngC() * 0.3,
      });
    }
    RT.lightning = { timer: 0, interval: 2.5, active: false, flashTime: 0, x: 0.5, segs: [] };
  }

  function renderTemple(W, H) {
    const g = growth();
    const groundY = H * 0.70;

    let r1, g1, b1, r2, g2, b2;
    if (g < 0.5) {
      r1 = Math.round(lerp(22, 8, g * 2)); g1 = Math.round(lerp(10, 12, g * 2)); b1 = Math.round(lerp(8, 30, g * 2));
      r2 = Math.round(lerp(35, 12, g * 2)); g2 = Math.round(lerp(14, 14, g * 2)); b2 = Math.round(lerp(10, 38, g * 2));
    } else {
      const t = (g - 0.5) * 2;
      r1 = Math.round(lerp(8, 12, t)); g1 = Math.round(lerp(12, 18, t)); b1 = Math.round(lerp(30, 45, t));
      r2 = Math.round(lerp(12, 16, t)); g2 = Math.round(lerp(14, 22, t)); b2 = Math.round(lerp(38, 55, t));
    }
    const skyGrd = gCtx.createLinearGradient(0, 0, 0, groundY);
    skyGrd.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    skyGrd.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    gCtx.fillStyle = skyGrd; gCtx.fillRect(0, 0, W, groundY);

    if (g < 0.25) {
      const sA = (0.25 - g) / 0.25;
      for (let i = 0; i < 35; i++) {
        const sx = ((i * 141.6) % 1) * W, sy = ((i * 83.7) % 1) * groundY * 0.65;
        gCtx.beginPath(); gCtx.arc(sx, sy, 0.5 + (i % 3) * 0.3, 0, Math.PI * 2);
        gCtx.fillStyle = `rgba(180,190,220,${sA * 0.6})`; gCtx.fill();
      }
    }

    _templeClouds(W, H, g);
    _templeLightning(W, H, groundY, g);
    const grdR = Math.round(lerp(22, 12, g)), grdG2 = Math.round(lerp(14, 18, g)), grdB = Math.round(lerp(8, 28, g));
    const groundGrd = gCtx.createLinearGradient(0, groundY, 0, H);
    groundGrd.addColorStop(0, `rgb(${grdR},${grdG2},${grdB})`);
    groundGrd.addColorStop(1, `rgb(6,8,14)`);
    gCtx.fillStyle = groundGrd; gCtx.fillRect(0, groundY, W, H - groundY);

    if (g < 0.5) {
      const crackAlpha = 1 - g * 2;
      gCtx.save();
      gCtx.globalAlpha = crackAlpha * 0.5;
      gCtx.strokeStyle = "rgba(80,50,20,0.7)"; gCtx.lineWidth = 1;
      const crackData = [[0.1, 0, 0.18, 1], [0.35, -0.3, 0.28, 0.5], [0.6, 0.2, 0.7, 0.8], [0.8, -0.1, 0.9, 0.6]];
      crackData.forEach(([x1f, d1, x2f, d2]) => {
        gCtx.beginPath();
        gCtx.moveTo(x1f * W, groundY + d1 * (H - groundY) * 0.4);
        gCtx.lineTo(x2f * W, groundY + d2 * (H - groundY) * 0.4);
        gCtx.stroke();
      });
      gCtx.restore();
    }

    if (g > 0.3) {
      const puddleAlpha = clamp((g - 0.3) / 0.5, 0, 0.65);
      const puddlePositions = [[0.15, 0.35], [0.42, 0.25], [0.72, 0.40], [0.55, 0.60]];
      gCtx.save();
      puddlePositions.forEach(([xf, yf]) => {
        const px = xf * W, py = groundY + yf * (H - groundY) * 0.3;
        const pGrd = gCtx.createRadialGradient(px, py, 0, px, py, W * 0.08);
        pGrd.addColorStop(0, `rgba(30,60,100,${puddleAlpha})`);
        pGrd.addColorStop(1, "transparent");
        gCtx.fillStyle = pGrd;
        gCtx.beginPath(); gCtx.ellipse(px, py, W * 0.08, W * 0.03, 0, 0, Math.PI * 2); gCtx.fill();
      });
      gCtx.restore();
    }

    _templeStructure(W, H, groundY, g);
    _templeRain(W, H, g);
    if (g > 0.6) {
      const glowAlpha = (g - 0.6) / 0.4;
      const gx = W * 0.5, gy = groundY - H * 0.45;
      const glGrd = gCtx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.15);
      glGrd.addColorStop(0, `rgba(147,197,253,${glowAlpha * 0.6})`);
      glGrd.addColorStop(1, "transparent");
      gCtx.fillStyle = glGrd;
      gCtx.beginPath(); gCtx.arc(gx, gy, W * 0.15, 0, Math.PI * 2); gCtx.fill();
    }
    const vig = gCtx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
    gCtx.fillStyle = vig; gCtx.fillRect(0, 0, W, H);
    _drawLevelLabel(W, H, g);
  }

  function _templeClouds(W, H, g) {
    if (g < 0.1) return;
    const baseAlpha = clamp((g - 0.1) / 0.4, 0, 0.8);
    gCtx.save();
    for (const cl of RT.clouds) {
      if (g < cl.threshold) continue;
      const alpha = Math.min(baseAlpha, clamp((g - cl.threshold) / 0.25, 0, 0.8));
      cl.xFrac += cl.speed;
      if (cl.xFrac > 1.1) cl.xFrac = -0.1;
      const cx = cl.xFrac * W;
      const cy = cl.yFrac * H + Math.sin(gTime * 0.25 + cl.phase) * H * 0.008;
      const rx = cl.rx * W, ry = cl.ry * H;
      gCtx.globalAlpha = alpha;
      const cGrd = gCtx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      cGrd.addColorStop(0, "rgba(25,35,60,0.85)");
      cGrd.addColorStop(0.6, "rgba(15,22,45,0.55)");
      cGrd.addColorStop(1, "transparent");
      gCtx.fillStyle = cGrd;
      gCtx.beginPath(); gCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); gCtx.fill();
    }
    gCtx.restore();
  }

  function _templeLightning(W, H, groundY, g) {
    if (g < 0.15 || g > 0.7) return;
    RT.lightning.timer += 0.016;
    if (RT.lightning.timer >= RT.lightning.interval) {
      RT.lightning.timer = 0;
      RT.lightning.interval = 1.5 + Math.random() * 3.5;
      RT.lightning.active = true;
      RT.lightning.flashTime = 0.15;
      RT.lightning.x = 0.2 + Math.random() * 0.6;
      RT.lightning.segs = [];
      let lx = RT.lightning.x * W, ly = H * 0.04;
      for (let i = 0; i < 7; i++) {
        lx += (Math.random() - 0.5) * W * 0.07;
        ly += H * 0.08;
        RT.lightning.segs.push({ x: lx, y: ly });
      }
    }
    if (RT.lightning.active) {
      RT.lightning.flashTime -= 0.016;
      const alpha = clamp(RT.lightning.flashTime / 0.15, 0, 1);
      if (RT.lightning.flashTime <= 0) RT.lightning.active = false;
      gCtx.save();
      gCtx.globalAlpha = alpha * 0.85;
      gCtx.strokeStyle = "rgba(147,197,253,0.95)"; gCtx.lineWidth = 2;
      gCtx.shadowColor = "rgba(100,160,255,0.8)"; gCtx.shadowBlur = 8;
      gCtx.beginPath(); gCtx.moveTo(RT.lightning.x * W, H * 0.04);
      for (const seg of RT.lightning.segs) { gCtx.lineTo(seg.x, seg.y); }
      gCtx.stroke();
      gCtx.globalAlpha = alpha * 0.06;
      gCtx.fillStyle = "rgba(200,220,255,1)"; gCtx.fillRect(0, 0, W, groundY);
      gCtx.restore();
    }
  }

  function _templeStructure(W, H, groundY, g) {
    const alpha = Math.max(0.05, g * 0.9 + 0.05);
    const cx = W * 0.5;
    gCtx.save();
    gCtx.globalAlpha = alpha;

    const platW = W * 0.55, platH = H * 0.06;
    const platX = cx - platW / 2, platY = groundY - platH;
    const platColor = g > 0.4 ? `rgb(${Math.round(40 + g * 20)},${Math.round(50 + g * 25)},${Math.round(70 + g * 35)})` : "rgb(22,18,14)";
    gCtx.fillStyle = platColor;
    gCtx.fillRect(platX, platY, platW, platH);

    const step2W = platW * 0.75, step2H = H * 0.04;
    const step2X = cx - step2W / 2, step2Y = platY - step2H;
    gCtx.fillStyle = g > 0.4 ? `rgb(${Math.round(35 + g * 18)},${Math.round(45 + g * 22)},${Math.round(65 + g * 30)})` : "rgb(18,15,11)";
    gCtx.fillRect(step2X, step2Y, step2W, step2H);

    const colPositions = [-0.22, -0.10, 0.10, 0.22];
    const colH = H * 0.28;
    const colW = W * 0.032;
    const colColor = g > 0.3 ? `rgb(${Math.round(50 + g * 25)},${Math.round(60 + g * 30)},${Math.round(80 + g * 40)})` : "rgb(25,20,15)";
    colPositions.forEach(xOff => {
      gCtx.fillStyle = colColor;
      gCtx.fillRect(cx + xOff * W - colW / 2, step2Y - colH, colW, colH);
      gCtx.fillRect(cx + xOff * W - colW * 0.8, step2Y - colH - colW * 0.5, colW * 1.6, colW * 0.5);
    });

    const roofY = step2Y - colH - H * 0.03;
    gCtx.fillStyle = g > 0.3 ? `rgb(${Math.round(30 + g * 20)},${Math.round(40 + g * 25)},${Math.round(70 + g * 35)})` : "rgb(20,16,12)";
    gCtx.fillRect(cx - W * 0.28, roofY, W * 0.56, H * 0.04);

    gCtx.beginPath();
    gCtx.moveTo(cx - W * 0.28, roofY);
    gCtx.lineTo(cx + W * 0.28, roofY);
    gCtx.lineTo(cx + W * 0.22, roofY - H * 0.07);
    gCtx.lineTo(cx - W * 0.22, roofY - H * 0.07);
    gCtx.closePath();
    gCtx.fillStyle = g > 0.3 ? `rgb(${Math.round(20 + g * 22)},${Math.round(30 + g * 28)},${Math.round(60 + g * 40)})` : "rgb(15,12,9)";
    gCtx.fill();
    gCtx.beginPath();
    gCtx.moveTo(cx - W * 0.18, roofY - H * 0.07);
    gCtx.lineTo(cx + W * 0.18, roofY - H * 0.07);
    gCtx.lineTo(cx + W * 0.12, roofY - H * 0.13);
    gCtx.lineTo(cx - W * 0.12, roofY - H * 0.13);
    gCtx.closePath();
    gCtx.fillStyle = g > 0.3 ? `rgb(${Math.round(16 + g * 20)},${Math.round(26 + g * 25)},${Math.round(55 + g * 38)})` : "rgb(12,10,8)";
    gCtx.fill();
    gCtx.beginPath();
    gCtx.moveTo(cx - W * 0.04, roofY - H * 0.13);
    gCtx.lineTo(cx + W * 0.04, roofY - H * 0.13);
    gCtx.lineTo(cx, roofY - H * 0.22);
    gCtx.closePath();
    gCtx.fillStyle = g > 0.5 ? `rgba(147,197,253,${0.5 + g * 0.4})` : "rgb(10,8,6)";
    gCtx.fill();
    const doorW = W * 0.08, doorH = H * 0.10;
    const doorX = cx - doorW / 2, doorY = step2Y - doorH;
    gCtx.fillStyle = g > 0.4 ? "rgba(5,10,25,0.9)" : "rgba(4,3,2,0.9)";
    gCtx.fillRect(doorX, doorY, doorW, doorH);
    gCtx.beginPath();
    gCtx.arc(cx, doorY, doorW / 2, Math.PI, 0);
    gCtx.fill();
    if (g > 0.4) {
      const tg = gCtx.createRadialGradient(cx, roofY - H * 0.12, 0, cx, roofY - H * 0.12, W * 0.12);
      tg.addColorStop(0, `rgba(100,160,255,${(g - 0.4) * 0.3})`);
      tg.addColorStop(1, "transparent");
      gCtx.globalAlpha = 1;
      gCtx.fillStyle = tg;
      gCtx.beginPath(); gCtx.arc(cx, roofY - H * 0.12, W * 0.12, 0, Math.PI * 2); gCtx.fill();
    }

    gCtx.restore();
  }

  function _templeRain(W, H, g) {
    if (g < 0.15) return;
    const rainAlpha = clamp((g - 0.15) / 0.4, 0, 0.55);
    gCtx.save();
    gCtx.strokeStyle = `rgba(147,197,253,${rainAlpha})`;
    gCtx.lineWidth = 0.8;
    for (const rd of RT.rainDrops) {
      if (g < rd.threshold) continue;
      rd.yFrac += rd.speed;
      if (rd.yFrac > 1.05) { rd.yFrac = -0.05; rd.xFrac = Math.random(); }
      const rx = rd.xFrac * W + Math.sin(gTime * 1.5 + rd.xFrac * 10) * 2;
      const ry = rd.yFrac * H;
      gCtx.beginPath();
      gCtx.moveTo(rx, ry);
      gCtx.lineTo(rx - 1.5, ry + rd.len);
      gCtx.stroke();
    }
    gCtx.restore();
  }

  const BG = {};

  function _buildButterfly() {
    const rngB = sRng(55);
    BG.flowers = [];
    for (let i = 0; i < 20; i++) {
      BG.flowers.push({
        xFrac: rngB(),
        yFrac: 0.6 + rngB() * 0.35,
        size: 0.018 + rngB() * 0.022,
        phase: rngB() * Math.PI * 2,
        threshold: rngB() * 0.5,
        hue: [0, 32, 280, 320, 55][Math.floor(rngB() * 5)],
      });
    }
    BG.butterflies = [];
    const rngBf = sRng(33);
    for (let i = 0; i < 8; i++) {
      BG.butterflies.push({
        xFrac: rngBf(),
        yFrac: 0.25 + rngBf() * 0.45,
        speedX: (rngBf() - 0.5) * 0.0006,
        speedY: (rngBf() - 0.5) * 0.0003,
        flapPhase: rngBf() * Math.PI * 2,
        size: 0.025 + rngBf() * 0.02,
        threshold: 0.3 + rngBf() * 0.35,
        hue: [0, 280, 32, 300, 55][Math.floor(rngBf() * 5)],
      });
    }
    BG.fireflies = [];
    const rngFf = sRng(77);
    for (let i = 0; i < 18; i++) {
      BG.fireflies.push({
        xFrac: rngFf(),
        yFrac: 0.1 + rngFf() * 0.75,
        phase: rngFf() * Math.PI * 2,
        size: 1.5 + rngFf() * 2,
        threshold: 0.55 + rngFf() * 0.25,
        speedX: (rngFf() - 0.5) * 0.0003,
        speedY: (rngFf() - 0.5) * 0.0002,
      });
    }
  }

  function renderButterfly(W, H) {
    const g = growth();
    const groundY = H * 0.75;
    const skyR = Math.round(lerp(6, 20, g)), skyG = Math.round(lerp(4, 10, g)), skyB = Math.round(lerp(14, 28, g));
    const s2R = Math.round(lerp(10, 30, g)), s2G = Math.round(lerp(5, 12, g)), s2B = Math.round(lerp(18, 38, g));
    const skyGrd = gCtx.createLinearGradient(0, 0, 0, groundY);
    skyGrd.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
    skyGrd.addColorStop(1, `rgb(${s2R},${s2G},${s2B})`);
    gCtx.fillStyle = skyGrd; gCtx.fillRect(0, 0, W, groundY);
    const sA = clamp(1 - g * 2, 0, 0.6);
    if (sA > 0) {
      for (let i = 0; i < 45; i++) {
        const sx = ((i * 143.7) % 1) * W, sy = ((i * 91.4) % 1) * groundY;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(gTime * (0.4 + i * 0.025) + i));
        gCtx.beginPath(); gCtx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
        gCtx.fillStyle = `rgba(200,180,240,${sA * tw})`; gCtx.fill();
      }
    }
    if (g < 0.5) {
      const mx = W * 0.78, my = H * 0.12, mr = 13 * (Math.min(W, H) / 400);
      gCtx.beginPath(); gCtx.arc(mx, my, mr * 1.8, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(200,180,240,${0.06 + g * 0.04})`; gCtx.fill();
      gCtx.beginPath(); gCtx.arc(mx, my, mr, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(220,210,250,${0.4 + g * 0.3})`; gCtx.fill();
    }
    if (g >= 0.35) {
      const t = (g - 0.35) / 0.65;
      const sunGrd = gCtx.createRadialGradient(W * 0.22, H * 0.1, 0, W * 0.22, H * 0.1, W * 0.12);
      sunGrd.addColorStop(0, `rgba(251,146,60,${t * 0.55})`);
      sunGrd.addColorStop(1, "transparent");
      gCtx.fillStyle = sunGrd;
      gCtx.beginPath(); gCtx.arc(W * 0.22, H * 0.1, W * 0.12, 0, Math.PI * 2); gCtx.fill();
    }
    const grdR = Math.round(lerp(8, 20, g)), grdG2 = Math.round(lerp(10, 32, g)), grdB = Math.round(lerp(6, 12, g));
    const groundGrd = gCtx.createLinearGradient(0, groundY, 0, H);
    groundGrd.addColorStop(0, `rgb(${grdR},${grdG2},${grdB})`);
    groundGrd.addColorStop(1, "rgb(3,6,3)");
    gCtx.fillStyle = groundGrd; gCtx.fillRect(0, groundY, W, H - groundY);
    if (g > 0.08) {
      _butterflyGrass(W, H, groundY, g);
    }
    for (const fl of BG.flowers) {
      if (g < fl.threshold) continue;
      const alpha = clamp((g - fl.threshold) / 0.2, 0, 1);
      const fx = fl.xFrac * W;
      const fy = groundY + fl.yFrac * (H - groundY) * 0.4;
      const sz = fl.size * Math.min(W, H);
      const sway = Math.sin(gTime * 1.2 + fl.phase) * 2;
      gCtx.save();
      gCtx.globalAlpha = alpha;
      gCtx.strokeStyle = `hsl(120, 45%, ${18 + g * 15}%)`;
      gCtx.lineWidth = 1.5;
      gCtx.beginPath();
      gCtx.moveTo(fx + sway * 0.3, fy - sz * 0.3);
      gCtx.quadraticCurveTo(fx + sway, fy - sz * 1.5, fx + sway, fy - sz * 2.5);
      gCtx.stroke();
      const numP = 5;
      const bloom = clamp((g - fl.threshold) / 0.3, 0, 1);
      for (let p = 0; p < numP; p++) {
        const angle = (p / numP) * Math.PI * 2 + gTime * 0.1;
        const pd = sz * 0.55 * bloom;
        const px = fx + sway + Math.cos(angle) * pd;
        const py = fy - sz * 2.5 + Math.sin(angle) * pd * 0.5;
        gCtx.fillStyle = `hsl(${fl.hue}, 80%, ${45 + g * 20}%)`;
        gCtx.beginPath(); gCtx.ellipse(px, py, sz * 0.28, sz * 0.18, angle, 0, Math.PI * 2); gCtx.fill();
      }
      gCtx.fillStyle = "rgba(254,240,138,0.9)";
      gCtx.beginPath(); gCtx.arc(fx + sway, fy - sz * 2.5, sz * 0.18, 0, Math.PI * 2); gCtx.fill();
      gCtx.restore();
    }

    for (const bf of BG.butterflies) {
      if (g < bf.threshold) continue;
      const alpha = clamp((g - bf.threshold) / 0.22, 0, 0.9);
      bf.xFrac += bf.speedX; bf.yFrac += bf.speedY;
      if (bf.xFrac < -0.05 || bf.xFrac > 1.05) bf.speedX *= -1;
      if (bf.yFrac < 0.1 || bf.yFrac > 0.7) bf.speedY *= -1;
      const bx = bf.xFrac * W, by = bf.yFrac * H;
      const sz = bf.size * Math.min(W, H);
      const flap = Math.sin(gTime * 5 + bf.flapPhase);
      gCtx.save();
      gCtx.globalAlpha = alpha;
      const uw = sz * (0.6 + Math.abs(flap) * 0.3);
      gCtx.fillStyle = `hsla(${bf.hue}, 80%, 60%, 0.9)`;
      gCtx.beginPath(); gCtx.ellipse(bx - uw * 0.5, by - sz * 0.1, uw * 0.6, sz * 0.35, -0.3 - flap * 0.4, 0, Math.PI * 2); gCtx.fill();
      gCtx.beginPath(); gCtx.ellipse(bx + uw * 0.5, by - sz * 0.1, uw * 0.6, sz * 0.35, 0.3 + flap * 0.4, 0, Math.PI * 2); gCtx.fill();
      gCtx.fillStyle = `hsla(${bf.hue + 20}, 70%, 50%, 0.75)`;
      gCtx.beginPath(); gCtx.ellipse(bx - uw * 0.35, by + sz * 0.12, uw * 0.42, sz * 0.25, -0.5 - flap * 0.3, 0, Math.PI * 2); gCtx.fill();
      gCtx.beginPath(); gCtx.ellipse(bx + uw * 0.35, by + sz * 0.12, uw * 0.42, sz * 0.25, 0.5 + flap * 0.3, 0, Math.PI * 2); gCtx.fill();
      gCtx.strokeStyle = "#111"; gCtx.lineWidth = 1.5;
      gCtx.beginPath(); gCtx.moveTo(bx, by - sz * 0.3); gCtx.lineTo(bx, by + sz * 0.3); gCtx.stroke();
      gCtx.strokeStyle = "rgba(30,20,10,0.8)"; gCtx.lineWidth = 0.8;
      [[-1, -0.5], [1, -0.5]].forEach(([dx, dy]) => {
        gCtx.beginPath(); gCtx.moveTo(bx, by - sz * 0.3);
        gCtx.quadraticCurveTo(bx + dx * sz * 0.2, by + dy * sz * 0.3, bx + dx * sz * 0.25, by - sz * 0.5);
        gCtx.stroke();
        gCtx.beginPath(); gCtx.arc(bx + dx * sz * 0.25, by - sz * 0.5, 1.2, 0, Math.PI * 2);
        gCtx.fillStyle = "#333"; gCtx.fill();
      });
      gCtx.restore();
    }
    if (g > 0.5) {
      gCtx.save();
      for (const ff of BG.fireflies) {
        if (g < ff.threshold) continue;
        ff.xFrac += ff.speedX; ff.yFrac += ff.speedY;
        if (ff.xFrac < 0 || ff.xFrac > 1) ff.speedX *= -1;
        if (ff.yFrac < 0.1 || ff.yFrac > 0.9) ff.speedY *= -1;
        const fx = ff.xFrac * W, fy = ff.yFrac * H;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(gTime * 1.8 + ff.phase));
        const fa = Math.min(0.85, (g - ff.threshold) / 0.3) * pulse;
        const fr = ff.size * (Math.min(W, H) / 400);
        gCtx.globalAlpha = fa;
        const fGrd = gCtx.createRadialGradient(fx, fy, 0, fx, fy, fr * 3);
        fGrd.addColorStop(0, "rgba(200,255,100,0.9)");
        fGrd.addColorStop(0.5, "rgba(160,255,60,0.3)");
        fGrd.addColorStop(1, "transparent");
        gCtx.fillStyle = fGrd;
        gCtx.beginPath(); gCtx.arc(fx, fy, fr * 3, 0, Math.PI * 2); gCtx.fill();
        gCtx.globalAlpha = fa * 0.9;
        gCtx.fillStyle = "rgba(220,255,150,0.95)";
        gCtx.beginPath(); gCtx.arc(fx, fy, fr * 0.7, 0, Math.PI * 2); gCtx.fill();
      }
      gCtx.restore();
    }
    const vig = gCtx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.60)");
    gCtx.fillStyle = vig; gCtx.fillRect(0, 0, W, H);
    _drawLevelLabel(W, H, g);
  }

  function _butterflyGrass(W, H, groundY, g) {
    const count = Math.floor(g * 40);
    gCtx.save();
    gCtx.strokeStyle = `hsl(120, 45%, ${12 + g * 18}%)`;
    gCtx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const gx = ((i * 53.7) % 1) * W;
      const gy = groundY;
      const gh = (8 + (i % 7) * 4) * (Math.min(W, H) / 400);
      const sway = Math.sin(gTime * 1.4 + i * 0.3) * 2;
      gCtx.globalAlpha = 0.5 + g * 0.3;
      gCtx.beginPath();
      gCtx.moveTo(gx, gy);
      gCtx.quadraticCurveTo(gx + sway, gy - gh * 0.5, gx + sway * 1.5, gy - gh);
      gCtx.stroke();
    }
    gCtx.restore();
  }



  const CP = (() => {
    let W = 0, H = 0, inited = false;
    function resize(w, h) {
      W = w;
      H = h;
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // STARS 
    const stars = [];
    function initStars() {
      stars.length = 0;
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random(), y: Math.random() * 0.52,
          r: Math.random() * 1.6 + 0.3,
          phase: Math.random() * Math.PI * 2,
          cross: Math.random() > 0.78
        });
      }
    }

    // PARTICLES 
    const particles = [];
    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random(), y: Math.random() * 0.78,
          spd: Math.random() * 0.00008 + 0.00003,
          drift: (Math.random() - 0.5) * 0.00005,
          phase: Math.random() * Math.PI * 2,
          size: Math.random() * 2.2 + 0.5,
          hue: Math.random() * 50 + 20
        });
      }
    }

    // STORM CLOUDS
    const stormC = [];
    function initStorm() {
      stormC.length = 0;
      for (let i = 0; i < 14; i++) {
        stormC.push({
          x: Math.random() * 1.5 - 0.2,
          y: Math.random() * 0.42 + 0.04,
          w: Math.random() * 0.28 + 0.14,
          h: Math.random() * 0.1 + 0.055,
          spd: (Math.random() - 0.5) * 0.00009,
          dark: Math.random() > 0.42,
          alpha: Math.random() * 0.42 + 0.28
        });
      }
    }

    // SKY 
    function drawSky(p) {
      const p1 = clamp(p / 0.28, 0, 1);
      const p2 = clamp((p - 0.28) / 0.5, 0, 1);
      const r0 = Math.round(lerp(lerp(8, 22, p1), 5, p2));
      const g0 = Math.round(lerp(lerp(14, 10, p1), 7, p2));
      const b0 = Math.round(lerp(lerp(36, 25, p1), 18, p2));
      const r1 = Math.round(lerp(lerp(14, 30, p1), 8, p2));
      const g1 = Math.round(lerp(lerp(20, 15, p1), 10, p2));
      const b1 = Math.round(lerp(lerp(52, 38, p1), 28, p2));

      const g = gCtx.createLinearGradient(0, 0, 0, H * 0.62);
      g.addColorStop(0, `rgb(${r0},${g0},${b0})`);
      g.addColorStop(1, `rgb(${r1},${g1},${b1})`);
      gCtx.fillStyle = g;
      gCtx.fillRect(0, 0, W, H * 0.62);

      // horizon glow
      const hA = clamp((p - 0.35) / 0.28, 0, 1) * clamp(1 - (p - 0.72) / 0.18, 0, 1);
      if (hA > 0) {
        const hg = gCtx.createLinearGradient(0, H * 0.36, 0, H * 0.62);
        hg.addColorStop(0, `rgba(175,85,28,${hA * 0.22})`);
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        gCtx.fillStyle = hg;
        gCtx.fillRect(0, H * 0.36, W, H * 0.26);
      }
    }

    // STARS 
    function drawStars(p, t) {
      const base = clamp(1 - p * 2, 0, 1) * 0.9 + clamp((p - 0.88) / 0.08, 0, 1) * 0.55;
      if (base < 0.01) return;
      stars.forEach(s => {
        const twinkle = 0.5 + Math.sin(t * 1.9 + s.phase) * 0.35;
        const a = base * twinkle;
        if (a < 0.02) return;
        gCtx.fillStyle = `rgba(210,220,255,${a})`;
        gCtx.beginPath();
        gCtx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        gCtx.fill();
        if (s.cross && a > 0.28) {
          gCtx.save();
          gCtx.strokeStyle = `rgba(210,220,255,${a * 0.45})`;
          gCtx.lineWidth = 0.6;
          gCtx.beginPath();
          gCtx.moveTo(s.x * W - s.r * 3.5, s.y * H);
          gCtx.lineTo(s.x * W + s.r * 3.5, s.y * H);
          gCtx.moveTo(s.x * W, s.y * H - s.r * 3.5);
          gCtx.lineTo(s.x * W, s.y * H + s.r * 3.5);
          gCtx.stroke();
          gCtx.restore();
        }
      });
    }

    // MOON
    function drawMoon(p, t) {
      const mA = clamp(1 - p * 1.7, 0, 0.95) + clamp((p - 0.92) / 0.07, 0, 1) * 0.65;
      if (mA < 0.02) return;
      const mx = W * 0.14, my = H * 0.18, mr = Math.min(W, H) * 0.072;
      gCtx.save();
      const glow = gCtx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 2.8);
      glow.addColorStop(0, `rgba(175,185,215,${mA * 0.16})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      gCtx.fillStyle = glow;
      gCtx.beginPath();
      gCtx.arc(mx, my, mr * 2.8, 0, Math.PI * 2);
      gCtx.fill();
      const body = gCtx.createRadialGradient(mx - mr * 0.2, my - mr * 0.2, mr * 0.1, mx, my, mr);
      body.addColorStop(0, `rgba(228,232,248,${mA})`);
      body.addColorStop(0.6, `rgba(192,202,222,${mA})`);
      body.addColorStop(1, `rgba(158,168,198,${mA})`);
      gCtx.fillStyle = body;
      gCtx.beginPath();
      gCtx.arc(mx, my, mr, 0, Math.PI * 2);
      gCtx.fill();
      // crescent shadow
      gCtx.fillStyle = `rgba(6,12,34,${mA * 0.92})`;
      gCtx.beginPath();
      gCtx.arc(mx + mr * 0.36, my - mr * 0.07, mr * 0.87, 0, Math.PI * 2);
      gCtx.fill();
      // craters
      gCtx.fillStyle = `rgba(148,158,188,${mA * 0.38})`;
      [[mx - mr * 0.34, my + mr * 0.22, mr * 0.09], [mx - mr * 0.14, my - mr * 0.27, mr * 0.065], [mx - mr * 0.54, my - mr * 0.07, mr * 0.075]].forEach(([cx, cy, cr]) => {
        gCtx.beginPath(); gCtx.arc(cx, cy, cr, 0, Math.PI * 2); gCtx.fill();
      });
      gCtx.restore();
    }

    //  MOUNTAIN 
    function drawMountain(p, t) {
      const mCX = W * 0.60;
      const peakY = H * 0.10;
      const base = H * 0.53;
      const leftFoot = W * 0.30;
      const rightFoot = W * 0.98;

      const glowA = clamp((p - 0.26) / 0.28, 0, 1);
      const goldA = clamp((p - 0.46) / 0.3, 0, 1);
      const peakA = clamp((p - 0.66) / 0.22, 0, 1);

      // aura
      if (glowA > 0) {
        const ag = gCtx.createRadialGradient(mCX, peakY + H * 0.16, H * 0.01, mCX, peakY + H * 0.16, H * 0.44);
        ag.addColorStop(0, `rgba(${Math.round(lerp(38, 195, goldA))},${Math.round(lerp(28, 125, goldA))},${Math.round(lerp(58, 48, goldA))},${glowA * 0.28})`);
        ag.addColorStop(1, 'rgba(0,0,0,0)');
        gCtx.fillStyle = ag;
        gCtx.beginPath();
        gCtx.ellipse(mCX, peakY + H * 0.2, W * 0.38, H * 0.42, 0, 0, Math.PI * 2);
        gCtx.fill();
      }

      gCtx.save();
      gCtx.beginPath();
      gCtx.moveTo(leftFoot, base);
      gCtx.bezierCurveTo(leftFoot + W * 0.08, base - H * 0.07, mCX - W * 0.22, peakY + H * 0.22, mCX - W * 0.042, peakY + H * 0.042);
      gCtx.lineTo(mCX, peakY);
      gCtx.lineTo(mCX + W * 0.042, peakY + H * 0.042);
      gCtx.bezierCurveTo(mCX + W * 0.18, peakY + H * 0.2, rightFoot - W * 0.07, base - H * 0.05, rightFoot, base);
      gCtx.closePath();

      const bright = lerp(0.10, 0.30, clamp((p - 0.18) / 0.45, 0, 1));
      const warm = lerp(0, 0.17, goldA);
      const mg = gCtx.createLinearGradient(mCX - W * 0.16, peakY, mCX + W * 0.05, base);
      mg.addColorStop(0, `rgb(${Math.round((bright * 0.9 + warm * 0.55) * 255)},${Math.round((bright * 0.82 + warm * 0.28) * 255)},${Math.round(bright * 0.95 * 255)})`);
      mg.addColorStop(0.38, `rgb(${Math.round((bright * 0.62 + warm) * 255)},${Math.round((bright * 0.55 + warm * 0.48) * 255)},${Math.round(bright * 0.52 * 255)})`);
      mg.addColorStop(0.72, `rgb(${Math.round((0.075 + warm * 0.48) * 255)},${Math.round((0.058 + warm * 0.28) * 255)},${Math.round(0.095 * 255)})`);
      mg.addColorStop(1, 'rgb(16,12,26)');
      gCtx.fillStyle = mg;
      gCtx.fill();

      // lit right face
      gCtx.beginPath();
      gCtx.moveTo(mCX, peakY);
      gCtx.lineTo(mCX + W * 0.042, peakY + H * 0.042);
      gCtx.bezierCurveTo(mCX + W * 0.18, peakY + H * 0.2, rightFoot - W * 0.07, base - H * 0.05, rightFoot, base);
      gCtx.lineTo(mCX, base);
      gCtx.closePath();
      const rfg = gCtx.createLinearGradient(mCX, peakY, rightFoot, base);
      rfg.addColorStop(0, `rgba(${Math.round((bright * 1.1 + warm * 0.35) * 255)},${Math.round((bright + warm * 0.18) * 255)},${Math.round(bright * 0.88 * 255)},0.45)`);
      rfg.addColorStop(1, 'rgba(0,0,0,0)');
      gCtx.fillStyle = rfg;
      gCtx.fill();

      // snow cap
      const snowA = clamp((p - 0.28) / 0.24, 0, 1);
      if (snowA > 0) {
        gCtx.beginPath();
        gCtx.moveTo(mCX, peakY);
        gCtx.lineTo(mCX - W * 0.044, peakY + H * 0.044);
        gCtx.bezierCurveTo(mCX - W * 0.028, peakY + H * 0.034, mCX - W * 0.01, peakY + H * 0.02, mCX, peakY + H * 0.016);
        gCtx.bezierCurveTo(mCX + W * 0.01, peakY + H * 0.02, mCX + W * 0.028, peakY + H * 0.034, mCX + W * 0.044, peakY + H * 0.044);
        gCtx.closePath();
        gCtx.fillStyle = `rgba(212,222,245,${snowA * 0.9})`;
        gCtx.fill();
        gCtx.fillStyle = `rgba(238,244,255,${snowA * 0.5})`;
        gCtx.beginPath();
        gCtx.ellipse(mCX - W * 0.009, peakY + H * 0.009, W * 0.016, H * 0.01, 0.3, 0, Math.PI * 2);
        gCtx.fill();
      }

      // peak glow
      if (peakA > 0) {
        const pg = gCtx.createRadialGradient(mCX, peakY, 0, mCX, peakY, W * 0.11);
        pg.addColorStop(0, `rgba(255,232,138,${peakA * 0.98})`);
        pg.addColorStop(0.38, `rgba(215,155,55,${peakA * 0.38})`);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        gCtx.fillStyle = pg;
        gCtx.beginPath();
        gCtx.arc(mCX, peakY, W * 0.11, 0, Math.PI * 2);
        gCtx.fill();
      }
      gCtx.restore();
    }

    //  MIST 
    function drawMist(p, t) {
      const mA = clamp(1 - (p - 0.04) / 0.2, 0, 1) * 0.65 + clamp((p - 0.78) / 0.12, 0, 0.25);
      if (mA < 0.01) return;
      const mx = W * 0.5, my = H * 0.51;
      const mg = gCtx.createRadialGradient(mx, my, 0, mx, my, W * 0.42);
      mg.addColorStop(0, `rgba(155,165,198,${mA * 0.52})`);
      mg.addColorStop(0.55, `rgba(128,140,182,${mA * 0.28})`);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      gCtx.fillStyle = mg;
      gCtx.beginPath();
      gCtx.ellipse(mx, my + H * 0.01, W * 0.45, H * 0.09, 0, 0, Math.PI * 2);
      gCtx.fill();
    }

    // STORM CLOUDS
    function drawStormClouds(p, t) {
      const a = clamp(1 - p / 0.35, 0, 1);
      if (a < 0.01) return;
      stormC.forEach(c => {
        const cx = ((c.x + c.spd * t * 0.38) % 1.6) - 0.2;
        const cg = gCtx.createRadialGradient(cx * W, c.y * H, 0, cx * W, c.y * H, c.w * W * 0.5);
        const col = c.dark ? [9, 7, 20] : [26, 18, 46];
        cg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${c.alpha * a})`);
        cg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        gCtx.fillStyle = cg;
        gCtx.beginPath();
        gCtx.ellipse(cx * W, c.y * H, c.w * W, c.h * H, 0, 0, Math.PI * 2);
        gCtx.fill();
      });
    }

    //  PINE TREES 
    function drawPines(p) {
      const count = Math.floor(W / 48);
      const spread = 0.85;
      const startX = 0.075;
      for (let i = 0; i < count; i++) {
        const xf = startX + (i / count) * spread;
        // skip center (mountain area)
        if (xf > 0.38 && xf < 0.55) continue;
        const dark = (i % 3 === 0);
        const hVariance = (Math.sin(i * 137.5) * 0.5 + 0.5);
        const hf = 0.16 + hVariance * 0.12;
        const yBase = 0.68 + Math.sin(i * 0.9) * 0.025;
        const layers = 3 + Math.floor(hVariance * 3);
        const tx = xf * W, ty = yBase * H, th = hf * H;
        const gv = clamp((p - 0.35) / 0.3, 0.35, 1);
        gCtx.save();
        for (let l = 0; l < layers; l++) {
          const ly = ty - th * (0.3 + l * 0.22);
          const lw = W * (0.032 - l * 0.004) * (1 - l * 0.03);
          const lh = th * 0.2;
          gCtx.fillStyle = dark
            ? `rgba(${Math.round(lerp(16, 25, gv))},${Math.round(lerp(34, 50, gv))},${Math.round(lerp(19, 28, gv))},0.95)`
            : `rgba(${Math.round(lerp(22, 37, gv))},${Math.round(lerp(48, 75, gv))},${Math.round(lerp(24, 40, gv))},0.95)`;
          gCtx.beginPath();
          gCtx.moveTo(tx, ly - lh);
          gCtx.lineTo(tx - lw, ly + lh * 0.38);
          gCtx.lineTo(tx + lw, ly + lh * 0.38);
          gCtx.closePath();
          gCtx.fill();
        }
        gCtx.fillStyle = `rgba(45,28,14,0.65)`;
        gCtx.fillRect(tx - W * 0.005, ty - th * 0.16, W * 0.01, th * 0.16);
        gCtx.restore();
      }
    }

    //  BROAD TREES 
    function drawDeciduous(p) {
      const ga = clamp((p - 0.1) / 0.28, 0.3, 1);
      const gv = clamp((p - 0.38) / 0.28, 0.4, 1);
      const trees = [[0.015, 0.60, 0.21], [0.055, 0.58, 0.24], [0.938, 0.58, 0.22], [0.975, 0.60, 0.19]];
      trees.forEach(([xf, yf, hf]) => {
        const tx = xf * W, ty = yf * H, tr = hf * H * 0.42;
        gCtx.save();
        gCtx.fillStyle = `rgba(50,30,14,${ga})`;
        gCtx.fillRect(tx - W * 0.007, ty, W * 0.014, H * 0.1);
        [[0, 0, 1], [0.06, -0.04, 0.78], [0.03, 0.06, 0.82], [-0.05, -0.02, 0.72]].forEach(([ox, oy, sc]) => {
          gCtx.fillStyle = `rgba(${Math.round(22 * sc)},${Math.round(lerp(55, 85, gv) * sc)},${Math.round(18 * sc)},${ga})`;
          gCtx.beginPath();
          gCtx.arc(tx + ox * W, ty + oy * H, tr * sc, 0, Math.PI * 2);
          gCtx.fill();
        });
        gCtx.restore();
      });
    }

    // ROCKS
    function drawRocks(p) {
      const rA = clamp((p - 0.04) / 0.18, 0.55, 1);
      const rockDefs = [
        { x: 0.038, y: 0.72, w: 0.13, h: 0.23, c: [108, 82, 52] },
        { x: 0.142, y: 0.675, w: 0.095, h: 0.29, c: [122, 92, 60] },
        { x: 0.208, y: 0.74, w: 0.075, h: 0.19, c: [98, 75, 48] },
        { x: 0.648, y: 0.71, w: 0.10, h: 0.23, c: [112, 85, 55] },
        { x: 0.732, y: 0.665, w: 0.115, h: 0.29, c: [118, 89, 58] },
        { x: 0.830, y: 0.72, w: 0.088, h: 0.21, c: [102, 78, 50] },
        { x: 0.895, y: 0.695, w: 0.078, h: 0.25, c: [116, 88, 56] },
      ];
      rockDefs.forEach(r => {
        const rx = r.x * W, ry = r.y * H, rw = r.w * W, rh = r.h * H;
        gCtx.save();
        gCtx.beginPath();
        gCtx.moveTo(rx, ry + rh);
        gCtx.bezierCurveTo(rx - rw * 0.1, ry + rh * 0.68, rx - rw * 0.04, ry + rh * 0.18, rx + rw * 0.3, ry);
        gCtx.bezierCurveTo(rx + rw * 0.55, ry - rh * 0.05, rx + rw, ry + rh * 0.14, rx + rw, ry + rh * 0.58);
        gCtx.bezierCurveTo(rx + rw * 0.96, ry + rh * 0.85, rx + rw * 0.52, ry + rh, rx, ry + rh);
        gCtx.closePath();
        const rg = gCtx.createLinearGradient(rx, ry, rx + rw * 0.3, ry + rh);
        rg.addColorStop(0, `rgba(${Math.round(r.c[0] * 1.22)},${Math.round(r.c[1] * 1.18)},${Math.round(r.c[2] * 1.12)},${rA})`);
        rg.addColorStop(0.48, `rgba(${r.c[0]},${r.c[1]},${r.c[2]},${rA})`);
        rg.addColorStop(1, `rgba(${Math.round(r.c[0] * 0.52)},${Math.round(r.c[1] * 0.48)},${Math.round(r.c[2] * 0.43)},${rA})`);
        gCtx.fillStyle = rg;
        gCtx.fill();
        gCtx.strokeStyle = `rgba(${Math.round(r.c[0] * 0.42)},${Math.round(r.c[1] * 0.38)},${Math.round(r.c[2] * 0.35)},${rA * 0.55})`;
        gCtx.lineWidth = 1;
        gCtx.beginPath();
        gCtx.moveTo(rx + rw * 0.34, ry + rh * 0.1); gCtx.lineTo(rx + rw * 0.27, ry + rh * 0.56); gCtx.stroke();
        gCtx.beginPath();
        gCtx.moveTo(rx + rw * 0.61, ry + rh * 0.14); gCtx.lineTo(rx + rw * 0.66, ry + rh * 0.62); gCtx.stroke();
        gCtx.restore();
      });
    }

    //  BUSHES 
    function drawBushes(p) {
      const bA = clamp((p - 0.07) / 0.22, 0.4, 1);
      const bushes = [
        [0.048, 0.80, 0.065, 0.038], [0.162, 0.79, 0.058, 0.034], [0.245, 0.80, 0.075, 0.042],
        [0.42, 0.815, 0.065, 0.038], [0.515, 0.805, 0.085, 0.048],
        [0.615, 0.80, 0.065, 0.038], [0.712, 0.79, 0.075, 0.042], [0.795, 0.80, 0.058, 0.034], [0.888, 0.80, 0.065, 0.038],
      ];
      bushes.forEach(([xf, yf, wr, hr]) => {
        const bx = xf * W, by = yf * H;
        gCtx.fillStyle = `rgba(26,48,20,${bA})`;
        gCtx.beginPath(); gCtx.ellipse(bx, by, wr * W, hr * H, 0, 0, Math.PI * 2); gCtx.fill();
        gCtx.fillStyle = `rgba(32,60,25,${bA * 0.7})`;
        gCtx.beginPath(); gCtx.ellipse(bx - wr * W * 0.3, by - hr * H * 0.3, wr * W * 0.58, hr * H * 0.52, 0, 0, Math.PI * 2); gCtx.fill();
        gCtx.beginPath(); gCtx.ellipse(bx + wr * W * 0.28, by - hr * H * 0.22, wr * W * 0.52, hr * H * 0.48, 0, 0, Math.PI * 2); gCtx.fill();
      });
    }

    // GROUND 
    function drawGrass(p) {
      const gv = clamp((p - 0.18) / 0.38, 0.28, 1);
      const gg = gCtx.createLinearGradient(0, H * 0.75, 0, H);
      gg.addColorStop(0, `rgba(${Math.round(lerp(32, 55, gv))},${Math.round(lerp(66, 105, gv))},${Math.round(lerp(20, 35, gv))},1)`);
      gg.addColorStop(0.38, `rgba(${Math.round(lerp(26, 48, gv))},${Math.round(lerp(58, 92, gv))},${Math.round(lerp(16, 28, gv))},1)`);
      gg.addColorStop(1, `rgba(${Math.round(lerp(18, 36, gv))},${Math.round(lerp(46, 75, gv))},${Math.round(lerp(12, 22, gv))},1)`);
      gCtx.fillStyle = gg;
      gCtx.beginPath();
      gCtx.moveTo(0, H * 0.755);
      gCtx.bezierCurveTo(W * 0.22, H * 0.738, W * 0.5, H * 0.762, W * 0.74, H * 0.748);
      gCtx.bezierCurveTo(W * 0.86, H * 0.742, W, H * 0.756, W, H);
      gCtx.lineTo(0, H); gCtx.closePath(); gCtx.fill();
      // highlight stripe
      const hgv = clamp((p - 0.28) / 0.28, 0, 1);
      gCtx.fillStyle = `rgba(${Math.round(lerp(42, 68, hgv))},${Math.round(lerp(86, 132, hgv))},${Math.round(lerp(26, 46, hgv))},0.45)`;
      gCtx.beginPath();
      gCtx.moveTo(0, H * 0.755);
      gCtx.bezierCurveTo(W * 0.28, H * 0.742, W * 0.58, H * 0.758, W, H * 0.745);
      gCtx.lineTo(W, H * 0.782); gCtx.lineTo(0, H * 0.782); gCtx.closePath(); gCtx.fill();
    }

    function drawForeground() {
      // grass tufts
      const tufts = [[0.46, 0.87], [0.50, 0.895], [0.54, 0.875]];
      gCtx.strokeStyle = 'rgba(30,68,22,0.75)'; gCtx.lineWidth = 1.5;
      tufts.forEach(([xf, yf]) => {
        const bx = xf * W, by = yf * H;
        [-3, -1.5, 0, 1.5, 3].forEach(i => {
          gCtx.beginPath();
          gCtx.moveTo(bx + i * 2.5, by);
          gCtx.quadraticCurveTo(bx + i * 2.5 + i * 1.8, by - H * 0.018, bx + i * 2.5 + i, by - H * 0.028);
          gCtx.stroke();
        });
      });
      // pebbles
      gCtx.fillStyle = 'rgba(65,60,55,0.68)';
      [[0.515, 0.91], [0.535, 0.908]].forEach(([xf, yf]) => {
        gCtx.beginPath();
        gCtx.ellipse(xf * W, yf * H, W * 0.006, H * 0.004, 0, 0, Math.PI * 2);
        gCtx.fill();
      });
    }

    // CLOUD BRIDGES
    function drawCloudBridges(p, t) {
      const a = clamp((p - 0.32) / 0.16, 0, 1); if (a <= 0) return;
      const mCX = W * 0.60, peakY = H * 0.10;
      const bridges = [
        { angle: -0.42, dist: 0.27, w: 0.19, h: 0.04, delay: 0 },
        { angle: 0.30, dist: 0.24, w: 0.17, h: 0.037, delay: 0.03 },
        { angle: -0.18, dist: 0.36, w: 0.23, h: 0.046, delay: 0.06 },
        { angle: 0.52, dist: 0.32, w: 0.15, h: 0.034, delay: 0.09 },
      ];
      bridges.forEach((b, i) => {
        const ba = clamp((p - 0.32 - b.delay) / 0.14, 0, 1); if (ba <= 0) return;
        const bx = mCX + Math.cos(b.angle) * W * b.dist;
        const by = peakY + H * 0.2 + Math.sin(b.angle) * H * 0.08 + Math.sin(t * 0.55 + i) * H * 0.007;
        const warm = clamp((p - 0.5) / 0.24, 0, 1);
        const bg = gCtx.createRadialGradient(bx, by, 0, bx, by, W * b.w * 0.5);
        bg.addColorStop(0, `rgba(${Math.round(lerp(183, 248, warm * 0.28))},${Math.round(lerp(175, 212, warm * 0.16))},${Math.round(lerp(218, 238, 0))},${ba * 0.68})`);
        bg.addColorStop(0.55, `rgba(162,154,202,${ba * 0.32})`);
        bg.addColorStop(1, 'rgba(138,128,188,0)');
        gCtx.fillStyle = bg;
        gCtx.beginPath();
        gCtx.ellipse(bx, by, W * b.w * 0.5, H * b.h, b.angle * 0.22, 0, Math.PI * 2);
        gCtx.fill();
      });
    }

    //  PEACEFUL CLOUDS 
    function drawPeacefulClouds(p, t) {
      const a = clamp((p - 0.42) / 0.16, 0, 1); if (a <= 0) return;
      const mCX = W * 0.60, peakY = H * 0.10;
      const clouds = [
        { ox: -0.37, oy: 0.22, w: 0.17, h: 0.048, spd: 0.27, del: 0 },
        { ox: 0.28, oy: 0.18, w: 0.155, h: 0.043, spd: -0.22, del: 0.03 },
        { ox: -0.21, oy: 0.40, w: 0.21, h: 0.052, spd: 0.16, del: 0.06 },
        { ox: 0.22, oy: 0.36, w: 0.19, h: 0.048, spd: -0.18, del: 0.08 },
        { ox: -0.43, oy: 0.52, w: 0.26, h: 0.062, spd: 0.10, del: 0.10 },
        { ox: 0.37, oy: 0.48, w: 0.24, h: 0.058, spd: -0.12, del: 0.12 },
      ];
      clouds.forEach((c, i) => {
        const ca = clamp((p - 0.42 - c.del) / 0.13, 0, 1) * a; if (ca <= 0) return;
        const px = mCX + c.ox * W + Math.sin(t * c.spd + i) * W * 0.015;
        const py = peakY + c.oy * H + Math.cos(t * c.spd * 0.7 + i) * H * 0.005;
        const warm = clamp((p - 0.48) / 0.27, 0, 1);
        const cg = gCtx.createRadialGradient(px, py, 0, px, py, c.w * W * 0.5);
        cg.addColorStop(0, `rgba(${Math.round(lerp(186, 244, warm * 0.28))},${Math.round(lerp(178, 222, warm * 0.17))},${Math.round(lerp(224, 245, 0))},${ca * 0.63})`);
        cg.addColorStop(0.55, `rgba(168,160,208,${ca * 0.28})`);
        cg.addColorStop(1, 'rgba(148,138,198,0)');
        gCtx.fillStyle = cg;
        gCtx.beginPath();
        gCtx.ellipse(px, py, c.w * W * 0.5, c.h * H, 0, 0, Math.PI * 2);
        gCtx.fill();
      });
    }

    //  LIGHT RAYS 
    function drawLightRays(p, t) {
      const a = clamp((p - 0.52) / 0.2, 0, 1); if (a <= 0) return;
      const mCX = W * 0.60, peakY = H * 0.10;
      gCtx.save();
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * 0.065;
        const len = H * (0.24 + (i % 3) * 0.058);
        const sp = 0.02 + (i % 2) * 0.008;
        gCtx.beginPath();
        gCtx.moveTo(mCX + Math.cos(ang - sp) * W * 0.014, peakY + Math.sin(ang - sp) * H * 0.014);
        gCtx.lineTo(mCX + Math.cos(ang - sp) * len, peakY + Math.sin(ang - sp) * len);
        gCtx.lineTo(mCX + Math.cos(ang + sp) * len, peakY + Math.sin(ang + sp) * len);
        gCtx.lineTo(mCX + Math.cos(ang + sp) * W * 0.014, peakY + Math.sin(ang + sp) * H * 0.014);
        gCtx.closePath();
        const rg = gCtx.createLinearGradient(mCX, peakY, mCX + Math.cos(ang) * len, peakY + Math.sin(ang) * len);
        rg.addColorStop(0, `rgba(255,226,108,${a * 0.2})`);
        rg.addColorStop(0.38, `rgba(255,198,68,${a * 0.065})`);
        rg.addColorStop(1, 'rgba(255,168,48,0)');
        gCtx.fillStyle = rg; gCtx.fill();
      }
      gCtx.restore();
    }

    //  SKY GATE
    function drawSkyGate(p, t) {
      const a = clamp((p - 0.60) / 0.12, 0, 1); if (a <= 0) return;
      const mCX = W * 0.60, peakY = H * 0.10;
      const gx = mCX, gy = peakY - H * 0.085;
      const gw = Math.min(W, H) * 0.062, gh = H * 0.118;
      const pulse = 0.92 + Math.sin(t * 1.35) * 0.08;

      const gg = gCtx.createRadialGradient(gx, gy, 0, gx, gy, gw * 3);
      gg.addColorStop(0, `rgba(255,212,85,${a * 0.68 * pulse})`);
      gg.addColorStop(0.42, `rgba(195,150,52,${a * 0.22})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      gCtx.fillStyle = gg; gCtx.beginPath(); gCtx.arc(gx, gy, gw * 3, 0, Math.PI * 2); gCtx.fill();

      const pc = `rgba(${Math.round(lerp(68, 208, a))},${Math.round(lerp(52, 162, a))},${Math.round(lerp(28, 72, a))},${a * 0.94})`;
      gCtx.fillStyle = pc;
      gCtx.beginPath(); gCtx.roundRect(gx - gw - gw * 0.1, gy - gh * 0.28, gw * 0.1, gh, 3); gCtx.fill();
      gCtx.beginPath(); gCtx.roundRect(gx + gw, gy - gh * 0.28, gw * 0.1, gh, 3); gCtx.fill();

      const cc = `rgba(${Math.round(lerp(88, 228, a))},${Math.round(lerp(65, 185, a))},${Math.round(lerp(32, 82, a))},${a * 0.97})`;
      gCtx.fillStyle = cc;
      gCtx.beginPath(); gCtx.roundRect(gx - gw - gw * 0.1, gy - gh * 0.28 - H * 0.021, gw * 2.2, H * 0.021, 3); gCtx.fill();

      gCtx.strokeStyle = `rgba(255,202,72,${a * 0.9})`; gCtx.lineWidth = 2;
      gCtx.beginPath(); gCtx.arc(gx, gy - gh * 0.28 - H * 0.021, gw * 1.06, Math.PI, 0); gCtx.stroke();

      const ig = gCtx.createLinearGradient(gx - gw, gy - gh * 0.28, gx + gw, gy + gh * 0.65);
      ig.addColorStop(0, `rgba(255,232,128,${a * 0.13})`); ig.addColorStop(1, 'rgba(0,0,0,0)');
      gCtx.fillStyle = ig;
      gCtx.fillRect(gx - gw, gy - gh * 0.28, gw * 2, gh);
    }

    // PARTICLES
    function drawParticles(p, t) {
      const a = clamp((p - 0.58) / 0.2, 0, 1); if (a <= 0) return;
      const mCX = W * 0.60;
      particles.forEach(pt => {
        pt.x = (pt.x + pt.spd + Math.sin(t * 0.27 + pt.y) * 0.00011) % 1;
        pt.y = ((pt.y + pt.drift + Math.cos(t * 0.17 + pt.x) * 0.000065) + 1) % 1;
        if (pt.y > 0.82) return;
        const dist = Math.hypot(pt.x * W - mCX, pt.y * H - H * 0.10);
        const prox = clamp(1 - dist / (W * 0.52), 0, 1);
        const al = (0.28 + Math.sin(t * 1.65 + pt.phase) * 0.35) * a * (0.32 + prox * 0.58);
        const pg = gCtx.createRadialGradient(pt.x * W, pt.y * H, 0, pt.x * W, pt.y * H, pt.size * 2.2);
        pg.addColorStop(0, `rgba(255,${Math.round(188 + pt.hue)},${Math.round(82 + pt.hue)},${al})`);
        pg.addColorStop(1, 'rgba(255,198,98,0)');
        gCtx.fillStyle = pg;
        gCtx.beginPath(); gCtx.arc(pt.x * W, pt.y * H, pt.size * 2.2, 0, Math.PI * 2); gCtx.fill();
      });
    }


    return {
      render(w, h, p, t) {
        if (!inited || W !== w || H !== h) {
          resize(w, h);
          initStars();
          initParticles();
          initStorm();
          inited = true;
        }
        drawSky(p);
        drawStars(p, t);
        drawMoon(p, t);
        drawStormClouds(p, t);
        drawMountain(p, t);
        drawPeacefulClouds(p, t);
        drawCloudBridges(p, t);
        drawLightRays(p, t);
        drawSkyGate(p, t);
        drawPines(p);
        drawDeciduous(p);
        drawRocks(p);
        drawBushes(p);
        drawGrass(p);
        drawForeground();
        drawMist(p, t);
        drawParticles(p, t);
      }
    };
  })();

  function renderCloudPeak(W, H) {
    CP.render(W, H, growth(), gTime);
  }


  function _drawTrikonasanaStickGuide(W, H, poseLevel, t) {
    const cx = W * 0.52;
    const cy = H * 0.55;
    const scale = Math.min(W, H) / 330;
    const phase = (Math.sin(t * 1.7) + 1) / 2;
    const glow = 0.45 + 0.35 * phase + 0.20 * poseLevel;
    function X(v) { return cx + v * scale; }
    function Y(v) { return cy + v * scale; }
    function line(a, b, c, d, col, w) {
      gCtx.strokeStyle = col;
      gCtx.lineWidth = w * scale;
      gCtx.lineCap = 'round';
      gCtx.lineJoin = 'round';
      gCtx.beginPath();
      gCtx.moveTo(X(a), Y(b));
      gCtx.lineTo(X(c), Y(d));
      gCtx.stroke();
    }
    function dot(a, b, r, col, alpha) {
      gCtx.save();
      gCtx.globalAlpha = alpha == null ? 1 : alpha;
      gCtx.fillStyle = col;
      gCtx.shadowColor = col;
      gCtx.shadowBlur = 14 * scale;
      gCtx.beginPath();
      gCtx.arc(X(a), Y(b), r * scale, 0, Math.PI * 2);
      gCtx.fill();
      gCtx.restore();
    }
    gCtx.save();
    const aura = gCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.32);
    aura.addColorStop(0, `rgba(56,189,248,${0.12 + glow * 0.08})`);
    aura.addColorStop(0.55, `rgba(168,85,247,${0.08 + glow * 0.05})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    gCtx.fillStyle = aura;
    gCtx.beginPath();
    gCtx.arc(cx, cy, Math.min(W, H) * 0.32, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.strokeStyle = `rgba(56,189,248,${0.35 + poseLevel * 0.35})`;
    gCtx.lineWidth = 2 * scale;
    gCtx.beginPath();
    gCtx.ellipse(cx, Y(90), 78 * scale, 10 * scale, 0, 0, Math.PI * 2);
    gCtx.stroke();
    const main = '#e5f7ff', prism = '#a78bfa', focus = '#38bdf8';
    gCtx.shadowColor = `rgba(56,189,248,${glow})`;
    gCtx.shadowBlur = 18 * scale;
    gCtx.lineWidth = 5 * scale;
    gCtx.beginPath();
    gCtx.arc(X(0), Y(-72), 14 * scale, 0, Math.PI * 2);
    gCtx.strokeStyle = main;
    gCtx.stroke();
    line(-2, -55, -34, 12, main, 5);
    line(-46, 18, 52, 18, main, 5);
    line(-46, 18, -92, 86, main, 5);
    line(52, 18, 112, 86, main, 5);
    line(-92, 86, -120, 86, main, 5);
    line(112, 86, 142, 86, main, 5);
    line(-18, -24, -70, 58, main, 5);
    line(-70, 58, -92, 86, main, 5);
    line(-18, -24, 42, -112, main, 5);
    line(42, -112, 44, -132, main, 5);
    line(-34, 12, 42, -112, prism, 2.4);
    line(-92, 86, 142, 86, `rgba(56,189,248,${0.55 + glow * 0.25})`, 2.4);
    dot(-34, 12, 5, prism, 0.9); dot(-18, -24, 5, prism, 0.9); dot(42, -112, 5, focus, 0.95); dot(-92, 86, 5, focus, 0.95); dot(142, 86, 5, focus, 0.95);
    gCtx.strokeStyle = `rgba(56,189,248,${0.45 + phase * 0.35})`;
    gCtx.lineWidth = 3 * scale;
    gCtx.beginPath(); gCtx.moveTo(X(74), Y(-40 + phase * 10)); gCtx.lineTo(X(74), Y(-105 + phase * 10)); gCtx.stroke();
    gCtx.beginPath(); gCtx.moveTo(X(74), Y(-105 + phase * 10)); gCtx.lineTo(X(66), Y(-93 + phase * 10)); gCtx.lineTo(X(82), Y(-93 + phase * 10)); gCtx.closePath();
    gCtx.fillStyle = `rgba(56,189,248,${0.45 + phase * 0.35})`; gCtx.fill();
    gCtx.restore();
  }

  const TRI = { initedW: 0, initedH: 0, crystals: [], particles: [], ribbons: [] };
  const TRI_PALETTE = [
    '#FFD93D', '#FFB23E', '#FF8C42', '#FF5E5B', '#E8458A',
    '#C04CFF', '#7C5CFF', '#4D7CFF', '#37C0FF', '#2EE6C7',
    '#3FE07A', '#9CE83C', '#F2F2F2'
  ];
  function _triPal(i, alphaHex) { return TRI_PALETTE[i % TRI_PALETTE.length] + (alphaHex || ''); }
  function _triRandPal() { return TRI_PALETTE[Math.floor(Math.random() * TRI_PALETTE.length)]; }

  function _triInitCrystals(W, H) {
    TRI.crystals.length = 0;
    const count = Math.max(18, Math.floor(W / 45));
    for (let i = 0; i < count; i++) {
      TRI.crystals.push({
        baseX: (i + 0.5) / count * W + (Math.random() - 0.5) * 30,
        baseY: H,
        h: 22 + Math.random() * 30,
        w: 7 + Math.random() * 9,
        hueIndex: Math.floor(Math.random() * TRI_PALETTE.length),
        phase: Math.random() * Math.PI * 2,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.4 + Math.random() * 0.4,
        floatRange: 70 + Math.random() * 120,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.08 + Math.random() * 0.12,
        growth: 0,
        glow: 0,
        facets: 3 + Math.floor(Math.random() * 3)
      });
    }
  }

  function _triInitParticles(W, H) {
    TRI.particles.length = 0;
    const count = 140;
    for (let i = 0; i < count; i++) {
      TRI.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2.5,
        color: _triRandPal(),
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        twinkle: Math.random() * Math.PI * 2,
        shard: Math.random() < 0.3
      });
    }
  }

  function _triMakeRibbon(i, H) {
    return {
      baseY: H * (0.15 + i * 0.09),
      amplitude: 40 + i * 12,
      speed: 0.15 + i * 0.05,
      freq: 0.0028 + i * 0.0006,
      colorA: TRI_PALETTE[(i * 2) % TRI_PALETTE.length],
      colorB: TRI_PALETTE[(i * 2 + 3) % TRI_PALETTE.length],
      phaseOffset: i * 1.3,
      thickness: 90 + i * 10
    };
  }
  function _triInitRibbons(H) {
    TRI.ribbons = [];
    for (let i = 0; i < 5; i++) TRI.ribbons.push(_triMakeRibbon(i, H));
  }

  function _triHexToRgb(hex) {
    hex = hex.replace('#', '');
    return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
  }
  function _triLerpColor(c1, c2, x) {
    const p1 = _triHexToRgb(c1), p2 = _triHexToRgb(c2);
    return `rgb(${Math.round(lerp(p1.r, p2.r, x))},${Math.round(lerp(p1.g, p2.g, x))},${Math.round(lerp(p1.b, p2.b, x))})`;
  }

  function renderPrismValley(W, H) {
    if (TRI.initedW !== W || TRI.initedH !== H || TRI.crystals.length === 0) {
      _triInitCrystals(W, H);
      _triInitParticles(W, H);
      _triInitRibbons(H);
      TRI.initedW = W; TRI.initedH = H;
    }

    const poseLevel = growth();
    const t = gTime;

    const sky = gCtx.createLinearGradient(0, 0, 0, H);
    const dark1 = '#03040a', dark2 = '#070a16';
    const bright1 = '#2a1a4a', bright2 = '#0d0830';
    sky.addColorStop(0, _triLerpColor(dark1, bright1, poseLevel));
    sky.addColorStop(1, _triLerpColor(dark2, bright2, poseLevel));
    gCtx.fillStyle = sky;
    gCtx.fillRect(0, 0, W, H);

    const auroraAlpha = Math.max(0, (poseLevel - 0.15) / 0.85);
    if (auroraAlpha > 0.01) {
      TRI.ribbons.forEach((r, idx) => {
        gCtx.save();
        gCtx.globalCompositeOperation = 'lighter';
        gCtx.globalAlpha = auroraAlpha * (0.18 + 0.05 * idx);

        const grad = gCtx.createLinearGradient(0, r.baseY - r.thickness, 0, r.baseY + r.thickness);
        grad.addColorStop(0, r.colorA + '00');
        grad.addColorStop(0.5, r.colorA);
        grad.addColorStop(0.5, r.colorB);
        grad.addColorStop(1, r.colorB + '00');

        gCtx.beginPath();
        gCtx.moveTo(0, r.baseY);
        for (let x = 0; x <= W; x += 12) {
          const y = r.baseY
            + Math.sin(x * r.freq + t * r.speed + r.phaseOffset) * r.amplitude
            + Math.sin(x * r.freq * 2.3 + t * r.speed * 1.7) * (r.amplitude * 0.35);
          gCtx.lineTo(x, y);
        }
        for (let x = W; x >= 0; x -= 12) {
          const y = r.baseY
            + Math.sin(x * r.freq + t * r.speed + r.phaseOffset) * r.amplitude
            + Math.sin(x * r.freq * 2.3 + t * r.speed * 1.7) * (r.amplitude * 0.35)
            + r.thickness;
          gCtx.lineTo(x, y);
        }
        gCtx.closePath();
        gCtx.fillStyle = grad;
        gCtx.fill();
        gCtx.restore();
      });
    }

    gCtx.fillStyle = _triLerpColor('#0a0c14', '#1b1432', poseLevel);
    gCtx.fillRect(0, H - 70, W, 70);

    gCtx.save();
    gCtx.globalAlpha = 0.55 - poseLevel * 0.2;
    for (let i = 0; i < 24; i++) {
      const fx = (i * 53 + 20) % W;
      const fy = H - 60 + (i % 4) * 6;
      gCtx.fillStyle = _triPal(i, '');
      gCtx.globalAlpha = (0.55 - poseLevel * 0.2) * 0.6;
      gCtx.fillRect(fx, fy, 10, 5);
    }
    gCtx.restore();

    TRI.crystals.forEach((c) => {
      const target = Math.min(1, poseLevel * (0.85 + 0.3 * Math.sin(c.phase)));
      c.growth += (target - c.growth) * 0.04;
      c.glow += (target - c.glow) * 0.05;

      const grownH = c.h * (0.15 + c.growth * 1.1);
      const grownW = c.w * (0.4 + c.growth * 0.9);

      const flowSpeed = 8 + c.growth * 22;
      let cx = c.baseX - t * flowSpeed * c.driftSpeed * 6;
      cx = ((cx % (W + 80)) + (W + 80)) % (W + 80) - 40;

      const wave = Math.sin(cx * 0.006 + c.driftPhase) * (30 + c.growth * 50);
      const lift = 80 + c.growth * (c.floatRange + 80) + Math.sin(t * c.floatSpeed + c.floatPhase) * (8 + c.growth * 14) + wave * (c.growth);
      const groundY = c.baseY - 60;
      const bodyBottomY = groundY - lift;
      const topY = bodyBottomY - grownH;

      if (c.growth > 0.02) {
        const shadowAlpha = Math.max(0, 0.35 - lift / 300) * c.growth;
        const shadowScale = Math.max(0.2, 1 - lift / 180);
        gCtx.save();
        gCtx.globalAlpha = shadowAlpha;
        gCtx.fillStyle = '#000000';
        gCtx.beginPath();
        gCtx.ellipse(cx, groundY + 4, grownW * 0.9 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.restore();
      }

      if (c.glow > 0.02) {
        const haloR = grownW * 4 * c.glow;
        const g = gCtx.createRadialGradient(cx, topY, 0, cx, topY, haloR);
        const hc = TRI_PALETTE[c.hueIndex];
        g.addColorStop(0, hc + 'aa');
        g.addColorStop(1, hc + '00');
        gCtx.save();
        gCtx.globalCompositeOperation = 'lighter';
        gCtx.fillStyle = g;
        gCtx.fillRect(cx - haloR, topY - haloR, haloR * 2, haloR * 2);
        gCtx.restore();
      }

      const pulse = 1 + Math.sin(t * 1.5 + c.phase) * 0.04 * c.glow;
      const bw = grownW * pulse;
      const bh = grownH * pulse;

      gCtx.save();
      gCtx.translate(cx, bodyBottomY);

      gCtx.beginPath();
      gCtx.moveTo(0, -bh);
      gCtx.lineTo(bw / 2, -bh * 0.25);
      gCtx.lineTo(0, 0);
      gCtx.lineTo(-bw / 2, -bh * 0.25);
      gCtx.closePath();

      const baseColor = TRI_PALETTE[c.hueIndex];
      gCtx.fillStyle = baseColor + Math.floor((0.25 + c.glow * 0.55) * 255).toString(16).padStart(2, '0');
      gCtx.fill();

      gCtx.save();
      gCtx.beginPath();
      gCtx.moveTo(0, -bh);
      gCtx.lineTo(bw / 2, -bh * 0.25);
      gCtx.lineTo(0, 0);
      gCtx.lineTo(-bw / 2, -bh * 0.25);
      gCtx.closePath();
      gCtx.clip();

      for (let f = 0; f < c.facets; f++) {
        const fy = -bh + (f / c.facets) * bh;
        const fy2 = -bh + ((f + 1) / c.facets) * bh;
        gCtx.beginPath();
        gCtx.moveTo(-bw, fy);
        gCtx.lineTo(bw, fy2);
        gCtx.lineTo(bw, fy2 + bh / c.facets);
        gCtx.lineTo(-bw, fy + bh / c.facets);
        gCtx.closePath();
        gCtx.fillStyle = TRI_PALETTE[(c.hueIndex + f + 1) % TRI_PALETTE.length] + Math.floor((0.18 + c.glow * 0.4) * 255).toString(16).padStart(2, '0');
        gCtx.fill();
      }
      gCtx.restore();

      gCtx.beginPath();
      gCtx.moveTo(0, -bh);
      gCtx.lineTo(bw / 2, -bh * 0.25);
      gCtx.lineTo(0, 0);
      gCtx.lineTo(-bw / 2, -bh * 0.25);
      gCtx.closePath();
      gCtx.strokeStyle = '#ffffff' + Math.floor((0.15 + c.glow * 0.5) * 255).toString(16).padStart(2, '0');
      gCtx.lineWidth = 1;
      gCtx.stroke();

      gCtx.restore();

      if (c.glow > 0.25) {
        const glintAlpha = (c.glow - 0.25) / 0.75 * (0.5 + 0.5 * Math.sin(t * 3 + c.phase * 4));
        if (glintAlpha > 0.02) {
          gCtx.save();
          gCtx.globalCompositeOperation = 'lighter';
          gCtx.globalAlpha = glintAlpha;
          gCtx.fillStyle = '#ffffff';
          const gx = cx + Math.sin(t * 2 + c.phase) * bw * 0.3;
          const gy = (topY + bodyBottomY) / 2 + Math.cos(t * 2.3 + c.phase) * bh * 0.25;
          const gr = 1.5 + c.glow * 2;
          gCtx.beginPath();
          gCtx.moveTo(gx, gy - gr * 2);
          gCtx.lineTo(gx + gr * 0.5, gy);
          gCtx.lineTo(gx, gy + gr * 2);
          gCtx.lineTo(gx - gr * 0.5, gy);
          gCtx.closePath();
          gCtx.fill();
          gCtx.restore();
        }
      }
    });

    TRI.particles.forEach(p => {
      p.x += p.vx * (0.4 + poseLevel * 1.2);
      p.y += p.vy * (0.4 + poseLevel * 1.2) - poseLevel * 0.15;
      p.twinkle += 0.05;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      const alpha = (0.15 + poseLevel * 0.6) * (0.5 + 0.5 * Math.sin(p.twinkle));
      gCtx.save();
      gCtx.globalAlpha = alpha;
      gCtx.fillStyle = p.color;
      gCtx.globalCompositeOperation = 'lighter';
      if (p.shard) {
        gCtx.save();
        gCtx.translate(p.x, p.y);
        gCtx.rotate(p.twinkle);
        gCtx.beginPath();
        gCtx.moveTo(0, -p.r * 2);
        gCtx.lineTo(p.r * 1.4, p.r);
        gCtx.lineTo(-p.r * 1.4, p.r);
        gCtx.closePath();
        gCtx.fill();
        gCtx.restore();
      } else {
        gCtx.beginPath();
        gCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        gCtx.fill();
      }
      gCtx.restore();
    });

    const vg = gCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    gCtx.fillStyle = vg;
    gCtx.fillRect(0, 0, W, H);

    _drawLevelLabel(W, H, poseLevel);
  }

  const SB = { initedW: 0, initedH: 0, world: {} };
  const SB_COL = {
    skyTop: '#FFD9A0',
    skyTopGo: '#6FC5FF',
    skyBot: '#FFB6A3',
    skyBotGo: '#A6E3FF',
    sea: '#3FA9C9',
    seaDeep: '#2C7A9C',
    seaGlow: '#7FE3FF',
    land: '#C9A876',
    landDark: '#A8835A',
    grass: '#8FBF6B',
    grassDark: '#6E9C4E',
    roadDirt: '#9C7A52',
    roadDone: '#D9B98C',
    roadGlow: '#FFD15C',
    bridgeWood: '#8A5A3C',
    bridgeGlow: '#FFB347',
    building: '#E07A5F',
    buildingAlt: '#F2CC8F',
    buildingAlt2: '#81B29A',
    roof: '#9A3B3B',
    roofAlt: '#3D5A80',
    flag: '#E63946',
    flagAlt: '#457B9D',
    flagGold: '#FFD60A',
    person: '#4A4A4A',
    cart: '#6F4E37',
    ship: '#5C4033',
    sail: '#F1FAEE',
    shadow: 'rgba(0,0,0,0.18)'
  };

  function _sbHexToRgb(hex) {
    hex = hex.replace('#', '');
    return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
  }
  function _sbLerpColor(c1, c2, x) {
    const p1 = _sbHexToRgb(c1), p2 = _sbHexToRgb(c2);
    return `rgb(${Math.round(lerp(p1.r, p2.r, x))},${Math.round(lerp(p1.g, p2.g, x))},${Math.round(lerp(p1.b, p2.b, x))})`;
  }
  function _sbClamp01(v) { return Math.max(0, Math.min(1, v)); }
  function _sbRoadX(world, tProg) { return lerp(world.roadStart, world.roadEnd, tProg); }
  function _sbRoadYAt(world, x) { return world.groundY - 6 * Math.sin(x * 0.01); }
  function _sbQuadY(y0, yc, y1, tt) {
    const a = (1 - tt) * (1 - tt);
    const b = 2 * (1 - tt) * tt;
    const c = tt * tt;
    return a * y0 + b * yc + c * y1;
  }

  function _sbLayoutWorld(W, H) {
    const world = {};
    const groundY = H * 0.62;
    world.groundY = groundY;
    world.skyH = groundY;

    world.settlements = [
      { x: W * 0.06, y: groundY, name: 'village', scale: 0.85, prosperity: 0 },
      { x: W * 0.22, y: groundY, name: 'hamlet', scale: 0.7, prosperity: 0 },
      { x: W * 0.66, y: groundY, name: 'town', scale: 1.0, prosperity: 0 },
      { x: W * 0.80, y: groundY, name: 'market', scale: 0.85, prosperity: 0 },
      { x: W * 0.93, y: groundY, name: 'port', scale: 1.0, prosperity: 0 }
    ];

    world.river = { x1: W * 0.32, x2: W * 0.60, y: groundY };

    world.roadStart = W * 0.06;
    world.roadEnd = W * 0.92;

    world.seaX = W * 0.90;

    world.carts = [
      { progress: 0.05, speed: 0.00028, type: 'cart' },
      { progress: 0.15, speed: 0.00022, type: 'cart' },
      { progress: 0.40, speed: -0.00026, type: 'cart' },
      { progress: 0.55, speed: -0.0002, type: 'cart' },
      { progress: 0.70, speed: 0.0003, type: 'caravan' },
      { progress: 0.85, speed: -0.00018, type: 'caravan' },
      { progress: 0.95, speed: 0.00024, type: 'cart' }
    ];

    world.ships = [
      { progress: 0.1, speed: 0.00016 },
      { progress: 0.4, speed: -0.00013 },
      { progress: 0.65, speed: 0.00011 },
      { progress: 0.9, speed: -0.00014 }
    ];

    world.villagers = [];
    world.settlements.forEach((s, i) => {
      for (let j = 0; j < 7; j++) {
        world.villagers.push({
          settlement: i,
          x: s.x + (Math.random() - 0.5) * 100 * s.scale,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: 0.3 + Math.random() * 0.4,
          range: 50 + Math.random() * 30,
          baseX: s.x + (Math.random() - 0.5) * 100 * s.scale,
          bob: Math.random() * Math.PI * 2
        });
      }
    });

    world.workers = [];
    for (let i = 0; i < 5; i++) {
      world.workers.push({
        x: world.river.x1 - 30 + Math.random() * (world.river.x2 - world.river.x1 + 60),
        bob: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      });
    }

    world.flagPhase = 0;

    world.clouds = [];
    for (let i = 0; i < 8; i++) {
      world.clouds.push({
        x: Math.random() * W,
        y: H * (0.08 + Math.random() * 0.18),
        scale: 0.6 + Math.random() * 0.8,
        speed: 3 + Math.random() * 5
      });
    }

    world.birds = [];
    for (let i = 0; i < 9; i++) {
      world.birds.push({
        x: Math.random() * W,
        y: H * (0.1 + Math.random() * 0.15),
        speed: 20 + Math.random() * 15,
        phase: Math.random() * Math.PI * 2
      });
    }

    world.sparkles = [];
    for (let i = 0; i < 110; i++) {
      world.sparkles.push({
        x: Math.random() * W,
        y: groundY - Math.random() * (H * 0.35),
        r: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5
      });
    }

    return world;
  }

  function _sbDrawCloud(x, y, scale) {
    gCtx.save();
    gCtx.globalAlpha = 0.85;
    gCtx.fillStyle = '#FFFFFF';
    gCtx.beginPath();
    gCtx.ellipse(x, y, 28 * scale, 14 * scale, 0, 0, Math.PI * 2);
    gCtx.ellipse(x + 22 * scale, y + 4 * scale, 20 * scale, 12 * scale, 0, 0, Math.PI * 2);
    gCtx.ellipse(x - 20 * scale, y + 5 * scale, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.restore();
  }

  function _sbDrawSky(W, H, world, poseLevel, t) {
    const glow = Math.max(0, (poseLevel - 0.75) / 0.25);
    const sky = gCtx.createLinearGradient(0, 0, 0, world.skyH);
    sky.addColorStop(0, _sbLerpColor(SB_COL.skyTop, SB_COL.skyTopGo, glow));
    sky.addColorStop(1, _sbLerpColor(SB_COL.skyBot, SB_COL.skyBotGo, glow));
    gCtx.fillStyle = sky;
    gCtx.fillRect(0, 0, W, world.skyH);

    const sunX = W * 0.5, sunY = H * 0.16, sunR = 36;
    gCtx.save();
    gCtx.globalAlpha = 0.9;
    gCtx.fillStyle = _sbLerpColor('#FFE3A3', '#FFFDE7', glow);
    gCtx.beginPath();
    gCtx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.restore();

    world.clouds.forEach(c => {
      c.x += c.speed * 0.016;
      if (c.x > W + 80) c.x = -80;
      _sbDrawCloud(c.x, c.y, c.scale);
    });

    if (poseLevel > 0.25) {
      const birdAlpha = Math.min(1, (poseLevel - 0.25) / 0.25);
      world.birds.forEach(b => {
        b.x += b.speed * 0.016;
        if (b.x > W + 20) b.x = -20;
        const flap = Math.sin(t * 8 + b.phase) * 6;
        gCtx.save();
        gCtx.globalAlpha = birdAlpha * 0.8;
        gCtx.strokeStyle = '#5A5A5A';
        gCtx.lineWidth = 2;
        gCtx.beginPath();
        gCtx.moveTo(b.x - 8, b.y);
        gCtx.quadraticCurveTo(b.x - 4, b.y - flap, b.x, b.y);
        gCtx.quadraticCurveTo(b.x + 4, b.y - flap, b.x + 8, b.y);
        gCtx.stroke();
        gCtx.restore();
      });
    }
  }

  function _sbDrawShip(x, y, alpha, glow) {
    gCtx.save();
    gCtx.globalAlpha = alpha;
    gCtx.fillStyle = SB_COL.ship;
    gCtx.beginPath();
    gCtx.moveTo(x - 22, y);
    gCtx.lineTo(x + 22, y);
    gCtx.lineTo(x + 16, y + 10);
    gCtx.lineTo(x - 16, y + 10);
    gCtx.closePath();
    gCtx.fill();
    gCtx.strokeStyle = '#4A3726';
    gCtx.lineWidth = 2;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x, y - 24);
    gCtx.stroke();
    gCtx.fillStyle = _sbLerpColor(SB_COL.sail, '#FFE9B0', glow * 0.5);
    gCtx.beginPath();
    gCtx.moveTo(x, y - 22);
    gCtx.lineTo(x + 16, y - 14);
    gCtx.lineTo(x, y - 6);
    gCtx.closePath();
    gCtx.fill();
    gCtx.fillStyle = SB_COL.flag;
    gCtx.beginPath();
    gCtx.moveTo(x, y - 24);
    gCtx.lineTo(x + 8, y - 21);
    gCtx.lineTo(x, y - 18);
    gCtx.closePath();
    gCtx.fill();
    gCtx.restore();
  }

  function _sbDrawSea(W, H, world, poseLevel, t) {
    const glow = Math.max(0, (poseLevel - 0.75) / 0.25);
    gCtx.fillStyle = _sbLerpColor(SB_COL.sea, SB_COL.seaGlow, glow * 0.5);
    gCtx.fillRect(world.seaX, world.groundY, W - world.seaX, H - world.groundY);

    gCtx.save();
    gCtx.strokeStyle = _sbLerpColor(SB_COL.seaDeep, '#FFFFFF', glow * 0.4);
    gCtx.globalAlpha = 0.35;
    gCtx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wy = world.groundY + 14 + i * 22;
      gCtx.beginPath();
      for (let x = world.seaX; x <= W; x += 14) {
        const yy = wy + Math.sin(x * 0.04 + t * 1.5 + i) * 3;
        if (x === world.seaX) gCtx.moveTo(x, yy); else gCtx.lineTo(x, yy);
      }
      gCtx.stroke();
    }
    gCtx.restore();

    gCtx.fillStyle = _sbLerpColor(SB_COL.sea, SB_COL.seaGlow, glow * 0.5);
    gCtx.fillRect(world.river.x1, world.river.y, world.river.x2 - world.river.x1, H - world.river.y);
    gCtx.save();
    gCtx.strokeStyle = _sbLerpColor(SB_COL.seaDeep, '#FFFFFF', glow * 0.4);
    gCtx.globalAlpha = 0.35;
    gCtx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const wy = world.river.y + 10 + i * 14;
      gCtx.beginPath();
      for (let x = world.river.x1; x <= world.river.x2; x += 6) {
        const yy = wy + Math.sin(x * 0.08 + t * 2 + i) * 2;
        if (x === world.river.x1) gCtx.moveTo(x, yy); else gCtx.lineTo(x, yy);
      }
      gCtx.stroke();
    }
    gCtx.restore();

    if (poseLevel > 0.5) {
      const shipAlpha = Math.min(1, (poseLevel - 0.5) / 0.2);
      world.ships.forEach(sh => {
        sh.progress += sh.speed;
        if (sh.progress > 1) sh.progress = 0;
        if (sh.progress < 0) sh.progress = 1;
        const sx = lerp(world.seaX + 30, W - 30, sh.progress);
        const sy = world.groundY + 30 + Math.sin(t * 1.2 + sh.progress * 10) * 3;
        _sbDrawShip(sx, sy, shipAlpha, glow);
      });
    }
  }

  function _sbDrawGround(W, H, world) {
    gCtx.fillStyle = SB_COL.land;
    gCtx.fillRect(0, world.groundY, world.seaX, H - world.groundY);

    gCtx.fillStyle = SB_COL.grass;
    gCtx.fillRect(0, world.groundY, world.seaX, 14);
    gCtx.fillStyle = SB_COL.grassDark;
    for (let x = 0; x < world.seaX; x += 18) {
      gCtx.fillRect(x, world.groundY + 10, 2, 6);
    }
  }

  function _sbDrawRoadSegment(world, xStart, xEnd, progress, glow, t) {
    const segLen = xEnd - xStart;
    const builtLen = segLen * progress;

    gCtx.save();
    gCtx.fillStyle = SB_COL.roadDirt;
    gCtx.globalAlpha = 0.5;
    gCtx.fillRect(xStart, world.groundY - 2, segLen, 8);
    gCtx.restore();

    if (progress > 0) {
      const halfBuilt = builtLen / 2;

      [[xStart, xStart + halfBuilt], [xEnd - halfBuilt, xEnd]].forEach(([a, b]) => {
        if (b <= a) return;
        const roadCol = _sbLerpColor(SB_COL.roadDone, SB_COL.roadGlow, glow);
        gCtx.fillStyle = roadCol;
        gCtx.fillRect(a, world.groundY - 2, b - a, 8);

        if (glow > 0.01) {
          gCtx.save();
          gCtx.globalAlpha = glow * (0.3 + 0.2 * Math.sin(t * 3 + a * 0.05));
          gCtx.fillStyle = SB_COL.roadGlow;
          gCtx.fillRect(a, world.groundY - 4, b - a, 12);
          gCtx.restore();
        }

        gCtx.save();
        gCtx.strokeStyle = _sbLerpColor('#B08F63', '#FFF3CF', glow);
        gCtx.globalAlpha = 0.6;
        gCtx.lineWidth = 1;
        gCtx.setLineDash([6, 6]);
        gCtx.beginPath();
        gCtx.moveTo(a, world.groundY + 2);
        gCtx.lineTo(b, world.groundY + 2);
        gCtx.stroke();
        gCtx.setLineDash([]);
        gCtx.restore();
      });
    }
  }

  function _sbDrawBridgeStructure(x1, x2, y, archHeight, towerHeight, pillarProg, deckProg, towerProg, lanternProg, glow, t, mirrored) {
    const cx = (x1 + x2) / 2;
    const width = x2 - x1;
    const stoneCol = _sbLerpColor('#A89C8C', '#E8D9B0', glow * 0.4);
    const stoneShade = _sbLerpColor('#8A7E70', '#C9B98C', glow * 0.4);
    const woodCol = _sbLerpColor(SB_COL.bridgeWood, SB_COL.bridgeGlow, glow * 0.6);
    const cableCol = _sbLerpColor('#5A4632', '#FFD98A', glow * 0.7);

    if (deckProg > 0.01) {
      const segments = 28;
      gCtx.save();
      gCtx.lineCap = 'round';
      for (let i = 0; i <= segments; i++) {
        const tt = i / segments;
        const distFromEdge = Math.min(tt, 1 - tt) * 2;
        if (distFromEdge > deckProg + 0.02) continue;

        const px = lerp(x1, x2, tt);
        const arch = Math.sin(tt * Math.PI) * archHeight;
        const py = y - 10 - arch;

        gCtx.fillStyle = woodCol;
        gCtx.fillRect(px - 4, py - 3, 8, 8);
        gCtx.strokeStyle = stoneShade;
        gCtx.globalAlpha = 0.5;
        gCtx.lineWidth = 0.5;
        gCtx.strokeRect(px - 4, py - 3, 8, 8);
        gCtx.globalAlpha = 1;
      }

      if (deckProg > 0.85) {
        gCtx.strokeStyle = _sbLerpColor('#C9A876', '#FFE9A8', glow * 0.5);
        gCtx.lineWidth = 2;
        gCtx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const tt = i / segments;
          const px = lerp(x1, x2, tt);
          const arch = Math.sin(tt * Math.PI) * archHeight;
          const py = y - 10 - arch - 5;
          if (i === 0) gCtx.moveTo(px, py); else gCtx.lineTo(px, py);
        }
        gCtx.stroke();
      }
      gCtx.restore();
    }

    if (towerProg > 0.01) {
      [cx - width * 0.16, cx + width * 0.16].forEach((tx) => {
        const archAtTx = Math.sin(((tx - x1) / width) * Math.PI) * archHeight;
        const ty = y - 10 - archAtTx;
        const th = towerHeight * towerProg;

        gCtx.save();
        gCtx.fillStyle = stoneCol;
        gCtx.fillRect(tx - 5, ty - th, 10, th);
        gCtx.fillStyle = stoneShade;
        gCtx.globalAlpha = 0.5;
        for (let by = ty - th + 6; by < ty; by += 8) {
          gCtx.fillRect(tx - 5, by, 10, 1);
        }
        gCtx.globalAlpha = 1;

        gCtx.fillStyle = _sbLerpColor(SB_COL.roofAlt, '#FFD98A', glow * 0.5);
        gCtx.beginPath();
        gCtx.moveTo(tx - 7, ty - th);
        gCtx.lineTo(tx + 7, ty - th);
        gCtx.lineTo(tx, ty - th - 14);
        gCtx.closePath();
        gCtx.fill();

        if (lanternProg > 0.01 && !mirrored) {
          const pulse = 0.6 + 0.4 * Math.sin(t * 3 + tx * 0.05);
          gCtx.save();
          gCtx.globalCompositeOperation = 'lighter';
          gCtx.globalAlpha = lanternProg * pulse * 0.8;
          const r = 14;
          const grd = gCtx.createRadialGradient(tx, ty - th - 6, 0, tx, ty - th - 6, r);
          grd.addColorStop(0, '#FFE9A8');
          grd.addColorStop(1, 'rgba(255,233,168,0)');
          gCtx.fillStyle = grd;
          gCtx.fillRect(tx - r, ty - th - 6 - r, r * 2, r * 2);
          gCtx.restore();

          gCtx.save();
          gCtx.globalAlpha = lanternProg;
          gCtx.fillStyle = '#FFE9A8';
          gCtx.beginPath();
          gCtx.arc(tx, ty - th - 6, 3, 0, Math.PI * 2);
          gCtx.fill();
          gCtx.restore();
        }

        gCtx.restore();

        if (towerProg > 0.15) {
          const cableAlpha = Math.min(1, (towerProg - 0.15) / 0.5);
          gCtx.save();
          gCtx.globalAlpha = cableAlpha;
          gCtx.strokeStyle = cableCol;
          gCtx.lineWidth = 1.5;

          [x1, x2].forEach(ex => {
            const exArch = Math.sin(((ex - x1) / width) * Math.PI) * archHeight;
            const ey = y - 10 - exArch;
            gCtx.beginPath();
            gCtx.moveTo(tx, ty - th);
            gCtx.quadraticCurveTo((tx + ex) / 2, Math.max(ty - th, ey) + 18, ex, ey);
            gCtx.stroke();

            const hangerCount = 8;
            for (let h = 1; h < hangerCount; h++) {
              const ht = h / hangerCount;
              const hx = lerp(tx, ex, ht);
              const qy = _sbQuadY(ty - th, Math.max(ty - th, ey) + 18, ey, ht);
              const archAtHx = Math.sin(((hx - x1) / width) * Math.PI) * archHeight;
              const deckYatHx = y - 10 - archAtHx;
              gCtx.beginPath();
              gCtx.moveTo(hx, qy);
              gCtx.lineTo(hx, deckYatHx - 6);
              gCtx.stroke();
            }
          });
          gCtx.restore();
        }
      });
    }

    if (lanternProg > 0.05 && !mirrored) {
      const flagAlpha = lanternProg;
      [cx - width * 0.16, cx + width * 0.16].forEach((tx, i) => {
        const archAtTx = Math.sin(((tx - x1) / width) * Math.PI) * archHeight;
        const ty = y - 10 - archAtTx;
        const th = towerHeight * towerProg;
        const poleTopY = ty - th - 18;
        const wave = Math.sin(t * 4 + tx * 0.1) * 4;
        gCtx.save();
        gCtx.globalAlpha = flagAlpha;
        gCtx.fillStyle = i === 0 ? SB_COL.flag : SB_COL.flagAlt;
        gCtx.beginPath();
        gCtx.moveTo(tx, poleTopY - 4);
        gCtx.lineTo(tx + 18, poleTopY - 1 + wave * 0.3);
        gCtx.lineTo(tx + 18, poleTopY + 7 + wave);
        gCtx.lineTo(tx, poleTopY + 6);
        gCtx.closePath();
        gCtx.fill();
        gCtx.restore();
      });
    }

    if (glow > 0.01 && !mirrored) {
      gCtx.save();
      gCtx.globalCompositeOperation = 'lighter';
      gCtx.globalAlpha = glow * 0.35;
      gCtx.fillStyle = SB_COL.bridgeGlow;
      for (let tt = 0; tt <= 1; tt += 0.08) {
        const px = lerp(x1, x2, tt);
        const arch = Math.sin(tt * Math.PI) * archHeight;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + tt * 8);
        gCtx.beginPath();
        gCtx.arc(px, y - 10 - arch - 4, 5 * pulse, 0, Math.PI * 2);
        gCtx.fill();
      }
      gCtx.restore();
    }
  }

  function _sbDrawBridge(world, poseLevel, glow, t) {
    const x1 = world.river.x1, x2 = world.river.x2, y = world.river.y;
    const cx = (x1 + x2) / 2;

    const pillarProg = _sbClamp01(poseLevel / 0.30);
    const deckProg = _sbClamp01((poseLevel - 0.10) / 0.40);
    const towerProg = _sbClamp01((poseLevel - 0.25) / 0.40);
    const lanternProg = _sbClamp01((poseLevel - 0.70) / 0.30);

    const archHeight = 78;
    const towerHeight = 130;

    gCtx.save();

    if (pillarProg < 0.05) {
      gCtx.strokeStyle = SB_COL.bridgeWood;
      gCtx.lineWidth = 4;
      gCtx.beginPath();
      gCtx.moveTo(x1, y - 2);
      gCtx.lineTo(x1 + 18, y + 12);
      gCtx.moveTo(x2, y - 2);
      gCtx.lineTo(x2 - 18, y + 14);
      gCtx.stroke();
      gCtx.fillStyle = SB_COL.bridgeWood;
      gCtx.fillRect(cx - 16, y + 6, 10, 4);
      gCtx.fillRect(cx + 6, y + 14, 14, 4);
    }

    _sbDrawBridgeStructure(x1, x2, y, archHeight, towerHeight, pillarProg, deckProg, towerProg, lanternProg, glow, t, false);

    gCtx.restore();
  }

  function _sbDrawRoad(world, poseLevel, t) {
    const roadProgress = Math.min(1, poseLevel / 0.5);
    const glow = Math.max(0, (poseLevel - 0.75) / 0.25);

    _sbDrawRoadSegment(world, world.roadStart, world.river.x1, roadProgress, glow, t);
    _sbDrawRoadSegment(world, world.river.x2, world.roadEnd, roadProgress, glow, t);

    _sbDrawBridge(world, poseLevel, glow, t);
  }

  function _sbDrawBuilding(x, y, w, h, roofColor, prosp, glow, t, seed, poseLevel) {
    if (h < 4) return;
    const wallColor = _sbLerpColor(SB_COL.buildingAlt, '#FFF6E0', glow * 0.4);

    gCtx.save();
    gCtx.fillStyle = SB_COL.shadow;
    gCtx.fillRect(x - w / 2 + 2, y - 2, w, 4);

    gCtx.fillStyle = wallColor;
    gCtx.fillRect(x - w / 2, y - h, w, h);

    gCtx.fillStyle = _sbLerpColor(roofColor, '#FFD15C', glow * 0.5);
    gCtx.beginPath();
    gCtx.moveTo(x - w / 2 - 4, y - h);
    gCtx.lineTo(x + w / 2 + 4, y - h);
    gCtx.lineTo(x, y - h - w * 0.45);
    gCtx.closePath();
    gCtx.fill();

    if (h > 14) {
      gCtx.fillStyle = '#5A3E2B';
      const doorW = w * 0.22, doorH = h * 0.4;
      gCtx.fillRect(x - doorW / 2, y - doorH, doorW, doorH);
    }

    if (h > 20) {
      const winLit = glow > 0.05;
      gCtx.fillStyle = winLit ? _sbLerpColor('#CDE8F5', '#FFE9A8', glow) : '#CDE8F5';
      const winW = w * 0.18, winH = h * 0.16;
      gCtx.fillRect(x - w * 0.32, y - h * 0.62, winW, winH);
      gCtx.fillRect(x + w * 0.14, y - h * 0.62, winW, winH);
      if (winLit) {
        gCtx.save();
        gCtx.globalAlpha = glow * 0.5;
        gCtx.fillStyle = '#FFE9A8';
        gCtx.fillRect(x - w * 0.32 - 2, y - h * 0.62 - 2, winW + 4, winH + 4);
        gCtx.fillRect(x + w * 0.14 - 2, y - h * 0.62 - 2, winW + 4, winH + 4);
        gCtx.restore();
      }
    }

    if (poseLevel > 0.8) {
      const flagAlpha = Math.min(1, (poseLevel - 0.8) / 0.2);
      const poleX = x + w * 0.3;
      const poleTopY = y - h - w * 0.45 - 16;
      gCtx.save();
      gCtx.globalAlpha = flagAlpha;
      gCtx.strokeStyle = '#8A5A3C';
      gCtx.lineWidth = 1.5;
      gCtx.beginPath();
      gCtx.moveTo(poleX, y - h - w * 0.45);
      gCtx.lineTo(poleX, poleTopY);
      gCtx.stroke();

      const wave = Math.sin(t * 4 + seed) * 4;
      const flagColors = [SB_COL.flag, SB_COL.flagAlt, SB_COL.flagGold];
      gCtx.fillStyle = flagColors[Math.floor(seed) % flagColors.length];
      gCtx.beginPath();
      gCtx.moveTo(poleX, poleTopY);
      gCtx.lineTo(poleX + 16, poleTopY + 3 + wave * 0.3);
      gCtx.lineTo(poleX + 16, poleTopY + 9 + wave);
      gCtx.lineTo(poleX, poleTopY + 8);
      gCtx.closePath();
      gCtx.fill();
      gCtx.restore();
    }

    gCtx.restore();
  }

  function _sbDrawSettlement(world, s, t, poseLevel) {
    const scale = s.scale;
    const prosp = s.prosperity;
    const glow = Math.max(0, (poseLevel - 0.75) / 0.25);

    const buildingCount = 4 + Math.floor(prosp * 3);

    const buildingDefs = [
      { dx: -110, w: 30, h: 26, roof: SB_COL.roofAlt },
      { dx: -70, w: 36, h: 34, roof: SB_COL.roof },
      { dx: -25, w: 30, h: 28, roof: SB_COL.roofAlt },
      { dx: 15, w: 38, h: 40, roof: SB_COL.roof },
      { dx: 60, w: 28, h: 26, roof: SB_COL.roofAlt },
      { dx: 95, w: 34, h: 36, roof: SB_COL.roof },
      { dx: 132, w: 26, h: 24, roof: SB_COL.roofAlt }
    ];

    for (let i = 0; i < buildingCount && i < buildingDefs.length; i++) {
      const b = buildingDefs[i];
      const bx = s.x + b.dx * scale;
      const bw = b.w * scale;
      const bh = b.h * scale * (0.3 + prosp * 0.7);
      const by = world.groundY;

      _sbDrawBuilding(bx, by, bw, bh, b.roof, prosp, glow, t, i + s.x, poseLevel);
    }
  }

  function _sbDrawSettlements(world, t, poseLevel) {
    world.settlements.forEach((s) => {
      s.prosperity = poseLevel;
      _sbDrawSettlement(world, s, t, poseLevel);
    });
  }

  function _sbDrawPerson(x, y, t, seed, colorOverride) {
    const walkCycle = Math.sin(t * 6 + seed) * 3;
    gCtx.save();
    gCtx.fillStyle = colorOverride || SB_COL.person;
    gCtx.fillRect(x - 2, y - 12, 4, 8);
    gCtx.beginPath();
    gCtx.arc(x, y - 15, 3, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.strokeStyle = colorOverride || SB_COL.person;
    gCtx.lineWidth = 2;
    gCtx.beginPath();
    gCtx.moveTo(x, y - 4);
    gCtx.lineTo(x - 3 + walkCycle * 0.5, y + 2);
    gCtx.moveTo(x, y - 4);
    gCtx.lineTo(x + 3 - walkCycle * 0.5, y + 2);
    gCtx.stroke();
    gCtx.restore();
  }

  function _sbDrawVillagers(world, t, poseLevel) {
    if (poseLevel < 0.05) return;
    const alpha = Math.min(1, poseLevel / 0.25);
    world.villagers.forEach(v => {
      v.x += v.dir * v.speed;
      if (Math.abs(v.x - v.baseX) > v.range) v.dir *= -1;
      const y = _sbRoadYAt(world, v.x) + 8;
      gCtx.save();
      gCtx.globalAlpha = alpha;
      _sbDrawPerson(v.x, y, t, v.bob);
      gCtx.restore();
    });
  }

  function _sbDrawWorkers(world, t, poseLevel) {
    const alpha = poseLevel > 0.05 && poseLevel < 0.6
      ? Math.min(1, (poseLevel - 0.05) / 0.1) * Math.max(0, (0.6 - poseLevel) / 0.2)
      : (poseLevel >= 0.05 && poseLevel <= 0.1 ? (poseLevel - 0.05) / 0.05 : 0);

    if (alpha <= 0.01) return;

    world.workers.forEach((w) => {
      const bob = Math.sin(t * w.speed * 4 + w.bob) * 2;
      const y = world.river.y - 4 + bob;
      gCtx.save();
      gCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
      _sbDrawPerson(w.x, y, t, w.bob, '#7A5230');
      gCtx.strokeStyle = '#7A5230';
      gCtx.lineWidth = 2;
      const swing = Math.sin(t * 8 + w.bob);
      gCtx.beginPath();
      gCtx.moveTo(w.x + 2, y - 14);
      gCtx.lineTo(w.x + 2 + swing * 4, y - 18 - swing * 2);
      gCtx.stroke();
      gCtx.restore();
    });
  }

  function _sbDrawCart(x, y, t, type, scale) {
    gCtx.save();
    gCtx.translate(x, y);
    gCtx.scale(scale, scale);
    gCtx.fillStyle = SB_COL.cart;
    gCtx.fillRect(-12, -10, 24, 10);
    if (type === 'caravan') {
      gCtx.fillStyle = '#D9B98C';
      gCtx.beginPath();
      gCtx.moveTo(-12, -10);
      gCtx.quadraticCurveTo(0, -20, 12, -10);
      gCtx.closePath();
      gCtx.fill();
    }
    const wheelSpin = (t * 6) % (Math.PI * 2);
    [-7, 7].forEach(wx => {
      gCtx.save();
      gCtx.translate(wx, 0);
      gCtx.rotate(wheelSpin);
      gCtx.strokeStyle = '#3A2A1A';
      gCtx.lineWidth = 1.5;
      gCtx.beginPath();
      gCtx.arc(0, 0, 4, 0, Math.PI * 2);
      gCtx.moveTo(-4, 0); gCtx.lineTo(4, 0);
      gCtx.moveTo(0, -4); gCtx.lineTo(0, 4);
      gCtx.stroke();
      gCtx.restore();
    });
    gCtx.restore();
  }

  function _sbDrawCarts(world, t, poseLevel) {
    if (poseLevel < 0.25) return;
    const cartAlpha = Math.min(1, (poseLevel - 0.25) / 0.15);
    const caravanAlpha = Math.min(1, Math.max(0, (poseLevel - 0.5) / 0.15));

    world.carts.forEach(c => {
      if (c.type === 'caravan' && caravanAlpha <= 0.01) return;
      if (c.type === 'cart' && cartAlpha <= 0.01) return;

      c.progress += c.speed;
      if (c.progress > 1) c.progress = 0;
      if (c.progress < 0) c.progress = 1;

      const bridgeProgress = Math.max(0, Math.min(1, (poseLevel - 0.05) / 0.2));
      let prog = c.progress;
      const riverT1 = (world.river.x1 - world.roadStart) / (world.roadEnd - world.roadStart);
      const riverT2 = (world.river.x2 - world.roadStart) / (world.roadEnd - world.roadStart);
      if (bridgeProgress < 0.9 && prog > riverT1 && prog < riverT2) {
        c.progress = c.speed > 0 ? riverT1 : riverT2;
        prog = c.progress;
      }

      const x = _sbRoadX(world, prog);
      const y = _sbRoadYAt(world, x) - 4;
      gCtx.save();
      gCtx.globalAlpha = c.type === 'caravan' ? caravanAlpha : cartAlpha;
      _sbDrawCart(x, y, t, c.type, c.type === 'caravan' ? 1.1 : 0.9);
      gCtx.restore();
    });
  }

  function _sbDrawSparkles(world, t, poseLevel) {
    const alpha = Math.max(0, (poseLevel - 0.85) / 0.15);
    if (alpha <= 0.01) return;
    world.sparkles.forEach(p => {
      p.twinkle += p.speed * 0.05;
      const a = alpha * (0.4 + 0.6 * Math.sin(p.twinkle));
      gCtx.save();
      gCtx.globalAlpha = a;
      gCtx.fillStyle = '#FFE9A8';
      gCtx.beginPath();
      gCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gCtx.fill();
      gCtx.restore();
    });
  }

  function renderKingdoms(W, H) {
    if (SB.initedW !== W || SB.initedH !== H || !SB.world.settlements) {
      SB.world = _sbLayoutWorld(W, H);
      SB.initedW = W; SB.initedH = H;
    }
    const world = SB.world;
    const poseLevel = growth();
    const t = gTime;

    _sbDrawSky(W, H, world, poseLevel, t);
    _sbDrawSea(W, H, world, poseLevel, t);
    _sbDrawGround(W, H, world);
    _sbDrawRoad(world, poseLevel, t);
    _sbDrawWorkers(world, t, poseLevel);
    _sbDrawCarts(world, t, poseLevel);
    _sbDrawSettlements(world, t, poseLevel);
    _sbDrawVillagers(world, t, poseLevel);
    _sbDrawSparkles(world, t, poseLevel);

    _drawLevelLabel(W, H, poseLevel);
  }


  function _newWorldSky(W, H, top, bottom) {
    const g = gCtx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); gCtx.fillStyle = g; gCtx.fillRect(0, 0, W, H);
  }
  function _particle(x, y, r, c, a = 1) { gCtx.save(); gCtx.globalAlpha = a; gCtx.fillStyle = c; gCtx.beginPath(); gCtx.arc(x, y, r, 0, Math.PI * 2); gCtx.fill(); gCtx.restore(); }

  function renderJungleTemple(W, H) {
    
    const lvl = Math.max(1, Math.min(4, gLevel || 1));
    const t = gTime * 60;
    const S = Math.min(W / 900, H / 720);
    const ox = (W - 900 * S) / 2;
    const oy = (H - 720 * S) / 2;
    const X = x => ox + x * S;
    const Y = y => oy + y * S;
    const SC = v => v * S;

    function rect(x, y, w, h, fill) { gCtx.fillStyle = fill; gCtx.fillRect(X(x), Y(y), SC(w), SC(h)); }
    function ellipse(x, y, rx, ry, rot, fill, alpha = 1) {
      gCtx.save(); gCtx.globalAlpha = alpha; gCtx.fillStyle = fill; gCtx.beginPath();
      gCtx.ellipse(X(x), Y(y), SC(rx), SC(ry), rot, 0, Math.PI * 2); gCtx.fill(); gCtx.restore();
    }
    function circle(x, y, r, fill, alpha = 1) { ellipse(x, y, r, r, 0, fill, alpha); }
    function pathStroke(points, color, width, alpha = 1) {
      gCtx.save(); gCtx.globalAlpha = alpha; gCtx.strokeStyle = color; gCtx.lineWidth = SC(width); gCtx.lineCap = 'round'; gCtx.lineJoin = 'round';
      gCtx.beginPath(); gCtx.moveTo(X(points[0][0]), Y(points[0][1]));
      for (let i = 1; i < points.length; i++) gCtx.lineTo(X(points[i][0]), Y(points[i][1]));
      gCtx.stroke(); gCtx.restore();
    }
    function bezierStroke(x1, y1, cx1, cy1, cx2, cy2, x2, y2, color, width, alpha = 1) {
      gCtx.save(); gCtx.globalAlpha = alpha; gCtx.strokeStyle = color; gCtx.lineWidth = SC(width); gCtx.lineCap = 'round';
      gCtx.beginPath(); gCtx.moveTo(X(x1), Y(y1)); gCtx.bezierCurveTo(X(cx1), Y(cy1), X(cx2), Y(cy2), X(x2), Y(y2)); gCtx.stroke(); gCtx.restore();
    }

    // outer background
    gCtx.fillStyle = '#123d18';
    gCtx.fillRect(0, 0, W, H);

    const sky = gCtx.createLinearGradient(0, Y(0), 0, Y(720));
    sky.addColorStop(0, lvl >= 4 ? '#64b5f6' : '#6ec6f5');
    sky.addColorStop(.40, '#b8dcf2');
    sky.addColorStop(.75, lvl >= 2 ? '#d8f0b8' : '#97b77d');
    sky.addColorStop(1, lvl >= 2 ? '#5fa832' : '#334155');
    gCtx.fillStyle = sky;
    gCtx.fillRect(ox, oy, 900 * S, 720 * S);

    // sun and light rays
    const sunGlow = gCtx.createRadialGradient(X(780), Y(95), 0, X(780), Y(95), SC(95));
    sunGlow.addColorStop(0, 'rgba(255,242,160,.9)'); sunGlow.addColorStop(1, 'rgba(255,242,160,0)');
    gCtx.fillStyle = sunGlow; gCtx.beginPath(); gCtx.arc(X(780), Y(95), SC(95), 0, Math.PI * 2); gCtx.fill();
    circle(780, 95, 52, '#ffe680', .92); circle(780, 95, 42, '#fff2a0', .95);
    if (lvl >= 3) {
      gCtx.save(); gCtx.globalAlpha = .07 + .04 * Math.sin(t * .025); gCtx.fillStyle = '#fff9a0';
      for (let i = -2; i <= 2; i++) { gCtx.save(); gCtx.translate(X(780), Y(95)); gCtx.rotate(i * .42); gCtx.beginPath(); gCtx.moveTo(SC(-10), 0); gCtx.lineTo(SC(10), 0); gCtx.lineTo(SC(95), SC(260)); gCtx.lineTo(SC(45), SC(260)); gCtx.closePath(); gCtx.fill(); gCtx.restore(); }
      gCtx.restore();
    }

    // clouds
    function cloud(cx, cy, scale, alpha, dir) {
      gCtx.save(); gCtx.globalAlpha = alpha; gCtx.translate(SC(Math.sin(t * .012) * dir), 0); gCtx.fillStyle = 'white';
      ellipse(cx, cy, 80 * scale, 30 * scale, 0, 'white', 1); ellipse(cx - 40 * scale, cy + 10 * scale, 52 * scale, 24 * scale, 0, 'white', 1);
      ellipse(cx + 40 * scale, cy + 10 * scale, 58 * scale, 22 * scale, 0, 'white', 1); ellipse(cx, cy - 12 * scale, 44 * scale, 26 * scale, 0, 'white', 1);
      gCtx.restore();
    }
    cloud(180, 90, 1, .82, 60); cloud(490, 68, 1.05, .70, -50);

    // distant trees
    function tree(cx, base, h, alpha, phase) {
      const sway = Math.sin(t * .018 + phase) * 4;
      gCtx.save(); gCtx.globalAlpha = alpha; gCtx.translate(SC(sway), 0);
      rect(cx - 7, base - h * .45, 14, h * .45, '#4a6e3a');
      ellipse(cx, base - h * .55, 42, h * .28, 0, lvl >= 2 ? '#4a9130' : '#5a7e46', 1);
      ellipse(cx - 22, base - h * .47, 28, h * .20, -.15, lvl >= 2 ? '#3d8228' : '#4e7040', 1);
      ellipse(cx + 24, base - h * .45, 26, h * .19, .15, lvl >= 2 ? '#3d8228' : '#4e7040', 1);
      gCtx.restore();
    }
    tree(74, 510, 240, .35, 0.4); tree(217, 510, 260, .35, 1.1); tree(676, 505, 260, .35, 1.8); tree(827, 505, 290, .35, .9);

    // ground
    const ground = gCtx.createLinearGradient(0, Y(490), 0, Y(720));
    ground.addColorStop(0, lvl >= 2 ? '#5fa832' : '#475569'); ground.addColorStop(.60, lvl >= 2 ? '#3d7a1f' : '#334155'); ground.addColorStop(1, lvl >= 2 ? '#2b5a14' : '#172033');
    gCtx.fillStyle = ground; gCtx.fillRect(X(0), Y(490), SC(900), SC(230));
    ellipse(450, 492, 460, 18, 0, lvl >= 2 ? '#4a8c25' : '#253449', .6);
    ellipse(110, 500, 70, 12, 0, lvl >= 2 ? '#3e8020' : '#1f2937', .75); ellipse(780, 498, 80, 11, 0, lvl >= 2 ? '#3e8020' : '#1f2937', .65);

    // flowers and grass progressively restored
    if (lvl >= 2) {
      for (let i = 0; i < 26; i++) {
        const x = (i * 37 + 17) % 900, base = 510 + (i % 4) * 2, len = 35 + (i % 5) * 12, sway = Math.sin(t * .05 + i) * 7;
        bezierStroke(x, base, x + sway * .2, base - len * .35, x + sway * .6, base - len * .65, x + sway, base - len, i % 2 ? '#58be2e' : '#4aa820', 2.8, .85);
      }
      [[58, 468, '#f04848'], [858, 452, '#e030a8'], [310, 447, '#f07030']].slice(0, lvl >= 3 ? 3 : 1).forEach(([fx, fy, col], idx) => {
        bezierStroke(fx, 705, fx - 2, 610, fx + 2, 535, fx, fy, '#3a8a22', 4, .9);
        for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3 + t * .01; ellipse(fx + Math.cos(a) * 13, fy + Math.sin(a) * 13, 7, 16, a, col, .95); }
        circle(fx, fy, 7, '#ffd030', 1);
      });
    }

    // sparkles / fireflies
    const sparkCount = lvl >= 4 ? 36 : lvl >= 3 ? 24 : 10;
    for (let i = 0; i < sparkCount; i++) {
      const sx = (i * 83 + Math.sin(t * .02 + i) * 18) % 900;
      const sy = 105 + (i * 57 % 310) + Math.sin(t * .04 + i) * 8;
      circle(sx, sy, 1.6 + (i % 3) * .8, lvl >= 3 ? '#fffaaa' : '#86efac', .18 + .45 * (.5 + .5 * Math.sin(t * .06 + i)));
    }

    // snake shadow
    ellipse(432, 630, 210, 22, 0, '#1a4a0a', .25 + .05 * Math.sin(t * .055));

    const bob = Math.sin(t * .045) * 8;
    gCtx.save();
    gCtx.translate(0, SC(bob));
    const bodyGrad = gCtx.createLinearGradient(X(210), Y(520), X(650), Y(270));
    bodyGrad.addColorStop(0, '#d4a43c'); bodyGrad.addColorStop(.40, '#c47e18'); bodyGrad.addColorStop(.75, '#a85f10'); bodyGrad.addColorStop(1, '#7a3f08');
    // body path
    gCtx.fillStyle = bodyGrad; gCtx.strokeStyle = '#7a3e08'; gCtx.lineWidth = SC(4);
    gCtx.beginPath();
    const pulse = Math.sin(t * .04) * 5;
    gCtx.moveTo(X(195), Y(615));
    gCtx.bezierCurveTo(X(160 - pulse * .3), Y(590), X(170), Y(548 - pulse * .2), X(232), Y(525));
    gCtx.bezierCurveTo(X(310), Y(498 - pulse * .25), X(410), Y(535 + pulse * .2), X(492), Y(533));
    gCtx.bezierCurveTo(X(504), Y(485), X(492), Y(400), X(508), Y(320));
    gCtx.bezierCurveTo(X(521), Y(248), X(584), Y(220), X(620), Y(272));
    gCtx.bezierCurveTo(X(660), Y(336), X(636), Y(442), X(624), Y(520));
    gCtx.bezierCurveTo(X(656), Y(554), X(662), Y(590), X(638), Y(610));
    gCtx.bezierCurveTo(X(614), Y(660), X(514), Y(638), X(418), Y(626));
    gCtx.bezierCurveTo(X(334), Y(618), X(258), Y(668), X(195), Y(615));
    gCtx.closePath(); gCtx.fill(); gCtx.stroke();
    // sheen
    gCtx.globalAlpha = .22; gCtx.fillStyle = 'white'; ellipse(558, 210, 34, 24, -.2, 'white', 1); gCtx.globalAlpha = 1;
    // belly strip
    gCtx.fillStyle = '#ecd9aa'; gCtx.globalAlpha = .86;
    gCtx.beginPath(); gCtx.moveTo(X(558), Y(300)); gCtx.bezierCurveTo(X(588), Y(300), X(614), Y(314), X(626), Y(338));
    gCtx.bezierCurveTo(X(624), Y(400), X(612), Y(462), X(606), Y(524)); gCtx.bezierCurveTo(X(588), Y(530), X(562), Y(526), X(545), Y(514));
    gCtx.bezierCurveTo(X(552), Y(444), X(556), Y(368), X(558), Y(300)); gCtx.closePath(); gCtx.fill(); gCtx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { bezierStroke(556 - i * .7, 316 + i * 18, 582, 316 + i * 18, 610, 320 + i * 18, 624 - i * 1.6, 332 + i * 18, '#b89050', 1.2, .45); }
    // dorsal patches
    [[576, 338, 20, 13], [574, 380, 19, 13], [572, 422, 18, 12], [570, 462, 17, 11], [568, 500, 16, 10]].forEach(a => ellipse(a[0], a[1], a[2], a[3], 0, '#8a4808', .35));
    [[258, 545, 34, 12], [400, 540, 32, 12], [248, 600, 30, 12], [380, 612, 26, 10], [524, 540, 32, 12]].forEach(a => ellipse(a[0], a[1], a[2], a[3], .12, '#6a3206', .28));

    // head bob and rotate
    gCtx.save();
    gCtx.translate(X(575), Y(248));
    gCtx.rotate(Math.sin(t * .04) * .04);
    gCtx.translate(-X(575), -Y(248));
    ellipse(575, 248, 82, 74, 0, bodyGrad, 1);
    gCtx.strokeStyle = '#7a3e08'; gCtx.lineWidth = SC(4); gCtx.beginPath(); gCtx.ellipse(X(575), Y(248), SC(82), SC(74), 0, 0, Math.PI * 2); gCtx.stroke();
    ellipse(575, 285, 55, 28, 0, '#d4a040', .42);
    ellipse(535, 237, 22, 38, -.28, '#f5f0e0', 1); ellipse(608, 237, 22, 38, .28, '#f5f0e0', 1);
    const blink = (Math.sin(t * .07) > 0.94) ? .12 : 1;
    ellipse(537, 241, 12, 26 * blink, -.28, '#1a1208', 1); ellipse(609, 241, 12, 26 * blink, .28, '#1a1208', 1);
    circle(530, 228, 5.5, 'white', .9); circle(602, 228, 5.5, 'white', .9);
    ellipse(549, 294, 5.5, 3.5, -.18, '#5a2808', 1); ellipse(598, 295, 5.5, 3.5, .18, '#5a2808', 1);
    bezierStroke(530, 300, 558, 328, 610, 324, 636, 298, '#8a4020', 5, .8);
    const tongueOn = Math.sin(t * .075) > 0.25;
    if (tongueOn) { bezierStroke(580, 320, 579, 345, 576, 360, 565, 372, '#c02040', 4.5, 1); bezierStroke(579, 348, 590, 360, 600, 368, 612, 376, '#c02040', 4.5, 1); }
    gCtx.restore();
    gCtx.restore();

    // butterfly at upper/mid level
    if (lvl >= 3) {
      const bx = 260 + Math.sin(t * .018) * 110, by = 360 + Math.sin(t * .028 + 1.4) * 45, flap = .2 + .8 * Math.abs(Math.sin(t * .35));
      gCtx.save(); gCtx.translate(X(bx), Y(by)); gCtx.rotate(Math.sin(t * .02) * .25); gCtx.fillStyle = '#f8a020';
      gCtx.beginPath(); gCtx.ellipse(SC(-16), SC(-8), SC(22 * flap), SC(14), -.6, 0, Math.PI * 2); gCtx.fill();
      gCtx.beginPath(); gCtx.ellipse(SC(16), SC(-8), SC(22 * flap), SC(14), .6, 0, Math.PI * 2); gCtx.fill();
      gCtx.fillStyle = '#f06818'; gCtx.beginPath(); gCtx.ellipse(SC(-12), SC(12), SC(18 * flap), SC(12), .5, 0, Math.PI * 2); gCtx.fill();
      gCtx.beginPath(); gCtx.ellipse(SC(12), SC(12), SC(18 * flap), SC(12), -.5, 0, Math.PI * 2); gCtx.fill();
      gCtx.fillStyle = '#3a2808'; gCtx.beginPath(); gCtx.ellipse(0, 0, SC(3), SC(16), 0, 0, Math.PI * 2); gCtx.fill(); gCtx.restore();
    }

    // foreground leaves
    if (lvl >= 2) {
      for (let i = 0; i < 12; i++) {
        const x = i * 82, y = i % 2 ? 660 : 648, col = i % 3 === 0 ? '#3ea820' : i % 3 === 1 ? '#52c030' : '#46b024';
        ellipse(x, y, 56, 20, (i % 2 ? -.18 : .20), col, .93);
      }
    }

    gCtx.save();
    gCtx.font = `${Math.max(12, SC(18))}px Inter, Arial`;
    gCtx.fillStyle = 'rgba(255,255,255,.88)';
    gCtx.textAlign = 'center';
    const labels = ['Forgotten Garden', 'Garden Awakens', 'Sacred Cobra Grove', 'Living Cobra Sanctuary'];
    gCtx.fillText(labels[lvl - 1], X(450), Y(38));
    gCtx.restore();

    _drawLevelLabel(W, H, gCtx);
  }

  function renderSamuraiDojo(W, H) {
    const lvl = gLevel, t = gTime * 60;
    const S = Math.min(W / 600, H / 380);
    const ox = (W - 600 * S) / 2;
    const oy = (H - 380 * S) / 2;
    function X(x) { return ox + x * S; }
    function Y(y) { return oy + y * S; }
    function SC(v) { return v * S; }

    const SKY = {
      1: { top: '#c4734a', mid: '#d9896a', bot: '#e8b090', water: '#b06040' },
      2: { top: '#7a4a6a', mid: '#c06a50', bot: '#e09070', water: '#5a6a8a' },
      3: { top: '#e8701a', mid: '#f0a060', bot: '#f8d090', water: '#c07a40' },
      4: { top: '#1a0a30', mid: '#3a1a50', bot: '#6a3060', water: '#1a2a5a' }
    };
    const names = ['', 'Broken dojo - dawn', 'Bamboo awakening - dusk', 'Full bloom - golden hour', 'Grand festival - lantern night'];
    const L = Math.max(1, Math.min(4, lvl));
    const sky = SKY[L];

    gCtx.fillStyle = '#1a0f08';
    gCtx.fillRect(0, 0, W, H);

    function fillRect(x, y, w, h) { gCtx.fillRect(X(x), Y(y), SC(w), SC(h)); }
    function strokeRect(x, y, w, h) { gCtx.strokeRect(X(x), Y(y), SC(w), SC(h)); }
    function line(x1, y1, x2, y2) { gCtx.beginPath(); gCtx.moveTo(X(x1), Y(y1)); gCtx.lineTo(X(x2), Y(y2)); gCtx.stroke(); }
    function ellipse(x, y, rx, ry, rot, fill = true) { gCtx.beginPath(); gCtx.ellipse(X(x), Y(y), SC(rx), SC(ry), rot, 0, Math.PI * 2); fill ? gCtx.fill() : gCtx.stroke(); }
    function arc(x, y, r, fill = true) { gCtx.beginPath(); gCtx.arc(X(x), Y(y), SC(r), 0, Math.PI * 2); fill ? gCtx.fill() : gCtx.stroke(); }

    // sky
    let g = gCtx.createLinearGradient(0, Y(0), 0, Y(209));
    g.addColorStop(0, sky.top); g.addColorStop(.5, sky.mid); g.addColorStop(1, sky.bot);
    gCtx.fillStyle = g; fillRect(0, 0, 600, 209);
    if (L === 4) {
      gCtx.fillStyle = 'rgba(255,180,80,0.12)';
      for (let i = 0; i < 50; i++) { arc((i * 137.5) % 600, (i * 89.3) % 171, i % 5 === 0 ? 1.2 : .5, true); }
    }

    // mountains
    gCtx.fillStyle = L === 4 ? '#2a1540' : L === 3 ? '#c05828' : L === 2 ? '#8a4a60' : '#a05538';
    gCtx.beginPath(); gCtx.moveTo(X(0), Y(209));
    [[0, .35], [.08, .22], [.18, .3], [.28, .16], [.4, .24], [.52, .13], [.64, .21], [.76, .12], [.88, .2], [1, .28], [1, .55]].forEach(([x, y]) => gCtx.lineTo(X(600 * x), Y(380 * y)));
    gCtx.closePath(); gCtx.fill();
    gCtx.fillStyle = L === 4 ? '#1a0a28' : L === 3 ? '#8a3a18' : L === 2 ? '#5a2a40' : '#6a3020';
    gCtx.beginPath(); gCtx.moveTo(X(0), Y(209));
    [[0, .42], [.1, .3], [.2, .38], [.32, .25], [.45, .33], [.58, .22], [.7, .31], [.82, .2], [.95, .29], [1, .35], [1, .55]].forEach(([x, y]) => gCtx.lineTo(X(600 * x), Y(380 * y)));
    gCtx.closePath(); gCtx.fill();

    // water
    let wg = gCtx.createLinearGradient(0, Y(209), 0, Y(258));
    wg.addColorStop(0, sky.water); wg.addColorStop(1, L === 4 ? '#0a1530' : '#7a4a30');
    gCtx.fillStyle = wg; fillRect(0, 209, 600, 49);
    gCtx.save(); gCtx.globalAlpha = .15 + .1 * Math.sin(t * .04); gCtx.strokeStyle = '#fff'; gCtx.lineWidth = SC(1);
    for (let i = 0; i < 5; i++) line(60 + i * 10, 217 + i * 7.6, 240 + i * 5, 217 + i * 7.6);
    gCtx.restore();
    if (L >= 2) { gCtx.save(); gCtx.globalAlpha = .2 + .1 * Math.sin(t * .06 + 1); gCtx.strokeStyle = '#ffd080'; gCtx.lineWidth = SC(1.5); line(270, 209, 330, 258); gCtx.restore(); }

    // shoji panels
    function shoji(side) {
      const x = side === 'left' ? 0 : 468, w = 132, h = 342, y = 19;
      gCtx.fillStyle = L <= 1 ? '#c8b090' : L === 2 ? '#d8c098' : '#e8d8b0'; fillRect(x, y, w, h);
      gCtx.strokeStyle = '#5a3a18'; gCtx.lineWidth = SC(3); strokeRect(x, y, w, h);
      gCtx.save(); gCtx.globalAlpha = .4; gCtx.strokeStyle = '#5a3a18'; gCtx.lineWidth = SC(1.5);
      for (let i = 1; i < 4; i++) line(x + w / 4 * i, y, x + w / 4 * i, y + h);
      for (let j = 1; j < 6; j++) line(x, y + h / 6 * j, x + w, y + h / 6 * j);
      gCtx.restore();
      gCtx.fillStyle = '#5a3a18'; fillRect(x, y, w, 4); fillRect(x, y + h - 4, w, 4); fillRect(x, y, 4, h); fillRect(x + w - 4, y, 4, h);
    }
    shoji('left'); shoji('right');

    // frame
    gCtx.fillStyle = '#5a3a18'; fillRect(132, 15, 336, 8); fillRect(132, 258 - 8, 336, 8); fillRect(132, 15, 8, 251); fillRect(460, 15, 8, 251); fillRect(296, 15, 8, 251);
    if (L >= 3) { gCtx.fillStyle = 'rgba(255,200,100,0.08)'; fillRect(140, 23, 156, 235); fillRect(304, 23, 156, 235); }

    // lantern glow and bamboo
    if (L >= 4) {
      gCtx.save(); gCtx.globalAlpha = .08 + .04 * Math.sin(t * .07);
      [[213, 46], [351, 46]].forEach(([lx, ly]) => { const rg = gCtx.createRadialGradient(X(lx), Y(ly), 0, X(lx), Y(ly), SC(120)); rg.addColorStop(0, '#ffaa30'); rg.addColorStop(1, 'transparent'); gCtx.fillStyle = rg; gCtx.fillRect(0, 0, W, H); });
      gCtx.restore();
    }
    if (L >= 2) {
      gCtx.save(); gCtx.globalAlpha = .7;[12, 36, 60].forEach((bx, i) => { const sway = Math.sin(t * .022 + i * .8) * 4; gCtx.strokeStyle = '#3a6a2a'; gCtx.lineWidth = SC(3); gCtx.beginPath(); gCtx.moveTo(X(bx), Y(258)); gCtx.bezierCurveTo(X(bx + sway * .3), Y(190), X(bx + sway * .6), Y(114), X(bx + sway), Y(19)); gCtx.stroke(); for (let s = 0; s < 5; s++) { const sy = 258 - s * 45.6, sx = bx + sway * (s / 5) * .5; gCtx.strokeStyle = '#4a8a3a'; gCtx.lineWidth = SC(4); line(sx - 2, sy, sx + 2, sy); if (s > 1) { gCtx.fillStyle = '#3a7a2a'; ellipse(sx + 10, sy - 5, 10, 3, .5, true); ellipse(sx - 10, sy - 8, 8, 3, -.5, true); } } }); gCtx.restore();
    }

    // floor and tatami
    let fg = gCtx.createLinearGradient(0, Y(258), 0, Y(380)); fg.addColorStop(0, '#c8a060'); fg.addColorStop(1, '#a07840'); gCtx.fillStyle = fg; fillRect(0, 258, 600, 122);
    gCtx.save(); gCtx.globalAlpha = .12; gCtx.strokeStyle = '#6a4a20'; gCtx.lineWidth = SC(1); for (let i = 0; i <= 12; i++) line(600 / 12 * i, 258, 600 / 12 * i, 380); gCtx.restore();
    let tg = gCtx.createLinearGradient(X(60), Y(258), X(60), Y(349)); tg.addColorStop(0, '#9aaa68'); tg.addColorStop(1, '#7a8a50'); gCtx.fillStyle = tg; fillRect(60, 258, 480, 91); gCtx.strokeStyle = '#5a6a38'; gCtx.lineWidth = SC(2.5); strokeRect(60, 258, 480, 91);
    gCtx.save(); gCtx.globalAlpha = .25; gCtx.strokeStyle = '#5a6a38'; gCtx.lineWidth = SC(.8); for (let i = 1; i < 10; i++) line(60 + i * 48, 258, 60 + i * 48, 349); for (let i = 1; i < 4; i++) line(60, 258 + i * 22.75, 540, 258 + i * 22.75); gCtx.restore();
    gCtx.strokeStyle = '#8a9a58'; gCtx.lineWidth = SC(3); line(60, 258, 540, 258); line(60, 349, 540, 349);

    // vase and bonsai
    const vx = 60, vy = 267;
    gCtx.fillStyle = '#e8c890'; ellipse(vx, vy + 8, 9, 14, 0, true); gCtx.fillStyle = '#d0a870'; fillRect(vx - 9, vy + 3, 18, 14); gCtx.fillStyle = '#e8c890'; ellipse(vx, vy + 17, 11, 5, 0, true);
    if (L >= 2) { gCtx.strokeStyle = '#3a5020'; gCtx.lineWidth = SC(1.5); gCtx.beginPath(); gCtx.moveTo(X(vx), Y(vy)); gCtx.bezierCurveTo(X(vx - 5), Y(vy - 12), X(vx - 10), Y(vy - 22), X(vx - 8), Y(vy - 34)); gCtx.stroke(); gCtx.beginPath(); gCtx.moveTo(X(vx), Y(vy)); gCtx.bezierCurveTo(X(vx + 3), Y(vy - 14), X(vx + 8), Y(vy - 20), X(vx + 5), Y(vy - 30)); gCtx.stroke(); (L >= 3 ? [[vx - 8, vy - 34], [vx + 5, vy - 30], [vx - 2, vy - 22]] : [[vx - 8, vy - 34]]).forEach(([fx, fy]) => { gCtx.fillStyle = L >= 3 ? '#e86080' : '#c04060'; for (let p = 0; p < 5; p++) { const a = p * Math.PI * .4; ellipse(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 4, 3, a, true); } gCtx.fillStyle = '#ffdd00'; arc(fx, fy, 3, true); }); }
    const bx = 534, by = 267; gCtx.fillStyle = '#4a3218'; fillRect(bx - 16, by + 6, 32, 8); fillRect(bx - 10, by + 14, 20, 6); gCtx.strokeStyle = '#3a2010'; gCtx.lineWidth = SC(3); line(bx, by + 6, bx - 2, by - 14); gCtx.lineWidth = SC(2); line(bx - 2, by - 2, bx - 18, by - 22); line(bx - 2, by - 8, bx + 14, by - 20);
    (L >= 3 ? [[-10, -32], [10, -30], [0, -24], [-18, -24], [14, -22]] : L >= 2 ? [[-10, -32], [10, -30], [0, -24]] : [[0, -28]]).forEach(([ox2, oy2]) => { gCtx.fillStyle = L >= 4 ? '#1a5a1a' : '#2a6a2a'; arc(bx + ox2, by + oy2, L >= 3 ? 12 : 10, true); gCtx.fillStyle = L >= 4 ? '#2a7a2a' : '#3a8a3a'; arc(bx + ox2 - 2, by + oy2 - 2, L >= 3 ? 8 : 7, true); });

    
    const tableY = 290, tx = 300; gCtx.save(); gCtx.globalAlpha = L === 1 ? .5 : 1; gCtx.fillStyle = '#3a1f08'; fillRect(tx - 90 + 6, tableY - 14, 8, 14); fillRect(tx + 90 - 14, tableY - 14, 8, 14); gCtx.fillStyle = '#4a2a10'; fillRect(tx - 90, tableY - 22, 180, 8); gCtx.fillStyle = 'rgba(255,200,120,0.07)'; fillRect(tx - 88, tableY - 20, 176, 3); gCtx.restore();
    const teaY = tableY - 22; gCtx.save(); gCtx.globalAlpha = L === 1 ? .4 : 1; gCtx.fillStyle = '#e8dcc8'; ellipse(tx, teaY - 11, 15, 11, 0, true); gCtx.strokeStyle = '#b89060'; gCtx.lineWidth = SC(1.5); ellipse(tx, teaY - 11, 15, 11, 0, false); gCtx.fillStyle = '#c8a070'; ellipse(tx, teaY - 21, 11, 4, 0, true); gCtx.fillStyle = '#b87040'; ellipse(tx, teaY - 22, 7, 3, 0, true); gCtx.strokeStyle = '#b89060'; gCtx.lineWidth = SC(3); gCtx.beginPath(); gCtx.moveTo(X(tx + 15), Y(teaY - 13)); gCtx.quadraticCurveTo(X(tx + 26), Y(teaY - 18), X(tx + 22), Y(teaY - 10)); gCtx.stroke(); gCtx.beginPath(); gCtx.moveTo(X(tx - 15), Y(teaY - 16)); gCtx.quadraticCurveTo(X(tx - 28), Y(teaY - 11), X(tx - 15), Y(teaY - 6)); gCtx.stroke();
    if (L >= 2) { [tx - 32, tx + 32].forEach(cup => { gCtx.fillStyle = '#d8c8a0'; ellipse(cup, teaY - 7, 9, 6, 0, true); gCtx.strokeStyle = '#a08050'; gCtx.lineWidth = SC(1); ellipse(cup, teaY - 7, 9, 6, 0, false); gCtx.fillStyle = 'rgba(80,140,160,0.6)'; gCtx.beginPath(); gCtx.ellipse(X(cup), Y(teaY - 8), SC(6), SC(3), 0, Math.PI, Math.PI * 2); gCtx.fill(); }); }
    if (L >= 3) { gCtx.save(); gCtx.globalAlpha = .3 + .2 * Math.sin(t * .05); gCtx.strokeStyle = '#c8c8d0'; gCtx.lineWidth = SC(1); gCtx.beginPath(); gCtx.moveTo(X(tx), Y(teaY - 27)); gCtx.bezierCurveTo(X(tx + 8), Y(teaY - 40), X(tx + 12), Y(teaY - 38), X(tx + 6), Y(teaY - 30)); gCtx.stroke(); gCtx.restore(); } gCtx.restore();

    // sakura petals
    if (L >= 3) {
      gCtx.save();
      for (let i = 0; i < 60; i++) {
        const px = 132 + ((i * 47 + t * 0.45 + Math.sin(t * .015 + i) * 20) % 336);
        const py = ((i * 29 + t * (.35 + (i % 7) * .03)) % 258) - 10;
        const r = t * .01 + i, sz = 2 + (i % 4);
        gCtx.globalAlpha = (.35 + (i % 5) * .08); gCtx.save(); gCtx.translate(X(px), Y(py)); gCtx.rotate(r); gCtx.fillStyle = L >= 4 ? '#ffb0c0' : '#ffccd5';
        for (let p = 0; p < 5; p++) { gCtx.save(); gCtx.rotate(p * Math.PI * .4); gCtx.beginPath(); gCtx.ellipse(0, -SC(sz), SC(sz * .5), SC(sz), 0, 0, Math.PI * 2); gCtx.fill(); gCtx.restore(); }
        gCtx.restore();
      }
      gCtx.restore();
    }

    // lanterns and festival deco
    const count = L === 1 ? 0 : L === 2 ? 1 : 2;
    [[213, 46], [351, 46]].slice(0, count).forEach(([lx, ly], i) => {
      const flk = .85 + .15 * Math.sin(t * .09 + i * 1.8), bright = L >= 4 ? 1 : L >= 3 ? .85 : .7;
      gCtx.save(); gCtx.strokeStyle = '#3a2010'; gCtx.lineWidth = SC(1.5); line(lx, 15, lx, ly - 22); gCtx.fillStyle = '#2a1008'; fillRect(lx - 6, ly - 24, 12, 4);
      gCtx.save(); gCtx.globalAlpha = .25 * bright * flk; const rg = gCtx.createRadialGradient(X(lx), Y(ly), 0, X(lx), Y(ly), SC(55)); rg.addColorStop(0, '#ffaa30'); rg.addColorStop(1, 'transparent'); gCtx.fillStyle = rg; arc(lx, ly, 55, true); gCtx.restore();
      gCtx.fillStyle = `rgb(${Math.floor(200 * flk)},${Math.floor(40 * flk)},${Math.floor(30 * flk)})`; ellipse(lx, ly, 16, 22, 0, true);
      gCtx.strokeStyle = 'rgba(0,0,0,.3)'; gCtx.lineWidth = SC(1); for (let rr = -1; rr <= 1; rr++) line(lx - 16, ly + rr * 7, lx + 16, ly + rr * 7);
      gCtx.fillStyle = 'rgba(255,200,100,0.12)'; fillRect(lx - 16, ly - 22, 32, 4); fillRect(lx - 16, ly + 18, 32, 4);
      gCtx.save(); gCtx.globalAlpha = .5 * bright * flk; const ig = gCtx.createRadialGradient(X(lx), Y(ly), 0, X(lx), Y(ly), SC(12)); ig.addColorStop(0, 'rgba(255,220,120,1)'); ig.addColorStop(1, 'transparent'); gCtx.fillStyle = ig; arc(lx, ly, 12, true); gCtx.restore();
      const tassel = L >= 4 ? 22 : 16; for (let tt = -1; tt <= 1; tt++) { gCtx.strokeStyle = 'rgba(255,160,40,0.6)'; gCtx.lineWidth = SC(1); line(lx + tt * 5, ly + 22, lx + tt * 7, ly + 22 + tassel); }
      gCtx.restore();
    });
    if (L >= 4) {
      gCtx.save(); gCtx.strokeStyle = 'rgba(255,180,40,0.5)'; gCtx.lineWidth = SC(1); gCtx.beginPath(); gCtx.moveTo(X(132), Y(19)); for (let i = 0; i <= 8; i++) gCtx.lineTo(X(132 + i * 42), Y(19 + (i % 2) * 11)); gCtx.stroke();
      for (let i = 0; i <= 4; i++) { const fx = 132 + i * 84, fy = 19 + (i % 2) * 11 + 6; gCtx.fillStyle = i % 2 === 0 ? '#e84040' : '#e8d040'; gCtx.beginPath(); gCtx.moveTo(X(fx), Y(fy)); gCtx.lineTo(X(fx - 6), Y(fy + 12)); gCtx.lineTo(X(fx + 6), Y(fy + 12)); gCtx.closePath(); gCtx.fill(); }
      gCtx.restore();
    }

    
    gCtx.save();
    gCtx.font = `${Math.max(10, SC(12))}px serif`;
    gCtx.fillStyle = 'rgba(240,190,130,0.75)';
    gCtx.textAlign = 'center';
    gCtx.fillText(names[L], X(300), Y(372));
    gCtx.restore();
    _drawLevelLabel(W, H, gCtx);
  }

  const GV = (() => {
    let W = 0, H = 0, inited = false, t = 0;
    function resize(w, h) {
      W = w;
      H = h;
      rebuildLeafCarpet();
    }

   
    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    const rng = mulberry32(42);

   
    let carpetLeaves = [];
    function rebuildLeafCarpet() {
      carpetLeaves = [];
      const groundY = H * 0.68;
      const count = 420;
      for (let i = 0; i < count; i++) {
        const x = rng() * W;
        const depthT = rng(); 
        const y = groundY + depthT * depthT * (H - groundY);
        const scale = 0.5 + depthT * 0.9; 
        const hue = 10 + rng() * 35; 
        const sat = 65 + rng() * 30;
        const lit = 30 + rng() * 28;
        const rot = rng() * Math.PI * 2;
        const sz = (3 + rng() * 5) * scale;
        const type = Math.floor(rng() * 3); // 0=oval, 1=maple, 2=elongated
        carpetLeaves.push({ x, y, sz, rot, hue, sat, lit, type, depthT });
      }
      // sort by y 
      carpetLeaves.sort((a, b) => a.y - b.y);
    }

    // Falling leaf particles
    class FallingLeaf {
      constructor(initial) {
        this.reset(initial);
      }
      reset(rand) {
        this.x = Math.random() * W * 1.1 - W * 0.05;
        this.y = rand ? Math.random() * H * 0.7 : -20;
        this.sz = 4 + Math.random() * 7;
        this.hue = 10 + Math.random() * 35;
        this.sat = 70 + Math.random() * 25;
        this.lit = 35 + Math.random() * 25;
     
        this.vx = (Math.random() - 0.45) * 0.6;
        this.vy = 0.5 + Math.random() * 0.9;
        this.rot = Math.random() * Math.PI * 2;
        this.rv = (Math.random() - 0.5) * 0.04;
        this.wobF = Math.random() * Math.PI * 2; // wobble phase
        this.wobA = 0.3 + Math.random() * 0.5;  // wobble amplitude
        this.type = Math.floor(Math.random() * 3);
      }
      update() {
        this.wobF += 0.022;
        this.x += this.vx + Math.sin(this.wobF) * this.wobA;
        this.y += this.vy;
        this.rot += this.rv;
        if (this.y > H + 30) this.reset(false);
      }
      draw(alpha) {
        if (alpha <= 0) return;
        gCtx.save();
        gCtx.globalAlpha = alpha * 0.82;
        gCtx.translate(this.x, this.y);
        gCtx.rotate(this.rot);
        drawLeafShape(gCtx, 0, 0, this.sz, this.type, this.hue, this.sat, this.lit);
        gCtx.restore();
      }
    }

    // single leaf shape
    function drawLeafShape(gCtx, x, y, sz, type, hue, sat, lit) {
      const col = `hsl(${hue},${sat}%,${lit}%)`;
      const col2 = `hsl(${hue + 8},${sat - 10}%,${lit + 12}%)`;
      gCtx.fillStyle = col;
      if (type === 0) {
        
        gCtx.beginPath();
        gCtx.ellipse(x, y, sz * 0.38, sz, 0, 0, Math.PI * 2);
        gCtx.fill();
        // Midrib highlight
        gCtx.strokeStyle = col2;
        gCtx.lineWidth = 0.6;
        gCtx.globalAlpha *= 0.5;
        gCtx.beginPath();
        gCtx.moveTo(x, y - sz); gCtx.lineTo(x, y + sz);
        gCtx.stroke();
      } else if (type === 1) {

        gCtx.beginPath();
        gCtx.moveTo(x, y - sz);
        gCtx.bezierCurveTo(x + sz * 0.5, y - sz * 0.6, x + sz * 0.7, y - sz * 0.1, x + sz * 0.3, y + sz * 0.4);
        gCtx.bezierCurveTo(x + sz * 0.55, y + sz * 0.3, x + sz * 0.5, y + sz * 0.85, x, y + sz);
        gCtx.bezierCurveTo(x - sz * 0.5, y + sz * 0.85, x - sz * 0.55, y + sz * 0.3, x - sz * 0.3, y + sz * 0.4);
        gCtx.bezierCurveTo(x - sz * 0.7, y - sz * 0.1, x - sz * 0.5, y - sz * 0.6, x, y - sz);
        gCtx.closePath();
        gCtx.fill();
        // side lobes
        gCtx.globalAlpha *= 0.85;
        gCtx.fillStyle = col2;
        [[-0.9, -0.3, 0.45], [0.9, -0.3, 0.45]].forEach(([lx, ly, lr]) => {
          gCtx.beginPath();
          gCtx.ellipse(x + lx * sz * 0.55, y + ly * sz * 0.5, sz * lr * 0.4, sz * lr * 0.55, lx > 0 ? 0.5 : -0.5, 0, Math.PI * 2);
          gCtx.fill();
        });
      } else {
        // Elongated oval - birch-like
        gCtx.save();
        gCtx.translate(x, y);
        gCtx.rotate(0.3);
        gCtx.beginPath();
        gCtx.ellipse(0, 0, sz * 0.28, sz * 1.1, 0, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.restore();
      }
    }

    const fallingLeaves = Array.from({ length: 55 }, () => new FallingLeaf(true));

    // Branch system
    function drawBranch(gCtx, x1, y1, len, angle, depth, maxDepth, thickness, leafDensity, hue) {
      if (depth > maxDepth || len < 2) return;

      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;

      // Trunk/branch
      gCtx.save();
      gCtx.strokeStyle = depth === 0
        ? `rgba(32,18,7,0.95)`
        : depth < 3
          ? `rgba(42,24,9,0.88)`
          : `rgba(55,32,12,0.75)`;
      gCtx.lineWidth = Math.max(0.6, thickness);
      gCtx.lineCap = 'round';
      gCtx.beginPath();
      gCtx.moveTo(x1, y1);
      // Slight curve for organic feel
      const mx = (x1 + x2) / 2 + Math.sin(depth * 1.7 + x1 * 0.003) * len * 0.12;
      const my = (y1 + y2) / 2 + Math.cos(depth * 2.1 + y1 * 0.003) * len * 0.06;
      gCtx.quadraticCurveTo(mx, my, x2, y2);
      gCtx.stroke();
      gCtx.restore();

      // Leaf cluster at branch tips
      if (depth >= maxDepth - 1 && leafDensity > 0.05) {
        const r = len * (1.8 + leafDensity * 1.4);
        const glow = gCtx.createRadialGradient(x2, y2, 0, x2, y2, r);
        const alpha = leafDensity * 0.88;
        glow.addColorStop(0, `hsla(${hue},85%,42%,${alpha})`);
        glow.addColorStop(0.45, `hsla(${hue - 5},80%,36%,${alpha * 0.9})`);
        glow.addColorStop(0.75, `hsla(${hue + 10},70%,28%,${alpha * 0.65})`);
        glow.addColorStop(1, 'transparent');
        gCtx.save();
        gCtx.fillStyle = glow;
        gCtx.beginPath();
        // Slight squish for natural elliptical canopy
        gCtx.ellipse(x2, y2, r, r * 0.78, 0, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.restore();
      }

      // Recurse
      const spread = 0.38 + 0.1 / (depth + 1);
      const decay = 0.62 + depth * 0.018;
      drawBranch(gCtx, x2, y2, len * decay, angle - spread * (0.6 + Math.random() * 0.5), depth + 1, maxDepth, thickness * 0.58, leafDensity, hue);
      drawBranch(gCtx, x2, y2, len * decay, angle + spread * (0.6 + Math.random() * 0.5), depth + 1, maxDepth, thickness * 0.55, leafDensity, hue);
      if (depth < 3 && Math.random() > 0.45) {
        drawBranch(gCtx, x2, y2, len * decay * 0.75, angle + (Math.random() - 0.5) * spread * 0.6, depth + 2, maxDepth, thickness * 0.4, leafDensity, hue);
      }
    }

    // full tree rooted 
    function drawTree(tx, groundY, trunkH, trunkW, leafDensity, hue, windT) {
      const sway = Math.sin(windT * 0.014 + tx * 0.002) * 0.012;

      gCtx.save();

      // Trunk base - rooted, flaring at bottom
      const tg = gCtx.createLinearGradient(tx - trunkW, groundY, tx + trunkW, groundY);
      tg.addColorStop(0, 'rgba(18,9,3,0.97)');
      tg.addColorStop(0.3, 'rgba(38,20,7,0.95)');
      tg.addColorStop(0.7, 'rgba(50,28,10,0.9)');
      tg.addColorStop(1, 'rgba(18,9,3,0.97)');
      gCtx.fillStyle = tg;

      // Flared base
      gCtx.beginPath();
      gCtx.moveTo(tx - trunkW * 2.2, groundY + 4);
      gCtx.quadraticCurveTo(tx - trunkW * 0.8, groundY - trunkH * 0.08, tx - trunkW * 0.3, groundY - trunkH * 0.12);
      gCtx.quadraticCurveTo(tx - trunkW * 0.22, groundY - trunkH * 0.6, tx - trunkW * 0.12 + sway * trunkH, groundY - trunkH);
      gCtx.lineTo(tx + trunkW * 0.12 + sway * trunkH, groundY - trunkH);
      gCtx.quadraticCurveTo(tx + trunkW * 0.22, groundY - trunkH * 0.6, tx + trunkW * 0.3, groundY - trunkH * 0.12);
      gCtx.quadraticCurveTo(tx + trunkW * 0.8, groundY - trunkH * 0.08, tx + trunkW * 2.2, groundY + 4);
      gCtx.closePath();
      gCtx.fill();

      gCtx.restore();

      // Branches from near top of trunk
      const branchBaseX = tx + sway * trunkH;
      const branchBaseY = groundY - trunkH * 0.88;
      const maxDepth = leafDensity > 0.3 ? 8 : 7;

      gCtx.save();
     
      const baseAngle = -Math.PI / 2 + sway * 0.3;

      drawBranch(gCtx, branchBaseX, branchBaseY,
        trunkH * 0.38, baseAngle - 0.18, 0, maxDepth, trunkW * 2.8, leafDensity, hue);
      drawBranch(gCtx, branchBaseX, branchBaseY,
        trunkH * 0.34, baseAngle + 0.22, 0, maxDepth, trunkW * 2.4, leafDensity, hue);
      
      drawBranch(gCtx, tx + sway * trunkH * 0.5, groundY - trunkH * 0.6,
        trunkH * 0.28, baseAngle - 0.55, 0, maxDepth - 1, trunkW * 1.8, leafDensity, hue);
      gCtx.restore();
    }

    // Ground (grass + leaf carpet)
    function drawGround(blend) {
      const groundY = H * 0.68;

      // Grass base - warm green turning golden
      const f = blend / 3;
      const grassG = gCtx.createLinearGradient(0, groundY, 0, H);
      const r1 = Math.round(80 + f * 90);
      const g1 = Math.round(88 + f * 30);
      const b1 = Math.round(28 - f * 10);
      const r2 = Math.round(50 + f * 65);
      const g2 = Math.round(55 + f * 22);
      const b2 = Math.round(16 - f * 5);
      grassG.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      grassG.addColorStop(1, `rgb(${r2},${g2},${b2})`);
      gCtx.fillStyle = grassG;
      gCtx.fillRect(0, groundY, W, H - groundY);

      // Frost/dew shimmer near horizon at level 0
      if (blend < 0.8) {
        const frostAlpha = (0.8 - blend) * 0.28;
        const frost = gCtx.createLinearGradient(0, groundY, 0, groundY + H * 0.12);
        frost.addColorStop(0, `rgba(220,240,255,${frostAlpha})`);
        frost.addColorStop(1, 'transparent');
        gCtx.fillStyle = frost;
        gCtx.fillRect(0, groundY, W, H * 0.12);
      }

      // Leaf carpet - density grows with blend
      const carpetAlpha = Math.min(1, blend * 0.5);
      if (carpetAlpha > 0.01) {
        gCtx.save();
        carpetLeaves.forEach(leaf => {
          
          const depthAlpha = 0.25 + leaf.depthT * 0.65;
          gCtx.globalAlpha = carpetAlpha * depthAlpha;
          gCtx.save();
          gCtx.translate(leaf.x, leaf.y);
          gCtx.rotate(leaf.rot);
          drawLeafShape(gCtx, 0, 0, leaf.sz, leaf.type, leaf.hue, leaf.sat, leaf.lit);
          gCtx.restore();
        });
        gCtx.restore();
      }

      // Ground mist band
      const mist = gCtx.createLinearGradient(0, groundY - H * 0.04, 0, groundY + H * 0.1);
      mist.addColorStop(0, 'transparent');
      mist.addColorStop(0.35, `rgba(200,185,150,${0.07 + blend * 0.03})`);
      mist.addColorStop(1, 'transparent');
      gCtx.fillStyle = mist;
      gCtx.fillRect(0, groundY - H * 0.04, W, H * 0.14);
    }

    // Sky 
    function drawSky(blend) {
      const groundY = H * 0.68;
      const f = blend / 3;

      // Sky gradient 
      const skyTop = blend < 1
        ? `rgb(${Math.round(140 + f * 40)},${Math.round(130 + f * 30)},${Math.round(125 + f * 20)})`
        : blend < 2
          ? `rgb(${Math.round(160 - f * 20)},${Math.round(195 - f * 10)},${Math.round(220 + f * 5)})`
          : `rgb(100,158,220)`;
      const skyHorizon = blend < 1
        ? `rgb(${Math.round(195 + f * 40)},${Math.round(175 + f * 35)},${Math.round(145 + f * 20)})`
        : `rgb(${Math.round(235 - f * 10)},${Math.round(215 - f * 5)},${Math.round(190)})`;

      const sky = gCtx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyHorizon);
      gCtx.fillStyle = sky;
      gCtx.fillRect(0, 0, W, groundY);

      // Sun 
      const sunX = W * 0.72;
      const sunY = H * 0.14;
      const sunR = H * 0.055;

      // Sun halo
      const sunGlow = gCtx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 5);
      const glowA = 0.08 + blend * 0.07;
      sunGlow.addColorStop(0, `rgba(255,255,220,${glowA * 3})`);
      sunGlow.addColorStop(0.15, `rgba(255,230,160,${glowA * 2})`);
      sunGlow.addColorStop(0.4, `rgba(255,210,120,${glowA})`);
      sunGlow.addColorStop(1, 'transparent');
      gCtx.fillStyle = sunGlow;
      gCtx.fillRect(0, 0, W, groundY);

      // Sun disc
      const sunDisc = gCtx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
      sunDisc.addColorStop(0, 'rgba(255,255,230,0.96)');
      sunDisc.addColorStop(0.6, 'rgba(255,230,160,0.90)');
      sunDisc.addColorStop(1, 'rgba(255,200,100,0.0)');
      gCtx.save();
      gCtx.fillStyle = sunDisc;
      gCtx.beginPath();
      gCtx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      gCtx.fill();
      gCtx.restore();

      // Light rays from sun 
      gCtx.save();
      gCtx.globalCompositeOperation = 'lighter';
      const rayStr = 0.018 + blend * 0.016;
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI * 0.62 + i * 0.055 + Math.sin(t * 0.005 + i) * 0.015;
        const len = W * 1.6;
        const rg = gCtx.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
        rg.addColorStop(0, `rgba(255,240,180,${rayStr * 2.5})`);
        rg.addColorStop(0.2, `rgba(255,220,140,${rayStr})`);
        rg.addColorStop(1, 'transparent');
        gCtx.fillStyle = rg;
        gCtx.save();
        gCtx.translate(sunX, sunY);
        gCtx.rotate(angle);
        const w = 6 + i * 3;
        gCtx.fillRect(0, -w / 2, len, w);
        gCtx.restore();
      }
      gCtx.restore();

      // Distant hill / forest silhouette on horizon
      const horizY = groundY;
      gCtx.save();
      gCtx.fillStyle = blend < 1
        ? `rgba(100,90,75,0.45)`
        : `rgba(${Math.round(60 + blend * 20)},${Math.round(85 + blend * 15)},${Math.round(45 + blend * 10)},0.55)`;
      gCtx.beginPath();
      gCtx.moveTo(0, horizY);
      // Rolling hills
      for (let x = 0; x <= W; x += W / 40) {
        const hy = horizY - H * (0.04 + Math.sin(x * 0.009 + 1.2) * 0.028 + Math.sin(x * 0.018 + 2.4) * 0.018);
        x === 0 ? gCtx.moveTo(x, hy) : gCtx.lineTo(x, hy);
      }
      gCtx.lineTo(W, horizY);
      gCtx.closePath();
      gCtx.fill();
      // Haze on distant hills
      const hazeG = gCtx.createLinearGradient(0, horizY - H * 0.06, 0, horizY);
      hazeG.addColorStop(0, 'transparent');
      hazeG.addColorStop(1, `rgba(${Math.round(200 + blend * 15)},${Math.round(185 + blend * 10)},${Math.round(160)},${0.3 + blend * 0.08})`);
      gCtx.fillStyle = hazeG;
      gCtx.fillRect(0, horizY - H * 0.06, W, H * 0.06);
      gCtx.restore();
    }

    // Chairs (Adirondack silhouettes, grounded) 
    function drawChairs(blend) {
      if (blend < 0.5) return;
      const alpha = Math.min(1, (blend - 0.5) * 1.4);
      const groundY = H * 0.68;
      const chairScale = H * 0.075;

      gCtx.save();
      gCtx.globalAlpha = alpha * 0.88;

      // Chair positions - slightly left of centre, on the ground
      const chairs = [
        { x: W * 0.40, facing: 1 },
        { x: W * 0.49, facing: -1 },
      ];
      const col = `rgba(28,14,5,0.92)`;

      chairs.forEach(({ x, facing }) => {
        const y = groundY;
        const s = chairScale;
        gCtx.save();
        gCtx.translate(x, y);
        gCtx.scale(facing, 1); // flip for second chair
        gCtx.fillStyle = col;

        // Seat
        gCtx.beginPath();
        gCtx.moveTo(-s * 0.55, -s * 0.55);
        gCtx.lineTo(s * 0.55, -s * 0.55);
        gCtx.lineTo(s * 0.48, -s * 0.35);
        gCtx.lineTo(-s * 0.48, -s * 0.35);
        gCtx.closePath();
        gCtx.fill();

        // Back slats
        for (let i = 0; i < 5; i++) {
          const sx = -s * 0.42 + i * s * 0.21;
          gCtx.fillRect(sx, -s * 1.15, s * 0.09, s * 0.65);
        }
        // Back top rail
        gCtx.beginPath();
        gCtx.moveTo(-s * 0.52, -s * 1.18);
        gCtx.quadraticCurveTo(0, -s * 1.28, s * 0.52, -s * 1.18);
        gCtx.lineTo(s * 0.52, -s * 1.10);
        gCtx.quadraticCurveTo(0, -s * 1.20, -s * 0.52, -s * 1.10);
        gCtx.closePath();
        gCtx.fill();

        // Armrests
        gCtx.fillRect(-s * 0.58, -s * 0.7, s * 0.12, s * 0.36);
        gCtx.fillRect(s * 0.46, -s * 0.7, s * 0.12, s * 0.36);
        gCtx.beginPath();
        gCtx.ellipse(-s * 0.52, -s * 0.7, s * 0.28, s * 0.06, -0.15, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.beginPath();
        gCtx.ellipse(s * 0.52, -s * 0.7, s * 0.28, s * 0.06, 0.15, 0, Math.PI * 2);
        gCtx.fill();

        // Front legs
        gCtx.fillRect(-s * 0.44, -s * 0.35, s * 0.09, s * 0.38);
        gCtx.fillRect(s * 0.35, -s * 0.35, s * 0.09, s * 0.38);
        // Back legs (angled)
        gCtx.save();
        gCtx.translate(-s * 0.48, -s * 0.36);
        gCtx.rotate(0.18);
        gCtx.fillRect(0, 0, s * 0.09, s * 0.44);
        gCtx.restore();

        gCtx.restore();
      });

      // Small table between chairs
      const tableX = W * 0.445;
      gCtx.fillStyle = col;
      gCtx.fillRect(tableX - H * 0.02, groundY - H * 0.04, H * 0.04, H * 0.04);
      gCtx.beginPath();
      gCtx.ellipse(tableX, groundY - H * 0.04, H * 0.028, H * 0.01, 0, 0, Math.PI * 2);
      gCtx.fill();

      gCtx.restore();
    }

    // Pollen motes 
    class Mote {
      constructor() { this.reset(true); }
      reset(rand) {
        const groundY = H * 0.68;
        this.x = Math.random() * W;
        this.y = rand ? Math.random() * groundY : groundY * 0.3 + Math.random() * groundY * 0.5;
        this.r = Math.random() * 1.8 + 0.3;
        this.vx = (Math.random() - 0.5) * 0.18;
        this.vy = (Math.random() - 0.5) * 0.10;
        this.life = 0;
        this.maxLife = 180 + Math.random() * 140;
      }
      update() {
        this.life++;
        this.x += this.vx + Math.sin(t * 0.008 + this.y * 0.005) * 0.1;
        this.y += this.vy + Math.cos(t * 0.01 + this.x * 0.004) * 0.07;
        if (this.life > this.maxLife) this.reset(false);
      }
      draw(blend) {
        const a = Math.sin((this.life / this.maxLife) * Math.PI) * 0.4 * Math.min(1, blend * 0.8);
        if (a < 0.01) return;
        gCtx.save();
        gCtx.globalAlpha = a;
        gCtx.fillStyle = 'rgba(255,240,160,0.95)';
        gCtx.beginPath();
        gCtx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.restore();
      }
    }
    const motes = Array.from({ length: 80 }, () => new Mote());

    function render(blend) {
      gCtx.clearRect(0, 0, W, H);

      const groundY = H * 0.68;
      // Leaf hue: starts at reddish-orange (10 degree), goes to deep amber (32°) at peak
      const leafHue = 10 + blend * 7.5;

      // Sky + sun + hills
      drawSky(blend);

      // Background/mid trees (smaller, hazed, behind the main ones)
      gCtx.save();
      const bgTreeCount = 9;
      for (let i = 0; i < bgTreeCount; i++) {
        const tx = W * 0.04 + (W * 0.92 / (bgTreeCount - 1)) * i;
        const distFromSide = Math.min(tx / W, (W - tx) / W) * 2; // 0=edge 1=centre
        if (distFromSide > 0.55) continue; // skip centre path area
        const haze = 0.35 + distFromSide * 0.25;
        gCtx.globalAlpha = haze;
        const trunkH = H * (0.28 + distFromSide * 0.12);
        drawTree(tx, groundY, trunkH, trunkH * 0.016,
          Math.min(1, blend * 0.75) * 0.7, leafHue, t);
      }
      gCtx.globalAlpha = 1;
      gCtx.restore();

      // Ground (grass + carpet)
      drawGround(blend);

      // Foreground trees - large, rooted on groundY
      // Left massive tree 
      const fgTrees = [
        { x: W * 0.09, trunkH: H * 0.62, trunkW: H * 0.022 },
        { x: W * 0.22, trunkH: H * 0.50, trunkW: H * 0.017 },
        { x: W * -0.02, trunkH: H * 0.55, trunkW: H * 0.020 },
        // Right side
        { x: W * 0.91, trunkH: H * 0.58, trunkW: H * 0.020 },
        { x: W * 0.78, trunkH: H * 0.48, trunkW: H * 0.016 },
        { x: W * 1.02, trunkH: H * 0.52, trunkW: H * 0.018 },
      ];

      const leafDensity = Math.min(1, blend * 0.72 + 0.06);
      fgTrees.forEach(tr => {
        drawTree(tr.x, groundY, tr.trunkH, tr.trunkW, leafDensity, leafHue, t);
      });

      // Chairs
      drawChairs(blend);

      // Falling leaves 
      const leafFallAlpha = 0.15 + blend * 0.28;
      fallingLeaves.forEach(l => { l.update(); l.draw(leafFallAlpha); });

      // Motes
      motes.forEach(m => { m.update(); m.draw(blend); });

      // Soft vignette
      const vig = gCtx.createRadialGradient(W * 0.5, H * 0.55, H * 0.15, W * 0.5, H * 0.55, W * 0.75);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(0.55, 'transparent');
      vig.addColorStop(1, 'rgba(5,2,0,0.55)');
      gCtx.fillStyle = vig;
      gCtx.fillRect(0, 0, W, H);
    }


    return {
      render(w, h, p, time) {
        if (!inited || W !== w || H !== h) {
          resize(w, h);
          inited = true;
        }
        t = time * 60;
        render(p * 3);
      }
    };
  })();

  function renderAutumnValley(W, H) {
    GV.render(W, H, growth(), gTime);
  }

  function renderPuppetKingdom(W, H) {
    const lvl = gLevel, t = gTime, gr = growth();
    _newWorldSky(W, H, lvl >= 4 ? '#4c1d95' : '#1f102c', lvl >= 3 ? '#7c2d12' : '#05030a');
    gCtx.fillStyle = lvl >= 2 ? '#3b2418' : '#171019'; gCtx.fillRect(0, H * .66, W, H * .34);
    const cx = W * .5, base = H * .68;
    gCtx.fillStyle = lvl >= 4 ? '#7c2d12' : '#2b1721'; gCtx.fillRect(cx - 140, base - 120, 280, 120);
    gCtx.fillStyle = lvl >= 3 ? '#f59e0b' : '#4b2430'; gCtx.fillRect(cx - 155, base - 135, 310, 22);
    gCtx.fillStyle = lvl >= 1 ? '#7f1d1d' : '#2d1b20'; gCtx.fillRect(cx - 130, base - 110, 260, 100);
    if (lvl >= 1) { for (let i = 0; i < 60; i++) _particle((i * 47 + t * 12) % W, (i * 29 + t * 18) % H, 1.4, '#c4b5fd', .35); }
    if (lvl >= 2) { for (let i = 0; i < 7; i++) { const x = cx - 110 + i * 36; gCtx.strokeStyle = '#d97706'; gCtx.lineWidth = 3; gCtx.beginPath(); gCtx.arc(x, base - 55, 12 + (i % 2) * 4, t + i, t + i + Math.PI * 1.5); gCtx.stroke(); _particle(x, base - 75, 4, '#fbbf24', .7); } }
    if (lvl >= 3) { for (let i = 0; i < 5; i++) { const x = cx - 90 + i * 45, y = base - 25 + Math.sin(t * 3 + i) * 8; gCtx.fillStyle = '#fde68a'; gCtx.fillRect(x - 6, y - 18, 12, 28); gCtx.strokeStyle = '#fff7ed'; gCtx.beginPath(); gCtx.moveTo(x, y - 18); gCtx.lineTo(x, base - 120); gCtx.stroke(); } for (let i = 0; i < 18; i++) { _particle((i * 61 + t * 30) % W, H * .25 + (i * 41 % 180), 3, '#fde68a', .8); } }
    if (lvl >= 4) { gCtx.fillStyle = 'rgba(251,191,36,.16)'; gCtx.fillRect(0, 0, W, H); for (let i = 0; i < 10; i++) { const x = (i * 97 + t * 80) % W, y = H * .2 + (i * 31 % 120); _particle(x, y, 6, '#f97316', .8); _particle(x + 8, y - 8, 3, '#fef3c7', .9); } }
    _drawLevelLabel(W, H, gCtx);
  }

  function renderPeacockGarden(W, H) {
    const lvl = gLevel, t = gTime, gr = growth();
    const restore = clamp(((lvl - 1) + gProgress) / 4, 0, 1);
    const phase = restore;
    const cx = W * .5, ground = H * .74;

    const sky = gCtx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, lvl >= 4 ? '#f7dfc6' : lvl >= 3 ? '#f1d7c1' : lvl >= 2 ? '#ece0d1' : '#17242d');
    sky.addColorStop(.52, lvl >= 4 ? '#fff2d6' : lvl >= 3 ? '#f6e7d2' : lvl >= 2 ? '#f5edd8' : '#21313a');
    sky.addColorStop(1, lvl >= 4 ? '#fdf6ed' : lvl >= 3 ? '#f7efe3' : lvl >= 2 ? '#e8dbc8' : '#0b1418');
    gCtx.fillStyle = sky; gCtx.fillRect(0, 0, W, H);
    // soft sun beam
    const beam = gCtx.createLinearGradient(cx, 0, cx, ground);
    beam.addColorStop(0, `rgba(250,232,192,${.08 + phase * .34})`);
    beam.addColorStop(1, 'rgba(250,232,192,0)');
    gCtx.fillStyle = beam; gCtx.fillRect(cx - W * .14, 0, W * .28, ground);

    // clouds and birds
    function cloud(x, y, s, a) {
      gCtx.fillStyle = `rgba(255,248,240,${a})`;
      gCtx.beginPath();
      gCtx.ellipse(x, y, s * 52, s * 15, 0, 0, Math.PI * 2);
      gCtx.ellipse(x + s * 27, y - s * 8, s * 34, s * 12, 0, 0, Math.PI * 2);
      gCtx.ellipse(x - s * 25, y - s * 2, s * 28, s * 10, 0, 0, Math.PI * 2);
      gCtx.fill();
    }
    cloud((W * .22 + Math.sin(t * .25) * 16), H * .12, Math.min(W, H) / 540, .25 + phase * .25);
    cloud((W * .78 - Math.sin(t * .22) * 14), H * .10, Math.min(W, H) / 580, .20 + phase * .22);
    gCtx.strokeStyle = `rgba(90,75,55,${.25 + phase * .25})`; gCtx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { const bx = (W * (.12 + i * .22) + t * 25 * (i % 2 ? -1 : 1) + W) % W, by = H * (.12 + .03 * i); gCtx.beginPath(); gCtx.moveTo(bx - 8, by); gCtx.quadraticCurveTo(bx - 2, by - 5, bx + 5, by); gCtx.quadraticCurveTo(bx + 12, by - 5, bx + 18, by); gCtx.stroke(); }

    // ground
    const gg = gCtx.createLinearGradient(0, ground, 0, H);
    gg.addColorStop(0, lvl >= 2 ? '#c8dc9e' : '#4b5563');
    gg.addColorStop(1, lvl >= 2 ? '#a8c07a' : '#2f2f2f');
    gCtx.fillStyle = gg; gCtx.fillRect(0, ground, W, H - ground);
    gCtx.fillStyle = `rgba(184,208,144,${.25 + phase * .35})`; gCtx.beginPath(); gCtx.ellipse(cx, ground + H * .03, W * .52, H * .07, 0, 0, Math.PI * 2); gCtx.fill();

    function drawMughalPalace() {
      const s = Math.min(W, H), base = ground, stone = lvl >= 4 ? '#F2D8C8' : lvl >= 3 ? '#E6C7B8' : lvl >= 2 ? '#BCA99B' : '#4b5563', shade = lvl >= 2 ? '#D4B8A8' : '#374151';
      gCtx.save();
      if (lvl >= 4) { gCtx.shadowColor = 'rgba(250,210,120,.55)'; gCtx.shadowBlur = 24; }
      // side pavilions
      [[.15, .94], [.85, .82]].forEach(([px, op]) => {
        const x = W * px, w = W * .18, h = H * .20;
        gCtx.globalAlpha = op; gCtx.fillStyle = stone; gCtx.fillRect(x - w / 2, base - h, w, h);
        gCtx.fillStyle = shade; gCtx.fillRect(x - w / 2, base - h * .80, w, h * .05); gCtx.fillRect(x - w / 2, base - h * .45, w, h * .035);
        for (let k = -1; k <= 1; k++) { gCtx.fillStyle = 'rgba(120,80,75,.45)'; gCtx.beginPath(); gCtx.roundRect(x + k * w * .25 - w * .06, base - h * .70, w * .12, h * .26, w * .06); gCtx.fill(); }
        for (let k = -1; k <= 1; k++) { gCtx.fillStyle = stone; gCtx.beginPath(); gCtx.ellipse(x + k * w * .25, base - h, w * .13, h * .045, 0, 0, Math.PI * 2); gCtx.fill(); gCtx.beginPath(); gCtx.moveTo(x + k * w * .25 - w * .13, base - h); gCtx.quadraticCurveTo(x + k * w * .25, base - h - H * .06, x + k * w * .25 + w * .13, base - h); gCtx.fill(); }
      });
      gCtx.globalAlpha = 1;
      // main palace
      const w = W * .36, h = H * .34;
      gCtx.fillStyle = stone; gCtx.fillRect(cx - w / 2, base - h * .70, w, h * .70);
      gCtx.fillStyle = shade; gCtx.fillRect(cx - w / 2, base - H * .02, w, H * .02);
      gCtx.fillStyle = stone; gCtx.fillRect(cx - w * .28, base - h * .76, W * .028, h * .76); gCtx.fillRect(cx + w * .28 - W * .028, base - h * .76, W * .028, h * .76);
      gCtx.beginPath(); gCtx.ellipse(cx, base - h * .76, W * .16, H * .055, 0, 0, Math.PI * 2); gCtx.fill();
      gCtx.beginPath(); gCtx.moveTo(cx - W * .16, base - h * .76); gCtx.quadraticCurveTo(cx, base - h * 1.14, cx + W * .16, base - h * .76); gCtx.closePath(); gCtx.fill();
      gCtx.fillStyle = lvl >= 4 ? '#d9b66d' : shade; gCtx.fillRect(cx - W * .006, base - h * 1.20, W * .012, H * .04); gCtx.beginPath(); gCtx.moveTo(cx - W * .015, base - h * 1.20); gCtx.lineTo(cx, base - h * 1.28); gCtx.lineTo(cx + W * .015, base - h * 1.20); gCtx.closePath(); gCtx.fill();
      // gate
      gCtx.fillStyle = 'rgba(110,70,65,.30)'; gCtx.beginPath(); gCtx.moveTo(cx - W * .045, base); gCtx.lineTo(cx - W * .045, base - H * .10); gCtx.quadraticCurveTo(cx - W * .045, base - H * .17, cx, base - H * .18); gCtx.quadraticCurveTo(cx + W * .045, base - H * .17, cx + W * .045, base - H * .10); gCtx.lineTo(cx + W * .045, base); gCtx.closePath(); gCtx.fill();
      if (lvl >= 3) { gCtx.strokeStyle = 'rgba(192,112,106,.55)'; gCtx.lineWidth = 2; for (let i = 0; i < 3; i++) { gCtx.beginPath(); gCtx.moveTo(cx - W * .12 + i * W * .12, base - h * .55); gCtx.lineTo(cx - W * .10 + i * W * .12, base - h * .18); gCtx.stroke(); } }
      gCtx.restore();
    }
    drawMughalPalace();

    // animated palms / trees
    function palm(x, y, side, scale) {
      gCtx.save(); gCtx.translate(x, y); gCtx.rotate(Math.sin(t * 1.1 + x) * .035); gCtx.scale(scale, scale);
      gCtx.strokeStyle = '#8B6E4A'; gCtx.lineWidth = 10; gCtx.lineCap = 'round'; gCtx.beginPath(); gCtx.moveTo(0, 0); gCtx.quadraticCurveTo(side * 10, -70, side * 5, -145); gCtx.stroke();
      gCtx.strokeStyle = lvl >= 2 ? '#3A7A3A' : '#2b4634'; gCtx.lineWidth = 4;
      for (let i = 0; i < 8; i++) { const a = -Math.PI * .75 + i * Math.PI / 7; gCtx.beginPath(); gCtx.moveTo(side * 5, -145); gCtx.quadraticCurveTo(side * (45 + 8 * i) * Math.cos(a), -145 + (65 * Math.sin(a)), side * (78 * Math.cos(a)), -145 + (58 * Math.sin(a))); gCtx.stroke(); }
      gCtx.restore();
    }
    palm(W * .17, ground, 1, .75); palm(W * .83, ground, -1, .75);

    // flowers / vines only after level 2
    if (lvl >= 2) {
      for (let i = 0; i < 10; i++) {
        const x = W * .08 + i * W * .09, y = ground - 10 + Math.sin(t * 1.6 + i) * 4;
        gCtx.fillStyle = i % 2 ? '#E85090' : '#F0A820';
        gCtx.beginPath(); for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3; gCtx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 9, a, 0, Math.PI * 2); } gCtx.fill();
        gCtx.fillStyle = '#FEE8A0'; gCtx.beginPath(); gCtx.arc(x, y, 3, 0, Math.PI * 2); gCtx.fill();
      }
    }

    // water channels restored
    if (lvl >= 2) {
      gCtx.fillStyle = 'rgba(80,180,220,.75)'; gCtx.fillRect(cx - W * .24, ground - H * .035, W * .11, H * .035); gCtx.fillRect(cx + W * .13, ground - H * .035, W * .11, H * .035);
      gCtx.strokeStyle = 'rgba(220,250,255,.55)'; gCtx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { gCtx.beginPath(); gCtx.ellipse(cx - W * .19 + i * W * .02, ground - H * .018, 12 + Math.sin(t * 2 + i) * 3, 3, 0, 0, Math.PI * 2); gCtx.stroke(); gCtx.beginPath(); gCtx.ellipse(cx + W * .17 + i * W * .02, ground - H * .018, 12 + Math.sin(t * 2 + i) * 3, 3, 0, 0, Math.PI * 2); gCtx.stroke(); }
    }

    function drawPeacock(px, py, s, open) {
      gCtx.save(); gCtx.translate(px, py); gCtx.scale(s, s);
      gCtx.fillStyle = 'rgba(0,0,0,.16)'; gCtx.beginPath(); gCtx.ellipse(0, 36, 82, 12, 0, 0, Math.PI * 2); gCtx.fill();
      // tail fan
      for (let i = 0; i < 22; i++) {
        const u = i / 21, a = -Math.PI * .92 + u * Math.PI * .84, len = (72 + Math.sin(u * Math.PI) * 42) * open;
        const ex = Math.cos(a) * len, ey = Math.sin(a) * len + 18;
        gCtx.strokeStyle = 'rgba(30,110,80,.65)'; gCtx.lineWidth = 1.2; gCtx.beginPath(); gCtx.moveTo(0, 10); gCtx.lineTo(ex, ey); gCtx.stroke();
        const grad = gCtx.createRadialGradient(ex, ey, 1, ex, ey, 18);
        grad.addColorStop(0, '#22d3ee'); grad.addColorStop(.35, '#0f766e'); grad.addColorStop(.7, '#a3e635'); grad.addColorStop(1, 'rgba(15,118,110,0)');
        gCtx.fillStyle = grad; gCtx.beginPath(); gCtx.ellipse(ex, ey, 9, 21, a + Math.PI / 2, 0, Math.PI * 2); gCtx.fill();
        gCtx.fillStyle = '#0b4a6f'; gCtx.beginPath(); gCtx.ellipse(ex, ey, 5, 8, a + Math.PI / 2, 0, Math.PI * 2); gCtx.fill();
        gCtx.fillStyle = '#fde047'; gCtx.beginPath(); gCtx.arc(ex, ey, 2, 0, Math.PI * 2); gCtx.fill();
      }
      // body
      const body = gCtx.createLinearGradient(-18, -15, 18, 30); body.addColorStop(0, '#0f766e'); body.addColorStop(1, '#164e63');
      gCtx.fillStyle = body; gCtx.beginPath(); gCtx.ellipse(0, 12, 18, 28, 0, 0, Math.PI * 2); gCtx.fill();
      gCtx.strokeStyle = '#0e7490'; gCtx.lineWidth = 8; gCtx.lineCap = 'round'; gCtx.beginPath(); gCtx.moveTo(12, -8); gCtx.quadraticCurveTo(35, -38, 24, -58); gCtx.stroke();
      gCtx.fillStyle = '#0891b2'; gCtx.beginPath(); gCtx.arc(24, -60, 10, 0, Math.PI * 2); gCtx.fill();
      gCtx.fillStyle = '#f59e0b'; gCtx.beginPath(); gCtx.moveTo(33, -59); gCtx.lineTo(44, -55); gCtx.lineTo(33, -51); gCtx.fill();
      gCtx.strokeStyle = '#14532d'; gCtx.lineWidth = 2; gCtx.beginPath(); gCtx.moveTo(-7, 35); gCtx.lineTo(-12, 52); gCtx.moveTo(8, 35); gCtx.lineTo(13, 52); gCtx.stroke();
      gCtx.restore();
    }
    if (lvl >= 3) {
      drawPeacock(W * .25, ground - 10, .50, .55 + Math.sin(t * 1.2) * .05);
      drawPeacock(W * .75, ground - 10, .50, .55 + Math.sin(t * 1.2 + 1) * .05);
      drawPeacock(cx, ground - 5, .82, clamp(.65 + gr * .6, 0, 1));
    }

    // particles/petals reduced and elegant
    if (lvl >= 2) {
      for (let i = 0; i < 24; i++) { const x = (i * 73 + t * 22) % W, y = (i * 37 + t * 14) % H; _particle(x, y, 1.8, i % 2 ? '#f9a8d4' : '#fef3c7', .35); }
    }
    if (lvl >= 4) {
      gCtx.fillStyle = 'rgba(253,224,71,.13)'; gCtx.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) _particle((i * 91 + t * 44) % W, H * .16 + (i * 31 % 150), 4, ['#22d3ee', '#f472b6', '#fde047'][i % 3], .72);
    }
    _drawLevelLabel(W, H, gCtx);
  }

  function renderPranaNexus(W, H) {
    const lvl = gLevel, t = gTime, gr = growth();
    const restore = clamp(((lvl - 1) + gProgress) / 4, 0, 1);
    const breath = (Math.sin(t * 1.35) + 1) / 2;
    const cx = W * .5, ground = H * .76, cy = H * .55;
    const sky = gCtx.createRadialGradient(cx, H * .42, 20, cx, H * .42, Math.max(W, H) * .72);
    sky.addColorStop(0, lvl >= 4 ? '#fff0a5' : lvl >= 3 ? '#d9e7bd' : lvl >= 2 ? '#a8dfc8' : '#24374d');
    sky.addColorStop(.38, lvl >= 4 ? '#b8ead3' : lvl >= 3 ? '#a8dfc8' : lvl >= 2 ? '#5bbfcf' : '#112638');
    sky.addColorStop(1, lvl >= 4 ? '#3d96b3' : lvl >= 3 ? '#2e8ca8' : lvl >= 2 ? '#1b6a85' : '#06111c');
    gCtx.fillStyle = sky; gCtx.fillRect(0, 0, W, H);

    // sun moved higher, behind head but not covering figure
    const sunY = H * .36;
    const sun = gCtx.createRadialGradient(cx, sunY, 0, cx, sunY, Math.max(W, H) * (.30 + breath * .04));
    sun.addColorStop(0, `rgba(255,253,231,${.40 + restore * .45})`);
    sun.addColorStop(.28, `rgba(255,224,130,${.25 + restore * .25})`);
    sun.addColorStop(1, 'rgba(255,224,130,0)');
    gCtx.fillStyle = sun; gCtx.beginPath(); gCtx.arc(cx, sunY, Math.max(W, H) * .34, 0, Math.PI * 2); gCtx.fill();
    gCtx.fillStyle = `rgba(255,249,196,${.45 + restore * .45})`; gCtx.beginPath(); gCtx.arc(cx, sunY, H * .06, 0, Math.PI * 2); gCtx.fill();

    // clouds
    function cloud(x, y, s, a) { gCtx.fillStyle = `rgba(255,255,255,${a})`; gCtx.beginPath(); gCtx.ellipse(x, y, s * 55, s * 14, 0, 0, Math.PI * 2); gCtx.ellipse(x + s * 25, y - s * 8, s * 36, s * 13, 0, 0, Math.PI * 2); gCtx.ellipse(x - s * 28, y - s * 3, s * 30, s * 11, 0, 0, Math.PI * 2); gCtx.fill(); }
    cloud(W * .22 + Math.sin(t * .2) * 12, H * .22, Math.min(W, H) / 520, .18 + restore * .18);
    cloud(W * .80 - Math.sin(t * .22) * 12, H * .20, Math.min(W, H) / 540, .16 + restore * .16);

    // hills and ground
    gCtx.fillStyle = `rgba(120,190,110,${.35 + restore * .45})`; gCtx.beginPath(); gCtx.ellipse(W * .25, H * .80, W * .22, H * .18, 0, 0, Math.PI * 2); gCtx.fill();
    gCtx.beginPath(); gCtx.ellipse(W * .75, H * .81, W * .22, H * .17, 0, 0, Math.PI * 2); gCtx.fill();
    const groundGrad = gCtx.createLinearGradient(0, H * .69, 0, H);
    groundGrad.addColorStop(0, lvl >= 2 ? '#e8f5c8' : '#40545a'); groundGrad.addColorStop(1, lvl >= 3 ? '#75b76a' : '#22383a');
    gCtx.fillStyle = groundGrad; gCtx.fillRect(0, H * .70, W, H * .30);
    gCtx.fillStyle = `rgba(212,232,160,${.25 + restore * .45})`; gCtx.beginPath(); gCtx.ellipse(cx, H * .82, W * .28, H * .06, 0, 0, Math.PI * 2); gCtx.fill();

    // tropical leaves restore step by step
    function bigLeaf(x, y, w, h, rot, col, a) {
      gCtx.save(); gCtx.translate(x, y); gCtx.rotate(rot + Math.sin(t * 1.1 + x) * .025); gCtx.globalAlpha = a; gCtx.fillStyle = col;
      gCtx.beginPath(); gCtx.moveTo(0, -h * .5); gCtx.bezierCurveTo(w * .55, -h * .30, w * .48, h * .35, 0, h * .5); gCtx.bezierCurveTo(-w * .48, h * .35, -w * .55, -h * .30, 0, -h * .5); gCtx.fill();
      gCtx.strokeStyle = 'rgba(230,255,230,.28)'; gCtx.lineWidth = 2; gCtx.beginPath(); gCtx.moveTo(0, -h * .42); gCtx.lineTo(0, h * .42); gCtx.stroke(); gCtx.restore();
    }
    const la = .25 + restore * .75;
    if (lvl >= 1) { bigLeaf(W * .07, H * .50, W * .12, H * .34, -.25, '#2d6b3a', la); bigLeaf(W * .93, H * .50, W * .12, H * .34, .25, '#2d6b3a', la); }
    if (lvl >= 2) { bigLeaf(W * .15, H * .63, W * .18, H * .40, .72, '#4a9a55', la); bigLeaf(W * .85, H * .63, W * .18, H * .40, -.72, '#4a9a55', la); }
    if (lvl >= 3) { bigLeaf(W * .26, H * .63, W * .16, H * .34, 1.0, '#5aba70', la); bigLeaf(W * .74, H * .63, W * .16, H * .34, -1.0, '#5aba70', la); }

    // lotuses
    function lotus(x, y, s, a) { if (a <= 0) return; gCtx.save(); gCtx.globalAlpha = a; gCtx.translate(x, y); for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; gCtx.fillStyle = i % 2 ? '#f5a020' : '#f5c842'; gCtx.beginPath(); gCtx.ellipse(Math.cos(an) * s * .28, Math.sin(an) * s * .14, s * .14, s * .42, an, 0, Math.PI * 2); gCtx.fill(); } gCtx.fillStyle = '#ffe082'; gCtx.beginPath(); gCtx.arc(0, 0, s * .14, 0, Math.PI * 2); gCtx.fill(); gCtx.restore(); }
    lotus(W * .14, ground, H * .075, clamp((restore - .25) * 1.8, 0, 1)); lotus(W * .86, ground, H * .075, clamp((restore - .25) * 1.8, 0, 1));

    // prana rings
    for (let i = 0; i < 3 + lvl; i++) { gCtx.strokeStyle = `rgba(255,245,184,${.08 + restore * .08})`; gCtx.lineWidth = 1.5; gCtx.beginPath(); gCtx.arc(cx, cy, 70 + i * 30 + breath * 12, 0, Math.PI * 2); gCtx.stroke(); }

    gCtx.save();
    gCtx.shadowColor = 'rgba(139,92,246,.45)'; gCtx.shadowBlur = 10;
    gCtx.strokeStyle = '#8B5CF6'; gCtx.lineWidth = Math.max(5, Math.min(W, H) * .012); gCtx.lineCap = 'round'; gCtx.lineJoin = 'round';
    const sc = Math.min(W, H) / 520;
    const ox = cx, oy = H * .70 + Math.sin(t * 1.35) * 2;
    function X(x) { return ox + (x - 340) * sc; } function Y(y) { return oy + (y - 390) * sc; }
    // head
    gCtx.beginPath(); gCtx.ellipse(X(340), Y(250), 37 * sc, 45 * sc, 0, 0, Math.PI * 2); gCtx.stroke();
    // smile
    gCtx.lineWidth = Math.max(3, Math.min(W, H) * .006); gCtx.beginPath(); gCtx.moveTo(X(318), Y(262)); gCtx.bezierCurveTo(X(326), Y(282), X(354), Y(282), X(362), Y(262)); gCtx.stroke();
    gCtx.lineWidth = Math.max(5, Math.min(W, H) * .012);
    // neck/spine
    gCtx.beginPath(); gCtx.moveTo(X(340), Y(295)); gCtx.lineTo(X(340), Y(415)); gCtx.stroke();
    // arms
    gCtx.beginPath(); gCtx.moveTo(X(340), Y(315)); gCtx.bezierCurveTo(X(314), Y(318), X(304), Y(348), X(296), Y(380)); gCtx.bezierCurveTo(X(288), Y(410), X(272), Y(426), X(247), Y(439)); gCtx.stroke();
    gCtx.beginPath(); gCtx.moveTo(X(340), Y(315)); gCtx.bezierCurveTo(X(366), Y(318), X(376), Y(348), X(384), Y(380)); gCtx.bezierCurveTo(X(392), Y(410), X(408), Y(426), X(433), Y(439)); gCtx.stroke();
    // lotus legs
    gCtx.beginPath(); gCtx.moveTo(X(247), Y(439)); gCtx.bezierCurveTo(X(210), Y(440), X(194), Y(466), X(214), Y(482)); gCtx.bezierCurveTo(X(245), Y(505), X(302), Y(476), X(340), Y(442)); gCtx.stroke();
    gCtx.beginPath(); gCtx.moveTo(X(433), Y(439)); gCtx.bezierCurveTo(X(470), Y(440), X(486), Y(466), X(466), Y(482)); gCtx.bezierCurveTo(X(435), Y(505), X(378), Y(476), X(340), Y(442)); gCtx.stroke();
    gCtx.lineWidth = Math.max(3, Math.min(W, H) * .006);
    gCtx.beginPath(); gCtx.moveTo(X(260), Y(438)); gCtx.bezierCurveTo(X(295), Y(432), X(321), Y(435), X(340), Y(448)); gCtx.stroke();
    gCtx.beginPath(); gCtx.moveTo(X(420), Y(438)); gCtx.bezierCurveTo(X(385), Y(432), X(359), Y(435), X(340), Y(448)); gCtx.stroke();
    // hands
    gCtx.lineWidth = Math.max(5, Math.min(W, H) * .010); gCtx.beginPath(); gCtx.ellipse(X(247), Y(439), 12 * sc, 8 * sc, -.4, 0, Math.PI * 2); gCtx.stroke(); gCtx.beginPath(); gCtx.ellipse(X(433), Y(439), 12 * sc, 8 * sc, .4, 0, Math.PI * 2); gCtx.stroke();
    // energy dots
    ['#fff5b8', '#fff5b8', '#fff5b8'].forEach((c, i) => { const yy = [330, 365, 400][i]; _particle(X(340), Y(yy), 5 + breath * 3, c, .75); });
    gCtx.restore();

    // particles
    for (let i = 0; i < 50; i++) { const x = (i * 53 + Math.sin(t * .7 + i) * 16) % W, y = (i * 41 - t * (lvl >= 2 ? 16 : 6) + H * 2) % H; _particle(x, y, 1.5, lvl >= 4 ? '#fff9c4' : '#bfdbfe', .18 + restore * .28); }
    if (lvl >= 4) { for (let i = 0; i < 10; i++) _particle((i * 79 + t * 55) % W, H * .12 + (i * 29 % 160), 4, '#fef08a', .8); }
    _drawLevelLabel(W, H, gCtx);
  }



  const LEVEL_NAMES = {
    tree: ["Grow Your Roots", "Survive the Wind", "Bloom Fruits & Flowers", "Restore the Sacred Tree"],
    warrior: ["Awaken the Warrior", "Defend the Village Gate", "Drive Out the Spirits", "Village Fully Restored"],
    padmasana: ["Calm the Waters", "Lotus Bud Appears", "Lotus Blooms", "Sacred Lotus Awakens"],
    vajrasana: ["Summon the Clouds", "Call the Thunder", "Open the Rain Gates", "Healing Monsoon"],
    baddha_konasana: ["Plant Wildflowers", "Garden Blooms", "Butterflies Return", "Enchanted Sanctuary"],
    tadasana: ["Calm the Mist", "Restore the Cloud Path", "Reach the Sky Gate", "Awaken the Cloud Peak"],
    trikonasana: ["Discover the Crystal Path", "Restore the Prism Towers", "Reignite the Rainbow Beams", "Prism Valley Restored"],
    balasana: ["Reconnect the Village", "Restore the Trading Route", "Unite the Settlements", "Kingdom Alliance Restored"],
    bhujangasana: ["Forgotten Ruins", "Jungle Awakens", "Sacred Life Returns", "Temple Restored"],
    wall_plank_chaturanga: ["Broken Gates", "Bamboo Groves Return", "Cherry Blossom Dojo", "Grand Dojo Completed"],
    padahastasana: ["Dry Trees", "Autumn Stream", "Forest Wildlife Returns", "Golden Valley Restored"],
    paschimottanasana: ["Silent Stage", "Music Returns", "Marionette Festival", "Endless Performance"],
    paschim_namaskarasana: ["Dry Gardens", "Roses Bloom", "Peacock Garden Awakens", "Crystal Fountains Activate"],
    pranayama: ["Dormant Self", "Energy Flow", "Inner Harmony", "Prana Ascension"],
  };
  function _drawLevelLabel(W, H, g) { return; }

  function loop() {
    gTime += 0.016;
    const W = gCanvas.offsetWidth || 400;
    const H = gCanvas.offsetHeight || 480;
    gCanvas.width = W;
    gCanvas.height = H;
    switch (gPose) {
      case "warrior": renderWarrior(W, H); break;
      case "padmasana": renderLotus(W, H); break;
      case "vajrasana": renderTemple(W, H); break;
      case "baddha_konasana": renderButterfly(W, H); break;
      case "tadasana": renderCloudPeak(W, H); break;
      case "trikonasana": renderPrismValley(W, H); break;
      case "balasana": renderKingdoms(W, H); break;
      case "bhujangasana": renderJungleTemple(W, H); break;
      case "wall_plank_chaturanga": renderSamuraiDojo(W, H); break;
      case "padahastasana": renderAutumnValley(W, H); break;
      case "paschimottanasana": renderPuppetKingdom(W, H); break;
      case "paschim_namaskarasana": renderPeacockGarden(W, H); break;
      case "pranayama": renderPranaNexus(W, H); break;
      case "tree": renderTree(W, H); break;
      default: renderUnknownPoseWorld(W, H); break;
    }
    gAnimId = requestAnimationFrame(loop);
  }
})();