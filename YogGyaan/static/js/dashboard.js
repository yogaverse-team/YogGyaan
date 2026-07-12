document.addEventListener("DOMContentLoaded", () => {
  animateProgressBars();
  renderWorldMapIfPresent();
});

function animateProgressBars() {
  document.querySelectorAll(".pct-bar[data-pct]").forEach((bar) => {
    const target = bar.getAttribute("data-pct") + "%";
    bar.style.width = "0%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = target;
      });
    });
  });
}

function renderWorldMapIfPresent() {
  const container = document.getElementById("worldMapContainer");
  if (!container || typeof window.drawWorldMap !== "function") return;
  const data = {
    forest: parseInt(container.getAttribute("data-forest"),     10) || 0,
    village: parseInt(container.getAttribute("data-village"),    10) || 0,
    lotus: parseInt(container.getAttribute("data-lotus"),      10) || 0,
    temple: parseInt(container.getAttribute("data-temple"),     10) || 0,
    butterfly: parseInt(container.getAttribute("data-butterfly"),  10) || 0,
    desert: parseInt(container.getAttribute("data-desert"),     10) || 0,
    moon: parseInt(container.getAttribute("data-moon"),       10) || 0,
    cloud_peak: parseInt(container.getAttribute("data-cloud-peak"), 10) || 0,
    prism_valley: parseInt(container.getAttribute("data-prism-valley"), 10) || 0,
    coral_reef: parseInt(container.getAttribute("data-coral-reef"), 10) || 0,
    wind_valley: parseInt(container.getAttribute("data-wind-valley"), 10) || 0,
    kingdoms: parseInt(container.getAttribute("data-kingdoms"), 10) || 0,
    overall: parseInt(container.getAttribute("data-overall"),    10) || 0,
  };
  window.drawWorldMap(container, data);
}
