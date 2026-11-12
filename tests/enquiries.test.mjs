import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/enquiries.mjs";

const origin = "https://eskinder185.github.io";
const env = { ALLOWED_ORIGIN: origin, RESEND_API_KEY: "test", MAIL_FROM: "test@example.invalid", GENERAL_TO: "general@example.invalid", PROJECT_TO: "projects@example.invalid", SUPPORT_TO: "support@example.invalid", REPAIR_TO: "repair@example.invalid" };
const base = { name: "Test Person", email: "person@example.invalid", consent: "yes", submissionId: "12345678-1234-1234-1234-123456789abc", startedAt: Date.now() - 10000, website: "" };
const cases = [
  ["contact", { topic: "general", message: "A general question for the team." }, "GENERAL_TO"],
  ["quote", { service: "web", description: "A business website with five pages.", timeline: "Flexible" }, "PROJECT_TO"],
  ["quote-certificates", { form: "quote", service: "certificates", currentWebsite: "https://example.com", businessCategory: "Consulting", hostingProvider: "Cloudflare", description: "Need TLS certificate automation and monitoring across our subdomains.", timeline: "Within a month" }, "PROJECT_TO"],
  ["consultation", { type: "web", preferredDate1: "2099-01-01", timeOfDay: "Morning", format: "Video call" }, "PROJECT_TO"],
  ["web-inquiry", { websiteType: "Business", goals: "A site where people can request help.", timeline: "Flexible" }, "PROJECT_TO"],
  ["support-ticket", { category: "other", deviceType: "laptop", operatingSystem: "Windows", urgency: "normal", description: "My computer cannot connect to Wi-Fi." }, "SUPPORT_TO"],
  ["repair-booking", { deviceType: "laptop", manufacturer: "Dell", service: "diagnostic", problem: "The screen does not turn on.", dataBackup: "unsure", termsAccepted: "yes" }, "REPAIR_TO"],
];
function request(body, from = origin) { return new Request("https://worker.example.invalid/", { method: "POST", headers: { Origin: from, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

for (const [kind, fields, destination] of cases) test(`${kind} accepts and routes an enquiry`, async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ id: "mail-123" }); };
  try {
    const res = await worker.fetch(request({ ...base, ...fields, form: fields.form || kind }), env);
    assert.equal(res.status, 202);
    assert.equal((await res.json()).receipt, "mail-123");
    assert.equal(JSON.parse(calls[0].options.body).to[0], env[destination]);
    assert.equal(calls[0].options.headers["Idempotency-Key"], base.submissionId);
  } finally { globalThis.fetch = original; }
});

test("rejects invalid input, foreign origin, spam, and missing provider receipt", async () => {
  const body = { ...base, ...cases[0][1], form: "contact" };
  assert.equal((await worker.fetch(request(body, "https://other.invalid"), env)).status, 403);
  assert.equal((await worker.fetch(request({ ...body, message: "short" }), env)).status, 422);
  assert.equal((await worker.fetch(request({ ...body, website: "spam" }), env)).status, 400);
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({});
  try { assert.equal((await worker.fetch(request(body), env)).status, 502); }
  finally { globalThis.fetch = original; }
});

test("retries preserve the provider idempotency key and receipt", async () => {
  const keys = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    keys.push(options.headers["Idempotency-Key"]);
    return Response.json({ id: "same-receipt" });
  };
  try {
    const body = { ...base, ...cases[0][1], form: "contact" };
    const first = await worker.fetch(request(body), env);
    const second = await worker.fetch(request(body), env);
    assert.deepEqual(keys, [base.submissionId, base.submissionId]);
    assert.equal((await first.json()).receipt, (await second.json()).receipt);
  } finally { globalThis.fetch = original; }
});
