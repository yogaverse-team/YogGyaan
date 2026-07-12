window.drawWorldMap = function drawWorldMap(container, data) {
  const { forest = 0, village = 0, lotus = 0, temple = 0, butterfly = 0, desert = 0, moon = 0, cloud_peak = 0 } = data;

  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 500 540");
  svg.setAttribute("xmlns", svgNS);
  svg.style.cssText = "display:block; width:100%; background:linear-gradient(to bottom,#080d14,#0e1822)";

  const defs = el(svgNS, "defs");

  const skyGrad = linearGrad(svgNS, "skyGrad", [
    { offset: "0%", color: "#080d14" },
    { offset: "100%", color: "#0e1822" },
  ], { x1: "0", y1: "0", x2: "0", y2: "1" });
  defs.appendChild(skyGrad);

  const glowFilter = el(svgNS, "filter", { id: "greenGlow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
  const feGauss = el(svgNS, "feGaussianBlur", { stdDeviation: "3", result: "blur" });
  const feMerge = el(svgNS, "feMerge");
  feMerge.appendChild(el(svgNS, "feMergeNode", { in: "blur" }));
  feMerge.appendChild(el(svgNS, "feMergeNode", { in: "SourceGraphic" }));
  glowFilter.appendChild(feGauss);
  glowFilter.appendChild(feMerge);
  defs.appendChild(glowFilter);

  svg.appendChild(defs);
  svg.appendChild(rect(svgNS, { x: 0, y: 0, width: 500, height: 540, fill: "url(#skyGrad)" }));

  const vLine = el(svgNS, "line", {
    x1: 250, y1: 20, x2: 250, y2: 175,
    stroke: "rgba(255,255,255,0.05)", "stroke-width": "1", "stroke-dasharray": "5,5",
  });
  svg.appendChild(vLine);
  const hLine = el(svgNS, "line", {
    x1: 10, y1: 188, x2: 490, y2: 188,
    stroke: "rgba(255,255,255,0.05)", "stroke-width": "1", "stroke-dasharray": "4,4",
  });
  svg.appendChild(hLine);
  const vLine2 = el(svgNS, "line", {
    x1: 167, y1: 200, x2: 167, y2: 370,
    stroke: "rgba(255,255,255,0.04)", "stroke-width": "1", "stroke-dasharray": "4,4",
  });
  svg.appendChild(vLine2);
  const vLine3 = el(svgNS, "line", {
    x1: 333, y1: 200, x2: 333, y2: 370,
    stroke: "rgba(255,255,255,0.04)", "stroke-width": "1", "stroke-dasharray": "4,4",
  });
  svg.appendChild(vLine3);

  svg.appendChild(buildForest(svgNS, forest));
  svg.appendChild(buildVillage(svgNS, village));

  svg.appendChild(buildLotusLake(svgNS, lotus));
  svg.appendChild(buildRainTemple(svgNS, temple));
  svg.appendChild(buildButterflyGarden(svgNS, butterfly));
  svg.appendChild(buildDesertOasis(svgNS, desert));
  svg.appendChild(buildMoonObservatory(svgNS, moon));
  svg.appendChild(buildCloudPeak(svgNS, cloud_peak));

  [
    { x: 125, label: "Sacred Forest", pct: forest, color: "#4ade80", y1: 178, y2: 184 },
    { x: 375, label: "Village", pct: village, color: "#facc15", y1: 178, y2: 184 },
  ].forEach(({ x, label, pct, color, y1, y2 }) => {
    const g = el(svgNS, "g");
    g.appendChild(text(svgNS, label, {
      x, y: y1, fill: color, "font-size": "9",
      "text-anchor": "middle", "font-family": "Inter,sans-serif"
    }));
    g.appendChild(text(svgNS, `${Math.round(pct)}%`, {
      x, y: y2 + 7, fill: "rgba(255,255,255,0.4)", "font-size": "7",
      "text-anchor": "middle", "font-family": "Inter,sans-serif"
    }));
    svg.appendChild(g);
  });

  [
    { x: 83, label: "Lotus Lake", pct: lotus, color: "#f472b6", y: 368 },
    { x: 250, label: "Rain Temple", pct: temple, color: "#60a5fa", y: 368 },
    { x: 417, label: "Butterfly Garden", pct: butterfly, color: "#a78bfa", y: 368 },
    { x: 125, label: "Desert Oasis", pct: desert, color: "#f59e0b", y: 452 },
    { x: 375, label: "Moon Observatory", pct: moon, color: "#c084fc", y: 452 },
    { x: 250, label: "Cloud Peak", pct: cloud_peak, color: "#93c5fd", y: 518 },
  ].forEach(({ x, label, pct, color, y }) => {
    const g = el(svgNS, "g");
    g.appendChild(text(svgNS, label, {
      x, y: y - 6, fill: color, "font-size": "8",
      "text-anchor": "middle", "font-family": "Inter,sans-serif"
    }));
    g.appendChild(text(svgNS, `${Math.round(pct)}%`, {
      x, y: y + 2, fill: "rgba(255,255,255,0.4)", "font-size": "7",
      "text-anchor": "middle", "font-family": "Inter,sans-serif"
    }));
    svg.appendChild(g);
  });

  container.innerHTML = "";
  container.appendChild(svg);
};

function buildForest(ns, pct) {
  const g = el(ns, "g");
  const groundColor = pct > 0 ? "#1a3d1a" : "#1e1e10";
  g.appendChild(ellipse(ns, { cx: 125, cy: 168, rx: 110, ry: 12, fill: groundColor }));

  const treeData = [
    { x: 55, y: 122, h: 54, w: 32 },
    { x: 90, y: 108, h: 66, w: 40 },
    { x: 128, y: 116, h: 58, w: 34 },
    { x: 168, y: 128, h: 45, w: 27 },
    { x: 72, y: 135, h: 38, w: 25 },
    { x: 110, y: 130, h: 46, w: 29 },
    { x: 150, y: 134, h: 40, w: 25 },
  ];
  const treeCount = Math.round((pct / 100) * treeData.length);
  treeData.slice(0, treeCount).forEach(({ x, y, h, w }) => {
    g.appendChild(drawTree(ns, x, y, h, w, pct));
  });
  if (pct >= 50) {
    const flowers = ["#ff6b6b", "#ffd166", "#a8edea", "#ff8fab", "#c8f7c5"];
    flowers.forEach((color, i) => {
      g.appendChild(circle(ns, { cx: 32 + i * 40, cy: 168, r: 3, fill: color, opacity: 0.85 }));
    });
  }
  return g;
}

function drawTree(ns, x, y, h, w, pct) {
  const g = el(ns, "g", { opacity: Math.min(1, pct / 50 + 0.1).toString() });
  const trunk = rect(ns, { x: x - w * 0.07, y, width: w * 0.14, height: h * 0.35, fill: "#5c3d1e", rx: 2 });
  g.appendChild(trunk);
  const layers = [
    { dy: 0, r: w * 0.40, fill: "#2d6b2d" },
    { dy: -h * 0.28, r: w * 0.30, fill: "#3a8c3a" },
    { dy: -h * 0.50, r: w * 0.20, fill: "#4aaa4a" },
  ];
  layers.forEach(({ dy, r, fill }) => {
    const points = [`${x},${y + dy - r}`, `${x - r},${y + dy}`, `${x + r},${y + dy}`].join(" ");
    g.appendChild(el(ns, "polygon", { points, fill }));
  });
  return g;
}

function buildVillage(ns, pct) {
  const g = el(ns, "g");
  const alpha = Math.max(0.08, pct / 100);
  const lit = pct >= 25;

  g.appendChild(ellipse(ns, { cx: 375, cy: 168, rx: 110, ry: 11, fill: pct > 15 ? "#2a2010" : "#10100a" }));

  const houses = [
    { x: 300, y: 108, w: 42, h: 55, roofColor: "#7a1a1a" },
    { x: 357, y: 94, w: 46, h: 68, roofColor: "#5a2a0a" },
    { x: 412, y: 112, w: 38, h: 50, roofColor: "#3a1a5a" },
  ];

  houses.forEach(({ x, y, w, h, roofColor }) => {
    const houseG = el(ns, "g", { opacity: alpha.toString() });
    houseG.appendChild(rect(ns, { x, y, width: w, height: h, fill: lit ? "#c4924a" : "#2a1a0a", rx: 1 }));
    houseG.appendChild(el(ns, "polygon", {
      points: `${x},${y} ${x + w},${y} ${x + w / 2},${y - 22}`,
      fill: roofColor,
    }));
    const winFill = lit ? "#ffdb70" : "#0a0a05";
    houseG.appendChild(rect(ns, { x: x + 5, y: y + 14, width: 10, height: 10, fill: winFill, rx: 1 }));
    houseG.appendChild(rect(ns, { x: x + w - 14, y: y + 14, width: 10, height: 10, fill: winFill, rx: 1 }));
    g.appendChild(houseG);
  });

  if (pct >= 35) {
    [[332, 87], [396, 76]].forEach(([lx, ly]) => {
      g.appendChild(el(ns, "line", { x1: lx, y1: ly, x2: lx, y2: ly + 16, stroke: "#666", "stroke-width": "1" }));
      g.appendChild(circle(ns, { cx: lx, cy: ly + 16, r: 4.5, fill: "#ffdb70", opacity: "0.95" }));
      g.appendChild(circle(ns, { cx: lx, cy: ly + 16, r: 9, fill: "#ffdb70", opacity: "0.10" }));
    });
  }
  return g;
}

function buildLotusLake(ns, pct) {
  const g = el(ns, "g");
  const cx = 83, cy = 340, rx = 75, ry = 20;
  const alpha = Math.max(0.05, pct / 100);

  const waterColor = pct > 0 ? "#0a2a4a" : "#050d17";
  g.appendChild(ellipse(ns, { cx, cy, rx, ry, fill: waterColor, opacity: Math.max(0.3, alpha).toString() }));

  if (pct >= 20) {
    const shimmerAlpha = Math.min(0.6, pct / 100 * 0.8);
    g.appendChild(ellipse(ns, {
      cx, cy: cy - 2, rx: rx * 0.7, ry: ry * 0.4,
      fill: "#1a5a8a", opacity: shimmerAlpha.toString()
    }));
  }
  if (pct >= 15) {
    const lotusCount = Math.round((pct / 100) * 5);
    const positions = [
      { x: 60, y: 334 }, { x: 83, y: 328 }, { x: 100, y: 334 },
      { x: 70, y: 342 }, { x: 96, y: 342 },
    ];
    const colors = ["#f472b6", "#ec4899", "#fb7185", "#f9a8d4", "#e879f9"];
    positions.slice(0, lotusCount).forEach(({ x, y }, i) => {
      const flAlpha = Math.min(1, pct / 50 + 0.1);
      const flG = el(ns, "g", { opacity: flAlpha.toString() });
      flG.appendChild(el(ns, "line", {
        x1: x, y1: y + 6, x2: x, y2: y + 12,
        stroke: "#2d7a2d", "stroke-width": "1"
      }));
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2;
        const px = x + Math.cos(angle) * 4;
        const py = y + Math.sin(angle) * 2.5;
        flG.appendChild(ellipse(ns, {
          cx: px, cy: py, rx: 2.5, ry: 1.5,
          fill: colors[i % colors.length], opacity: "0.9",
          transform: `rotate(${p * 72},${x},${y})`
        }));
      }
      flG.appendChild(circle(ns, { cx: x, cy: y, r: 2, fill: "#fef08a" }));
      g.appendChild(flG);
    });
  }

  if (pct >= 30) {
    const padCount = Math.round((pct / 100) * 4);
    [[50, 338], [78, 344], [102, 339], [65, 345]].slice(0, padCount).forEach(([px, py]) => {
      g.appendChild(ellipse(ns, {
        cx: px, cy: py, rx: 5, ry: 3,
        fill: "#1a5a1a", opacity: "0.75"
      }));
    });
  }

  return g;
}

function buildRainTemple(ns, pct) {
  const g = el(ns, "g");
  const alpha = Math.max(0.06, pct / 100);
  const lit = pct >= 20;
  const cx = 250;
  const groundY = 355;

  g.appendChild(ellipse(ns, {
    cx, cy: groundY, rx: 72, ry: 10,
    fill: pct > 15 ? "#0a1a2a" : "#050a0f"
  }));

  const tG = el(ns, "g", { opacity: alpha.toString() });

  tG.appendChild(rect(ns, {
    x: 215, y: groundY - 8, width: 70, height: 8,
    fill: lit ? "#3a4a6a" : "#1a2030", rx: 1
  }));
  [[225, 30], [240, 35], [260, 35], [275, 30]].forEach(([cx2, h]) => {
    tG.appendChild(rect(ns, {
      x: cx2 - 2, y: groundY - 8 - h, width: 4, height: h,
      fill: lit ? "#5a6a8a" : "#1a2030"
    }));
  });
  tG.appendChild(el(ns, "polygon", {
    points: `${215},${groundY - 38} ${285},${groundY - 38} ${268},${groundY - 58} ${232},${groundY - 58}`,
    fill: lit ? "#2a4a7a" : "#0a1020",
  }));
  tG.appendChild(el(ns, "polygon", {
    points: `${232},${groundY - 58} ${268},${groundY - 58} ${250},${groundY - 75}`,
    fill: lit ? "#1a3a6a" : "#080c18",
  }));

  g.appendChild(tG);

  if (pct >= 25) {
    const dropCount = Math.round((pct / 100) * 8);
    const dropPositions = [
      [220, 295], [232, 302], [244, 298], [256, 304], [268, 299],
      [228, 310], [250, 308], [265, 314],
    ];
    const dropAlpha = Math.min(0.8, pct / 80);
    dropPositions.slice(0, dropCount).forEach(([dx, dy]) => {
      g.appendChild(el(ns, "line", {
        x1: dx, y1: dy, x2: dx + 1, y2: dy + 8,
        stroke: "#60a5fa", "stroke-width": "1.2", opacity: dropAlpha.toString()
      }));
    });
  }

  if (pct >= 40) {
    g.appendChild(circle(ns, {
      cx, cy: groundY - 80, r: 6,
      fill: "#93c5fd", opacity: Math.min(0.8, (pct - 40) / 60).toString()
    }));
    const glowAlpha = Math.min(0.3, (pct - 40) / 120);
    g.appendChild(circle(ns, {
      cx, cy: groundY - 80, r: 14,
      fill: "#60a5fa", opacity: glowAlpha.toString()
    }));
  }

  return g;
}

function buildButterflyGarden(ns, pct) {
  const g = el(ns, "g");
  const alpha = Math.max(0.05, pct / 100);
  const floorY = 355;
  const cx = 417;

  const groundColor = pct > 0 ? "#1a2a10" : "#0e120a";
  g.appendChild(ellipse(ns, { cx, cy: floorY, rx: 68, ry: 10, fill: groundColor }));

  if (pct >= 10) {
    const flowerCount = Math.round((pct / 100) * 7);
    const fPositions = [
      { x: 383, y: 344, c: "#f97316" }, { x: 396, y: 338, c: "#a78bfa" }, { x: 410, y: 342, c: "#fb923c" },
      { x: 424, y: 337, c: "#c084fc" }, { x: 437, y: 343, c: "#f97316" }, { x: 450, y: 340, c: "#a78bfa" },
      { x: 396, y: 350, c: "#fb923c" },
    ];

    fPositions.slice(0, flowerCount).forEach(({ x, y, c }) => {
      const fAlpha = Math.min(1, pct / 40 + 0.1);
      const fG = el(ns, "g", { opacity: fAlpha.toString() });
      fG.appendChild(el(ns, "line", {
        x1: x, y1: y + 5, x2: x, y2: y + 12,
        stroke: "#3a6a1a", "stroke-width": "1"
      }));
      [0, 72, 144, 216, 288].forEach(angle => {
        const rad = angle * Math.PI / 180;
        fG.appendChild(circle(ns, { cx: x + Math.cos(rad) * 3.5, cy: y + Math.sin(rad) * 2.5, r: 2.2, fill: c, opacity: "0.85" }));
      });
      fG.appendChild(circle(ns, { cx: x, cy: y, r: 1.5, fill: "#fef08a" }));
      g.appendChild(fG);
    });
  }

  if (pct >= 35) {
    const bfCount = Math.round(((pct - 35) / 65) * 4);
    const bfPositions = [
      { x: 390, y: 322, c: "#f97316" }, { x: 418, y: 315, c: "#a78bfa" },
      { x: 440, y: 325, c: "#fb923c" }, { x: 404, y: 308, c: "#c084fc" },
    ];
    bfPositions.slice(0, bfCount).forEach(({ x, y, c }) => {
      const bAlpha = Math.min(0.9, (pct - 35) / 65);
      const bG = el(ns, "g", { opacity: bAlpha.toString() });

      bG.appendChild(ellipse(ns, { cx: x - 5, cy: y - 1, rx: 5, ry: 3, fill: c, opacity: "0.75" }));
      bG.appendChild(ellipse(ns, { cx: x + 5, cy: y - 1, rx: 5, ry: 3, fill: c, opacity: "0.75" }));
      bG.appendChild(ellipse(ns, { cx: x - 4, cy: y + 2, rx: 3.5, ry: 2, fill: c, opacity: "0.55" }));
      bG.appendChild(ellipse(ns, { cx: x + 4, cy: y + 2, rx: 3.5, ry: 2, fill: c, opacity: "0.55" }));
      bG.appendChild(el(ns, "line", {
        x1: x, y1: y - 3, x2: x, y2: y + 3,
        stroke: "#111", "stroke-width": "1"
      }));
      g.appendChild(bG);
    });
  }

  return g;
}


function buildCloudPeak(ns, pct) {
  const g = el(ns, "g");
  const cx = 250, baseY = 505;
  const alpha = Math.max(0.08, pct / 100);
  g.appendChild(ellipse(ns, { cx, cy: baseY, rx: 90, ry: 10, fill: pct > 15 ? "#1e293b" : "#111827", opacity: "0.95" }));
  g.appendChild(el(ns, "polygon", { points: `${cx - 85},${baseY} ${cx},${baseY - 78} ${cx + 85},${baseY}`, fill: pct > 15 ? "#64748b" : "#334155", opacity: alpha.toString() }));
  g.appendChild(el(ns, "polygon", { points: `${cx - 35},${baseY - 45} ${cx},${baseY - 78} ${cx + 35},${baseY - 45}`, fill: pct > 55 ? "#dbeafe" : "#94a3b8", opacity: Math.min(1, alpha + 0.2).toString() }));
  const fogAlpha = Math.max(0.05, 0.55 - pct / 160);
  for (let i = 0; i < 5; i++) {
    g.appendChild(ellipse(ns, { cx: cx - 70 + i * 35, cy: baseY - 42 - (i % 2) * 8, rx: 35, ry: 8, fill: "#e2e8f0", opacity: fogAlpha.toString() }));
  }
  if (pct >= 30) {
    g.appendChild(el(ns, "path", { d: `M${cx - 92} ${baseY - 52} Q${cx - 15} ${baseY - 88} ${cx + 92} ${baseY - 54}`, fill: "none", stroke: "#bfdbfe", "stroke-width": "3", opacity: Math.min(0.9, pct / 100).toString() }));
  }
  if (pct >= 55) {
    g.appendChild(el(ns, "path", { d: `M${cx - 28} ${baseY - 70} L${cx - 28} ${baseY - 108} L${cx + 28} ${baseY - 108} L${cx + 28} ${baseY - 70}`, fill: "none", stroke: "#fde68a", "stroke-width": "3", opacity: Math.min(0.95, pct / 100).toString() }));
  }
  if (pct >= 80) {
    g.appendChild(circle(ns, { cx, cy: baseY - 82, r: 22, fill: "#bfdbfe", opacity: "0.18" }));
    [cx - 55, cx, cx + 55].forEach((x, i) => g.appendChild(text(ns, "✦", { x, y: baseY - 112 + i * 8, fill: "#fef3c7", "font-size": "12", "text-anchor": "middle" })));
  }
  return g;
}

function buildDesertOasis(ns, pct) {
  const g = el(ns, "g");
  const cx = 125, cy = 420;
  g.appendChild(ellipse(ns, { cx, cy, rx: 105, ry: 20, fill: pct > 0 ? "#3b2508" : "#16100a" }));
  const dunes = Math.max(1, Math.round((pct / 100) * 4));
  for (let i = 0; i < dunes; i++) {
    g.appendChild(ellipse(ns, { cx: 60 + i * 42, cy: cy - 4 - i % 2 * 3, rx: 38, ry: 9, fill: pct > 30 ? "#b7791f" : "#5a3a12", opacity: String(0.45 + pct / 180) }));
  }
  if (pct >= 25) {
    g.appendChild(ellipse(ns, { cx, cy: cy - 6, rx: 32, ry: 8, fill: "#0ea5e9", opacity: String(Math.min(.85, pct / 100)) }));
  }
  if (pct >= 45) {
    [105, 145].forEach(x => {
      g.appendChild(rect(ns, { x: x - 2, y: cy - 40, width: 4, height: 35, fill: "#6b3f13" }));
      g.appendChild(ellipse(ns, { cx: x - 8, cy: cy - 42, rx: 14, ry: 5, fill: "#22c55e", transform: `rotate(-25 ${x - 8} ${cy - 42})` }));
      g.appendChild(ellipse(ns, { cx: x + 8, cy: cy - 45, rx: 14, ry: 5, fill: "#22c55e", transform: `rotate(25 ${x + 8} ${cy - 45})` }));
    });
  }
  if (pct >= 70) {
    g.appendChild(text(ns, "🐪", { x: 160, y: 408, "font-size": "18" }));
  }
  return g;
}

function buildMoonObservatory(ns, pct) {
  const g = el(ns, "g");
  const cx = 375, cy = 420;
  g.appendChild(ellipse(ns, { cx, cy, rx: 100, ry: 18, fill: pct > 0 ? "#171230" : "#0b0b14" }));
  const alpha = Math.max(.08, pct / 100);

  g.appendChild(circle(ns, { cx: cx + 45, cy: cy - 78, r: 15, fill: pct >= 30 ? "#f5f3ff" : "#51446f", opacity: String(alpha) }));
  if (pct >= 50) g.appendChild(circle(ns, {
    cx: cx + 38, cy: cy - 82, r: 15, fill: "#080d14", opacity: "0.8"
  }));
  const tower = el(ns, "g", { opacity: String(alpha) });

  tower.appendChild(rect(ns, { x: cx - 32, y: cy - 50, width: 64, height: 45, fill: pct >= 35 ? "#6d5cae" : "#242039", rx: 3 }));
  tower.appendChild(el(ns, "polygon", { points: `${cx - 38},${cy - 50} ${cx + 38},${cy - 50} ${cx},${cy - 78}`, fill: pct >= 35 ? "#8b5cf6" : "#1f1b35" }));
  tower.appendChild(circle(ns, { cx, cy: cy - 28, r: 9, fill: pct >= 70 ? "#fde68a" : "#312e81" }));

  g.appendChild(tower);
  const stars = Math.round((pct / 100) * 7);
  for (let i = 0; i < stars; i++) g.appendChild(text(ns, "✦", { x: 300 + i * 22, y: 345 + (i % 2) * 18, fill: "#ddd6fe", "font-size": "10" }));
  return g;
}

function el(ns, tag, attrs = {}) {
  const e = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}
function rect(ns, attrs) {
  return el(ns, "rect", attrs);
}
function circle(ns, attrs) {
  return el(ns, "circle", attrs);
}
function ellipse(ns, attrs) {
  return el(ns, "ellipse", attrs);
}
function text(ns, content, attrs) {
  const t = el(ns, "text", attrs);
  t.textContent = content;
  return t;
}
function linearGrad(ns, id, stops, attrs = {}) {
  const grad = el(ns, "linearGradient", { id, ...attrs });
  stops.forEach(({ offset, color }) => {
    grad.appendChild(el(ns, "stop", { offset, "stop-color": color }));
  });
  return grad;
}