/* Admin panel. Security model: the UI is a convenience; Firestore rules are the real lock.
   Only ADMIN_EMAIL with a verified address can write. No demo mode, no public sign-up. */
import { toast } from "./site.js";
import { loadFirebase, loadAuth, firebaseConfig, ADMIN_EMAIL, el, icon, safeUrl, clip } from "./firebase.js";

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
  "auth/invalid-credential": "Wrong email or password.", "auth/invalid-email": "That email address looks wrong.", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/popup-closed-by-user": "Sign-in window was closed.", "auth/network-request-failed": "Network problem. Check your connection.", "auth/requires-recent-login": "For security, sign out, sign in again, then retry.",
  "auth/weak-password": "Password is too weak. Use at least 10 characters.", "auth/unauthorized-domain": "This domain isn't authorised in Firebase → Authentication → Settings → Authorized domains.",
}[e.code] || "Something went wrong. Please try again.");

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); say("#auth-bad", ""); say("#auth-ok", "");
  const btn = $("#login-btn"); btn.disabled = true;
  try { await A.signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); $("#password").value = ""; }
  catch (err) { say("#auth-bad", friendly(err)); }
  btn.disabled = false;
});
$("#google-btn").addEventListener("click", async () => {
  say("#auth-bad", "");
  try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); } catch (err) { say("#auth-bad", friendly(err)); }
});
$("#reset-btn").addEventListener("click", async () => {
  const email = $("#email").value.trim(); say("#auth-bad", ""); say("#auth-ok", "");
  if (!email) return say("#auth-bad", "Type your email above first.");
  try { await A.sendPasswordResetEmail(auth, email); } catch {}
  say("#auth-ok", "If that account exists, a reset link is on its way."); // same answer either way: no account probing
});
$("#logout").addEventListener("click", () => A.signOut(auth));
$("#send-verify").addEventListener("click", async () => {
  try { await A.sendEmailVerification(auth.currentUser); say("#verify-msg", "Verification email sent. Check your inbox (and spam)."); } catch (err) { say("#verify-msg", friendly(err)); }
});
$("#check-verify").addEventListener("click", async () => {
  await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
  if (auth.currentUser.emailVerified) { show("#verify", false); show("#dash", true); startData(); } else say("#verify-msg", "Not verified yet. Open the link in the email first.");
});
$("#pw-form").addEventListener("submit", async (e) => {
  e.preventDefault(); say("#pw-bad", "");
  try { await A.updatePassword(auth.currentUser, $("#new-pw").value); $("#new-pw").value = ""; toast("Password updated ✓"); } catch (err) { say("#pw-bad", friendly(err)); }
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
async function compress(file, max = 1000) {
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
let words = [];
function startData() {
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

  sub(fs.query(fs.collection(db, "projects"), fs.orderBy("createdAt", "desc")), (s) => {
    $("#n-projects").textContent = s.size;
    $("#proj-list").replaceChildren(...(s.empty ? [el("p", { class: "lead", text: "No extra projects yet. The built-in ones are in the page itself." })] : s.docs.map((d) => {
      const p = d.data(), img = safeUrl(p.imageUrl || "", { image: true });
      return el("div", { class: "item" }, el("div", { class: "acts" }, img ? el("img", { class: "thumb", src: img, alt: "" }) : null, el("div", {}, el("strong", { text: clip(p.title, 120) }), el("small", { text: `${p.status || "live"} · ${clip(p.category, 40)} · ${clip(p.tech, 80)}` }))), el("div", { class: "acts" }, delBtn(() => fs.deleteDoc(d.ref))));
    })));
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

/* ---------- projects ---------- */
let projImg = "";
picker("#j-file", "#j-preview", (u) => { projImg = u; });
$("#proj-form").addEventListener("submit", (e) => {
  e.preventDefault(); const link = $("#j-link").value.trim();
  if (link && !safeUrl(link)) return toast("Live link must start with https://");
  wrap(async () => {
    await fs.addDoc(fs.collection(db, "projects"), { title: $("#j-title").value.trim(), status: $("#j-status").value, category: $("#j-cat").value.trim() || "Project", tech: $("#j-tech").value.trim(), link: link || null, imageUrl: projImg || null, description: $("#j-desc").value.trim(), createdAt: fs.serverTimestamp() });
    e.target.reset(); projImg = ""; $("#j-preview").hidden = true;
  }, "Project saved ✓");
});
