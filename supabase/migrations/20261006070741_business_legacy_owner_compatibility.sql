-- Keep the published owner page usable until the new UI reaches production.
-- It sends status changes through this two-argument RPC, including cancellation.
-- The new UI sends a specific cancellation reason through owner_cancel_order.
create or replace function public.owner_update_order_status(target_order_id uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id = target_order_id for update;
  if not found or not private.is_active_staff(target.shop_id) then raise exception 'Order not found'; end if;
  if target.status in ('delivered','cancelled') then raise exception 'Order is already finalised'; end if;
  if next_status not in ('confirmed','out_for_delivery','delivered','cancelled')
    then raise exception 'Invalid order status'; end if;
  update public.orders set status = next_status,
    confirmed_at = case when next_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    delivered_at = case when next_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when next_status = 'cancelled'
      then 'Cancelled in previous owner dashboard' else cancellation_reason end
  where id = target_order_id;
  insert into public.order_events(order_id, shop_id, status, by_user)
  values (target_order_id, target.shop_id, next_status, auth.uid());
end;
$$;
