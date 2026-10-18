# Nextdoor Basket — Project Context (handoff for a new project/session)

Generated 2026-10-18 from the repo `rakeshbrahmandlapalli-png/save_the_locals` (branch `ccr-d987113d-ef9vfg`, same as `main` at commit `295c274`). Everything below was read from the code, migrations, CHANGELOG.md and DECISIONS.md. Things I could not confirm from the repo are marked **(unverified)**.

## 1. What it is

- Repo/package name: **Save the Locals** (`save-the-locals`). Customer-facing brand: **Nextdoor Basket** ("Your neighbourhood essentials, right next door.").
- A **multi-shop online ordering platform for independent neighbourhood (kirana) shops**, built for Indian users (₹, +91 mobile numbers, UPI/cash on delivery, Hyderabad/Manikonda placeholder data). README calls it "Phase-0".
- Each shop gets its own mobile storefront at `/s/<slug>`, an installable PWA, an owner console, and a QR/poster generator. A platform founder/admin console at `/admin` onboards shops and tracks the business.
- Model: customers order from a local shop; shop confirms and delivers (or pickup); payment is **cash or UPI on delivery** (no online payments). The platform accrues a **3% commission** on delivered orders (recorded only; nothing is charged or transferred by the software).

## 2. Tech stack

- Next.js **16.3.3** (pinned exactly; App Router, TypeScript), React 19.2, Tailwind CSS 4.1.13, `lucide-react`, `qrcode`.
- Supabase (Postgres 17, Auth, Realtime, Edge Functions): `@supabase/supabase-js` 2.57.4, `@supabase/ssr` 0.7.0.
- Env vars (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Fonts: Inter + Fraunces (Google fonts). Scripts: `dev`, `build`, `start`, `lint`.
- Hosting: the `next.config.ts` comment mentions Vercel restoring `.next/cache`, so it is deployed on Vercel **(unverified)**. Turbopack's build cache is disabled (`experimental.turbopackFileSystemCacheForBuild: false`) because production once shipped stale CSS.
- **IMPORTANT (AGENTS.md):** this Next.js version has breaking changes vs. what models know. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code and heed deprecations.

## 3. Repo layout

```
src/app/
  page.tsx                      public landing page: hero, how it works, active-shop list, shop-owner section, legal links
  layout.tsx                    metadata "Nextdoor Basket", viewport-fit=cover
  globals.css                   design tokens + component classes (.input, .btn-primary, .brand-lockup…)
  s/[slug]/                     CUSTOMER STOREFRONT (server page + client Storefront)
    page.tsx                    server-fetches shop, categories, products, delivered-order count; exports Shop/Category/Product types
    storefront.tsx              Shell: HomeView underneath + stacked layers (category/collection browse, basket, checkout), sticky basket bar, bottom nav, toast
    store-context.tsx           StoreProvider/useStore: basket state, layers stack, aisles, collections, "usuals", money helpers
    home-view.tsx               header, search, "same as last time" card, collections/aisles, store details
    browse-view.tsx / product-card.tsx / quantity-controls.tsx / product-image.tsx / aisle-art.tsx / bottom-nav.tsx / basket-view.tsx / checkout-view.tsx / loading.tsx
    status/page.tsx             order status lookup (code + phone) with step tracker
    manifest.webmanifest/route.ts, icon.tsx, apple-icon.tsx   per-shop PWA manifest + generated icons
    register-service-worker.tsx
    owner/                      OWNER CONSOLE (staff sign-in)
      owner-console.tsx         live orders (Realtime), status steps, cancel w/ reason, support requests, WhatsApp handoff link, sound alert
      catalogue/                add/edit/delete products & categories, stock/active toggles, inline price edit, CSV import w/ preview
      qr/                       QR + printable poster generator (`/s/<slug>?src=<name>`)
  admin/                        FOUNDER CONSOLE (platform admins only)
    admin-console.tsx           per-source metrics (orders, new/repeat customers, cancel rate, avg confirm time, AOV), computed client-side
    shop-onboarding.tsx         register a shop (created inactive)
    business-operations.tsx     invite owner by email, activate/deactivate shop, commission records + settlement, support tickets
  privacy/ terms/ refund-policy/   DRAFT legal pages (unreviewed placeholders)
src/lib/
  copy.ts                       all storefront/status UI strings (English only)
  store-brand.ts                PLATFORM_NAME="Nextdoor Basket"; shops named "placeholder…" display as the platform brand, default colour #27834a
  collections.ts                derives collections (Breakfast & tea, Cooking basics, Under ₹50) from real product names/prices; shown only with ≥3 in-stock matches
  category-icons.tsx            fixed set of 15 lucide icons owners pick per category
  supabase.ts / supabase-browser.ts / use-shop-staff-session.ts / use-platform-admin-session.ts
public/  sw.js, brand/neighbourhood-store.webp, products/*.jpg (5 demo product photos)
supabase/
  migrations/ 001_core … 008_shop_order_count, then 20261006063852_business_management, 20261006065226_business_security_grants, 20261006070741_business_legacy_owner_compatibility
  seed.sql                      placeholder shop `placeholder-manikonda` (id 10000000-…-0001), 4 categories, 20 products
  placeholder-product-photos.sql  one-off script (not a migration) setting demo image URLs
  functions/new-order-email/    edge function emailing the owner on new order (triggered by DB webhook/pg_net)
  tests/                        step1_acceptance.sql, step2_isolation.sql, step4_order_rules.mjs, step5_isolation.sql
CHANGELOG.md, DECISIONS.md      detailed step-by-step history and trade-offs (read these first in a new project)
```

## 4. Database model (Postgres, RLS on everything)

Tables: `shops` (slug, name, phone, owner_email, upi_id, address, lat/lng, hours jsonb, delivery_radius_km, min_order default 199, delivery_fee default 30, pickup/delivery_enabled, brand jsonb `{primary_colour, logo_url}`, active), `shop_staff` (role owner|staff), `platform_admins`, `categories` (+`icon`), `products` (price numeric, in_stock, active, image_url), `customers` (unique shop_id+phone), `orders` (status new→confirmed→out_for_delivery→delivered | cancelled; fulfilment delivery|pickup; payment cod|upi_on_delivery; source text for attribution; is_new_customer; cancellation_reason/cancelled_at), `order_items` (status ok|out_of_stock|substituted|skipped, substitute name/price), `order_events`, `shop_owner_invites`, `commission_records` (rate 300 bps = 3%, accrued|settled|void), `support_requests` (order_help|cancel_request|refund_help|other; open|resolved).

Key security design:
- Anonymous users can read active shops/categories/products only. They cannot read orders/customers; direct writes to orders/customers/items/events are revoked from everyone — all writes go through **security-definer RPCs** (`private.is_active_staff`, `private.is_platform_admin` guards, `search_path=''`).
- Public RPCs: `place_order` (server re-reads price/stock, enforces min order, delivery fee, **max 5 orders/hour per shop+phone**), `order_status(slug, code, phone)` (needs code AND phone), `last_order_items(slug, phone)` (phone only — accepted trade-off), `shop_delivered_order_count(slug)` (count only), `submit_order_support` (max 3 requests/24h per order).
- Staff/founder RPCs: `owner_update_order_status`, `owner_update_order_item`, `owner_cancel_order` (reason 5–300 chars), `resolve_order_support`, `admin_invite_shop_owner`, `claim_shop_owner_invitation`, `admin_set_shop_active` (activation requires a verified owner + ≥1 available product), `admin_set_commission_settlement`.
- Terminal orders (delivered/cancelled) can't be edited. A trigger accrues commission when an order becomes `delivered` (sum of ok items + substituted at substitute price).
- Migration `…070741` keeps the old 2-arg `owner_update_order_status` (including cancel) working for the previously published owner page.
- Staff can no longer UPDATE/DELETE `shops` (activation is a founder decision); shop INSERT by admin for onboarding.
- Tests exist for cross-shop isolation, price-tampering, min order, and rate limits (`supabase/tests`).

## 5. Customer experience (built)

Mobile-first storefront per shop: search, aisles (categories with icons), derived collections, product cards with photos/out-of-stock overlay, quantity stepper, sticky animated basket bar, bottom nav, stacked basket/checkout sheets (no cart persistence), "same as last time" repeat ordering by phone, checkout (name, mobile, delivery/pickup, address, cash/UPI, notes, **required consent checkbox** for Terms/Privacy), order confirmation with code, order status page with step tracker, "X orders delivered" trust badge (only when ≥5 genuinely delivered), `?src=` attribution kept in `sessionStorage` per shop. Installable PWA with minimal service worker caching only public catalogue reads (never orders/customers/owner/admin).

## 6. Design direction

Latest redesign (commits "Redesign storefront as Nextdoor Basket", "shelf-label identity"): bright white background, leaf-green `#27834a` primary, muted aisle accents (sage/clay/mustard/slate), Fraunces serif headings + Inter body, rounded 10–14px radii. Per-shop brand colour via `--brand` CSS variable. English only (Telugu `name_local` columns still exist in the DB but are unused; can return without a migration).

## 7. Git history (newest first)

1. `295c274` Business management: onboarding, owner invites, cancellations, support, commission
2. `4810292` Disable Turbopack build cache (stale CSS fix)
3. `4cad7d4` Redesign storefront as Nextdoor Basket
4. `7ffdc29` Shelf-label identity redesign
5. `df3d610` Refine storefront, basket, order tracking
6. `dbe0e2a` Mockup pictures for five demo products
7. `13afb09` Redesign customer storefront
8. `e0438d1` Category grouping + real trust signal
9. `d6124d0`, `0896723`, `963bdef` Visual polish, category icons, product photos, drop bilingual
10. `663f833` Steps 7/9/10/11: PWA, founder dashboard, QR generator, legal pages
11. `bff531f` Repeat ordering · `6b54b03` catalogue tools · `ae89efe` new-order email trigger · `2f9326a` owner console · `edfc9c2` checkout · `b8967b8` browsing · `dbbf031` isolation test · `9c496b2` secure multi-shop foundation

## 8. Known gaps / caveats / next steps

- **Legal pages are unreviewed drafts.** DECISIONS.md/CHANGELOG say an Indian legal professional must review Privacy/Terms/Refund before money changes hands or the pilot goes beyond a small known group.
- Landing page at `/` exists, with a simple list of active shops. There is still no search, location filter or contact/enquiry route for shops that want to join (no contact details are published because none are recorded in the repo). The shop list is untested against a live database.
- Seed data is a single placeholder shop; real shops are created via `/admin` (inactive until an owner is invited and a product exists).
- Service worker offline behaviour was code-reviewed, **not tested offline** (per DECISIONS.md).
- Commission is accrual-only; no payment, invoicing or settlement automation. No online payment gateway.
- New-order email depends on a Database Webhook configured in the Supabase dashboard (not in a migration) **(deployment state unverified)**.
- Whether the Supabase project has all migrations applied, and the production URL, are **unverified** from the repo.
- Founder metrics are computed client-side (fine for pilot volume; move to SQL if volume grows).
- The support-request customer UI (calling `submit_order_support`) — the RPC and owner/admin handling exist; I did not confirm a customer-facing form on the status page **(unverified)**.

## 9. Conventions to keep in a new project

- Money is computed in Postgres only; browser sends product IDs + quantities.
- No direct table writes for orders/customers; add a security-definer RPC with explicit auth checks and revoke `anon` execute on non-public RPCs (Supabase default grants EXECUTE to anon).
- Every new feature gets a CHANGELOG entry and non-obvious trade-offs go in DECISIONS.md.
- Keep UI strings in `src/lib/copy.ts`; shop-specific values (name, colour, logo) come from the shop row, never hard-coded.
- Prefer real signals over manufactured ones (e.g. trust badge only shows true counts).
