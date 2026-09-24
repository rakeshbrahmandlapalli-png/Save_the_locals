-- Categories can carry an icon key (from a fixed set the app ships with),
-- so a shop's "Staples", "Dairy", etc. get a small consistent icon
-- without any per-shop code or a hard-coded name-to-icon guess.

alter table public.categories add column if not exists icon text;
