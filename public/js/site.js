/* Josaphat · shared behaviour: nav, theme, reveal, typing, hero network, logo drip, filters. No dependencies. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- theme toggle ---------- */
function initTheme() {
  const btn = $("#theme-btn"); if (!btn) return;
  const root = document.documentElement;
  const paint = () => {
    const light = root.dataset.theme === "light";
    btn.querySelector("use").setAttribute("href", `assets/icons/sprite.svg#i-${light ? "moon" : "sun"}`);
    btn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    $('meta[name="theme-color"]')?.setAttribute("content", light ? "#f4f7fb" : "#060a16");
  };
  paint();
  btn.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    paint(); window.dispatchEvent(new Event("themechange"));
  });
}

/* ---------- mobile nav ---------- */
function initNav() {
  const btn = $("#menu-btn"), links = $("#nav-links"); if (!btn || !links) return;
  const set = (open) => {
    links.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open));
    btn.querySelector("use").setAttribute("href", `assets/icons/sprite.svg#i-${open ? "xmark" : "bars"}`);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); set(!links.classList.contains("open")); });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav-inner")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { set(false); btn.focus(); } });
  matchMedia("(min-width: 861px)").addEventListener("change", () => set(false));
}

/* ---------- scroll progress, back-to-top, reveal ---------- */
function initScroll() {
  const bar = $(".progress"), top = $(".to-top");
  let ticking = false;
  const update = () => {
    const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`;
    top?.classList.toggle("show", h.scrollTop > 700); ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
  top?.addEventListener("click", () => scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
}
export function observeReveal(root = document) {
  const items = $$(".reveal:not(.visible)", root);
  if (!("IntersectionObserver" in window)) { items.forEach((i) => i.classList.add("visible")); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  items.forEach((el) => {
    if (el.classList.contains("stagger")) [...el.children].forEach((c, i) => c.style.setProperty("--i", i));
    io.observe(el);
  });
}

/* ---------- typing headline ---------- */
const DEFAULT_WORDS = ["I'm Josaphat", "I'm a Developer", "I'm an IT Student", "Turning coffee into code.", "Fluent in binary and sarcasm.", "I make the buttons you love to click.", "Professional bug creator.", "I speak fluent Python, Java, and Google."];
export const typing = { words: DEFAULT_WORDS };
function initTyping() {
  const el = $("#typed"); if (!el) return;
  if (reduceMotion) return; // keep the static first line
  let i = 0, j = 0, del = false;
  const step = () => {
    const w = typing.words[i % typing.words.length];
    if (!del) {
      el.textContent = w.slice(0, ++j);
      if (j >= w.length) { del = true; return setTimeout(step, 1700); }
    } else {
      el.textContent = w.slice(0, --j);
      if (j <= 0) { del = false; i = (i + 1) % typing.words.length; return setTimeout(step, 350); }
    }
    setTimeout(step, del ? 35 : 75);
  };
  setTimeout(() => { del = true; j = el.textContent.length; step(); }, 2200);
}

/* ---------- hero network canvas: the same drifting, mouse-following lines, now floating in 3D space ----------
   Every node has a depth. A virtual camera eases toward the pointer (or sways by itself on touch screens), so near nodes
   slide one way and the far star-dust slides the other, like looking into a void through a window. */
function initNet() {
  const cv = $("#net"); if (!cv) return;
  const ctx = cv.getContext("2d");
  const hero = cv.parentElement, visual = $(".hero-visual", hero);
  const F = 760, ZR = 240, LINK = 165, LINK2 = LINK * LINK, YAW = 0.12, PITCH = 0.08;
  let w = 0, h = 0, pts = [], stars = [], raf = 0, visible = true, col = "56,189,248", last = 0;
  const mouse = { x: -999, y: -999, on: false }, aim = { x: 0, y: 0 }, cam = { x: 0, y: 0 };
  const hex2rgb = (hex) => { const m = hex.replace("#", ""); const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
  const recolor = () => { const c = css("--accent-2"); if (c.startsWith("#")) col = hex2rgb(c); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(150, Math.max(44, (w * h) / 8200)));
    pts = Array.from({ length: n }, () => ({ x: rnd(-0.65, 0.65) * w, y: rnd(-0.65, 0.65) * h, z: rnd(-ZR, ZR), vx: rnd(-0.16, 0.16), vy: rnd(-0.16, 0.16), vz: rnd(-0.12, 0.12), px: 0, py: 0, s: 1, d: 0.5 }));
    const m = Math.round(Math.min(130, Math.max(50, (w * h) / 11000)));
    stars = Array.from({ length: m }, () => ({ x: rnd(-1.6, 1.6) * w, y: rnd(-1.6, 1.6) * h, z: -rnd(420, 900), r: rnd(0.5, 1.1), a: rnd(0.18, 0.5), tw: rnd(0.0006, 0.002), ph: rnd(0, 6.28) }));
  };
  /* camera: yaw around Y, pitch around X, then perspective divide. Nearer to the viewer = bigger and quicker to move. */
  let cy = 1, sy = 0, cp = 1, sp = 0;
  const project = (o) => {
    const x1 = o.x * cy + o.z * sy, z1 = -o.x * sy + o.z * cy;
    const y1 = o.y * cp - z1 * sp, z2 = o.y * sp + z1 * cp;
    const s = F / (F - z2);
    o.px = w / 2 + x1 * s; o.py = h / 2 + y1 * s; o.s = s; o.d = Math.min(1, Math.max(0, (z2 + ZR) / (2 * ZR)));
  };
  const render = (now, k) => {
    if (!reduceMotion) {
      if (mouse.on) { aim.x = Math.max(-1, Math.min(1, (mouse.x / w - 0.5) * 2)); aim.y = Math.max(-1, Math.min(1, (mouse.y / h - 0.5) * 2)); }
      else { aim.x = Math.sin(now * 0.00028) * 0.45; aim.y = Math.cos(now * 0.00021) * 0.3; }
      const e = 1 - Math.pow(0.945, k);
      cam.x += (aim.x - cam.x) * e; cam.y += (aim.y - cam.y) * e;
      if (visual) { visual.style.setProperty("--cx", cam.x.toFixed(3)); visual.style.setProperty("--cy", cam.y.toFixed(3)); }
    }
    const yaw = -cam.x * YAW, pitch = cam.y * PITCH;
    cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
    ctx.clearRect(0, 0, w, h);

    /* far star-dust: tiny, dim, twinkling, moves the opposite way to the near nodes */
    for (const st of stars) {
      project(st);
      const tw = reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(now * st.tw + st.ph);
      ctx.fillStyle = `rgba(${col},${(st.a * tw).toFixed(3)})`; ctx.beginPath(); ctx.arc(st.px, st.py, st.r * st.s, 0, 6.283); ctx.fill();
    }
    /* cursor light */
    if (mouse.on && !reduceMotion) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 190);
      g.addColorStop(0, `rgba(${col},0.11)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(mouse.x - 190, mouse.y - 190, 380, 380);
    }
    for (const p of pts) {
      if (!reduceMotion) {
        p.x += p.vx * k; p.y += p.vy * k; p.z += p.vz * k;
        if (Math.abs(p.x) > 0.65 * w) p.vx *= -1; if (Math.abs(p.y) > 0.65 * h) p.vy *= -1; if (Math.abs(p.z) > ZR) p.vz *= -1;
      }
      project(p);
    }
    /* lines between neighbours (distance measured in 3D, so depth matters), fainter the further away they are */
    for (let a = 0; a < pts.length; a++) {
      const A = pts[a];
      for (let b = a + 1; b < pts.length; b++) {
        const B = pts[b], dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z, d = dx * dx + dy * dy + dz * dz;
        if (d < LINK2) {
          const depth = 0.55 + 0.45 * (A.d + B.d) / 2, s = (A.s + B.s) / 2;
          ctx.strokeStyle = `rgba(${col},${((1 - d / LINK2) * 0.5 * depth).toFixed(3)})`; ctx.lineWidth = 0.6 + 0.5 * s;
          ctx.beginPath(); ctx.moveTo(A.px, A.py); ctx.lineTo(B.px, B.py); ctx.stroke();
        }
      }
      const mx = A.px - mouse.x, my = A.py - mouse.y, md = mx * mx + my * my;
      if (md < 25000) { ctx.strokeStyle = `rgba(${col},${((1 - md / 25000) * 0.6).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(A.px, A.py); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
    }
    /* nodes, far to near: small and dim in the distance, bigger with a soft halo up close */
    pts.sort((a, b) => a.d - b.d);
    for (const p of pts) {
      ctx.fillStyle = `rgba(${col},${(0.25 + 0.7 * p.d).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.px, p.py, (0.9 + 1.9 * p.d) * p.s, 0, 6.283); ctx.fill();
      if (p.d > 0.62) { ctx.fillStyle = `rgba(${col},${(0.09 * p.d).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.px, p.py, 7 * p.s, 0, 6.283); ctx.fill(); }
    }
  };
  const loop = (now) => {
    const k = last ? Math.min((now - last) / 16.67, 3) : 1; last = now;
    render(now, k);
    raf = visible && !reduceMotion ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  recolor(); size(); render(0, 1); start();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(cv);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) start(); });
  addEventListener("resize", () => { size(); render(performance.now(), 1); });
  addEventListener("themechange", () => { recolor(); render(performance.now(), 1); });
  hero.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
  hero.addEventListener("pointerleave", () => { mouse.on = false; mouse.x = mouse.y = -999; });
}

/* ---------- logo "crying colours" drip (hover / focus) ---------- */
function initDrip() {
  const brand = $(".brand"), cv = $(".brand-drip"); if (!brand || !cv || reduceMotion) return;
  const ctx = cv.getContext("2d"); const colors = ["#00f3ff", "#0072ff", "#a855f7", "#00ff9d", "#ff007f", "#38bdf8"];
  let drops = [], on = false, raf = 0, dpr = 1;
  const fit = () => { dpr = Math.min(devicePixelRatio || 1, 2); const r = brand.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = 120 * dpr; };
  const spawn = () => { const w = cv.width; drops.push({ x: (0.06 + Math.random() * 0.88) * w, y: 0, vy: (0.6 + Math.random() * 1.2) * dpr, g: (0.1 + Math.random() * 0.07) * dpr, r: (1.6 + Math.random() * 2.2) * dpr, len: (8 + Math.random() * 12) * dpr, max: (40 + Math.random() * 50) * dpr, t: 0, a: 1, c: colors[(Math.random() * colors.length) | 0] }); };
  const frame = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (on && Math.random() < 0.5) spawn();
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.vy += d.g; d.y += d.vy; d.t += d.vy;
      if (d.t > d.max * 0.6) d.a -= 0.04;
      if (d.a <= 0) { drops.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = d.a; ctx.fillStyle = d.c; ctx.shadowColor = d.c; ctx.shadowBlur = 10 * dpr;
      ctx.beginPath(); ctx.moveTo(d.x - dpr, d.y - d.len); ctx.lineTo(d.x + dpr, d.y - d.len); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill(); ctx.restore();
    }
    raf = on || drops.length ? requestAnimationFrame(frame) : 0;
  };
  const go = (v) => { on = v; if (v) { fit(); if (!raf) frame(); } };
  brand.addEventListener("pointerenter", () => go(true)); brand.addEventListener("pointerleave", () => go(false));
  brand.addEventListener("focus", () => go(true)); brand.addEventListener("blur", () => go(false));
}

/* ---------- project filters ---------- */
function initFilters() {
  const bar = $("#filters"); if (!bar) return;
  const apply = (f) => {
    $$(".proj").forEach((c) => { c.hidden = !(f === "all" || c.dataset.status === f); });
    $$(".filter", bar).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
    const none = !$$(".proj").some((c) => !c.hidden); const e = $("#no-results"); if (e) e.hidden = !none;
    history.replaceState(null, "", f === "all" ? location.pathname : `#${f}`);
  };
  const counts = () => $$(".filter", bar).forEach((b) => { const f = b.dataset.filter; const n = f === "all" ? $$(".proj").length : $$(".proj").filter((c) => c.dataset.status === f).length; const s = b.querySelector("small"); if (s) s.textContent = n; b.hidden = f !== "all" && n === 0; });
  bar.addEventListener("click", (e) => { const b = e.target.closest(".filter"); if (b) apply(b.dataset.filter); });
  window.refreshFilters = () => { counts(); const cur = $('.filter[aria-pressed="true"]', bar)?.dataset.filter || "all"; apply(cur); };
  counts(); const h = location.hash.slice(1); if (["live", "building", "delivered"].includes(h)) apply(h);
}

/* ---------- hidden admin entrance: press and hold the footer name. It turns once like a key in a lock, then the door opens ---------- */
function initSecret() {
  const HOLD = 3000;
  const TURN = [{ transform: "perspective(420px) rotateX(0deg)" }, { transform: "perspective(420px) rotateX(360deg)" }];
  $$("[data-secret]").forEach((node) => {
    const key = $(".secret-name", node) || node;
    let timer = 0, sx = 0, sy = 0, turn = null, done = false;
    const release = () => {
      if (done || !timer) return;
      clearTimeout(timer); timer = 0; node.classList.remove("holding");
      const a = turn; turn = null; if (!a) return;
      a.onfinish = () => a.cancel();          // key slips back to rest, then the animation is dropped
      a.updatePlaybackRate(-3); a.play();
    };
    const unlock = () => {
      timer = 0; done = true; node.classList.replace("holding", "unlocked");
      try { navigator.vibrate?.([30, 50, 70]); } catch {}
      if (!reduceMotion && key.animate) key.animate([{ scale: 1 }, { scale: 1.3 }, { scale: 1 }], { duration: 320, easing: "ease-out" }); // the "click"
      setTimeout(() => location.assign("/admin"), 450);
    };
    node.addEventListener("pointerdown", (e) => {
      if (done || e.button > 0) return;
      clearTimeout(timer); sx = e.clientX; sy = e.clientY; node.classList.add("holding");
      if (!reduceMotion && key.animate) { turn?.cancel(); turn = key.animate(TURN, { duration: HOLD, easing: "cubic-bezier(0.45, 0.05, 0.35, 1)", fill: "forwards" }); }
      timer = setTimeout(unlock, HOLD);
    });
    node.addEventListener("pointermove", (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 18) release(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => node.addEventListener(ev, release));
    node.addEventListener("contextmenu", (e) => e.preventDefault());
  });
}

/* ---------- print / save as PDF ---------- */
document.addEventListener("click", (e) => { if (e.target.closest("[data-print]")) print(); });

/* ---------- copy to clipboard ---------- */
function initCopy() {
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    e.preventDefault();
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied: " + b.dataset.copy); }
    catch { toast("Couldn't copy. Select it manually."); }
  });
}

initTheme(); initNav(); initScroll(); observeReveal(); initTyping(); initNet(); initDrip(); initFilters(); initCopy(); initSecret();
console.log("%c Hey, fellow dev 👋 ", "background:#2563eb;color:#fff;font:700 14px monospace;padding:4px 8px;border-radius:6px", "\nHiring? josaphatkychiloz@gmail.com");
