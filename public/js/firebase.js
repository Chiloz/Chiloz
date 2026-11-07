/* Lazy Firebase loader. Pages that don't need data never download the SDK.
   The web config below is public by design — access is enforced by firestore.rules, not by hiding this. */
const VERSION = "10.14.1";
const CDN = `https://www.gstatic.com/firebasejs/${VERSION}`;
export const firebaseConfig = {
  apiKey: "AIzaSyCx8bEZ_7UVqAyOhLQs-P6WLjDoHft0RLw",
  authDomain: "josaphat-chilokoto.firebaseapp.com",
  projectId: "josaphat-chilokoto",
  storageBucket: "josaphat-chilokoto.firebasestorage.app",
  messagingSenderId: "823869084105",
  appId: "1:823869084105:web:aec7c5c36436d40b6cd818",
};
export const ADMIN_EMAIL = "josaphatkychiloz@gmail.com"; // UI hint only; real enforcement is in firestore.rules

let cache;
export function loadFirebase() {
  cache ||= (async () => {
    const [{ initializeApp }, fs] = await Promise.all([import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-firestore.js`)]);
    const app = initializeApp(firebaseConfig);
    return { app, db: fs.getFirestore(app), fs };
  })();
  return cache;
}
export const loadAuth = () => import(`${CDN}/firebase-auth.js`);

/* ---------- safe DOM helpers (never use innerHTML with data from Firestore) ---------- */
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}
export function icon(name, cls = "") {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg"); s.setAttribute("class", "icon " + cls); s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS(ns, "use"); u.setAttribute("href", `assets/icons/sprite.svg#i-${name}`); s.append(u); return s;
}
/** Allow only http(s) links, same-site relative paths, and (optionally) small data:image URIs. */
export function safeUrl(u, { image = false } = {}) {
  if (typeof u !== "string") return "";
  const v = u.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (image && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v) && v.length < 900_000) return v;
  if (/^assets\/[\w./-]+$/i.test(v)) return v;
  return "";
}
export const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
