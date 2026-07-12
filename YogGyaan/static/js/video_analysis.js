(function () {
  const input = document.getElementById('videoInput');
  const drop = document.getElementById('dropZone');
  const video = document.getElementById('videoPreview');
  const btn = document.getElementById('analyzeBtn');
  const poseSelect = document.getElementById('poseSelect');
  const progress = document.getElementById('analysisProgress');
  const status = document.getElementById('analysisStatus');
  const holdPoses = new Set(window.VIDEO_HOLD_POSES || []);
  let selectedFile = null;

  function setProgress(p) { progress.style.width = Math.max(0, Math.min(100, p)) + '%'; }

  function setFile(file) {
    if (!file)
      return;
    const ok = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
    if (!ok) {
      status.textContent = 'Please upload MP4, MOV, or WEBM only.';
      return;
    }
    selectedFile = file;
    video.src = URL.createObjectURL(file);
    video.style.display = 'block';
    btn.disabled = false;
    setProgress(0);
    status.textContent = file.name + ' selected.';
  }

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => setFile(input.files[0]));
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', ev => setFile(ev.dataTransfer.files[0]));
  btn.addEventListener('click', analyzeVideo);

  function waitEvent(el, name) {
    return new Promise(resolve => el.addEventListener(name, resolve, { once: true }));
  }

  async function seekTo(t) {
    if (!Number.isFinite(video.duration)) return;
    const target = Math.min(Math.max(0, t), Math.max(0, video.duration - 0.05));
    if (Math.abs(video.currentTime - target) < 0.015) return;
    video.currentTime = target;
    await waitEvent(video, 'seeked');

    await new Promise(r => requestAnimationFrame(r));
  }

  function drawTimeline(canvas, buckets, bucketWidth) {
    bucketWidth = bucketWidth || 5;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth || 420; canvas.height = 190;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const left = 45, right = canvas.width - 14, top = 18, bottom = canvas.height - 36;

    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.70)';
    ctx.font = '11px sans-serif';
    ctx.fillText('Accuracy (%)', 6, 12);
    ctx.fillText('Time (seconds)', Math.max(left, canvas.width / 2 - 38), canvas.height - 8);

    for (let i = 0; i <= 4; i++) {
      const pct = i * 25;
      const y = bottom - (pct / 100) * (bottom - top);
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.fillText(pct + '%', 12, y + 4);
    }

    if (!buckets.length)
      return;

    ctx.strokeStyle = 'rgba(74,222,128,.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    buckets.forEach((b, i) => {
      const x = left + (right - left) * (i / Math.max(1, buckets.length - 1));
      const y = bottom - (b.avg / 100) * (bottom - top);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();


    const labelStep = Math.max(1, Math.ceil(buckets.length / 6));
    ctx.fillStyle = 'rgba(250,204,21,.95)';
    buckets.forEach((b, i) => {
      const x = left + (right - left) * (i / Math.max(1, buckets.length - 1));
      const y = bottom - (b.avg / 100) * (bottom - top);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      if (i % labelStep === 0 || i === buckets.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        ctx.fillText(b.from + 's', x - 10, bottom + 14);
        ctx.fillStyle = 'rgba(250,204,21,.95)';
      }
    });
  }

  function lmVisible(p) {
    return p && (p.visibility === undefined || p.visibility > 0.25);
  }
  function dist(a, b) {
    return (!a || !b) ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function fallbackFrameAccuracy(lm, poseName) {
    if (!lm || lm.length < 33)
      return 0;
    const key = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    const visible = key.filter(i => lmVisible(lm[i])).length / key.length;
    if (visible < 0.35)
      return 0;

    const lSh = lm[11], rSh = lm[12], lWr = lm[15], rWr = lm[16], lHi = lm[23], rHi = lm[24], lKn = lm[25], rKn = lm[26], lAn = lm[27], rAn = lm[28];
    const shoulderW = Math.max(0.05, dist(lSh, rSh));
    const hipW = Math.max(0.05, dist(lHi, rHi));
    const bodyH = Math.max(0.10, Math.abs(((lSh.y + rSh.y) / 2) - ((lAn.y + rAn.y) / 2)));
    const stance = dist(lAn, rAn);
    const armSpan = dist(lWr, rWr);
    const kneeGap = dist(lKn, rKn);
    const ankleGap = dist(lAn, rAn);
    const oneArmUp = (lWr.y < lSh.y || rWr.y < rSh.y) ? 1 : 0;
    const bothArmsUp = ((lWr.y < lSh.y ? 1 : 0) + (rWr.y < rSh.y ? 1 : 0)) / 2;
    const oneLegRaised = Math.abs(lAn.y - rAn.y) / bodyH;
    let shape = 0.55;

    if (poseName === 'tree')
      shape = 0.35 + 0.35 * bothArmsUp + 0.30 * clamp(oneLegRaised / 0.20, 0, 1);
    else if (poseName === 'warrior')
      shape = 0.30 + 0.35 * clamp(stance / (shoulderW * 2.1), 0, 1) + 0.35 * clamp(armSpan / (shoulderW * 2.4), 0, 1);
    else if (poseName === 'tadasana')
      shape = 0.45 + 0.30 * clamp(1 - Math.abs(lSh.y - rSh.y) / 0.10, 0, 1) + 0.25 * clamp(1 - stance / (shoulderW * 1.8), 0, 1);
    else if (poseName === 'trikonasana')
      shape = 0.30 + 0.35 * clamp(stance / (shoulderW * 2.0), 0, 1) + 0.35 * clamp(armSpan / (shoulderW * 2.1), 0, 1);
    else if (poseName === 'padmasana' || poseName === 'baddha_konasana')
      shape = 0.35 + 0.35 * clamp(kneeGap / (hipW * 2.1), 0, 1) + 0.30 * clamp(1 - ankleGap / (hipW * 2.6), 0, 1);
    else if (poseName === 'vajrasana')
      shape = 0.45 + 0.30 * clamp(1 - kneeGap / (hipW * 2.5), 0, 1) + 0.25 * clamp(1 - ankleGap / (hipW * 3.0), 0, 1);
    else if (poseName === 'bhujangasana')
      shape = 0.45 + 0.35 * clamp(Math.abs(((lSh.y + rSh.y) / 2) - ((lHi.y + rHi.y) / 2)) / 0.35, 0, 1) + 0.20 * clamp(armSpan / (shoulderW * 2.2), 0, 1);
    else if (poseName === 'wall_plank_chaturanga')
      shape = 0.40 + 0.35 * clamp(armSpan / (shoulderW * 2.2), 0, 1) + 0.25 * clamp(stance / (hipW * 2.2), 0, 1);
    else if (poseName === 'padahastasana')
      shape = 0.40 + 0.35 * clamp(Math.max(lWr.y, rWr.y) - ((lHi.y + rHi.y) / 2), 0, 1) + 0.25 * clamp(kneeGap / (hipW * 1.8), 0, 1);
    else if (poseName === 'balasana')
      
      shape = 0.45 + 0.30 * clamp(1 - Math.abs(((lSh.y + rSh.y) / 2) - ((lHi.y + rHi.y) / 2)) / 0.30, 0, 1) + 0.25 * clamp(armSpan / (shoulderW * 1.4), 0, 1);

    return Math.round(clamp((0.45 * visible + 0.55 * shape) * 100, 8, 92));
  }

  function robustAccuracy(lm, poseName) {
    const strict = (typeof computeAccuracy === 'function') ? computeAccuracy(lm, poseName) : 0;
    const fallback = fallbackFrameAccuracy(lm, poseName);
    if (strict >= 15)
      return Math.max(strict, Math.round(fallback * 0.82));
    return fallback;
  }

  function drawCurrentFrame(lm, acc) {
    const canvas = document.getElementById('analysisCanvas');
    if (!canvas)
      return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth || 480, h = 220;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    if (lm && typeof drawSkeleton === 'function') drawSkeleton(ctx, lm, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 10, 125, 34);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText('Accuracy: ' + acc + '%', 20, 32);
  }

  async function analyzeVideo() {
    if (!selectedFile)
      return;
    btn.disabled = true; setProgress(2); status.textContent = 'Loading MediaPipe pose model...';
    const poseName = poseSelect.value;
    const isHold = holdPoses.has(poseName);
    let landmarker = null;
    try {
      landmarker = await initMediaPipe();
    }
    catch (e) {
      console.error(e);
    }
    if (!landmarker) {
      status.textContent = 'MediaPipe could not be loaded.';
      btn.disabled = false; return;
    }
    await new Promise(r => {
      if (video.readyState >= 1) r(); else video.onloadedmetadata = r;
    });

    const duration = Math.max(1, video.duration || 1);

    const maxFrames = 90;
    const framesToRead = Math.max(12, Math.min(maxFrames, Math.ceil(duration * 4)));
    const step = duration / framesToRead;

    const bucketWidth = Math.max(5, Math.ceil(duration / 10 / 5) * 5);
    const scores = [], buckets = [];

    let best = 0, low = 100, validFrames = 0, holdTime = 0, longestHold = 0, currentHold = 0;
    const HOLD_STATE = { OUT_OF_HOLD: 'OUT_OF_HOLD', IN_HOLD: 'IN_HOLD' };
    const gracePeriodSeconds = 1.0;
    const minimumSuccessfulHoldSeconds = 2.5;

    let holdState = HOLD_STATE.OUT_OF_HOLD;
    let belowThresholdSeconds = 0;
    let holdSegments = [];
    let reps = 0, left = 0, right = 0, inPose = false, lastSide = 'left';
    const threshold = 55;

    window.getCurrentPoseThreshold = () => threshold;
    if (window.resetLandmarkSmoother)
      window.resetLandmarkSmoother();

    let noLandmarkFrames = 0;
    for (let f = 0; f < framesToRead; f++) {
      const t = Math.min(duration - 0.05, f * step);
      await seekTo(t);
      let res = null;
      try {
        res = landmarker.detectForVideo(video, Math.max(1, Math.round(t * 1000)));
      }
      catch (e) {
        console.warn('Frame detect failed', e);
      }
      let acc = 0, lm = null;

      if (res && res.landmarks && res.landmarks[0])
        lm = res.landmarks[0];
      if (res && res.poseLandmarks && res.poseLandmarks[0])
        lm = res.poseLandmarks[0];
      if (lm) {
        const smoothed = smoothLandmarks(lm);
        acc = robustAccuracy(smoothed, poseName);
        drawCurrentFrame(smoothed, acc);
      }
      else {
        noLandmarkFrames++;
      }

      scores.push({ frame: f + 1, time: t, acc }); best = Math.max(best, acc); low = Math.min(low, acc);
      const good = acc >= threshold;
      const frameSeconds = step;

      if (good)
        validFrames++;

      if (isHold) {
        if (good) {
          if (holdState === HOLD_STATE.OUT_OF_HOLD) {
            holdState = HOLD_STATE.IN_HOLD;
            currentHold = 0;
          }
          belowThresholdSeconds = 0;
          currentHold += frameSeconds;
        }
        else if (holdState === HOLD_STATE.IN_HOLD) {
          belowThresholdSeconds += frameSeconds;
          if (belowThresholdSeconds > gracePeriodSeconds) {
            if (currentHold >= minimumSuccessfulHoldSeconds) {
              holdSegments.push(currentHold);
            }
            holdState = HOLD_STATE.OUT_OF_HOLD;
            currentHold = 0;
            belowThresholdSeconds = 0;
          }
        }
      }

      if (!isHold) {
        if (good && !inPose) {
          reps++;
          if (lastSide === 'left') {
            left++; lastSide = 'right';
          }
          else {
            right++; lastSide = 'left';
          } inPose = true;
        }
        if (!good) inPose = false;
      }

      const bucketIndex = Math.floor(t / bucketWidth);
      while (bucketIndex >= buckets.length)
        buckets.push({ from: buckets.length * bucketWidth, vals: [] });
      buckets[bucketIndex].vals.push(acc);
      setProgress(5 + ((f + 1) / framesToRead) * 82);

      status.textContent = `Frame ${f + 1}/${framesToRead}: ${acc}% accuracy`;
      await new Promise(r => setTimeout(r, 0));
    }
    if (isHold && holdState === HOLD_STATE.IN_HOLD && currentHold >= minimumSuccessfulHoldSeconds) {
      holdSegments.push(currentHold);
    }

    holdTime = holdSegments.reduce((sum, seconds) => sum + seconds, 0);
    longestHold = holdSegments.length ? Math.max(...holdSegments) : 0;
    const avgHoldDuration = holdSegments.length ? holdTime / holdSegments.length : 0;

    buckets.forEach(b => b.avg = Math.round(b.vals.reduce((a, c) => a + c, 0) / Math.max(1, b.vals.length)));
    const validScores = scores.map(s => s.acc).filter(a => a > 0);
    const avg = validScores.length ? Math.round(validScores.reduce((a, c) => a + c, 0) / validScores.length) : 0;

    if (low === 100) low = 0;

    const levels = avg >= 85 ? 4 : avg >= 72 ? 3 : avg >= 55 ? 2 : 1;
    const payload = { pose_name: poseName, video_name: selectedFile.name, accuracy: avg, best_accuracy: best, duration_seconds: Math.round(duration), levels_completed: levels, successful_reps: isHold ? 0 : reps, hold_duration: isHold ? Math.round(holdTime) : 0, left_reps: left, right_reps: right };
    status.textContent = 'Saving analyzed session...'; setProgress(92);
    let saved = {};

    try {
      const r = await fetch('/api/video-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      saved = await r.json();
    }
    catch (e) {
      saved = { xp_gained: 0 };
    }
    setProgress(100);

    status.textContent = noLandmarkFrames >= framesToRead ? 'Analysis complete, but no person was detected in the video.' : 'Analysis complete. Frame-by-frame report saved.';
    renderReport({ poseName, isHold, avg, best, low, duration: Math.round(duration), holdTime: Math.round(holdTime), longestHold: Math.round(longestHold), avgHoldDuration: Math.round(avgHoldDuration), successfulHolds: holdSegments.length, holdSegments: holdSegments.map(v => Math.round(v)), reps, left, right, levels, xp: saved.xp_gained || 0, buckets, bucketWidth, stability: scores.length ? Math.round((validFrames / scores.length) * 100) : 0, frames: scores, noLandmarkFrames });
    btn.disabled = false;
  }

  function renderReport(r) {
    document.getElementById('emptyReport').style.display = 'none';
    document.getElementById('reportWrap').style.display = 'block';

    avgAccuracy.textContent = r.avg + '%'; bestAccuracy.textContent = r.best + '%'; lowAccuracy.textContent = r.low + '%'; durationStat.textContent = r.duration + 's'; holdStat.textContent = r.holdTime + 's'; xpStat.textContent = '+' + r.xp;
    if (r.isHold) {
      const breakdown = (r.holdSegments && r.holdSegments.length)
        ? r.holdSegments.map((seconds, idx) => `Hold #${idx + 1}: <b>${seconds}s</b>`).join('<br>')
        : 'No successful hold longer than 2.5s detected.';
      detailBox.innerHTML = `Total Hold Time: <b>${r.holdTime}s</b><br>Longest Hold: <b>${r.longestHold}s</b><br>Average Hold Duration: <b>${r.avgHoldDuration}s</b><br>Successful Holds: <b>${r.successfulHolds}</b><br>Stability Score: <b>${r.stability}%</b><br>Frames without landmarks: <b>${r.noLandmarkFrames}</b><hr style="border-color:var(--border);opacity:.5"><b>Hold Breakdown</b><br>${breakdown}`;
    }
    else {
      detailBox.innerHTML = `Total Reps: <b>${r.reps}</b><br>Valid Reps: <b>${r.reps}</b><br>Left Side Reps: <b>${r.left}</b><br>Right Side Reps: <b>${r.right}</b><br>Frames without landmarks: <b>${r.noLandmarkFrames}</b>`;
    }
    timelineList.innerHTML = r.buckets.map(b => `<div class="timeline-row"><span>${b.from}s–${b.from + r.bucketWidth}s</span><b>${b.avg}%</b></div>`).join('');
    drawTimeline(document.getElementById('timelineChart'), r.buckets, r.bucketWidth);
  }
})();
