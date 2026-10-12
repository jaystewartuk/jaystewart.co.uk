// Product loops on the work page: play while on screen, pause off screen, and never start by
// themselves for visitors who ask for reduced motion. Each loop gets a pause/play button.
(() => {
  const loops = document.querySelectorAll("video.loop");
  if (!loops.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // On phones, swap to the phone cut of each loop (one phone screen, 4:5) where there is one.
  // data-phone names the folder under /media/ that holds loop-phone.* and poster-phone.webp.
  if (matchMedia("(max-width: 640px)").matches) {
    for (const v of loops) {
      const dir = v.dataset.phone;
      if (!dir) continue;
      const base = `/media/${dir}/`;
      v.poster = base + "poster-phone.webp";
      v.width = 720; v.height = 900;
      v.replaceChildren(
        Object.assign(document.createElement("source"), { src: base + "loop-phone.webm", type: 'video/webm; codecs="vp9"' }),
        Object.assign(document.createElement("source"), { src: base + "loop-phone.mp4", type: 'video/mp4; codecs="avc1.640032"' }),
      );
      if (v.dataset.phoneLabel) v.setAttribute("aria-label", v.dataset.phoneLabel);
      v.load();
      v.closest(".media")?.classList.add("phone");
    }
  }

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

// Project bar: highlight the section in view, and draw its rule once it sticks.
(() => {
  const bar = document.querySelector(".jump-bar");
  if (!bar || !("IntersectionObserver" in window)) return;
  const links = new Map([...bar.querySelectorAll("a")].map((a) => [a.hash.slice(1), a]));
  const seen = new Map();
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.isIntersecting);
    const current = [...links.keys()].find((id) => seen.get(id));
    for (const [id, a] of links) {
      if (id === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    const a = links.get(current);
    const nav = a?.parentElement;
    if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.offsetLeft - 16, behavior: "smooth" });
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of links.keys()) {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  }
  const sentinel = document.createElement("div");
  bar.before(sentinel);
  new IntersectionObserver(([e]) => bar.classList.toggle("stuck", !e.isIntersecting)).observe(sentinel);
})();
