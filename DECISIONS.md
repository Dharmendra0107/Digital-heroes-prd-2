# Digital Heroes — Decisions Log

Decisions made where the PRD was silent or ambiguous.

## Pricing

| Decision | Rationale |
|---|---|
| GST rate: 18% | Standard Indian GST for printing services as per GST schedule |
| All prices shown tax-inclusive | PRD specifies "VAT-inclusive totals shown at a glance" |
| Volume tier 1: 1–49 units = 0% discount | Industry baseline — full rate for small runs |
| Volume tier 2: 50–99 units = 10% off | Standard print industry discount for medium runs |
| Volume tier 3: 100–499 units = 20% off | Common for labels/stickers at 100+ |
| Volume tier 4: 500+ units = 30% off | Bulk rate for large print runs |
| Race numbers get steeper discounts | Event runs are typically 100–500+ units |

## Print Specifications

| Decision | Rationale |
|---|---|
| Default bleed: 3mm | Industry standard for commercial print |
| Default resolution: 300 DPI | Minimum for professional print; 600 DPI for stamps/laser |
| Print-ready PDF format: A4 | Default for generated proof documents |
| Output naming: `{OrderID}_{ProductType}_{Date}_{v}.{ext}` | Matches PRD convention |

## Designer

| Decision | Rationale |
|---|---|
| Library: Fabric.js | Better print-area constraint support; active community |
| Canvas scale: 1px = 1mm | Keeps canvas dimensions manageable for demo |
| Supported upload formats: PNG, PDF, SVG | AI files stored but not rendered client-side (noted limitation) |
| AI file handling | Stored as-is; not rendered in browser. Production would require server-side conversion. |

## Technical

| Decision | Rationale |
|---|---|
| Supabase Auth with email/password | Simple, secure, no extra infrastructure |
| Role stored in profiles table | Flexible; can add team/corporate ordering later |
| Admin role set via SQL | Deliberate barrier — admins are not self-serve |
| Stripe test mode by default | Production keys require live Stripe account |
| Gmail SMTP takes priority; Resend remains a fallback | Local Gmail SMTP uses an App Password; missing provider configuration skips delivery in demo setups |
| Local demo workflow data stored in `.demo-data.json` | Development-only persistence for demo orders, artwork, proofs, and statuses; never used in production |
| Demo checkout advances workflow without charging | Keeps the local order-to-proof demo testable without representing a payment transaction |
| PDFKit for print files | Programmatic PDF with full control over bleed/marks |
| Sharp for PNG generation | Industry standard for Node.js image processing |

## Known Limitations

| Limitation | Notes |
|---|---|
| PDF and AI print rendering | A single-page PDF up to 8 MB is rasterized locally with PDF.js for proof and print output. Multi-page PDFs are rejected. Illustrator files still require a secured AI-to-PDF converter and cannot produce print files yet. PDF rasterization is not press/color-profile certification. |
| Print file accuracy | Generated PDF and PNG files include saved canvas artwork, configured dimensions, and copied-edge bleed. They are not certified for every commercial press; production requires calibration with specific press profiles and confirmation of color management. |
| CSV merge | Admin-only batch output requires an approved latest proof and saved artwork; each valid row is rendered into a PDF and PNG with its number, optional name/category, and generated Code 128 barcode. Each request is limited to 100 rows, 1 MB of CSV, and 20 million aggregate raster pixels. |
| Profile settings | Customers can update their name and company, but not their email address. In local demo mode, changes apply to the active signed-in session; signing in again restores the configured demo account details. |
| Email notifications | Order creation, proof submission, and the first completion transition use configured Gmail SMTP or Resend. Missing provider credentials skip delivery explicitly; incomplete SMTP configuration and provider failures are returned as notification status. |
| Admin editing | Supabase-backed admins can update product name, description, base price, availability, and user name, company, and role. Active product edits are reflected in the public catalog and price calculator. Local demo products and accounts are read-only. The final administrator cannot be demoted. |
| Stripe live payments | Configured for test mode. Live payments require a verified Stripe account with live keys. |
