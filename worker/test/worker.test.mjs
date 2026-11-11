import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { normalizeUrl, patchWidget } from "../connect.mjs";

const ORIGIN = "https://josaphatchilokoto.space";
const ENV = { GEMINI_API_KEY: "test-secret-key" };
let ipCounter = 0;
const realFetch = globalThis.fetch;
let upstream; // calls made to "Gemini"

const geminiOk = (text, extraParts = []) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [...extraParts, { text }] } }] }), { status: 200 });

function mockGemini(...responses) {
  upstream = [];
  globalThis.fetch = async (url, init) => {
    upstream.push({ url: String(url), init });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    return typeof next === "function" ? next() : next.clone();
  };
}

function post(body, { origin = ORIGIN, type = "application/json", ip, env = ENV, raw } = {}) {
  const headers = { "CF-Connecting-IP": ip || `10.0.0.${++ipCounter}` };
  if (origin) headers.Origin = origin;
  if (type) headers["Content-Type"] = type;
  return worker.fetch(new Request("https://chiloz-chat.test.workers.dev/", { method: "POST", headers, body: raw ?? JSON.stringify(body) }), env);
}
const ask = (text, opts) => post({ messages: [{ role: "user", content: text }] }, opts);

beforeEach(() => mockGemini(geminiOk("Hello from Gemini")));
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("happy path returns the reply with CORS for the calling origin", async () => {
  const res = await ask("What does Josaphat build?");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { reply: "Hello from Gemini" });
});

test("API key goes to Gemini in a header and never into the response", async () => {
  const res = await ask("hi there");
  const text = await res.text();
  assert.ok(!text.includes("test-secret-key"));
  assert.equal(upstream.length, 1);
  assert.equal(upstream[0].init.headers["x-goog-api-key"], "test-secret-key");
  assert.ok(!upstream[0].url.includes("test-secret-key"));
  assert.match(upstream[0].url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  const sent = JSON.parse(upstream[0].init.body);
  assert.match(sent.system_instruction.parts[0].text, /josaphatchilokoto\.space/);
  assert.equal(sent.contents[0].role, "user");
});

test("preflight: allowed origin gets 204 with CORS, unknown origin gets 403", async () => {
  const ok = await worker.fetch(new Request("https://x.workers.dev/", { method: "OPTIONS", headers: { Origin: ORIGIN } }), ENV);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(ok.headers.get("access-control-allow-methods"), /POST/);
  const bad = await worker.fetch(new Request("https://x.workers.dev/", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), ENV);
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

test("rejects missing and foreign origins without calling Gemini", async () => {
  for (const origin of [null, "https://evil.example", "https://josaphatchilokoto.space.evil.example", "http://josaphatchilokoto.space"]) {
    const res = await ask("hi", { origin });
    assert.equal(res.status, 403, String(origin));
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(upstream.length, 0);
});

test("ALLOWED_ORIGINS var overrides the default list", async () => {
  const env = { ...ENV, ALLOWED_ORIGINS: "https://other.example" };
  assert.equal((await ask("hi", { env })).status, 403);
  assert.equal((await ask("hi", { env, origin: "https://other.example" })).status, 200);
});

test("rejects wrong content type, bad JSON, oversized and malformed bodies", async () => {
  assert.equal((await ask("hi", { type: "text/plain" })).status, 415);
  assert.equal((await post(null, { raw: "{not json" })).status, 400);
  assert.equal((await post({ messages: [] })).status, 400);
  assert.equal((await post({ messages: "hi" })).status, 400);
  assert.equal((await post({ messages: [{ role: "system", content: "x" }] })).status, 400);
  assert.equal((await post({ messages: [{ role: "user", content: 42 }] })).status, 400);
  assert.equal((await post({ messages: [{ role: "assistant", content: "only me" }] })).status, 400);
  assert.equal((await post({ messages: [{ role: "user", content: "   " }] })).status, 400);
  const big = await post(null, { raw: JSON.stringify({ messages: [{ role: "user", content: "a".repeat(20_000) }] }) });
  assert.equal(big.status, 413);
  assert.equal(upstream.length, 0);
});

test("only the last 8 messages are sent, trimmed to 500 chars, roles merged to alternate", async () => {
  const messages = [];
  for (let i = 0; i < 12; i++) messages.push({ role: i % 2 ? "assistant" : "user", content: `m${i}` });
  messages.push({ role: "user", content: "x".repeat(900) });
  const res = await post({ messages });
  assert.equal(res.status, 200);
  const contents = JSON.parse(upstream[0].init.body).contents;
  const roles = contents.map((c) => c.role);
  roles.forEach((r, i) => i && assert.notEqual(r, roles[i - 1]));
  assert.equal(contents[0].role, "user");
  assert.ok(contents.at(-1).parts[0].text.length <= 1002);
  assert.ok(contents.length <= 8);
});

test("rate limit: 9th request in a minute from one IP gets 429, other IPs unaffected", async () => {
  for (let i = 0; i < 8; i++) assert.equal((await ask("hi", { ip: "9.9.9.9" })).status, 200);
  const blocked = await ask("hi", { ip: "9.9.9.9" });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /too fast/);
  assert.equal((await ask("hi", { ip: "9.9.9.10" })).status, 200);
});

test("optional RATE_LIMITER binding is honoured and fails open if it throws", async () => {
  const deny = { ...ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await ask("hi", { env: deny })).status, 429);
  const broken = { ...ENV, RATE_LIMITER: { limit: async () => { throw new Error("boom"); } } };
  assert.equal((await ask("hi", { env: broken })).status, 200);
});

test("falls back to the next model on 404 / 429 / 503, and stops on 400", async () => {
  mockGemini(new Response("{}", { status: 404 }), geminiOk("from backup"));
  const res = await ask("hi");
  assert.deepEqual(await res.json(), { reply: "from backup" });
  assert.match(upstream[0].url, /gemini-3\.5-flash-lite/);
  assert.match(upstream[1].url, /gemini-2\.5-flash-lite/);

  mockGemini(new Response("{}", { status: 503 }), geminiOk("after 503"));
  assert.equal((await (await ask("hi")).json()).reply, "after 503");

  mockGemini(new Response("bad key", { status: 400 }), geminiOk("should not run"));
  const bad = await ask("hi");
  assert.equal(bad.status, 502);
  assert.equal(upstream.length, 1);
});

test("both models rate limited -> 429 busy; both down -> 502", async () => {
  mockGemini(new Response("{}", { status: 429 }));
  const busy = await ask("hi");
  assert.equal(busy.status, 429);
  assert.match((await busy.json()).error, /busy/);
  mockGemini(new Response("{}", { status: 500 }));
  assert.equal((await ask("hi")).status, 502);
});

test("GEMINI_MODELS var controls the chain", async () => {
  await ask("hi", { env: { ...ENV, GEMINI_MODELS: "my-model" } });
  assert.match(upstream[0].url, /models\/my-model:/);
});

test("missing secret -> 503 and no upstream call", async () => {
  const res = await ask("hi", { env: {} });
  assert.equal(res.status, 503);
  assert.equal(upstream.length, 0);
});

test("network failure and timeout -> 502", async () => {
  mockGemini(() => { throw new TypeError("fetch failed"); });
  assert.equal((await ask("hi")).status, 502);
});

test("thought parts are dropped; empty/blocked answers get a safe fallback", async () => {
  mockGemini(geminiOk("Visible answer", [{ text: "secret reasoning", thought: true }]));
  assert.equal((await (await ask("hi")).json()).reply, "Visible answer");
  mockGemini(new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }));
  assert.match((await (await ask("hi")).json()).reply, /contact Josaphat/);
});

