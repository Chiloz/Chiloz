/* Firestore-powered bits of the public site: hero text, homepage feed, extra projects, contact form. */
import { toast, typing, observeReveal } from "./site.js";
import { loadFirebase, el, icon, safeUrl, clip } from "./firebase.js";

const $ = (s, r = document) => r.querySelector(s);

/* ---------- Home: hero text overrides + latest updates ---------- */
async function initHome() {
  const feed = $("#feed"); if (!feed) return;
  let fb; try { fb = await loadFirebase(); } catch { return; } // offline / blocked: static fallback stays
  const { db, fs } = fb;

  fs.onSnapshot(fs.doc(db, "settings", "hero"), (snap) => {
    if (!snap.exists()) return; const d = snap.data();
    const badge = $("#hero-badge-text"), tag = $("#hero-tagline");
    if (badge && typeof d.badge === "string" && d.badge.trim()) badge.textContent = clip(d.badge, 120);
    if (tag && typeof d.tagline === "string" && d.tagline.trim()) tag.textContent = clip(d.tagline, 400);
    if (Array.isArray(d.words) && d.words.length) typing.words = d.words.filter((w) => typeof w === "string").map((w) => clip(w, 80));
  }, () => {});

  fs.onSnapshot(fs.query(fs.collection(db, "posts"), fs.orderBy("createdAt", "desc"), fs.limit(12)), (snap) => {
    if (snap.empty) return; // keep the default welcome card
    feed.replaceChildren(...snap.docs.map((d) => postCard(d.data())));
    observeReveal(feed);
  }, () => {});
}

function postCard(p) {
  const title = clip(p.title, 160), url = safeUrl(p.mediaUrl || p.imageUrl || "", { image: true });
  const type = p.mediaType || (p.imageUrl ? "image" : null);
  const media = [];
  if (type === "image" && url) media.push(el("div", { class: "post-media" }, el("img", { src: url, alt: title, loading: "lazy" })));
  if (type === "video" && safeUrl(p.mediaUrl)) media.push(el("div", { class: "post-media" }, el("video", { src: safeUrl(p.mediaUrl), controls: true, playsinline: true, preload: "metadata" })));
  let doc = null;
  if (type === "document" && safeUrl(p.mediaUrl)) {
    const name = clip(p.fileName, 120) || "Download attachment";
    doc = el("div", { class: "doc" }, el("div", { class: "doc-name" }, icon("file-lines"), el("span", { text: name })),
      el("a", { class: "btn btn-ghost btn-sm", href: safeUrl(p.mediaUrl), target: "_blank", rel: "noopener noreferrer" }, icon("download"), " Open"));
  }
  return el("article", { class: "card post reveal" }, ...media,
    el("div", { class: "post-body" },
      el("div", { class: "post-head" }, el("span", { class: "chip chip-accent", text: clip(p.badge, 30) || "Update" }), el("span", { class: "post-date", text: clip(p.date, 30) })),
      el("h3", { text: title }), el("p", { text: clip(p.content, 4000) }), doc));
}

/* ---------- Projects page: extra projects added from the admin ---------- */
const STATUS = { live: "Live", building: "In progress", delivered: "Delivered" };
async function initProjects() {
  const host = $("#dyn-projects"); if (!host) return;
  let fb; try { fb = await loadFirebase(); } catch { return; }
  const { db, fs } = fb;
  fs.onSnapshot(fs.query(fs.collection(db, "projects"), fs.orderBy("createdAt", "desc"), fs.limit(30)), (snap) => {
    host.replaceChildren(...snap.docs.map((d) => projectCard(d.data())));
    observeReveal(host); window.refreshFilters?.();
  }, () => {});
}
function projectCard(p) {
  const status = STATUS[p.status] ? p.status : "live";
  const link = safeUrl(p.link || ""), img = safeUrl(p.imageUrl || "", { image: true });
  const tags = clip(p.tech, 200).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  const cover = img
    ? el("div", { class: "cover tone-slate" }, el("img", { src: img, alt: "", loading: "lazy", class: "cover-img" }), el("span", { class: `status ${status}`, text: STATUS[status] }))
    : el("div", { class: "cover tone-blue" }, icon("code"), el("span", { class: `status ${status}`, text: STATUS[status] }));
  return el("article", { class: `card card-hover proj reveal${status === "building" ? " unfinished" : ""}`, dataset: { status } }, cover,
    el("div", { class: "proj-body" },
      el("div", { class: "proj-kind", text: clip(p.category, 40) || "Project" }), el("h3", { text: clip(p.title, 120) }), el("p", { text: clip(p.description, 600) }),
      el("div", { class: "tags" }, tags.map((t) => el("span", { class: "tag", text: t }))),
      el("div", { class: "proj-foot" }, link && status !== "building" ? el("a", { class: "btn btn-primary btn-sm", href: link, target: "_blank", rel: "noopener noreferrer" }, "Visit live ", icon("arrow-up-right-from-square")) : null,
        status === "building" ? el("span", { class: "note" }, icon("hammer"), "Unfinished: still being built") : null)));
}

