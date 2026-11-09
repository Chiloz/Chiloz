/* Admin panel. Security model: the UI is a convenience; Firestore rules are the real lock.
   Only ADMIN_EMAIL with a verified address can write. No demo mode, no public sign-up. */
import { toast } from "./site.js";
import { loadFirebase, loadAuth, ADMIN_EMAIL, el, icon, safeUrl, clip } from "./firebase.js";
import { DEFAULT_PROJECTS, SEED_VERSION } from "./projects-data.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const show = (id, on) => { $(id).hidden = !on; };
const say = (id, text) => { const b = $(id); if (!text) { b.hidden = true; return; } b.querySelector("span").textContent = text; b.hidden = false; };

let app, db, fs, A, auth;
try {
  ({ app, db, fs } = await loadFirebase()); A = await loadAuth(); auth = A.getAuth(app);
} catch {
  show("#auth", true); say("#auth-bad", "Couldn't reach Firebase. Check your internet connection and reload."); $("#login-form").remove(); $("#google-btn").remove();
  throw new Error("firebase unavailable");
}
let unsubs = [];

const isOwner = (u) => !!u && u.email?.toLowerCase() === ADMIN_EMAIL;

/* ---------- auth flow ---------- */
A.onAuthStateChanged(auth, async (user) => {
  unsubs.forEach((u) => u()); unsubs = [];
  show("#logout", !!user);
  if (!user) { show("#auth", true); show("#verify", false); show("#dash", false); return; }
  if (!isOwner(user)) {
    await A.signOut(auth); say("#auth-bad", "That account isn't authorised for this panel."); return;
  }
  show("#auth", false);
  if (!user.emailVerified) { show("#verify", true); show("#dash", false); return; }
  show("#verify", false); show("#dash", true); startData();
});

const friendly = (e) => ({
  "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.", "auth/user-not-found": "Wrong email or password.", "auth/user-disabled": "This account is disabled.", "auth/invalid-email": "That email address looks wrong.", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/popup-closed-by-user": "Sign-in window was closed.", "auth/network-request-failed": "Network problem. Check your connection.", "auth/requires-recent-login": "For security, sign out, sign in again, then retry.",
  "auth/weak-password": "Password is too weak. Use at least 10 characters.", "auth/unauthorized-domain": "This domain isn't authorised in Firebase → Authentication → Settings → Authorized domains.",
}[e.code] || "Something went wrong. Please try again.");

/* Login is locked to the owner: any other email is rejected here without even asking Firebase
   (and, more importantly, Firestore rules + disabled sign-up make other accounts useless). */
