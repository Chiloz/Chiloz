/* Josaphat · site assistant. FAQ answers are instant and free; anything else goes to the Cloudflare Worker (worker/) -> Gemini.
   Conversation lives only in this browser tab (sessionStorage). No dependencies. */
const WA = "https://wa.me/260954030644";
const EMAIL = "josaphatkychiloz@gmail.com";
const API = "https://chiloz-chat.josaphat-chilokoto.workers.dev"; // set by worker/connect.mjs
const MAX_LEN = 500, COOLDOWN = 2500, MAX_SESSION_CALLS = 25, STORE = "cb-history-v1";

const FAQ = [
  { q: /(how|what|which).*\b(this|your|the)\s+(chat\s?bot|bot|assistant|ai)\b.*(work|built|made|build|powered|run|model|tech)|\b(chat\s?bot|llm|gemini|rag)\b.*(how|built|made|powered|work)|\b(this|your)\s+(chat\s?bot|bot|assistant)\b.*(gemini|gpt|llm|model|api|using|use)|are you (a |an )?(bot|ai|human|robot|real)|(who|what) are you/i,
    a: "I'm the AI assistant on this site. Simple questions (projects, services, contact) are answered instantly in your browser. Anything else goes to a small Cloudflare Worker that keeps the API key on the server, rate-limits requests and passes your question to Google's Gemini model." },
  { q: /\b(hi|hello|hey|hie|morning|afternoon|evening)\b/i, short: true,
    a: "Hey! 👋 I'm Josaphat's site assistant. Ask me about his projects, services or how to reach him." },
  { q: /(who|about).*(josaphat|you|chiloz)|tell me about (him|josaphat)/i,
    a: "Josaphat Chilokoto (aka Chiloz) is an IT student and web developer in Lusaka, Zambia. He builds fast, secure, mobile-first websites and apps with Firebase, JavaScript, Node.js, Tailwind CSS, PHP and MySQL." },
  { q: /(where|location|based|live|address|city)/i,
    a: "Josaphat is based in Lusaka, Zambia, and works with clients across Zambia and remotely." },
  { q: /(contact|reach|email|e-mail|whatsapp|phone|call|number|get in touch|hire|quote|price|pricing|cost|how much|available|availability|rate)/i,
    a: `For quotes, availability or hiring, message Josaphat directly so he can answer personally:\n• WhatsApp: ${WA}\n• Email: ${EMAIL}\n• Or use the form on the Contact page.`, wa: true },
  { q: /(service|offer|do you (build|make|do)|what can you|build me|website for|app for|web ?site|landing page|e-?commerce|shop)/i,
    a: "Josaphat builds business websites, landing pages, web apps, simple online shops, mobile-first UI, and handles deployment and hosting setup. For a specific idea, tell me what you need or message him on WhatsApp." },
  { q: /(project|portfolio|work|built|made|sample|example)/i,
    a: "Online projects: Penguin View (real-time synced video app), Bunny's Gym Record (gym tracker) and SMEConnect (Cosmetology Expo Zambia 2026, group project).\nDelivered: Busaka Enviroworks, Zelo Foods, Lifecycle Organics, Bushemi Care, Penguin's World and JOKACHI Bakes. See the Projects page for all of them." },
  { q: /(skill|tech|stack|language|framework|tools?|know|use)/i,
    a: "His stack: JavaScript, Node.js, Firebase (Hosting, Firestore, Auth), Tailwind CSS, PHP and MySQL, plus Three.js for 3D, and interests in cybersecurity and networking." },
  { q: /(cv|resume|résumé|experience|education|study|student|school|qualification)/i,
    a: "Josaphat is an IT student, building real client and personal projects alongside his studies. His full background is on the Resume page." },
  { q: /(github|code|repo|source)/i, a: "His code is on GitHub: https://github.com/Chiloz" },
  { q: /(linkedin)/i, a: "Connect with him on LinkedIn: https://www.linkedin.com/in/josaphat-chilokoto-009499377/" },
  { q: /(thank|thanks|cheers|ok(ay)?|cool|great|nice)\W*$/i, short: true,
    a: "Anytime! 😊 Anything else you'd like to know?" },
];
const CHIPS = ["What does Josaphat build?", "See his projects", "How do I hire him?"];

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const svg = (d, vb = "0 0 24 24") => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", vb); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };
const ICON = { chat: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", x: "M18 6 6 18M6 6l12 12", send: "M22 2 11 13M22 2l-7 20-4-9-9-4z" };

function init() {
  if ($(".cb-fab")) return;
  let history = []; try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]").filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20); } catch (e) {}
  let busy = false, lastSend = 0, apiCalls = 0, opened = false;

  const fab = el("button", "cb-fab"); fab.type = "button"; fab.setAttribute("aria-label", "Open chat assistant"); fab.setAttribute("aria-expanded", "false"); fab.append(svg(ICON.chat));
  const nudge = el("div", "cb-nudge", "Questions? Ask me about Josaphat's work 👋"); nudge.setAttribute("role", "button");
  const panel = el("section", "cb-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Chat with Josaphat's assistant"); panel.setAttribute("aria-hidden", "true");
  const head = el("div", "cb-head"), av = el("div", "cb-av", "J"), title = el("div", "cb-title"), close = el("button", "cb-x"); close.type = "button"; close.setAttribute("aria-label", "Close chat"); close.append(svg(ICON.x));
  const strong = el("strong", null, "Josaphat's assistant"), sub = el("span", null, "Ask me anything about his work"); title.append(strong, sub); head.append(av, title, close);
  const log = el("div", "cb-log"); log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite");
  const chips = el("div", "cb-chips");
  const form = el("form", "cb-form"); form.autocomplete = "off";
  const input = el("input", "cb-input"); input.type = "text"; input.maxLength = MAX_LEN; input.placeholder = "Type your question…"; input.setAttribute("aria-label", "Your question");
  const send = el("button", "cb-send"); send.type = "submit"; send.setAttribute("aria-label", "Send"); send.append(svg(ICON.send)); form.append(input, send);
  const foot = el("div", "cb-foot", "AI assistant · answers may be imperfect. Don't share passwords or payment details.");
  panel.append(head, log, chips, form, foot); document.body.append(nudge, fab, panel);

  /* safe rendering: text nodes only; https URLs and the email become links */
  function fill(node, text) {
    const re = /(https?:\/\/[^\s<>"')]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g; let last = 0, m;
    while ((m = re.exec(text))) {
      node.append(document.createTextNode(text.slice(last, m.index)));
      let url = m[0].replace(/[.,;:!?]+$/, ""), tail = m[0].slice(url.length);
      const a = el("a", null, url);
      if (url.includes("@") && !url.startsWith("http")) a.href = "mailto:" + url;
      else if (/^https:\/\//i.test(url)) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      else { node.append(document.createTextNode(m[0])); last = m.index + m[0].length; continue; }
      node.append(a); if (tail) node.append(document.createTextNode(tail)); last = m.index + m[0].length;
    }
    node.append(document.createTextNode(text.slice(last)));
  }
  const add = (role, text) => { const m = el("div", "cb-msg " + (role === "user" ? "me" : "bot")); fill(m, text); log.append(m); log.scrollTop = log.scrollHeight; return m; };
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-20))); } catch (e) {} };
  const typing = () => { const t = el("div", "cb-msg bot cb-typing"); t.setAttribute("aria-label", "Assistant is typing"); t.append(el("i"), el("i"), el("i")); log.append(t); log.scrollTop = log.scrollHeight; return t; };
  const showChips = (list, wa) => {
    chips.replaceChildren();
    (list || []).forEach((t) => { const b = el("button", "cb-chip", t); b.type = "button"; b.addEventListener("click", () => ask(t)); chips.append(b); });
    if (wa) { const a = el("a", "cb-chip wa", "Chat on WhatsApp"); a.href = WA; a.target = "_blank"; a.rel = "noopener noreferrer"; chips.append(a); }
  };
  const faq = (t) => { const q = t.trim(); for (const f of FAQ) { if (f.short && q.length > 40) continue; if (f.q.test(q)) return f; } return null; };
  const reply = (text, wa) => { add("bot", text); history.push({ role: "assistant", content: text }); save(); showChips(wa ? [] : ["See his projects", "How do I hire him?"], wa); };

  async function ask(raw) {
    const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    const now = Date.now(); if (now - lastSend < COOLDOWN) return; lastSend = now;
    add("user", text); history.push({ role: "user", content: text }); save(); input.value = ""; chips.replaceChildren();

    const hit = faq(text);
    if (hit) { busy = true; send.disabled = true; const t = typing(); await new Promise((r) => setTimeout(r, 450)); t.remove(); reply(hit.a, hit.wa); busy = false; send.disabled = false; return; }

    if (apiCalls >= MAX_SESSION_CALLS) { reply(`You've reached the chat limit for this visit. Please message Josaphat directly: ${WA}`, true); return; }
    if (!API) { reply("I can only answer the common questions right now. For anything else, please message Josaphat directly and he'll reply personally.", true); return; }
    busy = true; send.disabled = true; apiCalls++;
    const t = typing(), ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(API, { method: "POST", mode: "cors", credentials: "omit", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ messages: history.slice(-8) }) });
      const data = await r.json().catch(() => ({}));
      t.remove();
      if (!r.ok || typeof data.reply !== "string") throw new Error(data.error || "bad response");
      reply(data.reply.slice(0, 1500), /whatsapp|contact|email/i.test(data.reply));
    } catch (e) {
      t.remove();
      const msg = e && e.message && e.message.length < 140 && !/bad response|Failed to fetch|aborted/i.test(e.message) ? e.message : "I couldn't reach the assistant just now. You can message Josaphat directly and he'll reply personally.";
      add("bot", msg); showChips([], true);
    } finally { clearTimeout(timer); busy = false; send.disabled = false; input.focus({ preventScroll: true }); }
  }

  function open(state) {
    opened = state; panel.classList.toggle("open", state); fab.classList.toggle("cb-open", state);
    panel.setAttribute("aria-hidden", String(!state)); fab.setAttribute("aria-expanded", String(state));
    fab.setAttribute("aria-label", state ? "Close chat assistant" : "Open chat assistant"); nudge.classList.remove("show");
    if (state) { if (!log.children.length) greet(); setTimeout(() => input.focus({ preventScroll: true }), 250); } else fab.focus({ preventScroll: true });
  }
  function greet() {
    if (history.length) { history.forEach((m) => add(m.role, m.content)); showChips(CHIPS.slice(1), false); return; }
    add("bot", "Hi, I'm Josaphat's assistant 👋 Ask me about his projects, what he can build for you, or how to get in touch.");
    showChips(CHIPS, false);
  }

  fab.addEventListener("click", () => open(!opened));
  close.addEventListener("click", () => open(false));
  nudge.addEventListener("click", () => open(true));
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && opened) open(false); });
  document.addEventListener("click", (e) => { if (opened && matchMedia("(min-width:521px)").matches && !e.target.closest(".cb-panel, .cb-fab, .cb-nudge")) open(false); });

  let seen = false; try { seen = sessionStorage.getItem("cb-nudged") === "1"; } catch (e) {}
  if (!seen) setTimeout(() => { if (!opened) { nudge.classList.add("show"); try { sessionStorage.setItem("cb-nudged", "1"); } catch (e) {} setTimeout(() => nudge.classList.remove("show"), 7000); } }, 6000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
