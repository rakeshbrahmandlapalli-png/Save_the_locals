-- Supabase installs pgcrypto in the trusted `extensions` schema. The order
-- function uses a restricted search path, so expose only that schema while it
-- runs; all application tables remain explicitly qualified as public.*.
do $$
begin
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'Required extensions.gen_random_bytes(integer) is unavailable';
  end if;
end;
$$;

alter function public.place_order(text, jsonb, jsonb, text, text, text, text)
  set search_path = 'extensions';