let fails = 0, lockUntil = 0;
const locked = () => { const left = Math.ceil((lockUntil - Date.now()) / 1000); if (left > 0) { say("#auth-bad", `Too many attempts. Try again in ${left}s.`); return true; } return false; };
const fail = (msg) => { say("#auth-bad", msg); if (++fails >= 5) { fails = 0; lockUntil = Date.now() + 60_000; } };
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); say("#auth-bad", ""); say("#auth-ok", "");
  if (locked()) return;
  const email = $("#email").value.trim().toLowerCase(), pw = $("#password").value;
  if (!email || !pw) return say("#auth-bad", "Enter your email and password.");
  if (email !== ADMIN_EMAIL) { $("#password").value = ""; return fail("Wrong email or password."); }
  const btn = $("#login-btn"); btn.disabled = true;
  try { await A.signInWithEmailAndPassword(auth, email, pw); $("#password").value = ""; fails = 0; }
  catch (err) { $("#password").value = ""; fail(friendly(err)); }
  btn.disabled = false;
});
$("#google-btn").addEventListener("click", async () => {
  say("#auth-bad", "");
  try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); } catch (err) { say("#auth-bad", friendly(err)); }
});
/* Reset links only ever go to the owner's inbox, whatever is typed in the form. */
async function sendReset(target) {
  try { await A.sendPasswordResetEmail(auth, ADMIN_EMAIL); } catch (err) { if (err.code === "auth/network-request-failed") return say(target, friendly(err)); }
  say(target, "A password reset link was sent to the owner's Gmail (check spam too). Open it to choose a new password.");
}
$("#reset-btn").addEventListener("click", async () => { say("#auth-bad", ""); await sendReset("#auth-ok"); });
$("#logout").addEventListener("click", () => A.signOut(auth));
$("#send-verify").addEventListener("click", async () => {
  try { await A.sendEmailVerification(auth.currentUser); say("#verify-msg", "Verification email sent. Check your inbox (and spam)."); } catch (err) { say("#verify-msg", friendly(err)); }
});
$("#check-verify").addEventListener("click", async () => {
  await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
  if (auth.currentUser.emailVerified) { show("#verify", false); show("#dash", true); startData(); } else say("#verify-msg", "Not verified yet. Open the link in the email first.");
});
function strength(p) {
  let n = 0; if (p.length >= 10) n++; if (p.length >= 14) n++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++; if (/\d/.test(p)) n++; if (/[^A-Za-z0-9]/.test(p)) n++;
  return n <= 2 ? ["weak", "Weak. Make it longer and mix in numbers or symbols."] : n === 3 ? ["ok", "Okay. A few more characters would make it strong."] : ["strong", "Strong."];
}
$("#new-pw").addEventListener("input", (e) => { const p = e.target.value, t = $("#pw-strength"); if (!p) { t.className = "hint"; t.textContent = "Use a phrase: several words, a number and a symbol."; return; } const [k, m] = strength(p); t.className = "hint " + k; t.textContent = m; });
$("#pw-reset").addEventListener("click", async () => { say("#pw-bad", ""); await sendReset("#pw-bad"); });
$("#pw-form").addEventListener("submit", async (e) => {
  e.preventDefault(); say("#pw-bad", "");
  const u = auth.currentUser, cur = $("#cur-pw").value, nw = $("#new-pw").value, nw2 = $("#new-pw2").value;
  if (!u?.providerData.some((p) => p.providerId === "password")) return say("#pw-bad", "This session is a Google sign-in, so it has no password yet. Press “Email me a reset link” to create one.");
  if (nw.length < 10) return say("#pw-bad", "New password must be at least 10 characters.");
  if (!/[A-Za-z]/.test(nw) || !/[^A-Za-z]/.test(nw)) return say("#pw-bad", "Mix letters with at least one number or symbol.");
  if (nw === cur) return say("#pw-bad", "The new password must be different from the current one.");
  if (nw !== nw2) return say("#pw-bad", "The two new passwords don't match.");
  const btn = e.submitter; if (btn) btn.disabled = true;
  try {
    await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, cur)); // proves it's really you
    await A.updatePassword(u, nw);
    e.target.reset(); $("#pw-strength").className = "hint"; $("#pw-strength").textContent = "Use a phrase: several words, a number and a symbol.";
    toast("Password updated ✓");
  } catch (err) { say("#pw-bad", err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" ? "Your current password is wrong." : friendly(err)); }
  if (btn) btn.disabled = false;
});

/* ---------- tabs ---------- */
function tab(k) {
  $$(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === k)));
  $$(".panel").forEach((p) => { p.hidden = p.id !== "p-" + k; });
}
$(".side").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) tab(b.dataset.tab); });
$("#dash").addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) tab(g.dataset.goto); });

