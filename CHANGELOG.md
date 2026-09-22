# Changelog

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
