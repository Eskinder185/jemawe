// Cloudflare Worker for the static GitHub Pages site. Set the bindings and secrets
// in docs/enquiry-deployment.md before exposing this endpoint to visitors.
const KINDS = new Set(["contact", "quote", "consultation", "support-ticket", "repair-booking", "web-inquiry"]);
const DESTINATION = {
  contact: "ENQUIRY_EMAIL",
  quote: "PROJECT_EMAIL",
  consultation: "PROJECT_EMAIL",
  "web-inquiry": "PROJECT_EMAIL",
  "support-ticket": "SUPPORT_EMAIL",
  "repair-booking": "REPAIR_EMAIL",
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(status, body, origin) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

export function validate(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Invalid request.";
  if (!KINDS.has(payload.form)) return "Choose a valid request type.";
  if (typeof payload.requestId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(payload.requestId)) return "Request ID is missing.";
  const fields = Object.entries(payload);
  if (fields.length > 45 || fields.some(([key, value]) => !/^[\w[\]-]{1,50}$/.test(key) ||
    !(typeof value === "string" || Array.isArray(value) && value.length <= 12 && value.every((v) => typeof v === "string")) ||
    JSON.stringify(value).length > 5000)) return "A field is too long or invalid.";
  if (typeof payload.name !== "string" || payload.name.trim().length < 2) return "Enter your name.";
  if (typeof payload.email !== "string" || !EMAIL.test(payload.email) || payload.email.length > 254) return "Enter a valid email address.";
  if (payload.consent !== "yes") return "Confirm the privacy notice.";
  const required = {
    contact: ["topic", "message"],
    quote: ["service", "description", "timeline", "contactPreference"],
    consultation: ["type", "preferredDate1", "timeOfDay", "format"],
    "support-ticket": ["category", "deviceType", "operatingSystem", "urgency", "description"],
    "repair-booking": ["deviceType", "manufacturer", "service", "problem", "dataBackup"],
    "web-inquiry": ["websiteType", "goals", "timeline"],
  }[payload.form];
  for (const field of required) if (typeof payload[field] !== "string" || payload[field].trim().length < 2) return `Complete ${field}.`;
  if (payload.form === "contact" && payload.message.trim().length < 10) return "Add more detail to your message.";
  if (payload.form === "quote" && payload.description.trim().length < 20) return "Describe your request in more detail.";
  if (payload.form === "repair-booking" && payload.problem.trim().length < 15) return "Describe the problem in more detail.";
  if (payload.form === "web-inquiry" && payload.goals.trim().length < 20) return "Describe your website goals in more detail.";
  if (payload.form === "support-ticket" && payload.description.trim().length < 20) return "Describe the issue in more detail.";
  if (payload.form === "consultation" && (!/^\d{4}-\d{2}-\d{2}$/.test(payload.preferredDate1) || payload.preferredDate1 < new Date().toISOString().slice(0, 10))) return "Choose a future preferred date.";
  return null;
}

function clean(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

export default {
  async fetch(request, env) {
    const allowed = env.SITE_ORIGIN || "https://eskinder185.github.io";
    const origin = request.headers.get("Origin");
    if (origin !== allowed) return reply(403, { error: "Origin is not allowed." }, allowed);
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" },
    });
    if (request.method !== "POST") return reply(405, { error: "Use POST." }, allowed);
    if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json") return reply(415, { error: "Send JSON." }, allowed);
    if (Number(request.headers.get("Content-Length") || 0) > 20_000) return reply(413, { error: "Request is too large." }, allowed);
    if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.ENQUIRY_EMAIL || !env.PROJECT_EMAIL || !env.SUPPORT_EMAIL || !env.REPAIR_EMAIL || !env.TURNSTILE_SECRET || !env.RATE_HASH_SECRET || !env.DB) {
      return reply(503, { error: "Enquiries are not configured yet." }, allowed);
    }
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 20_000) return reply(413, { error: "Request is too large." }, allowed);
      body = JSON.parse(raw);
    } catch { return reply(400, { error: "Invalid JSON." }, allowed); }
    if (body.website) return reply(400, { error: "Request could not be accepted." }, allowed); // honeypot
    const problem = validate(body);
    if (problem) return reply(422, { error: problem }, allowed);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.RATE_HASH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const ipHash = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", secret, new TextEncoder().encode(ip)))).map((n) => n.toString(16).padStart(2, "0")).join("");
    let challenge;
    try {
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: body.turnstileToken || "", remoteip: ip }),
      });
      challenge = verify.ok ? await verify.json() : null;
    } catch { return reply(503, { error: "Spam check unavailable. Please try again." }, allowed); }
    if (!challenge?.success || challenge.hostname !== new URL(allowed).hostname) return reply(422, { error: "Please complete the spam check and try again." }, allowed);
    const hour = Math.floor(Date.now() / 3_600_000);
    // D1 records only a hash and counter. The atomic upsert limits noisy sources.
    let rate;
    try {
      rate = await env.DB.prepare("INSERT INTO enquiry_rate (ip_hash, hour, count) VALUES (?, ?, 1) ON CONFLICT(ip_hash, hour) DO UPDATE SET count = count + 1 RETURNING count")
        .bind(ipHash, hour).first();
    } catch { return reply(503, { error: "Enquiry service unavailable. Please try again." }, allowed); }
    if (rate.count > 8) return reply(429, { error: "Too many requests. Please try again later." }, allowed);

    // The Resend idempotency key prevents repeat delivery within its 24-hour window.
    // Keep the payload stable across retries; the client retains requestId until accepted.
    const to = env[DESTINATION[body.form]];
    const label = `${body.form}${body.service ? `: ${clean(body.service)}` : ""}`;
    const details = Object.entries(body).filter(([key]) => !["requestId", "turnstileToken", "website", "consent"].includes(key))
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.map(clean).join(", ") : clean(value)}`).join("\n");
    let sent;
    try {
      sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `jemawe/${body.requestId}` },
        body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], reply_to: body.email, subject: `Jemawe ${label}`, text: `Request type: ${label}\nRequest ID: ${body.requestId}\n\n${details}` }),
      });
    } catch { return reply(502, { error: "Delivery service unavailable. Your answers were not accepted; please retry." }, allowed); }
    if (!sent.ok) return reply(502, { error: "Delivery service did not accept the request. Please retry." }, allowed);
    const receipt = await sent.json().catch(() => null);
    if (!receipt?.id) return reply(502, { error: "Delivery confirmation was incomplete. Please retry." }, allowed);
    return reply(202, { accepted: true, requestId: body.requestId }, allowed);
  },
};
