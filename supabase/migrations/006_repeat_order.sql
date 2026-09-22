-- "Same as last time": look up a customer's most recent order at this shop
-- by phone alone (no order code), and report each item against today's
-- catalogue so the storefront can flag anything unavailable or repriced.

create or replace function public.last_order_items(shop_slug text, phone text)
returns table(
  order_code text,
  ordered_at timestamptz,
  product_id uuid,
  ordered_name text,
  qty int,
  price_paid numeric,
  available boolean,
  current_name text,
  current_name_local text,
  current_unit text,
  current_price numeric
)
language plpgsql stable security definer set search_path = '' as $$
declare
  target_shop public.shops%rowtype;
  normal_phone text;
  target_customer_id uuid;
  target_order_id uuid;
  target_order_code text;
  target_ordered_at timestamptz;
begin
  select * into target_shop from public.shops where slug = shop_slug and active;
  if not found then return; end if;

  normal_phone := public.normalise_indian_phone(phone);

  select c.id into target_customer_id
  from public.customers c
  where c.shop_id = target_shop.id and c.phone = normal_phone;
  if target_customer_id is null then return; end if;

  select o.id, o.code, o.created_at into target_order_id, target_order_code, target_ordered_at
  from public.orders o
  where o.shop_id = target_shop.id and o.customer_id = target_customer_id
  order by o.created_at desc
  limit 1;
  if target_order_id is null then return; end if;

  return query
  select
    target_order_code, target_ordered_at, oi.product_id, oi.name, oi.qty, oi.price,
    (p.id is not null and p.active and p.in_stock),
    p.name, p.name_local, p.unit, p.price
  from public.order_items oi
  left join public.products p on p.id = oi.product_id and p.shop_id = target_shop.id
  where oi.order_id = target_order_id
  order by oi.name;
end;
$$;

revoke all on function public.last_order_items(text,text) from public;
grant execute on function public.last_order_items(text,text) to anon, authenticated;