/* ---------- Contact form ---------- */
const FORMSPREE = "https://formspree.io/f/xwvwopdq"; // email notification channel
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function initContact() {
  const form = $("#contact-form"); if (!form) return;
  const t0 = Date.now(), ok = $("#form-ok"), bad = $("#form-bad"), btn = $("#send-btn"), msg = form.elements.message, count = $("#msg-count");
  const setErr = (name, text) => { const f = form.elements[name], e = $(`#err-${name}`); if (f) f.setAttribute("aria-invalid", text ? "true" : "false"); if (e) e.textContent = text || ""; return !text; };
  msg.addEventListener("input", () => { count.textContent = `${msg.value.length} / 3000`; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); ok.hidden = bad.hidden = true;
    const v = Object.fromEntries(["name", "email", "subject", "message"].map((k) => [k, form.elements[k].value.trim()]));
    const valid = [
      setErr("name", v.name.length < 2 ? "Please enter your name." : v.name.length > 80 ? "That name is too long." : ""),
      setErr("email", !EMAIL.test(v.email) || v.email.length > 120 ? "Please enter a valid email address." : ""),
      setErr("message", v.message.length < 10 ? "Message should be at least 10 characters." : v.message.length > 3000 ? "Message is too long (3000 max)." : ""),
      setErr("subject", v.subject.length > 120 ? "Subject is too long (120 max)." : ""),
    ].every(Boolean);
    if (!valid) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }

    // bot checks: honeypot + impossibly fast submit + client-side cooldown
    let last = 0; try { last = +localStorage.getItem("msg_ts") || 0; } catch {}
    if (Date.now() - last < 45_000) { bad.querySelector("span").textContent = "You just sent a message. Please wait a moment before sending another."; bad.hidden = false; return; }
    const robot = form.elements.website.value || Date.now() - t0 < 2500;

    btn.disabled = true; const label = btn.innerHTML; btn.replaceChildren(icon("paper-plane", "spin"), " Sending…");
    const jobs = [];
    if (!robot) {
      jobs.push((async () => { const { db, fs } = await loadFirebase(); await fs.addDoc(fs.collection(db, "messages"), { ...v, status: "unread", createdAt: fs.serverTimestamp() }); })());
      jobs.push(fetch(FORMSPREE, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) }).then((r) => { if (!r.ok) throw new Error("formspree " + r.status); }));
    }
    const res = robot ? [{ status: "fulfilled" }] : await Promise.allSettled(jobs);
    btn.disabled = false; btn.innerHTML = label;
    if (res.some((r) => r.status === "fulfilled")) {
      try { localStorage.setItem("msg_ts", String(Date.now())); } catch {}
      ok.hidden = false; form.reset(); count.textContent = "0 / 3000"; ok.scrollIntoView({ block: "nearest", behavior: "smooth" }); toast("Message sent ✓");
    } else {
      bad.querySelector("span").innerHTML = "";
      bad.querySelector("span").append("Couldn't send right now. Please email ", el("a", { href: "mailto:josaphatkychiloz@gmail.com" }, "josaphatkychiloz@gmail.com"), " or message me on ", el("a", { href: "https://wa.me/260954030644", rel: "noopener" }, "WhatsApp"), ".");
      bad.hidden = false;
    }
  });
}

initHome(); initProjects(); initContact();
