-- Business operations: owner invitations, commission accrual, cancellations, and order help.
-- This migration does not charge, invoice, or transfer any money.

create table public.shop_owner_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  granted_user_id uuid references auth.users(id),
  unique (shop_id, email)
);

create table public.commission_records (
  order_id uuid primary key references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_value numeric(12,2) not null check (product_value >= 0),
  rate_bps integer not null default 300 check (rate_bps between 0 and 10000),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status text not null default 'accrued' check (status in ('accrued','settled','void')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  settlement_reference text,
  settled_by uuid references auth.users(id)
);
create index commission_records_shop_created_idx on public.commission_records(shop_id, created_at desc);

alter table public.orders
  add column cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) between 5 and 300),
  add column cancelled_at timestamptz;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  category text not null check (category in ('order_help','cancel_request','refund_help','other')),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text check (resolution_note is null or char_length(resolution_note) between 5 and 500)
);
create index support_requests_shop_status_created_idx on public.support_requests(shop_id, status, created_at desc);
create index support_requests_order_created_idx on public.support_requests(order_id, created_at desc);

alter table public.shop_owner_invites enable row level security;
alter table public.commission_records enable row level security;
alter table public.support_requests enable row level security;

revoke all on public.shop_owner_invites, public.commission_records, public.support_requests from anon, authenticated;
grant select on public.shop_owner_invites, public.commission_records, public.support_requests to authenticated;

create policy shop_owner_invites_admin_read on public.shop_owner_invites
  for select to authenticated using (private.is_platform_admin());
create policy commission_records_staff_read on public.commission_records
  for select to authenticated using (private.is_platform_admin() or private.is_active_staff(shop_id));
create policy support_requests_staff_read on public.support_requests
  for select to authenticated using (private.is_platform_admin() or private.is_active_staff(shop_id));

-- Activation is a founder decision. The current owner console does not edit shops.
revoke update, delete on public.shops from authenticated;

