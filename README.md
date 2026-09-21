# Save the Locals

Phase-0 online ordering for independent neighbourhood shops.

## Local setup

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable/anon key.
2. Run `npm install`.
3. Run `npm run dev`.

Database changes live in `supabase/migrations`. Apply them in filename order, then apply `supabase/seed.sql` for placeholder development data.

Next.js is pinned to `16.3.3` (Active LTS security release dated 25 August 2026).
