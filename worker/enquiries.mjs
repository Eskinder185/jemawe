// Deploy as a Cloudflare Worker after configuring the secrets documented in docs/enquiries.md.
// GitHub Pages never receives the mail API key or destination addresses.
const FORMS = {
  contact: { required: ["topic", "message"], destination: "GENERAL_TO", subject: "General message" },
  quote: { required: ["service", "description", "timeline"], destination: "PROJECT_TO", subject: "Quote request" },
  consultation: { required: ["type", "preferredDate1", "timeOfDay", "format"], destination: "PROJECT_TO", subject: "Consultation time request" },
  "web-inquiry": { required: ["websiteType", "goals", "timeline"], destination: "PROJECT_TO", subject: "Website enquiry" },
  "support-ticket": { required: ["category", "deviceType", "operatingSystem", "urgency", "description"], destination: "SUPPORT_TO", subject: "IT support request" },
  "repair-booking": { required: ["deviceType", "manufacturer", "service", "problem", "dataBackup", "termsAccepted"], destination: "REPAIR_TO", subject: "Repair request" },
};

function response(status, body, origin) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  } });
}

function clean(value, max = 4000) {
  return typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(value) ? value.trim() : null;
}

function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const kind = clean(body.form, 40);
  const config = FORMS[kind];
  if (!config) return { error: "Unknown request type." };
  const fields = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "form" || key === "submissionId" || key === "website" || key === "startedAt") continue;
    if (/password|passcode|cardnumber|cvv|cvc/i.test(key)) return { error: "Do not send passwords or payment details." };
    if (!/^[a-zA-Z][a-zA-Z0-9[\]]{0,40}$/.test(key)) return { error: "Invalid field name." };
    const values = Array.isArray(value) ? value : [value];
    if (values.length > 12 || values.some((v) => clean(v) === null)) return { error: `Invalid ${key}.` };
    fields[key] = values.map((v) => clean(v));
  }
  for (const key of ["name", "email", "consent", ...config.required]) {
    if (!fields[key]?.some(Boolean)) return { error: `Check the ${key} field.`, field: key };
  }
  if (fields.consent[0] !== "yes" || (kind === "repair-booking" && fields.termsAccepted[0] !== "yes")) return { error: "Consent is required.", field: "consent" };
  if (fields.name[0].length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email[0]) || fields.email[0].length > 254) return { error: "Enter a valid name and email address.", field: "email" };
  const minimum = { contact: ["message", 10], quote: ["description", 20], "web-inquiry": ["goals", 20], "support-ticket": ["description", 20], "repair-booking": ["problem", 15] }[kind];
  if (minimum && fields[minimum[0]][0].length < minimum[1]) return { error: `Add more detail to ${minimum[0]}.`, field: minimum[0] };
  if (kind === "consultation" && fields.preferredDate1[0] < new Date().toISOString().slice(0, 10)) return { error: "Choose a future preferred date.", field: "preferredDate1" };
  if (kind === "quote" && ["it", "repair"].includes(fields.service[0]) && (!fields.operatingSystem?.[0] || !fields.deviceCount?.[0])) return { error: "Add device details.", field: "operatingSystem" };
  const submissionId = clean(body.submissionId, 80);
  if (!submissionId || !/^[a-f0-9-]{36}$/i.test(submissionId)) return { error: "Please reload the form and try again." };
  return { kind, config, fields, submissionId };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN ? origin : null;
    if (!allowed) return response(403, { error: "Origin not allowed." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", Vary: "Origin" } });
    if (request.method !== "POST") return response(405, { error: "POST required." }, allowed);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return response(415, { error: "JSON required." }, allowed);
    if (Number(request.headers.get("Content-Length")) > 16000) return response(413, { error: "Request is too large." }, allowed);
    let raw;
    try { raw = await request.text(); if (raw.length > 16000) return response(413, { error: "Request is too large." }, allowed); }
    catch { return response(400, { error: "Could not read request." }, allowed); }
    let body;
    try { body = JSON.parse(raw); } catch { return response(400, { error: "Invalid JSON." }, allowed); }
    if (body.website) return response(400, { error: "Request rejected." }, allowed);
    const startedAt = Number(body.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 2500 || Date.now() - startedAt > 86400000) return response(400, { error: "Please wait a moment, then try again." }, allowed);
    const result = validate(body);
    if (result.error) return response(422, result, allowed);
    const { kind, config, fields, submissionId } = result;
    if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env[config.destination]) return response(503, { error: "Enquiries are temporarily unavailable." }, allowed);
    // KV throttling is best effort; the mail provider's idempotency key handles concurrent retries.
    if (env.RATE_LIMIT) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
      const key = `rate:${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
      const count = Number(await env.RATE_LIMIT.get(key) || 0);
      if (count >= 8) return response(429, { error: "Too many requests. Please try again later." }, allowed);
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3600 });
    }
    const lines = [`Request type: ${config.subject}`, `Submission ID: ${submissionId}`, "", ...Object.entries(fields).map(([key, value]) => `${key}: ${value.join(", ")}`)];
    const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": submissionId,
    }, body: JSON.stringify({ from: env.MAIL_FROM, to: [env[config.destination]], reply_to: fields.email[0], subject: `Jemawe: ${config.subject}`, text: lines.join("\n") }) });
    if (!mail.ok) return response(502, { error: "The mail service could not accept your request. Please try again." }, allowed);
    let receipt;
    try { receipt = await mail.json(); } catch { return response(502, { error: "The mail service returned an invalid receipt." }, allowed); }
    if (!receipt.id) return response(502, { error: "The mail service did not confirm acceptance." }, allowed);
    return response(202, { accepted: true, receipt: receipt.id, kind }, allowed);
  },
};