/* ---------- helpers ---------- */
const wrap = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (err) { toast(err.code === "permission-denied" ? "Not allowed. Check you're signed in with a verified owner email." : "Save failed: " + (err.message || err.code)); } };
const delBtn = (fn) => el("button", { class: "btn btn-danger btn-sm", type: "button", "aria-label": "Delete", onclick: () => confirm("Delete this permanently?") && wrap(fn, "Deleted") }, icon("trash"));
const when = (d) => (d?.toDate ? d.toDate().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Resize + compress a picture to a small WebP data-URL so it fits a Firestore document (<1 MiB). */
async function compress(file, max = 1100) {
  const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.82, 0.7, 0.55, 0.4]) { const u = c.toDataURL("image/webp", q); if (u.length < 380_000) return u; }
  throw new Error("Image is too large even after compressing. Use a smaller picture.");
}
const picker = (inputId, previewId, onData) => $(inputId).addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const u = await compress(f); onData(u); const p = $(previewId); p.src = u; p.hidden = false; } catch (err) { toast(err.message); e.target.value = ""; }
});

/* ---------- live data ---------- */
let words = [], projects = [];
const byOrder = (a, b) => (a.order ?? 1000) - (b.order ?? 1000) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
function startData() {
  seedProjects();
  const sub = (q, cb) => unsubs.push(fs.onSnapshot(q, cb, (e) => toast("Read failed: " + e.code)));

  sub(fs.doc(db, "settings", "hero"), (s) => {
    const d = s.data() || {}; if (document.activeElement?.id !== "h-badge") $("#h-badge").value = d.badge || ""; if (document.activeElement?.id !== "h-tag") $("#h-tag").value = d.tagline || "";
    words = Array.isArray(d.words) ? d.words : []; renderWords();
  });

  sub(fs.query(fs.collection(db, "posts"), fs.orderBy("createdAt", "desc")), (s) => {
    $("#n-posts").textContent = s.size;
    $("#post-list").replaceChildren(...(s.empty ? [el("p", { class: "lead", text: "No posts yet." })] : s.docs.map((d) => {
      const p = d.data(); return el("div", { class: "item" }, el("div", {}, el("strong", { text: clip(p.title, 160) }), el("small", { text: `${clip(p.badge, 30)} · ${clip(p.date, 30)}${p.mediaType ? " · " + p.mediaType : ""}` })), el("div", { class: "acts" }, delBtn(() => fs.deleteDoc(d.ref))));
    })));
  });

  sub(fs.query(fs.collection(db, "projects"), fs.limit(100)), (s) => {
    projects = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
    $("#n-projects").textContent = projects.length; renderProjects();
  });

  sub(fs.query(fs.collection(db, "messages"), fs.orderBy("createdAt", "desc"), fs.limit(100)), (s) => {
    const unread = s.docs.filter((d) => d.data().status !== "read").length;
    $("#n-messages").textContent = s.size; $("#n-unread").textContent = unread;
    const b = $("#unread-badge"); b.textContent = unread; b.hidden = !unread;
    $("#msg-list").replaceChildren(...(s.empty ? [el("p", { class: "lead", text: "No messages yet." })] : s.docs.map((d) => {
      const m = d.data(), un = m.status !== "read";
      const reply = el("a", { class: "btn btn-ghost btn-sm", href: `mailto:${encodeURIComponent(clip(m.email, 120)).replace("%40", "@")}?subject=${encodeURIComponent("Re: " + (clip(m.subject, 120) || "your message"))}` }, icon("envelope"), " Reply");
      const mark = el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => wrap(() => fs.updateDoc(d.ref, { status: un ? "read" : "unread" })) }, icon("check"), un ? " Mark read" : " Mark unread");
      return el("div", { class: `item msg${un ? " unread" : ""}` }, el("div", {}, el("strong", { text: `${clip(m.name, 80)} · ${clip(m.email, 120)}` }), el("small", { text: `${when(m.createdAt)}${m.subject ? " · " + clip(m.subject, 120) : ""}` }), el("p", { text: clip(m.message, 3000) })), el("div", { class: "acts" }, reply, mark, delBtn(() => fs.deleteDoc(d.ref))));
    })));
  });
}