create or replace function public.admin_invite_shop_owner(target_shop_id uuid, owner_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare clean_email text; existing_user uuid;
begin
  if not private.is_platform_admin() then raise exception 'Not authorised'; end if;
  if not exists (select 1 from public.shops where id = target_shop_id) then raise exception 'Shop not found'; end if;
  clean_email := lower(btrim(coalesce(owner_email, '')));
  if char_length(clean_email) > 254 or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then raise exception 'Enter a valid owner email'; end if;
  delete from public.shop_owner_invites where shop_id = target_shop_id and claimed_at is null and email <> clean_email;
  insert into public.shop_owner_invites(shop_id, email, invited_by)
  values (target_shop_id, clean_email, auth.uid())
  on conflict (shop_id, email) do update set invited_by = excluded.invited_by, created_at = now();
  select id into existing_user from auth.users
  where lower(email) = clean_email and email_confirmed_at is not null limit 1;
  if existing_user is not null then
    insert into public.shop_staff(shop_id, user_id, role, active)
    values (target_shop_id, existing_user, 'owner', true)
    on conflict (shop_id, user_id) do update set role = 'owner', active = true;
    update public.shop_owner_invites set claimed_at = now(), granted_user_id = existing_user
    where shop_id = target_shop_id and email = clean_email;
    return 'Owner access is ready for this verified account.';
  end if;
  return 'Invitation recorded. Ask the owner to register and verify this email, then sign in to their shop.';
end;
$$;

create or replace function public.claim_shop_owner_invitation()
returns integer language plpgsql security definer set search_path = '' as $$
declare verified_email text; claimed integer;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into verified_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then return 0; end if;
  insert into public.shop_staff(shop_id, user_id, role, active)
  select shop_id, auth.uid(), 'owner', true from public.shop_owner_invites
  where email = verified_email and claimed_at is null
  on conflict (shop_id, user_id) do update set role = 'owner', active = true;
  update public.shop_owner_invites set claimed_at = now(), granted_user_id = auth.uid()
  where email = verified_email and claimed_at is null;
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

create or replace function public.admin_set_shop_active(target_shop_id uuid, should_be_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'Not authorised'; end if;
  if not exists (select 1 from public.shops where id = target_shop_id) then raise exception 'Shop not found'; end if;
  if should_be_active then
    if not exists (select 1 from public.shop_staff where shop_id = target_shop_id and role = 'owner' and active)
      then raise exception 'Assign a verified owner before launch'; end if;
    if not exists (select 1 from public.products where shop_id = target_shop_id and active and in_stock)
      then raise exception 'Add an available product before launch'; end if;
  end if;
  update public.shops set active = should_be_active where id = target_shop_id;
end;
$$;

create or replace function private.accrue_order_commission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare merchandise_value numeric(12,2);
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;
  select coalesce(sum(case
    when status = 'ok' then price * qty
    when status = 'substituted' then coalesce(substitute_price, price) * qty
    else 0 end), 0)::numeric(12,2)
  into merchandise_value from public.order_items where order_id = new.id;
  insert into public.commission_records(order_id, shop_id, product_value, rate_bps, commission_amount)
  values (new.id, new.shop_id, merchandise_value, 300, round(merchandise_value * 0.03, 2))
  on conflict (order_id) do nothing;
  return new;
end;
$$;
create trigger accrue_order_commission after update of status on public.orders
for each row when (new.status = 'delivered' and old.status is distinct from new.status)
execute function private.accrue_order_commission();

create or replace function public.admin_set_commission_settlement(target_order_id uuid, reference text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'Not authorised'; end if;
  if char_length(btrim(coalesce(reference, ''))) < 3 or char_length(reference) > 120
    then raise exception 'Enter a settlement reference'; end if;
  update public.commission_records set status = 'settled', settled_at = now(),
    settlement_reference = btrim(reference), settled_by = auth.uid()
  where order_id = target_order_id and status = 'accrued';
  if not found then raise exception 'Accrued commission record not found'; end if;
end;
$$;

-- Cancel separately from regular progress so every new cancellation has a reason.
create or replace function public.owner_update_order_status(target_order_id uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id = target_order_id for update;
  if not found or not private.is_active_staff(target.shop_id) then raise exception 'Order not found'; end if;
  if target.status in ('delivered','cancelled') then raise exception 'Order is already finalised'; end if;
  if next_status not in ('confirmed','out_for_delivery','delivered') then
    raise exception 'Use the cancellation action to provide a reason'; end if;
  if not (
    (target.status = 'new' and next_status = 'confirmed') or
    (target.status = 'confirmed' and target.fulfilment = 'delivery' and next_status = 'out_for_delivery') or
    (target.status = 'confirmed' and target.fulfilment = 'pickup' and next_status = 'delivered') or
    (target.status = 'out_for_delivery' and next_status = 'delivered')
  ) then raise exception 'Complete the current order step first'; end if;
  update public.orders set status = next_status,
    confirmed_at = case when next_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    delivered_at = case when next_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = target_order_id;
  insert into public.order_events(order_id, shop_id, status, by_user)
  values (target_order_id, target.shop_id, next_status, auth.uid());
end;
$$;

create or replace function public.owner_cancel_order(target_order_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders%rowtype; clean_reason text;
begin
  select * into target from public.orders where id = target_order_id for update;
  if not found or not (private.is_active_staff(target.shop_id) or private.is_platform_admin())
    then raise exception 'Order not found'; end if;
  if target.status in ('delivered','cancelled') then raise exception 'Order is already finalised'; end if;
  clean_reason := btrim(coalesce(reason, ''));
  if char_length(clean_reason) < 5 or char_length(clean_reason) > 300 then
    raise exception 'Enter a cancellation reason (5–300 characters)'; end if;
  update public.orders set status = 'cancelled', cancellation_reason = clean_reason, cancelled_at = now()
  where id = target_order_id;
  insert into public.order_events(order_id, shop_id, status, by_user)
  values (target_order_id, target.shop_id, 'cancelled', auth.uid());
end;
$$;

create or replace function public.submit_order_support(
  shop_slug text, order_code text, customer_phone text, request_category text, request_message text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.orders%rowtype; ticket_id uuid; clean_message text;
begin
  if request_category not in ('order_help','cancel_request','refund_help','other')
    then raise exception 'Choose a help topic'; end if;
  clean_message := btrim(coalesce(request_message, ''));
  if char_length(clean_message) < 10 or char_length(clean_message) > 1000
    then raise exception 'Write 10–1000 characters'; end if;
  select o.* into target from public.orders o
  join public.shops s on s.id = o.shop_id
  join public.customers c on c.id = o.customer_id
  where s.slug = shop_slug and o.code = upper(btrim(order_code))
    and c.phone = public.normalise_indian_phone(customer_phone);
  if not found then raise exception 'Order not found'; end if;
  if request_category = 'cancel_request' and target.status in ('delivered','cancelled')
    then raise exception 'This order can no longer be cancelled'; end if;
  if (select count(*) from public.support_requests
      where order_id = target.id and created_at >= now() - interval '24 hours') >= 3
    then raise exception 'Request limit reached. Please call the shop'; end if;
  insert into public.support_requests(shop_id, order_id, category, message)
  values (target.shop_id, target.id, request_category, clean_message)
  returning id into ticket_id;
  return ticket_id;
end;
$$;

create or replace function public.resolve_order_support(target_request_id uuid, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.support_requests%rowtype; clean_note text;
begin
  select * into target from public.support_requests where id = target_request_id for update;
  if not found or not (private.is_platform_admin() or private.is_active_staff(target.shop_id))
    then raise exception 'Request not found'; end if;
  if target.status <> 'open' then raise exception 'Request is already resolved'; end if;
  clean_note := btrim(coalesce(note, ''));
  if char_length(clean_note) < 5 or char_length(clean_note) > 500
    then raise exception 'Enter a resolution note (5–500 characters)'; end if;
  update public.support_requests set status = 'resolved', resolution_note = clean_note,
    resolved_at = now(), resolved_by = auth.uid() where id = target_request_id;
end;
$$;

revoke all on function public.admin_invite_shop_owner(uuid,text) from public;
revoke all on function public.claim_shop_owner_invitation() from public;
revoke all on function public.admin_set_shop_active(uuid,boolean) from public;
revoke all on function public.admin_set_commission_settlement(uuid,text) from public;
revoke all on function public.owner_cancel_order(uuid,text) from public;
revoke all on function public.submit_order_support(text,text,text,text,text) from public;
revoke all on function public.resolve_order_support(uuid,text) from public;
grant execute on function public.admin_invite_shop_owner(uuid,text) to authenticated;
grant execute on function public.claim_shop_owner_invitation() to authenticated;
grant execute on function public.admin_set_shop_active(uuid,boolean) to authenticated;
grant execute on function public.admin_set_commission_settlement(uuid,text) to authenticated;
grant execute on function public.owner_cancel_order(uuid,text) to authenticated;
grant execute on function public.submit_order_support(text,text,text,text,text) to anon, authenticated;
grant execute on function public.resolve_order_support(uuid,text) to authenticated;
