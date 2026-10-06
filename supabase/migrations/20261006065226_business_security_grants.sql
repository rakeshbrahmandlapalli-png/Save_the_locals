-- Supabase's project default privileges grant EXECUTE directly to anon.
-- Remove that grant for staff and founder RPCs; their internal auth checks remain.
revoke execute on function public.admin_invite_shop_owner(uuid,text) from anon;
revoke execute on function public.claim_shop_owner_invitation() from anon;
revoke execute on function public.admin_set_shop_active(uuid,boolean) from anon;
revoke execute on function public.admin_set_commission_settlement(uuid,text) from anon;
revoke execute on function public.owner_cancel_order(uuid,text) from anon;
revoke execute on function public.resolve_order_support(uuid,text) from anon;
revoke execute on function public.owner_update_order_status(uuid,text) from anon;
revoke execute on function public.owner_update_order_item(uuid,text,text,numeric) from anon;
revoke execute on function public.notify_new_order() from anon;
revoke execute on function public.rls_auto_enable() from anon;
