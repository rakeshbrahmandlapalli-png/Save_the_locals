create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function private.is_active_staff(target_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_staff
    where shop_id = target_shop_id and user_id = auth.uid() and active
  );
$$;

alter table shops enable row level security;
alter table shop_staff enable row level security;
alter table platform_admins enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

create policy shops_public_read on shops for select using (active);
create policy shops_staff_all on shops for all to authenticated
  using (private.is_active_staff(id) or private.is_platform_admin())
  with check (private.is_active_staff(id) or private.is_platform_admin());

create policy categories_public_read on categories for select using (
  exists (select 1 from shops s where s.id = shop_id and s.active)
);
create policy categories_staff_all on categories for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());

create policy products_public_read on products for select using (
  active and exists (select 1 from shops s where s.id = shop_id and s.active)
);
create policy products_staff_all on products for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());

create policy shop_staff_members_read on shop_staff for select to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin());
create policy shop_staff_admin_all on shop_staff for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy platform_admins_self_read on platform_admins for select to authenticated
  using (user_id = auth.uid());

create policy customers_staff_all on customers for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());
create policy orders_staff_all on orders for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());
create policy order_items_staff_all on order_items for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());
create policy order_events_staff_all on order_events for all to authenticated
  using (private.is_active_staff(shop_id) or private.is_platform_admin())
  with check (private.is_active_staff(shop_id) or private.is_platform_admin());

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on shops, categories, products to anon, authenticated;
grant select, insert, update, delete on shops, shop_staff, categories, products, customers, orders, order_items, order_events to authenticated;
grant select on platform_admins to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.normalise_indian_phone(raw_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');
  if length(digits) = 12 and left(digits, 2) = '91' then digits := right(digits, 10); end if;
  if length(digits) = 11 and left(digits, 1) = '0' then digits := right(digits, 10); end if;
  if digits !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid Indian mobile number'; end if;
  return '+91' || digits;
end;
$$;

create or replace function public.place_order(
  shop_slug text,
  items jsonb,
  customer jsonb,
  fulfilment text,
  address text,
  payment_method text,
  source text default 'direct'
) returns text
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  target_shop public.shops%rowtype;
  normal_phone text;
  target_customer_id uuid;
  target_order_id uuid;
  order_code text;
  calculated_subtotal numeric;
  calculated_fee numeric;
  customer_is_new boolean;
  supplied_count int;
  matched_count int;
begin
  select * into target_shop from public.shops where slug = shop_slug and active;
  if not found then raise exception 'Shop not found or inactive'; end if;
  if fulfilment not in ('delivery', 'pickup') then raise exception 'Invalid fulfilment method'; end if;
  if payment_method not in ('cod', 'upi_on_delivery') then raise exception 'Invalid payment method'; end if;
  if fulfilment = 'delivery' and nullif(btrim(address), '') is null then raise exception 'Delivery address is required'; end if;
  if fulfilment = 'delivery' and not target_shop.delivery_enabled then raise exception 'Delivery is unavailable'; end if;
  if fulfilment = 'pickup' and not target_shop.pickup_enabled then raise exception 'Pickup is unavailable'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception 'Basket is empty'; end if;

  normal_phone := public.normalise_indian_phone(customer->>'phone');
  if (select count(*) from public.orders o join public.customers c on c.id = o.customer_id
      where o.shop_id = target_shop.id and c.phone = normal_phone and o.created_at >= now() - interval '1 hour') >= 5
  then raise exception 'Order limit reached. Try again later'; end if;

  with requested as (
    select (x->>'product_id')::uuid product_id, (x->>'qty')::int qty from jsonb_array_elements(items) x
  )
  select count(*), coalesce(sum(p.price * r.qty), 0)
    into matched_count, calculated_subtotal
  from requested r join public.products p on p.id = r.product_id
  where p.shop_id = target_shop.id and p.active and p.in_stock and r.qty > 0;
  supplied_count := jsonb_array_length(items);
  if matched_count <> supplied_count then raise exception 'A product is invalid or out of stock'; end if;
  if calculated_subtotal < target_shop.min_order then raise exception 'Order is below the shop minimum'; end if;
  calculated_fee := case when fulfilment = 'delivery' then target_shop.delivery_fee else 0 end;

  insert into public.customers(shop_id, phone, name)
  values (target_shop.id, normal_phone, nullif(btrim(customer->>'name'), ''))
  on conflict (shop_id, phone) do update set name = coalesce(excluded.name, public.customers.name)
  returning id into target_customer_id;
  select not exists(select 1 from public.orders where shop_id = target_shop.id and customer_id = target_customer_id)
    into customer_is_new;

  loop
    order_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 5));
    exit when not exists(select 1 from public.orders where shop_id = target_shop.id and code = order_code);
  end loop;

  insert into public.orders(shop_id, customer_id, code, fulfilment, address, notes, payment_method,
    subtotal, delivery_fee, total, source, is_new_customer)
  values (target_shop.id, target_customer_id, order_code, fulfilment,
    case when fulfilment = 'delivery' then btrim(address) end, nullif(btrim(customer->>'notes'), ''), payment_method,
    calculated_subtotal, calculated_fee, calculated_subtotal + calculated_fee,
    coalesce(nullif(btrim(source), ''), 'direct'), customer_is_new)
  returning id into target_order_id;

  insert into public.order_items(order_id, shop_id, product_id, name, unit, price, qty)
  select target_order_id, target_shop.id, p.id, p.name, p.unit, p.price, (x->>'qty')::int
  from jsonb_array_elements(items) x
  join public.products p on p.id = (x->>'product_id')::uuid
  where p.shop_id = target_shop.id and p.active and p.in_stock;
  insert into public.order_events(order_id, shop_id, status) values (target_order_id, target_shop.id, 'new');
  return order_code;
end;
$$;

create or replace function public.order_status(shop_slug text, code text, phone text)
returns table(order_code text, status text, fulfilment text, total numeric, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.code, o.status, o.fulfilment, o.total, o.created_at
  from public.orders o
  join public.shops s on s.id = o.shop_id
  join public.customers c on c.id = o.customer_id
  where s.slug = $1 and o.code = upper($2) and c.phone = public.normalise_indian_phone($3);
$$;

revoke all on function public.normalise_indian_phone(text) from public;
revoke all on function public.place_order(text,jsonb,jsonb,text,text,text,text) from public;
revoke all on function public.order_status(text,text,text) from public;
grant execute on function public.place_order(text,jsonb,jsonb,text,text,text,text) to anon, authenticated;
grant execute on function public.order_status(text,text,text) to anon, authenticated;
