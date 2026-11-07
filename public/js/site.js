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

/* ---------- hero network canvas ---------- */
function initNet() {
  const cv = $("#net"); if (!cv) return;
  const ctx = cv.getContext("2d");
  let w = 0, h = 0, pts = [], raf = 0, visible = true, col = "56,189,248";
  const mouse = { x: -999, y: -999 };
  const hex2rgb = (hex) => { const m = hex.replace("#", ""); const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
  const recolor = () => { const c = css("--accent-2"); if (c.startsWith("#")) col = hex2rgb(c); };
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(80, Math.max(26, (w * h) / 17000)));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32 }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      if (!reduceMotion) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
      ctx.fillStyle = `rgba(${col},0.75)`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
    }
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, d = dx * dx + dy * dy;
        if (d < 16900) { ctx.strokeStyle = `rgba(${col},${(1 - d / 16900) * 0.35})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); }
      }
      const mx = pts[a].x - mouse.x, my = pts[a].y - mouse.y, md = mx * mx + my * my;
      if (md < 25000) { ctx.strokeStyle = `rgba(${col},${(1 - md / 25000) * 0.6})`; ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
    }
    if (visible && !reduceMotion) raf = requestAnimationFrame(draw); else raf = 0;
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(draw); };
  recolor(); size(); draw();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(cv);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) start(); });
  addEventListener("resize", () => { size(); draw(); });
  addEventListener("themechange", () => { recolor(); draw(); });
  cv.parentElement.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  cv.parentElement.addEventListener("pointerleave", () => { mouse.x = mouse.y = -999; });
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
  const counts = () => $$(".filter", bar).forEach((b) => { const f = b.dataset.filter; const n = f === "all" ? $$(".proj").length : $$(".proj").filter((c) => c.dataset.status === f).length; const s = b.querySelector("small"); if (s) s.textContent = n; });
  bar.addEventListener("click", (e) => { const b = e.target.closest(".filter"); if (b) apply(b.dataset.filter); });
  window.refreshFilters = () => { counts(); const cur = $('.filter[aria-pressed="true"]', bar)?.dataset.filter || "all"; apply(cur); };
  counts(); const h = location.hash.slice(1); if (["live", "building", "delivered"].includes(h)) apply(h);
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

initTheme(); initNav(); initScroll(); observeReveal(); initTyping(); initNet(); initDrip(); initFilters(); initCopy();
console.log("%c Hey, fellow dev 👋 ", "background:#2563eb;color:#fff;font:700 14px monospace;padding:4px 8px;border-radius:6px", "\nHiring? josaphatkychiloz@gmail.com");
