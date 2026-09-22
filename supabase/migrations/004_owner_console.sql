revoke insert, update, delete on public.customers, public.orders, public.order_items, public.order_events from authenticated;

create or replace function public.owner_update_order_status(target_order_id uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id = target_order_id;
  if not found or not private.is_active_staff(target.shop_id) then raise exception 'Order not found'; end if;
  if target.status in ('delivered','cancelled') then raise exception 'Order is already finalised'; end if;
  if next_status not in ('confirmed','out_for_delivery','delivered','cancelled') then raise exception 'Invalid order status'; end if;
  update public.orders set status = next_status,
    confirmed_at = case when next_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    delivered_at = case when next_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = target_order_id;
  insert into public.order_events(order_id, shop_id, status, by_user)
  values (target_order_id, target.shop_id, next_status, auth.uid());
end;
$$;

create or replace function public.owner_update_order_item(
  target_item_id uuid, next_status text, new_substitute_name text default null, new_substitute_price numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare target public.order_items%rowtype; parent_order_status text;
begin
  select * into target from public.order_items where id = target_item_id;
  if not found or not private.is_active_staff(target.shop_id) then raise exception 'Order item not found'; end if;
  select status into parent_order_status from public.orders where id = target.order_id;
  if parent_order_status in ('delivered','cancelled') then raise exception 'Order is already finalised'; end if;
  if next_status not in ('ok','out_of_stock','substituted','skipped') then raise exception 'Invalid item status'; end if;
  if next_status = 'substituted' and (nullif(btrim(new_substitute_name), '') is null or new_substitute_price is null or new_substitute_price < 0)
    then raise exception 'Substitute name and valid price are required';
  end if;
  update public.order_items set status = next_status,
    substitute_name = case when next_status = 'substituted' then btrim(new_substitute_name) end,
    substitute_price = case when next_status = 'substituted' then new_substitute_price end
  where id = target_item_id;
end;
$$;

revoke all on function public.owner_update_order_status(uuid,text) from public;
revoke all on function public.owner_update_order_item(uuid,text,text,numeric) from public;
grant execute on function public.owner_update_order_status(uuid,text) to authenticated;
grant execute on function public.owner_update_order_item(uuid,text,text,numeric) to authenticated;

alter table public.orders replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then alter publication supabase_realtime add table public.orders; end if;
end $$;
