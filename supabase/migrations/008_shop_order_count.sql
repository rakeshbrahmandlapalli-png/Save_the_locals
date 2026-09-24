-- A real, honest trust signal for the storefront: how many orders this
-- shop has actually delivered. Anonymous customers cannot read the
-- orders table directly (by design), so this returns only a count,
-- never any row, and only for delivered orders (not pending/cancelled).

create or replace function public.shop_delivered_order_count(shop_slug text)
returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*)
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where s.slug = shop_slug and o.status = 'delivered';
$$;

revoke all on function public.shop_delivered_order_count(text) from public;
grant execute on function public.shop_delivered_order_count(text) to anon, authenticated;
