# Future portals: architecture plan

**Status: planning only.** Nothing here is built. The public site links to `/client-portal/` and `/repair-status/`, which explain that these features are coming.

## Principles
- Public site and authenticated apps are separate: `/portal` for customers and `/admin` for staff, never mixed into public pages.
- Authorization is enforced on the server and in the database (Supabase Row Level Security), never only in the browser.
- Least privilege: each role sees only what it needs.
- No card numbers or bank credentials stored. Use an established payment and invoicing provider (for example Stripe), and store only its reference IDs.
- No passwords collected through support forms. Remote sessions stay user-initiated.
- Audit logging for sensitive actions such as quote approval, role changes, data exports, and deletions.

## Proposed stack
Next.js (App Router, TypeScript), Supabase (Auth, Postgres, RLS, Storage), a payment provider for invoices, and a transactional email provider, hosted on Vercel or Cloudflare. See `development-roadmap.md` for the migration path.

## Roles
| Role | Can |
|---|---|
| `customer` | See their own organization's projects, tickets, repairs, invoices, documents, and appointments; open tickets; approve quotes |
| `support_technician` | See and update assigned tickets and repairs; add work logs |
| `project_manager` | Manage projects, milestones, tasks, and assignments; message clients |
| `finance` | Manage invoices, payments, and budgets; no access to device details |
| `admin` (founder) | Everything, including staff accounts, roles, and reports |

## Core tables (Postgres)
```
organizations      id, name, created_at
profiles           id (= auth.users.id), organization_id, full_name, role, created_at
projects           id, organization_id, name, stage, start_date, target_date
milestones         id, project_id, title, due_date, status, approved_at, approved_by
tickets            id, organization_id, created_by, category, os, urgency, status, assigned_to, created_at
ticket_messages    id, ticket_id, author_id, body, internal (bool), created_at
repairs            id, public_ref (random, not sequential), organization_id, device_type, model,
                   diagnosis, status, quote_parts_cents, quote_labor_cents, quote_approved_at
documents          id, organization_id, project_id, storage_path, uploaded_by, created_at
appointments       id, organization_id, kind, starts_at, ends_at, status
invoices           id, organization_id, provider_invoice_id, amount_cents, status, due_date
audit_log          id, actor_id, action, entity, entity_id, metadata jsonb, created_at
```

## Row Level Security sketch
- Customers: `organization_id = (select organization_id from profiles where id = auth.uid())`.
- Technicians: rows where `assigned_to = auth.uid()`.
- Internal ticket messages (`internal = true`) are never readable by customers.
- `audit_log` is insert-only for app roles and readable by admins only.
- Storage buckets are private and served with short-lived signed URLs.

## Customer dashboard (planned screens)
Overview · Projects (stage, milestones, deliverables, updates) · Support tickets (create, status, reply, history) · Repairs (diagnosis, approve quote, status, history) · Invoices (provider-hosted payment links) · Documents · Appointments · Notifications.

## Staff dashboards (planned)
- **Founder/CEO:** active projects, new inquiries, pipeline, revenue summaries from the billing provider, support load, staff overview.
- **Project manager:** projects, tasks, deadlines, assignments, client messages.
- **Finance:** invoices, payments, outstanding balances, budgets. Bookkeeping stays in an accounting system.
- **Technician:** assigned tickets and repairs, device details, work logs.
- **Support:** new inquiries, open tickets, contact history, follow-ups, escalations.

## Repair status lookup
`repairs.public_ref` is a long random token, never a sequential number. Lookup requires a signed-in customer, or a one-time emailed link that expires. This matches the promise on `/repair-status/`.
