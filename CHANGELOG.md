# Changelog

## Design pass — product photos, card polish, English only

- Wired up `image_url`, which existed in the schema but was never
  rendered: the storefront now shows a real photo when a product has
  one, and the catalogue screen has a photo URL field (plus optional
  `image_url` CSV column) to set it.
- Product cards: taller image area, rounded corners, a proper "out of
  stock" overlay with the whole card dimmed, larger touch targets on
  the quantity stepper.
- Removed the English/Telugu bilingual toggle and all `name_local`
  reads/writes across the storefront, checkout, and catalogue tools —
  English only, on request. The database columns are untouched, so
  bilingual can come back later without a migration.

## Step 7 — Installable app

- Added a per-shop `manifest.webmanifest`, generated from the shop's own
  name, brand colour, and slug — nothing hard-coded.
- Added a generated `icon` and `apple-icon` per shop (the shop's own logo
  if `brand.logo_url` is set, otherwise its first letter on its brand
  colour).
- Added a minimal service worker (`public/sw.js`) that caches the public
  storefront page and the public catalogue reads (shops, categories,
  products) only — orders, customers, and anything under `/owner` or
  `/admin` are never intercepted. On the next offline visit, the last
  successfully loaded catalogue is served from cache instead of failing.

## Step 9 — Founder measurement page

- Added `/admin` (platform-admin only, checked against `platform_admins`,
  not `shop_staff`): a shop selector and a table of orders, new
  customers, repeat customers (customers with 2+ total orders), the
  cancellation rate, average time to confirm, and average order value,
  all broken down by `source`.
- Computed client-side from the shop's own orders (already readable by a
  platform admin under RLS) rather than a new SQL function, since the
  pilot's order volume does not need server-side aggregation.

## Step 10 — QR and poster generator

- Added `/s/[slug]/owner/qr`: type a source name (pamphlet, counter,
  gate, ...), get a QR code pointing at `/s/<slug>?src=<name>`, laid out
  for printing (a Print button, dashed cut lines, controls hidden via
  `@media print`).
- Added the `qrcode` package so codes render client-side from the page
  itself — no reliance on a third-party image API for something meant to
  be printed and trusted.

## Step 11 — Legal pages and consent

- Added placeholder `/privacy`, `/terms`, and `/refund-policy` pages,
  each marked as an unreviewed draft. Per the build kit, an Indian legal
  professional must review these before any money is charged or the
  pilot goes beyond a small, known group.
- Added a required consent checkbox at checkout, linking to both pages,
  checked before `place_order` is ever called.

## Step 8 — "Same as last time"

- Added a card at the top of the storefront: enter a mobile number, see
  your most recent order at this shop.
- Each item is checked against today's catalogue: unavailable items are
  named and excluded, price changes are shown, everything else can be
  added to the basket in one tap.
- Added `last_order_items(shop_slug, phone)`, a security-definer function
  that finds the customer's most recent order by phone alone (no order
  code — see DECISIONS.md for the trade-off) and joins each item to the
  live product row.

## Step 6 — Catalogue tools

- Added `/s/[slug]/owner/catalogue`: add, edit, and delete categories and
  products, an in-stock toggle, a hide/show (`active`) toggle, and inline
  price editing.
- Added CSV import with a preview step: each row is validated (category,
  name, unit, and a non-negative price are required) before anything is
  written, invalid rows are shown with the specific problem and skipped,
  and new category names are created automatically.
- Extracted the shared sign-in/staff-membership check from the owner
  console into `useShopStaffSession`, now used by both owner screens.
- No new migration: products and categories were already directly
  writable by staff under RLS (only orders/items/customers were locked
  down to RPCs in Step 5).

## Step 5 — Owner console

- Added a staff sign-in console at `/s/[slug]/owner` showing live orders with
  bilingual item detail, a delivery-handoff WhatsApp link, and an optional
  sound alert on new orders via Supabase Realtime.
- Added `owner_update_order_status` and `owner_update_order_item`, the only
  way staff can change an order or item now that direct table writes are
  revoked from authenticated users.
- Added a terminal-order guard: a delivered or cancelled order (and its
  items) can no longer be edited by either RPC.
- Added `supabase/functions/new-order-email`, a webhook-triggered edge
  function that emails the shop owner when a new order is inserted (the
  Database Webhook itself is configured in the Supabase dashboard, not in a
  migration).
- Added an executable isolation test covering shop-to-shop denial, the
  terminal-order guard, and the blocked direct table write.

## Step 4 — Checkout and order placement

- Added a mobile checkout for customer details, delivery or pickup, address, cash or UPI on delivery, and optional notes.
- Connected checkout exclusively to the server-owned `place_order` function and added order confirmation.
- Added a private order-status lookup requiring both the order code and customer phone.
- Added migration `003_order_code_function_path.sql` to make secure order-code generation work with Supabase's extension schema.
- Added an executable acceptance test for price tampering, minimum-order enforcement, and hourly order limits.

## Step 3 — Mobile storefront

- Added `/s/[slug]` backed by the public Supabase catalogue policies.
- Added bilingual shop, category, product, search, and basket interfaces.
- Added category filtering, product search, quantity controls, live totals, and minimum-order feedback.
- Added session-level attribution that remembers the `?src=` value for the shop visit.

## Step 2 — Prove shop isolation

- Added a self-cleaning SQL acceptance test with two throwaway shops and staff identities.
- Added bidirectional checks for orders, customers, and inactive catalogue rows used by editing screens.
- Added non-empty controls that read the same rows with RLS disabled.

## Step 1 — Project, database, one shop

- Created the Next.js App Router TypeScript project with Tailwind CSS.
- Added core multi-shop schema migration `001_core.sql`.
- Added RLS, public ordering functions, and grants migration `002_security.sql`.
- Added one placeholder shop, four categories, and twenty placeholder products.
- Added a signed-out acceptance test for order privacy and public catalogue access.
