# Enquiry delivery setup

The six public enquiry forms share `site.formEndpoint` in `src/site.json`. It is `null` until delivery is configured and verified. While null, each form clearly reports that it was not sent. GitHub Pages cannot run a submission backend.

`worker/enquiries.mjs` is the server endpoint. It validates each form, rejects common bot submissions, rate limits by a hashed IP, sends to the appropriate destination, and returns success only when Resend returns an email ID. Resend's idempotency key prevents duplicate sends on retries. A `202` means the mail service accepted the message; it does not prove inbox delivery. The owner should also check the destination inbox and provider event log.

## Owner supplied configuration

1. Create a Cloudflare Worker and attach a KV namespace as `RATE_LIMIT`.
2. Set Worker secrets `RESEND_API_KEY`, `MAIL_FROM` (a sender on a verified domain), `GENERAL_TO`, `PROJECT_TO`, `SUPPORT_TO`, and `REPAIR_TO`. These may initially point to one authorized test inbox.
3. Set `ALLOWED_ORIGIN` to `https://eskinder185.github.io`. This is the browser origin, without `/jemawe`. Use the eventual custom domain origin after migration.
4. Deploy the Worker and verify one message from each form reaches the authorized test inbox. Confirm a retry with the same submission ID creates one provider message. Check invalid input, spam rejection, and a mail provider failure. Record the provider receipt and actual inbox delivery separately.
5. Confirm the public privacy policy, retention periods, legal terms, business email, and enquiry routing. Only then set `formEndpoint` to the Worker HTTPS URL and publish the site.

Do not put the API key or destination addresses in `src/site.json`, GitHub Actions logs, or the static output. For a custom domain and branded email, the owner must choose and configure the domain, DNS, sender verification, and mailbox. No domain or mailbox has been purchased or assumed.

The Worker accepts only the configured origin. The honeypot, time trap, and KV rate limit reduce simple spam; they do not guarantee abuse prevention. If traffic warrants it, add an account controlled challenge and a stronger atomic rate limiter. Consultation submissions request preferred times only; no appointment is booked by the endpoint.

## Controlled tests

Run `node --test tests/enquiries.test.mjs`. The suite stubs the Resend API and checks routing, validation, rejected origins, spam handling, and receipt requirements. It cannot prove external delivery without the owner controlled destination and live credentials.
