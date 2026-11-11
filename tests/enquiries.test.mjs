import test from "node:test";
import assert from "node:assert/strict";
import worker, { validate } from "../worker/enquiries.mjs";

const ORIGIN = "https://eskinder185.github.io";
const requestId = "5f6d62ea-682e-48d1-a166-0b690bf5e2ca";
const base = { requestId, name: "Test Customer", email: "test@example.test", consent: "yes", turnstileToken: "test-token" };
const cases = [
  [{ ...base, form: "contact", topic: "general", message: "I have a question about your services." }, "ENQUIRY_EMAIL"],
  [{ ...base, form: "quote", service: "web", description: "We need a five page website for our organization.", timeline: "Flexible", contactPreference: "email" }, "PROJECT_EMAIL"],
  [{ ...base, form: "consultation", type: "web", preferredDate1: "2099-01-01", timeOfDay: "Morning", format: "Video call" }, "PROJECT_EMAIL"],
  [{ ...base, form: "support-ticket", category: "Slow performance", deviceType: "Laptop", operatingSystem: "Windows 11", urgency: "normal", description: "The laptop is too slow after startup." }, "SUPPORT_EMAIL"],
  [{ ...base, form: "repair-booking", deviceType: "laptop", manufacturer: "Dell", service: "diagnosis", problem: "The screen flickers after waking up.", dataBackup: "unsure" }, "REPAIR_EMAIL"],
  [{ ...base, form: "web-inquiry", websiteType: "A new business website", goals: "Help customers find our services and hours.", timeline: "Flexible" }, "PROJECT_EMAIL"],
];

function env() {
  let count = 0;
  return {
    SITE_ORIGIN: ORIGIN, RESEND_API_KEY: "test", FROM_EMAIL: "Jemawe <test@example.test>",
    ENQUIRY_EMAIL: "general@example.test", PROJECT_EMAIL: "projects@example.test",
    SUPPORT_EMAIL: "support@example.test", REPAIR_EMAIL: "repairs@example.test", TURNSTILE_SECRET: "test", RATE_HASH_SECRET: "test-secret",
    DB: { prepare: () => ({ bind: () => ({ first: async () => ({ count: ++count }) }) }) },
  };
}
function request(body, origin = ORIGIN) {
  return new Request("https://worker.example.test/", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("all six form kinds reach their intended inbox after Turnstile acceptance", async () => {
  const original = globalThis.fetch;
  try {
    for (const [body, destination] of cases) {
      let sent;
      globalThis.fetch = async (url, options) => {
        if (String(url).includes("siteverify")) return Response.json({ success: true, hostname: "eskinder185.github.io" });
        sent = { options, payload: JSON.parse(options.body) };
        return Response.json({ id: "email-accepted-id" });
      };
      const response = await worker.fetch(request(body), env());
      assert.equal(response.status, 202, body.form);
      assert.equal((await response.json()).accepted, true);
      assert.equal(sent.payload.to[0], env()[destination]);
      assert.equal(sent.options.headers["Idempotency-Key"], `jemawe/${requestId}`);
      assert.match(sent.payload.text, new RegExp(`Request type: ${body.form}`));
    }
  } finally { globalThis.fetch = original; }
});

test("invalid and cross-origin requests never reach delivery", async () => {
  const original = globalThis.fetch;
  let sends = 0;
  try {
    globalThis.fetch = async () => { sends++; return Response.json({ success: true, hostname: "eskinder185.github.io" }); };
    assert.equal(validate({ ...cases[0][0], email: "bad" }), "Enter a valid email address.");
    assert.equal((await worker.fetch(request({ ...cases[0][0], email: "bad" }), env())).status, 422);
    assert.equal((await worker.fetch(request(cases[0][0], "https://other.example"), env())).status, 403);
    assert.equal(sends, 0);
  } finally { globalThis.fetch = original; }
});

test("a failed spam check or delivery never reports acceptance", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: false });
    assert.equal((await worker.fetch(request(cases[0][0]), env())).status, 422);
    globalThis.fetch = async (url) => String(url).includes("siteverify")
      ? Response.json({ success: true, hostname: "eskinder185.github.io" })
      : Response.json({ error: "provider failed" }, { status: 503 });
    assert.equal((await worker.fetch(request(cases[0][0]), env())).status, 502);
  } finally { globalThis.fetch = original; }
});

test("retries use the same provider idempotency key and the rate limit stops excess requests", async () => {
  const original = globalThis.fetch;
  const keys = [];
  const environment = env();
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("siteverify")) return Response.json({ success: true, hostname: "eskinder185.github.io" });
      keys.push(options.headers["Idempotency-Key"]);
      return Response.json({ id: "same-provider-email-id" });
    };
    for (let i = 0; i < 9; i++) {
      const response = await worker.fetch(request(cases[0][0]), environment);
      assert.equal(response.status, i < 8 ? 202 : 429);
    }
    assert.equal(keys.length, 8);
    assert.equal(new Set(keys).size, 1);
  } finally { globalThis.fetch = original; }
});
