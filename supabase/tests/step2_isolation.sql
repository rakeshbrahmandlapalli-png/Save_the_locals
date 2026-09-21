-- Step 2 acceptance test: prove shop-to-shop isolation with non-empty controls.
-- This script is self-cleaning. It creates deterministic throwaway rows, records
-- the results, deletes the rows, and returns only the final PASS/FAIL report.

begin;

create temp table isolation_results (
  test text not null,
  result text not null,
  observed integer not null,
  expected text not null
) on commit drop;
grant insert, select on isolation_results to authenticated;

-- Test-only identities. These are removed at the end; cascading cleanup also
-- proves no throwaway shop data survives the test.
insert into auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'step2-a@example.invalid', '', '{}', '{}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'step2-b@example.invalid', '', '{}', '{}', now(), now());

insert into public.shops (id, slug, name, phone, active) values
  ('a1000000-0000-0000-0000-000000000001', 'step2-shop-a', 'Step 2 Shop A', '+919000000001', true),
  ('b1000000-0000-0000-0000-000000000002', 'step2-shop-b', 'Step 2 Shop B', '+919000000002', true);

insert into public.shop_staff (shop_id, user_id, role) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'owner');

insert into public.products (id, shop_id, name, unit, price, active) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Private edit product A', '1 unit', 10, false),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Private edit product B', '1 unit', 20, false);

insert into public.customers (id, shop_id, phone, name) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '+919100000001', 'Customer A'),
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '+919100000002', 'Customer B');

insert into public.orders (
  id, shop_id, customer_id, code, fulfilment, payment_method,
  subtotal, delivery_fee, total, source, is_new_customer
) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'a3000000-0000-0000-0000-000000000001', 'S2A01', 'pickup', 'cod', 10, 0, 10, 'step2', true),
  ('b4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
   'b3000000-0000-0000-0000-000000000002', 'S2B02', 'pickup', 'cod', 20, 0, 20, 'step2', true);

-- Become Shop A's owner and attempt to read Shop B's private rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into isolation_results
select 'Shop A cannot read Shop B orders', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.orders where shop_id = 'b1000000-0000-0000-0000-000000000002';
insert into isolation_results
select 'Shop A cannot read Shop B customers', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.customers where shop_id = 'b1000000-0000-0000-0000-000000000002';
insert into isolation_results
select 'Shop A cannot read Shop B products for editing', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.products where shop_id = 'b1000000-0000-0000-0000-000000000002' and not active;
insert into isolation_results
select 'Shop A can read its own private product', case when count(*) = 1 then 'PASS' else 'FAIL' end,
       count(*)::int, '1' from public.products where shop_id = 'a1000000-0000-0000-0000-000000000001' and not active;

reset role;

-- Become Shop B's owner and attempt to read Shop A's private rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into isolation_results
select 'Shop B cannot read Shop A orders', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.orders where shop_id = 'a1000000-0000-0000-0000-000000000001';
insert into isolation_results
select 'Shop B cannot read Shop A customers', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.customers where shop_id = 'a1000000-0000-0000-0000-000000000001';
insert into isolation_results
select 'Shop B cannot read Shop A products for editing', case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*)::int, '0' from public.products where shop_id = 'a1000000-0000-0000-0000-000000000001' and not active;
insert into isolation_results
select 'Shop B can read its own private product', case when count(*) = 1 then 'PASS' else 'FAIL' end,
       count(*)::int, '1' from public.products where shop_id = 'b1000000-0000-0000-0000-000000000002' and not active;

reset role;

-- Mandatory non-empty control: switch RLS off, then read the same private rows.
alter table public.orders disable row level security;
alter table public.customers disable row level security;
alter table public.products disable row level security;

insert into isolation_results
select 'CONTROL: orders exist with RLS off', case when count(*) = 2 then 'PASS' else 'FAIL' end,
       count(*)::int, '2' from public.orders
where shop_id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
insert into isolation_results
select 'CONTROL: customers exist with RLS off', case when count(*) = 2 then 'PASS' else 'FAIL' end,
       count(*)::int, '2' from public.customers
where shop_id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
insert into isolation_results
select 'CONTROL: private products exist with RLS off', case when count(*) = 2 then 'PASS' else 'FAIL' end,
       count(*)::int, '2' from public.products
where shop_id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002') and not active;

alter table public.orders enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;

-- Cleanup is explicit and cascades through staff, customers, orders, and products.
delete from public.shops
where id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
delete from auth.users
where id in ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

select test, result, observed, expected
from isolation_results
order by test;

commit;
