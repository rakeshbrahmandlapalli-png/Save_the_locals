# Decisions

## Step 2

- **Isolation test data:** deterministic UUIDs and `.invalid` email addresses make the test repeatable and clearly non-production.
- **Catalogue editing check:** inactive products are used because active products are intentionally public in the storefront policy.
- **Cleanup:** throwaway shops and users are explicitly deleted before the final report; foreign-key cascades remove their dependent rows.

## Step 1

- **Framework version:** Next.js `16.3.3`, the patched Active LTS version identified in the official August 2026 security release. It is pinned exactly to prevent unreviewed framework changes.
- **Placeholder identity:** the seed uses a clearly labelled placeholder shop at slug `placeholder-manikonda`; no real shop facts are assumed.
- **Database boundary:** public checkout goes only through security-definer functions. Anonymous users cannot write tables directly and cannot select customer or order data.
- **Money representation:** the required `numeric` columns are retained. All prices and totals are calculated inside Postgres from catalogue rows.
