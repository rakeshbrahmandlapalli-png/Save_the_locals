-- Calls the new-order-email edge function whenever an order is inserted.
-- Written directly with pg_net because this project's dashboard does not
-- offer "call an Edge Function" as a Database Trigger target.

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://qpgcujatczxfbtvurfan.supabase.co/functions/v1/new-order-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'REPLACE_WITH_YOUR_ORDER_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists new_order_email_trigger on public.orders;
create trigger new_order_email_trigger
after insert on public.orders
for each row execute function public.notify_new_order();
