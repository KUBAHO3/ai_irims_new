# Rwanda FDA regulatory services portal

A working web app built from `../prototype.html`: product registration from draft to certificate, for applicants and Rwanda FDA assessors.

| Part | Stack | Path |
|---|---|---|
| Web | Next.js 15 (App Router), React 19, SWR | `apps/web` (port 3100) |
| API | NestJS 11, Prisma 6, PostgreSQL 16 | `apps/api` (port 4100) |
| Shared rules | TypeScript package used by both | `packages/shared` |

The browser only talks to the web app. Next.js proxies `/api/*` to the NestJS API, so the session cookie stays first-party.

## Run it

```bash
pnpm install
pnpm db:up                      # Postgres in Docker on 127.0.0.1:5440
cp .env.example apps/api/.env   # then set JWT_SECRET to a long random string
pnpm build:shared
pnpm db:migrate                 # creates the tables
pnpm db:seed                    # demo data (wipes the database and uploads folder)
pnpm dev                        # API on :4100, web on :3100
```

Open http://localhost:3100. With `NEXT_PUBLIC_DEMO_LOGIN=true` (set in `apps/web/.env.local`) the sign-in page has one-click demo buttons.

| Demo account | Sign in with | Password |
|---|---|---|
| Applicant (Imaginary Pharma Ltd) | `40112` or `regulatory@imaginary-pharma.example` | `Applicant#2026` |
| Assessor | `assessor@rfda.example` | `Assessor#2026` |

## What it does

**Public:** track an application by tracking number, see requirements per product type, sign in, create an account (a customer number is issued), raise a help-desk ticket.

**Applicant:** dashboard of what needs action, application list with filters, a guided start, a 5-step wizard with autosave (product, manufacturer, documents, label, review and submit), invoice payment (mobile money placeholder or proof upload), answering queries with attachments, invoices, certificates.

**Assessor:** in-tray sorted by stage deadline (SLA), enquiries across all applications, and a review workspace with stage-specific decisions:
verification (confirm payment) → screening (persisted document checklist, accept or query) → assessment (findings, recommend, query) → approval (approve and issue certificate, return, reject).

**Changing a submitted application:** the applicant can change it while it is with them (awaiting payment, or answering a query) via *Change application*. It is locked while Rwanda FDA is working on it. Changes are saved explicitly, not autosaved; each save must keep the details complete and is recorded in History ("Details changed", "Documents changed"). A changed document loses its screening tick, the last file of a required document can only be replaced, not removed, and the dossier must be complete before the applicant can pay or send a query response. Assessors see a "Changed by applicant" flag in the in-tray and a list of the changes in the review workspace. The product type can't be changed (the invoice depends on it).

The API enforces every rule the UI shows: completeness on submit, allowed decisions per stage, required comments, that every uploaded document is ticked before acceptance, ownership of applications and files.

## Document requirements

Defined in one place: `packages/shared/src/reference.ts` (`COMMON_DOCS`, `TYPE_DOCS`). Each requirement has a group, a required flag, an optional condition and whether several files may be uploaded.

Human medicines use these documents (shown in the wizard, the review workspace, the screening checklist and the public requirements list):

| Group | Document | Required |
|---|---|---|
| Reliance on a reference regulatory authority | Declaration of sameness | Yes, if registered by a reference authority |
| | GMP certificate issued by the reference regulatory authority | Yes, if registered by a reference authority |
| | Letter of authorization permitting the reference regulatory authority to share relevant information with Rwanda FDA | Yes, if registered by a reference authority |
| CTD dossier | Module 1: Administrative information and prescribing information | Yes (several files) |
| | Module 2: Common technical document summaries | Yes (several files) |
| | Module 3: Quality (pharmaceutical documentation) | Yes (several files) |
| | Module 4: Non-clinical study reports | Yes (several files) |
| | Module 5: Clinical studies | Yes (several files) |
| Other | Other documents | Optional (several files) |

"Registered by a reference authority" is the wizard question *Registered by a recognized regulatory authority?* in step 2; answering Yes also asks which authority. The administrative documents shared by all product types (cover letter, power of attorney, etc.) still apply.

## Files

Uploads are stored on disk under `apps/api/uploads` (`UPLOAD_DIR`) with random names; metadata is in the `StoredFile` table. Accepted: PDF, Word, Excel, PNG/JPEG, ZIP, up to `MAX_UPLOAD_MB` (200 MB) each. Downloads go through `GET /api/files/:id`, which checks the caller owns the application or is an assessor.

## Not done yet

- Mobile money is a placeholder that records a reference; no gateway is connected.
- The AI pre-check and AI assist panels are placeholders. The n8n prototype in `../n8n-poc` is the intended backend.
- No email notifications, password reset, renewals, or the other services (premises, import permits, etc.).
- One assessor role does every stage; there are no separate verifier/screener/approver roles yet.
- Fees, timelines, SLAs and most product lists are the prototype's illustrative values.
- Before production: HTTPS with `COOKIE_SECURE=true`, login rate limiting, object storage with virus scanning instead of local disk, and `NEXT_PUBLIC_DEMO_LOGIN=false`.
