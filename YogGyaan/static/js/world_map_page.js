(function () {
  const dataEl = document.getElementById('worldData');
  if (!dataEl)
    return;
  const world = JSON.parse(dataEl.textContent);
  const map = document.getElementById('fantasyMap');
  const panel = document.getElementById('regionPanel');

  let tx = 0, ty = 0, dragging = false, last = { x: 0, y: 0 };
  function stageGlow(r) {
    return r.locked ? 'rgba(120,120,130,.12)' : hexToRgba(r.color, .38 + (r.pct / 100) * .35);
  }
  function hexToRgba(hex, a) {
    hex = hex.replace('#', ''); const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function applyTransform() {
    map.style.transform = `translate(${tx}px,${ty}px)`;
  }
  function lineBetween(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const line = document.createElement('div'); line.className = 'map-path';
    line.style.left = a.x + '%'; line.style.top = a.y + '%'; line.style.width = `calc(${len}% + 10px)`; line.style.transform = `rotate(${ang}deg)`;
    return line;
  }

  function render() {
    map.innerHTML = '';
    const regs = world.regions || [];

    for (let i = 0; i < regs.length - 1; i++) {
      map.appendChild(lineBetween(regs[i], regs[i + 1]));
    }

    regs.forEach(r => {
      const aura = document.createElement('div');
      aura.className = 'map-aura';
      aura.style.left = `calc(${r.x}% - 55px)`;
      aura.style.top = `calc(${r.y}% - 55px)`;
      aura.style.width = '110px';
      aura.style.height = '110px';
      aura.style.background = stageGlow(r);
      map.appendChild(aura);

      const node = document.createElement('button');
      node.className = 'region-node' + (r.locked ? ' locked' : ''); node.style.left = r.x + '%'; node.style.top = r.y + '%'; node.style.setProperty('--region-color', r.color); node.style.setProperty('--region-glow', stageGlow(r));
      node.innerHTML = `<div class="region-icon">${r.locked ? '🔒' : r.icon}</div><div class="region-name">${r.region}</div><div class="region-pose">${r.pose_name}</div><div class="region-progress"><span style="width:${r.pct}%"></span></div><span class="stage-chip">Stage ${r.stage.num}</span>`;
      node.addEventListener('click', () => showRegion(r)); map.appendChild(node);

    });
    const first = regs.find(r => !r.locked) || regs[0]; if (first) showRegion(first);
  }

  function showRegion(r) {
    panel.style.setProperty('--accent', r.color);

    const hist = (r.accuracy_history || []).map((h, i) => `<div class="acc-bar" style="height:${Math.max(4, h.accuracy || 0)}%" data-label="${Math.round(h.accuracy || 0)}% · ${(h.completed_at || '').slice(0, 10)}"></div>`).join('') || '<p style="color:#9ca3af;font-size:.85rem">No accuracy history yet. Complete a practice session to generate chart data.</p>';
    const badges = (r.badges || []).map(b => `<span class="mini-badge">🏅 ${b.badge_name}</span>`).join('') || '<span class="mini-badge">No badges yet</span>';
    panel.innerHTML = `<div class="panel-region-icon">${r.locked ? '🔒' : r.icon}</div><h2 class="panel-title">${r.region}</h2><div class="panel-pose">${r.pose_name} · ${r.biome}</div><p class="panel-desc">${r.desc}</p><div class="big-progress"><span style="width:${r.pct}%"></span></div><div style="margin:.45rem 0;color:#cbd5e1;font-size:.85rem">${r.pct}% complete · Stage ${r.stage.num}: ${r.stage.name}</div><div class="panel-grid"><div class="panel-stat"><span>Mastery</span><strong>${r.mastery_level}</strong></div><div class="panel-stat"><span>Best Accuracy</span><strong>${Math.round(r.best_accuracy)}%</strong></div><div class="panel-stat"><span>Sessions</span><strong>${r.total_sessions}</strong></div><div class="panel-stat"><span>Stage Mood</span><strong style="font-size:.86rem">${r.stage.mood}</strong></div></div><h3>Accuracy History</h3><div class="accuracy-bars">${hist}</div><h3>Badges Earned</h3><div class="badge-row">${badges}</div><a class="practice-btn" href="/game/${r.pose}">${r.locked ? 'Preview Pose' : 'Practice Pose'}</a>`;
  }
  document.querySelectorAll('.map-tool').forEach(b => b.addEventListener('click', () => { const a = b.dataset.action; if (a === 'reset') { tx = 0; ty = 0; applyTransform(); } }));
  const stage = document.getElementById('worldMapStage');

  stage.addEventListener('mousedown', e => {
    if (e.target.closest('.region-node,.map-tool')) return; dragging = true; last = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => dragging = false);

  window.addEventListener('mousemove', e => {
    if (!dragging) return; tx += e.clientX - last.x; ty += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; applyTransform();
  });

  render(); applyTransform();
})();
