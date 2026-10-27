# Digital Heroes Platform and Operations Guide

This guide describes the deployed application, the services it uses, the main order workflow, useful URLs, and safe credential management. It intentionally does not contain passwords, API keys, access tokens, or service-role credentials.

## Application URLs

| Purpose | URL |
| --- | --- |
| Live storefront | https://dh-prd-2.vercel.app |
| Admin sign-in | https://dh-prd-2.vercel.app/admin/login |
| Admin overview | https://dh-prd-2.vercel.app/admin/dashboard |
| Admin orders | https://dh-prd-2.vercel.app/admin/jobs |
| Admin products | https://dh-prd-2.vercel.app/admin/products |
| Admin users and roles | https://dh-prd-2.vercel.app/admin/users |
| Admin reports | https://dh-prd-2.vercel.app/admin/reports |
| Vercel project | https://vercel.com/dharmendra17/dh-prd-2 |
| Vercel environment variables | https://vercel.com/dharmendra17/dh-prd-2/settings/environment-variables |
| Supabase dashboard | https://supabase.com/dashboard |
| Stripe dashboard | https://dashboard.stripe.com/ |
| Resend dashboard | https://resend.com/ |

The Vercel project is connected to `dharmendradev-0107/dh-prd-2`. The local Git `origin` is `Dharmendra0107/Digital-heroes-prd-2`; changes intended for production must also reach the Vercel-connected repository's `main` branch.

## Platforms and what they do

| Platform or component | Purpose |
| --- | --- |
| Next.js, React, TypeScript, Tailwind CSS | Application pages, interactive UI, API routes, and styling. |
| Vercel | Hosts the live Next.js application and stores Production environment variables. Pushing to the connected `main` branch triggers deployment. |
| Supabase | PostgreSQL database, user authentication, profiles and roles, and application data such as products, orders, designs, proofs, and print-file records. |
| Stripe | Creates hosted checkout sessions and processes payment events through `/api/webhooks/stripe`. Payment processing requires valid Stripe secrets and a configured webhook. |
| Resend | One supported transactional email provider. It requires an API key and an authorized sender address/domain. |
| Gmail SMTP / Nodemailer | Alternative transactional email provider. If any SMTP setting is supplied, SMTP is selected before Resend; all required SMTP settings must be valid. |
| PDFKit and Sharp | Generate server-side print PDF and PNG output. Production output is guarded by order status and proof approval. |
| Fabric.js | Customer-side artwork/design canvas. |
| PapaParse and JSZip | Parse variable-data CSV files and package generated batch output. |

## How the application works

1. A customer browses the storefront and configures a product. Product definitions, pricing tiers, and configuration are stored in Supabase.
2. The customer signs in through Supabase Auth and places an order. The order and its selected product configuration are saved in the database with an initial status such as `pending_payment`.
3. If Stripe is configured, the customer can start a Stripe Checkout session. A verified `checkout.session.completed` webhook updates the order to `artwork_pending`. Do not treat a successful order submission as proof that a payment was collected.
4. The customer creates or uploads artwork for the order. The admin reviews the order and updates its production status from the admin order detail page.
5. Proof records can be sent to the customer. The customer can approve a pending proof or request revisions. Approval marks the proof approved and moves the order to `proof_approved`.
6. Print output is available only when the order is in an allowed status and its latest proof is approved. The admin can then generate production output. Race-number orders also support a variable-data CSV merge.
7. Admins can update order status, manage product availability/details, manage user profiles and roles, review reports, and download an orders CSV.

The order status values are `pending_payment`, `paid`, `artwork_pending`, `proof_sent`, `proof_approved`, `in_production`, `completed`, and `cancelled`.

The admin can currently set an order directly to `cancelled`. There is no separate customer cancellation-request queue or accept/deny workflow.

## Credentials and environment configuration

Never put passwords, API keys, service-role keys, SMTP app passwords, webhook secrets, or session tokens in this file, source code, GitHub, screenshots, or chat messages.

### Production

Manage production secrets in the Vercel project's [Environment Variables](https://vercel.com/dharmendra17/dh-prd-2/settings/environment-variables) page. Apply changes to the Production environment and redeploy when required.

### Local development

Copy `.env.example` to `.env.local` and put local development values there. `.env.local` is private and must not be committed. Use test-mode payment credentials for local testing.

The application recognizes these environment variable names:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client key; database access must still be protected by policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-side Supabase operations. Keep secret; never expose to browser code. |
| `STRIPE_SECRET_KEY` | Server-side Stripe Checkout and payment API access. |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Listed in `.env.example`; current Checkout creation uses the server-side Stripe key and does not reference this variable. |
| `RESEND_API_KEY` | Resend API access for email delivery. |
| `EMAIL_FROM` | Sender address authorized by the configured email provider. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional SMTP configuration. SMTP takes priority over Resend when any of these values is set; configure all four together. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | Application base URLs used by email links and Stripe checkout redirects in their respective code paths. Set them to the live URL in production. |
| `DEMO_AUTH`, `DEMO_AUTH_SECRET` | Local-only demo authentication configuration. Demo auth is disabled in production. |

Never paste secret values into this guide. Obtain or rotate them through the respective provider dashboards and update them only in the correct environment.

## Current operational notes

- The deployment and admin pages have been exercised in production, including order status updates and the cancelled status filter.
- Email delivery is not confirmed as operational. Resend requires a verified sender domain/address. Previous Gmail SMTP authentication failed; revoke any old shared App Password and use a newly generated credential only if SMTP is selected.
- Payment configuration and a successful live payment have not been confirmed by this guide. Test payment and webhook behavior in Stripe test mode before enabling real transactions.
- Print generation requires a valid order with artwork and an approved latest proof; a pending-payment QA order is not suitable for validating final output.
- Admin credentials are individual Supabase Auth accounts. Use `/admin/login`; assign the `admin` role through an authorized administrative process. Do not store an admin password in repository documentation. A temporary password does not expire automatically after one day; rotate any temporary password manually after testing.

## Useful local commands

```powershell
npm install
npm run dev
npm run lint
npm run build
```

Database schema and access policies are maintained in `supabase/migrations/`. Environment variable names and placeholder examples are maintained in `.env.example`.
