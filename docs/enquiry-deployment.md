# Enquiry endpoint deployment

The six website forms send JSON to `worker/enquiries.mjs` only after `formEndpoint`
and `turnstileSiteKey` are set in `src/site.json`. Until then the site shows an
unavailable notice and does not claim receipt. The Worker uses Cloudflare Turnstile,
D1 for an hourly limit, and Resend for email. Resend returns an accepted email ID;
actual delivery to a mailbox must be verified separately before enabling the forms.

## Owner configuration

1. Confirm the business email recipients for general, project, support, and repair
   enquiries. These may be the same mailbox, but each must be set intentionally.
2. Verify a sender domain with Resend and create a restricted sending API key. Do not
   put either secret in this repository or in public page source.
3. Create a Cloudflare Worker with `worker/enquiries.mjs`, a D1 binding named `DB`,
   and apply `worker/schema.sql` to that database. Bind `SITE_ORIGIN` as
   `https://eskinder185.github.io` (change it when a custom domain is active).
4. Set Worker secrets `RESEND_API_KEY`, `TURNSTILE_SECRET`, `RATE_HASH_SECRET`
   (a long random value), and `FROM_EMAIL`.
   Set `ENQUIRY_EMAIL`, `PROJECT_EMAIL`, `SUPPORT_EMAIL`, and `REPAIR_EMAIL` as
   environment variables or secrets. Add a Turnstile widget for the site hostname.
5. Point `src/site.json` → `formEndpoint` at the deployed HTTPS Worker URL and
   `turnstileSiteKey` at the public widget key. Update the privacy page with the
   verified legal identity, contact details, providers, retention, and jurisdiction
   before enabling submissions. Obtain legal review of privacy and service terms.
6. Submit one controlled request of each type using an authorized test mailbox.
   Confirm Resend acceptance **and mailbox delivery**, then test duplicate retry,
   invalid input, Turnstile failure, and provider failure. Only then merge and deploy
   the enabled configuration.

The Worker accepts only the configured site origin, validates required fields on the
server, verifies Turnstile hostname, limits each secret-keyed IP hash to eight accepted checks per
hour, and sends the six request types to their configured destinations. The same
request ID is used as Resend's idempotency key on retries. Resend retains those keys
for 24 hours. D1 keeps an hourly hashed IP counter; schedule deletion of old rows
under the owner's retention policy.

The Worker should be deployed with Cloudflare's standard Worker controls and a
route or Worker URL that is not used for other purposes. GitHub Pages hosts only
the static front end; it cannot run this endpoint.