/* ---------- hero ---------- */
$("#hero-form").addEventListener("submit", (e) => { e.preventDefault(); wrap(() => fs.setDoc(fs.doc(db, "settings", "hero"), { badge: $("#h-badge").value.trim(), tagline: $("#h-tag").value.trim() }, { merge: true }), "Hero text saved ✓"); });
function renderWords() {
  $("#words").replaceChildren(...words.map((w, i) => el("div", { class: "item" }, el("span", { text: w }), el("button", { class: "btn btn-danger btn-sm", type: "button", "aria-label": "Remove phrase", onclick: () => wrap(() => fs.setDoc(fs.doc(db, "settings", "hero"), { words: words.filter((_, j) => j !== i) }, { merge: true })) }, icon("xmark")))));
}
$("#word-form").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#new-word").value.trim(); if (!v) return; $("#new-word").value = ""; wrap(() => fs.setDoc(fs.doc(db, "settings", "hero"), { words: [...words, v].slice(0, 30) }, { merge: true }), "Phrase added ✓"); });

/* ---------- posts ---------- */
let postImg = "";
$("#p-type").addEventListener("change", () => {
  const t = $("#p-type").value; $("#p-media").hidden = t === "none"; $("#p-file-wrap").hidden = t !== "image";
  $("#p-url-label").textContent = { image: "Picture link", video: "Video link (MP4 / WebM / YouTube not supported)", document: "Document link (Drive, Dropbox, direct PDF…)" }[t] || "Media link";
  $("#p-hint").textContent = t === "image" ? "Paste a link or upload below (it's resized automatically)." : "Host the file elsewhere and paste the public link. Firestore can't hold big files.";
});
picker("#p-file", "#p-preview", (u) => { postImg = u; $("#p-url").value = ""; });
$("#post-form").addEventListener("submit", (e) => {
  e.preventDefault(); const type = $("#p-type").value; const raw = postImg || $("#p-url").value.trim();
  const url = type === "none" ? "" : safeUrl(raw, { image: type === "image" });
  if (type !== "none" && !url) return toast("Please add a valid https:// link or upload a picture.");
  wrap(async () => {
    await fs.addDoc(fs.collection(db, "posts"), { title: $("#p-title").value.trim(), badge: $("#p-badge").value.trim() || "Update", content: $("#p-content").value.trim(), mediaType: type === "none" ? null : type, mediaUrl: url || null,
      fileName: type === "document" ? (url.split("/").pop().split("?")[0] || "Document").slice(0, 100) : null, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), createdAt: fs.serverTimestamp() });
    e.target.reset(); postImg = ""; $("#p-preview").hidden = true; $("#p-media").hidden = true;
  }, "Published ✓");
});

/* ---------- projects: first visit copies the built-in ones into Firestore so every project is editable ---------- */
async function seedProjects() {
  try {
    const marker = fs.doc(db, "settings", "seed");
    if ((await fs.getDoc(marker)).exists()) return;
    const have = new Set((await fs.getDocs(fs.collection(db, "projects"))).docs.map((d) => d.id));
    const batch = fs.writeBatch(db); let n = 0;
    for (const p of DEFAULT_PROJECTS) {
      if (have.has(p.id)) continue; n++;
      batch.set(fs.doc(db, "projects", p.id), { title: p.title, status: p.status, category: p.category, tech: p.tech, link: p.link || null, imageUrl: p.imageUrl || null, description: p.description, order: p.order, createdAt: fs.serverTimestamp() });
    }
    batch.set(marker, { projects: SEED_VERSION, at: fs.serverTimestamp() });
    await batch.commit();
    if (n) toast(`Imported your ${n} existing projects. You can edit all of them now ✓`);
  } catch (err) { toast("Couldn't import existing projects: " + (err.code || err.message)); }
}

