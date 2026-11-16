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
| Admin subscription plan | https://dh-prd-2.vercel.app/admin/subscription |
| Vercel project | https://vercel.com/dharmendra17/dh-prd-2 |
| Vercel environment variables | https://vercel.com/dharmendra17/dh-prd-2/settings/environment-variables |
| Supabase dashboard | https://supabase.com/dashboard |
| Razorpay dashboard | https://dashboard.razorpay.com/ |
| Resend dashboard | https://resend.com/ |

The Vercel project is connected to `dharmendradev-0107/dh-prd-2`. The local Git `origin` is `Dharmendra0107/Digital-heroes-prd-2`; changes intended for production must also reach the Vercel-connected repository's `main` branch.

## Platforms and what they do

| Platform or component | Purpose |
| --- | --- |
| Next.js, React, TypeScript, Tailwind CSS | Application pages, interactive UI, API routes, and styling. |
| Vercel | Hosts the live Next.js application and stores Production environment variables. Pushing to the connected `main` branch triggers deployment. |
| Supabase | PostgreSQL database, user authentication, profiles and roles, and application data such as products, orders, designs, proofs, and print-file records. |
| Razorpay | Processes recurring subscriptions for service access and separate per-order payments. The server verifies checkout signatures and webhook events before enabling subscription access or advancing an order. |
| Resend | One supported transactional email provider. It requires an API key and an authorized sender address/domain. |
| Gmail SMTP / Nodemailer | Alternative transactional email provider. If any SMTP setting is supplied, SMTP is selected before Resend; all required SMTP settings must be valid. |
| PDFKit and Sharp | Generate server-side print PDF and PNG output. Production output is guarded by order status and proof approval. |
| Fabric.js | Customer-side artwork/design canvas. |
| PapaParse and JSZip | Parse variable-data CSV files and package generated batch output. |

## How the application works

1. A customer creates an account or signs in. New signup confirmation emails redirect to `/auth/callback` on the same origin where signup began; the callback exchanges Supabase's one-time code for a session.
2. Before browsing product services, a customer must subscribe through Razorpay. The admin configures the current monthly or yearly plan at **Admin → Subscription**. Verified Razorpay subscription events update the customer subscription record; only an active subscription unlocks services.
3. An active subscriber can configure products and place unlimited orders; each print order is priced and paid for separately. The order API independently verifies active subscription status. For a `pending_payment` order, Razorpay Checkout collects the per-order amount and the app verifies the signature and captured payment; the `payment.captured` webhook is the server-to-server recovery path. Only a verified captured payment advances an order to `artwork_pending`.
4. The customer creates or uploads artwork for the order. The admin reviews the order and updates its production status from the admin order detail page.
5. Proof records can be sent to the customer. The customer can approve a pending proof or request revisions. Approval marks the proof approved and moves the order to `proof_approved`.
6. Print output is available only when the order is in an allowed status and its latest proof is approved. The admin can then generate production output. Race-number orders also support a variable-data CSV merge.
7. Admins can update order status, manage product availability/details, manage user profiles and roles, review reports, and download an orders CSV.

The order status values are `pending_payment`, `paid`, `artwork_pending`, `proof_sent`, `proof_approved`, `in_production`, `completed`, and `cancelled`.

The admin can currently set an order directly to `cancelled`. There is no separate customer cancellation-request queue or accept/deny workflow.

## Credentials and environment configuration

Never put passwords, API keys, service-role keys, SMTP app passwords, webhook secrets, or session tokens in this file, source code, GitHub, screenshots, or chat messages.

### Production

For cross-device confirmation, configure Supabase Authentication → Email Templates → Confirm signup to link to `{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=signup`. The token type must match the email action; using `type=email` for signup links makes Supabase reject the one-time token. The callback verifies the token and creates a session without requiring the signup browser's PKCE verifier. It also supports code-based confirmation links and other email OTP types.

Manage production secrets in the Vercel project's [Environment Variables](https://vercel.com/dharmendra17/dh-prd-2/settings/environment-variables) page. Apply changes to the Production environment and redeploy when required.

In Supabase Authentication URL Configuration, set the production Site URL to `https://dh-prd-2.vercel.app` and add `https://dh-prd-2.vercel.app/auth/callback` to the allowed redirect URLs. For local testing, also allow `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`. This prevents Supabase's default confirmation redirect from sending customers to the wrong host. The signup flow explicitly supplies its current app origin, but the Supabase Site URL remains the fallback for other Auth emails and links.

Supabase Auth confirmation email delivery is separate from application notification email settings such as `SMTP_*` and `RESEND_API_KEY`. Configure a verified sender under Supabase Authentication → Emails → SMTP Settings before relying on production signup. The built-in Supabase mailer is not a substitute for a production email provider. The signup page provides a resend action and does not claim that a new account was created when Supabase returns an obfuscated duplicate-account response.

### Local development

Copy `.env.example` to `.env.local` and put local development values there. `.env.local` is private and must not be committed. Use test-mode payment credentials for local testing.

The application recognizes these environment variable names:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client key; database access must still be protected by policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-side Supabase operations. Keep secret; never expose to browser code. |
| `RAZORPAY_KEY_ID` | Razorpay key ID used to create orders and initialize Checkout. Pair it only with its matching secret from the same Razorpay mode. |
| `RAZORPAY_KEY_SECRET` | Server-only Razorpay API and checkout-signature secret. Never expose it to browser code. A 401 from Razorpay usually means the pair is invalid, mismatched, or from different modes. |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies Razorpay webhook signatures; set the same value in the Razorpay Dashboard webhook configuration. |
| `RESEND_API_KEY` | Resend API access for email delivery. |
| `EMAIL_FROM` | Sender address authorized by the configured email provider. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional SMTP configuration. SMTP takes priority over Resend when any of these values is set; configure all four together. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | Application base URLs used by email links. Set them to the live URL in production. |
| `DEMO_AUTH`, `DEMO_AUTH_SECRET` | Local-only demo authentication configuration. Demo auth is disabled in production. |

Never paste secret values into this guide. Obtain or rotate them through the respective provider dashboards and update them only in the correct environment.

## Current operational notes

- The deployment and admin pages have been exercised in production, including order status updates and the cancelled status filter.
- Supabase Auth custom SMTP is enabled, but delivery to customer inboxes is not confirmed. This is separate from the application's notification mailer. A successful signup or resend response only means Supabase accepted the request; check the provider's delivery logs and the recipient inbox. For Gmail SMTP, use a Google App Password rather than the regular account password. A transactional provider such as Resend requires a verified sender domain/address.
- Apply `supabase/migrations/003_razorpay_payments.sql` before deploying the Razorpay checkout code. Configure the `payment.captured` webhook at `/api/webhooks/razorpay` and test with Razorpay test credentials before enabling live payments. A successful test payment must advance only its matching order to `artwork_pending`.
- Apply `supabase/migrations/004_subscriptions.sql` before deploying subscription access. Configure a plan under **Admin → Subscription** and enable the subscription lifecycle webhook events listed in `README.md`. Test activation, cancellation, and access revocation with Razorpay test credentials before enabling live subscriptions.
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
