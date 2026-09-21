-- Run as the anonymous API role after migrations and seed.
set local role anon;

do $$
declare visible_products int;
begin
  select count(*) into visible_products
  from public.products p join public.shops s on s.id = p.shop_id
  where s.slug = 'placeholder-manikonda';
  if visible_products <> 20 then
    raise exception 'FAIL: expected 20 public products, got %', visible_products;
  end if;
  raise notice 'PASS: signed-out product query returned 20 rows';
end $$;

do $$
begin
  perform count(*) from public.orders;
  raise exception 'FAIL: signed-out orders query unexpectedly had table access';
exception
  when insufficient_privilege then
    raise notice 'PASS: signed-out orders query was refused and returned no order data';
end $$;