let projImg = "", editingId = null;
const form = $("#proj-form");
const STATUS_LABEL = { live: "Online", delivered: "Delivered", building: "In progress" };
function setPreview(u) { const p = $("#j-preview"), ok = safeUrl(u || "", { image: true }); p.src = ok; p.hidden = !ok; $("#j-clear").hidden = !ok; }
function resetProjForm() {
  editingId = null; form.reset(); projImg = ""; setPreview(""); $("#j-cat").value = "Web app"; $("#j-tech").value = "HTML, CSS, JavaScript";
  $("#proj-title-h").textContent = "Add a project"; $("#j-submit span").textContent = "Save project"; $("#j-cancel").hidden = true; renderProjects();
}
function editProject(p) {
  editingId = p.id; projImg = p.imageUrl || "";
  $("#j-title").value = p.title || ""; $("#j-status").value = STATUS_LABEL[p.status] ? p.status : "live"; $("#j-cat").value = p.category || ""; $("#j-tech").value = p.tech || "";
  $("#j-link").value = p.link || ""; $("#j-order").value = p.order ?? ""; $("#j-desc").value = p.description || ""; setPreview(projImg);
  $("#proj-title-h").textContent = "Editing: " + clip(p.title, 60); $("#j-submit span").textContent = "Update project"; $("#j-cancel").hidden = false;
  renderProjects(); $("#proj-card").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function move(i, dir) {
  const j = i + dir; if (j < 0 || j >= projects.length) return;
  const list = [...projects]; [list[i], list[j]] = [list[j], list[i]];
  await wrap(async () => { const b = fs.writeBatch(db); list.forEach((p, k) => b.update(fs.doc(db, "projects", p.id), { order: (k + 1) * 10 })); await b.commit(); });
}
function renderProjects() {
  $("#proj-list").replaceChildren(...(!projects.length ? [el("p", { class: "lead", text: "No projects yet." })] : projects.map((p, i) => {
    const img = safeUrl(p.imageUrl || "", { image: true });
    return el("div", { class: "item" + (p.id === editingId ? " editing" : "") },
      el("div", { class: "acts" }, img ? el("img", { class: "thumb", src: img, alt: "" }) : el("span", { class: "thumb" }), el("div", {}, el("strong", { text: clip(p.title, 120) }), el("small", { text: `${STATUS_LABEL[p.status] || "Live"} · ${clip(p.category, 40)}${img ? "" : " · no picture yet"}` }))),
      el("div", { class: "acts" },
        el("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Move up", disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
        el("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Move down", disabled: i === projects.length - 1, onclick: () => move(i, 1) }, "↓"),
        el("button", { class: "btn btn-primary btn-sm", type: "button", onclick: () => editProject(p) }, "Edit"),
        delBtn(() => fs.deleteDoc(fs.doc(db, "projects", p.id)).then(() => { if (editingId === p.id) resetProjForm(); }))));
  })));
}
picker("#j-file", "#j-preview", (u) => { projImg = u; $("#j-clear").hidden = false; });
$("#j-clear").addEventListener("click", () => { projImg = ""; $("#j-file").value = ""; setPreview(""); });
$("#j-cancel").addEventListener("click", resetProjForm);
form.addEventListener("submit", (e) => {
  e.preventDefault(); const link = $("#j-link").value.trim();
  if (link && !safeUrl(link)) return toast("The link must start with https://");
  const o = $("#j-order").value.trim(), order = o === "" ? (editingId ? projects.find((p) => p.id === editingId)?.order ?? null : null) : Number(o);
  const data = { title: $("#j-title").value.trim(), status: $("#j-status").value, category: $("#j-cat").value.trim() || "Project", tech: $("#j-tech").value.trim(), link: link || null, imageUrl: projImg || null, description: $("#j-desc").value.trim(),
    order: order ?? ((Math.max(0, ...projects.map((p) => p.order ?? 0)) || 0) + 10), updatedAt: fs.serverTimestamp() };
  wrap(async () => {
    if (editingId) await fs.updateDoc(fs.doc(db, "projects", editingId), data);
    else await fs.addDoc(fs.collection(db, "projects"), { ...data, createdAt: fs.serverTimestamp() });
    resetProjForm();
  }, editingId ? "Project updated ✓" : "Project saved ✓");
});
