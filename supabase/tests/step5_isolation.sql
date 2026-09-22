-- Step 5 acceptance test: owner console isolation and the terminal-order guard.
-- This script is self-cleaning. It creates deterministic throwaway rows, records
-- the results, deletes the rows, and returns only the final PASS/FAIL report.

begin;

create temp table isolation_results (
  test text not null,
  result text not null,
  observed text not null,
  expected text not null
) on commit drop;
grant insert, select on isolation_results to authenticated;

-- Test-only identities. These are removed at the end; cascading cleanup also
-- proves no throwaway shop data survives the test.
insert into auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'step5-a@example.invalid', '', '{}', '{}', now(), now()),
  ('d0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'step5-b@example.invalid', '', '{}', '{}', now(), now());

insert into public.shops (id, slug, name, phone, active) values
  ('c1000000-0000-0000-0000-000000000001', 'step5-shop-a', 'Step 5 Shop A', '+919000000003', true),
  ('d1000000-0000-0000-0000-000000000002', 'step5-shop-b', 'Step 5 Shop B', '+919000000004', true);

insert into public.shop_staff (shop_id, user_id, role) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner'),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'owner');

insert into public.customers (id, shop_id, phone, name) values
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '+919100000003', 'Customer C'),
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', '+919100000004', 'Customer D');

-- Shop A: one live order and one already-delivered order. Shop B: one live order.
insert into public.orders (
  id, shop_id, customer_id, code, status, fulfilment, payment_method,
  subtotal, delivery_fee, total, source, is_new_customer
) values
  ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001', 'S5A01', 'new', 'pickup', 'cod', 10, 0, 10, 'step5', true),
  ('c3000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001', 'S5A02', 'delivered', 'pickup', 'cod', 10, 0, 10, 'step5', true),
  ('d3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002',
   'd2000000-0000-0000-0000-000000000002', 'S5B01', 'new', 'pickup', 'cod', 20, 0, 20, 'step5', true);

insert into public.order_items (id, order_id, shop_id, name, unit, price, qty) values
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Item A', '1 unit', 10, 1),
  ('c4000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Item A2', '1 unit', 10, 1),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'Item B', '1 unit', 20, 1);

-- Become Shop A's owner.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Non-empty control: Shop A can confirm its own live order through the RPC.
do $$
begin
  perform public.owner_update_order_status('c3000000-0000-0000-0000-000000000001', 'confirmed');
  insert into isolation_results values ('CONTROL: Shop A can confirm its own live order', 'PASS', 'ok', 'ok');
exception when others then
  insert into isolation_results values ('CONTROL: Shop A can confirm its own live order', 'FAIL', sqlerrm, 'ok');
end $$;

-- Shop A cannot move its own delivered order backwards.
do $$
begin
  perform public.owner_update_order_status('c3000000-0000-0000-0000-000000000002', 'confirmed');
  insert into isolation_results values ('Shop A cannot re-open its own delivered order', 'FAIL', 'no exception', 'finalised error');
exception when others then
  insert into isolation_results values ('Shop A cannot re-open its own delivered order',
    case when sqlerrm like '%finalised%' then 'PASS' else 'FAIL' end, sqlerrm, 'finalised error');
end $$;

-- Shop A cannot update Shop B's order.
do $$
begin
  perform public.owner_update_order_status('d3000000-0000-0000-0000-000000000002', 'confirmed');
  insert into isolation_results values ('Shop A cannot update Shop B order status', 'FAIL', 'no exception', 'not found error');
exception when others then
  insert into isolation_results values ('Shop A cannot update Shop B order status',
    case when sqlerrm like '%not found%' then 'PASS' else 'FAIL' end, sqlerrm, 'not found error');
end $$;

-- Shop A cannot edit Shop B's order item.
do $$
begin
  perform public.owner_update_order_item('d4000000-0000-0000-0000-000000000002', 'out_of_stock', null, null);
  insert into isolation_results values ('Shop A cannot edit Shop B order item', 'FAIL', 'no exception', 'not found error');
exception when others then
  insert into isolation_results values ('Shop A cannot edit Shop B order item',
    case when sqlerrm like '%not found%' then 'PASS' else 'FAIL' end, sqlerrm, 'not found error');
end $$;

-- Shop A cannot edit an item on its own already-delivered order.
do $$
begin
  perform public.owner_update_order_item('c4000000-0000-0000-0000-000000000002', 'out_of_stock', null, null);
  insert into isolation_results values ('Shop A cannot edit items on its own delivered order', 'FAIL', 'no exception', 'finalised error');
exception when others then
  insert into isolation_results values ('Shop A cannot edit items on its own delivered order',
    case when sqlerrm like '%finalised%' then 'PASS' else 'FAIL' end, sqlerrm, 'finalised error');
end $$;

-- Direct table writes are blocked; all order/item changes must go through the RPCs.
do $$
begin
  update public.orders set status = 'cancelled' where id = 'c3000000-0000-0000-0000-000000000001';
  insert into isolation_results values ('CONTROL: direct table write to orders is blocked', 'FAIL', 'no exception', 'permission denied');
exception when others then
  insert into isolation_results values ('CONTROL: direct table write to orders is blocked',
    case when sqlerrm like '%permission denied%' then 'PASS' else 'FAIL' end, sqlerrm, 'permission denied');
end $$;

reset role;

-- Mandatory non-empty control: with RLS off, confirm the RPC really changed Shop A's
-- order and really left Shop B's order untouched.
alter table public.orders disable row level security;
insert into isolation_results
select 'CONTROL: Shop A live order was actually confirmed', case when status = 'confirmed' then 'PASS' else 'FAIL' end,
       status, 'confirmed' from public.orders where id = 'c3000000-0000-0000-0000-000000000001';
insert into isolation_results
select 'CONTROL: Shop B order was never touched', case when status = 'new' then 'PASS' else 'FAIL' end,
       status, 'new' from public.orders where id = 'd3000000-0000-0000-0000-000000000002';
alter table public.orders enable row level security;

-- Cleanup is explicit and cascades through staff, customers, orders, and order items.
delete from public.shops
where id in ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002');
delete from auth.users
where id in ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002');

select test, result, observed, expected
from isolation_results
order by test;

commit;
