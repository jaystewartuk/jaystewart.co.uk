// Product loops on the work page: play while on screen, pause off screen, and never start by
// themselves for visitors who ask for reduced motion. Each loop gets a pause/play button.
(() => {
  const loops = document.querySelectorAll("video.loop");
  if (!loops.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const v of loops) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "loop-toggle";
    const label = () => {
      const paused = v.paused || v.dataset.held === "1";
      btn.textContent = paused ? "Play" : "Pause";
      btn.setAttribute("aria-label", (paused ? "Play" : "Pause") + " video");
    };
    btn.addEventListener("click", () => {
      if (v.paused) { v.dataset.held = "0"; v.play().catch(() => {}); }
      else { v.dataset.held = "1"; v.pause(); }
    });
    // Click a loop to watch it full screen (and again, or Esc, to come back).
    v.addEventListener("click", () => {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      v.dataset.held = "0";
      v.play().catch(() => {});
      if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });
    v.addEventListener("play", label);
    v.addEventListener("pause", label);
    if (still) v.dataset.held = "1";
    label();
    v.parentElement.append(btn);
  }

  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting && v.dataset.held !== "1") v.play().catch(() => {});
      else if (!e.isIntersecting && !v.paused) v.pause();
    }
  }, { threshold: 0.4 });
  for (const v of loops) io.observe(v);
})();
