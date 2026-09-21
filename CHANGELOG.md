# Changelog

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
