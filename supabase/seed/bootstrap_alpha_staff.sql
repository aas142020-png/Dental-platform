-- One-off, run manually in the Supabase SQL editor AFTER the owner has signed up through the app.
-- Not a migration and not part of seed.sql. Grants the Alpha owner all five staff roles as five
-- separate rows, so roles can be split between people later with no code change.
-- Edit the email on the next line before running. Refuses unless exactly one account matches.
do $$
declare
  v_email text := 'REPLACE_WITH_OWNER_EMAIL';
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from auth.users where lower(email) = lower(v_email);
  if coalesce(cardinality(v_ids), 0) <> 1 then
    raise exception 'expected exactly one auth user for %, found %', v_email, coalesce(cardinality(v_ids), 0);
  end if;
  insert into public.staff_roles (user_id, role)
  select v_ids[1], r from unnest(enum_range(null::public.staff_role)) r
  on conflict do nothing;
  raise notice 'granted % staff roles to %', (select count(*) from public.staff_roles where user_id = v_ids[1]), v_email;
end $$;
