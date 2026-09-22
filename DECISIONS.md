# Decisions

## Step 6

- **CSV columns:** `category, name, name_local, unit, price, in_stock`.
  `name_local` and `in_stock` are optional; the other four are required.
  This matches the shop's own price-board language rather than inventing
  a stricter format the owner would have to learn.
- **Deleting a category never deletes products.** `category_id` is set to
  null (already the schema's behaviour); a product only disappears from
  the catalogue if it is explicitly deleted or hidden.
- **Import is all-or-nothing per row, not per file.** Valid rows import
  even if other rows in the same CSV have errors, so one bad price
  doesn't block the other 99 correct ones.

## Step 5

- **Write path:** direct insert/update/delete on `customers`, `orders`,
  `order_items`, and `order_events` is revoked from authenticated users;
  every change goes through a security-definer RPC scoped by
  `private.is_active_staff`, matching the pattern already used for checkout.
- **Terminal orders are locked:** once an order is `delivered` or
  `cancelled`, neither its status nor its items can be changed by either
  RPC. Reversing a finalised order is a new order, not an edit.
- **Notification path:** the new-order email is sent by a Database Webhook
  calling an edge function, not a SQL trigger, so it can be paused or
  redirected from the Supabase dashboard without a migration.
- **Alert sound:** requires an explicit tap (`Enable sound`) because
  browsers block audio before user interaction; realtime order inserts
  still refresh the list either way.

## Step 4

- **Checkout shape:** checkout stays in a focused mobile sheet so the basket remains visible and no client-side cart persistence is required yet.
- **Money boundary:** the browser displays an estimate, but sends only product IDs and quantities; Postgres re-reads prices, stock, minimum order, and delivery fee before inserting an order.
- **Status privacy:** order status is not publicly queryable by code alone; the code and normalised customer phone must match.
- **Rate-limit scope:** the required five-orders-per-hour rule is enforced per shop and normalised phone inside the same security-definer transaction.
- **Extension resolution:** `place_order` exposes only Supabase's trusted `extensions` schema in its function search path; application tables remain explicitly schema-qualified.

## Step 3

- **Initial data path:** the storefront is server-rendered from Supabase so the catalogue and prices arrive in the first HTML response on slow connections.
- **Language display:** English and Telugu names are both visible, with a compact toggle choosing which is primary.
- **Attribution lifetime:** `src` is stored in `sessionStorage`, scoped by shop slug, so it survives navigation during the visit without leaking across shops.
- **Visual direction:** screens use familiar retail controls, compact spacing, restrained shop colours, and no gradients or decorative AI-startup styling.

## Step 2

- **Isolation test data:** deterministic UUIDs and `.invalid` email addresses make the test repeatable and clearly non-production.
- **Catalogue editing check:** inactive products are used because active products are intentionally public in the storefront policy.
- **Cleanup:** throwaway shops and users are explicitly deleted before the final report; foreign-key cascades remove their dependent rows.

## Step 1

- **Framework version:** Next.js `16.3.3`, the patched Active LTS version identified in the official August 2026 security release. It is pinned exactly to prevent unreviewed framework changes.
- **Placeholder identity:** the seed uses a clearly labelled placeholder shop at slug `placeholder-manikonda`; no real shop facts are assumed.
- **Database boundary:** public checkout goes only through security-definer functions. Anonymous users cannot write tables directly and cannot select customer or order data.
- **Money representation:** the required `numeric` columns are retained. All prices and totals are calculated inside Postgres from catalogue rows.