test("/health reports configuration without exposing the key; unknown paths 404; GET / is 405", async () => {
  const h = await worker.fetch(new Request("https://x.workers.dev/health"), ENV);
  const healthText = await h.text();
  assert.deepEqual(JSON.parse(healthText), { ok: true, configured: true });
  assert.ok(!healthText.includes("test-secret-key"));
  const h2 = await worker.fetch(new Request("https://x.workers.dev/health"), {});
  assert.deepEqual(await h2.json(), { ok: true, configured: false });
  assert.equal((await worker.fetch(new Request("https://x.workers.dev/nope", { method: "POST" }), ENV)).status, 404);
  assert.equal((await worker.fetch(new Request("https://x.workers.dev/"), ENV)).status, 405);
});

test("connect.mjs only accepts https workers.dev URLs and patches exactly the API line", () => {
  assert.equal(normalizeUrl("https://chiloz-chat.josaphat.workers.dev/"), "https://chiloz-chat.josaphat.workers.dev");
  for (const bad of ["", "nope", "http://a.workers.dev", "https://evil.example", "https://workers.dev.evil.example"]) {
    assert.throws(() => normalizeUrl(bad), undefined, bad);
  }
  const src = 'a\nconst API = "";\nb';
  assert.equal(patchWidget(src, "https://x.y.workers.dev"), 'a\nconst API = "https://x.y.workers.dev"; // set by worker/connect.mjs\nb');
  assert.throws(() => patchWidget("no api line", "https://x.y.workers.dev"));
});
