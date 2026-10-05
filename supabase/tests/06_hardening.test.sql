-- Hardening migration: fixed search_path everywhere; not-found uses PT404 (HTTP 404 via PostgREST).
begin;
select plan(13);

do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
            where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public', r.t);
  end loop; end $$;

create function pg_temp.state_of(p_sql text) returns text language plpgsql as $$
declare s text; h text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics s = returned_sqlstate, h = pg_exception_hint;
  return s || ' ' || coalesce(nullif(h, ''), '-');
end $$;

-- 1. search_path
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'private')
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
          0::bigint, 'every application function in public/private has a fixed search_path');

select is((select count(*) from pg_proc p
            where p.oid in ('private.has_premium_access()'::regprocedure, 'private.in_workflow()'::regprocedure,
                            'private.nonblank(jsonb, public.locale_code)'::regprocedure,
                            'private.tg_guard_claim_sources()'::regprocedure, 'private.tg_guard_claims()'::regprocedure,
                            'private.tg_guard_media()'::regprocedure, 'private.tg_guard_published_pointer()'::regprocedure,
                            'private.tg_guard_topic_blocks()'::regprocedure, 'private.tg_guard_workflow_row()'::regprocedure,
                            'private.tg_set_updated_at()'::regprocedure, 'private.tg_version_identity()'::regprocedure)
              and p.proconfig @> array['search_path=""'] and not p.prosecdef),
          11::bigint, 'the 11 flagged functions: search_path = '''', still SECURITY INVOKER');

-- Security model and privileges unchanged
select ok((select prosecdef from pg_proc where oid = 'public.transition_content(text, uuid, public.content_status, text)'::regprocedure),
  'transition_content is still SECURITY DEFINER');
select ok(not has_function_privilege('anon', 'public.transition_content(text, uuid, public.content_status, text)', 'execute'),
  'anon still cannot execute transition_content');
select ok(has_function_privilege('authenticated', 'public.transition_content(text, uuid, public.content_status, text)', 'execute'),
  'authenticated can still execute transition_content');
select ok(has_function_privilege('anon', 'private.has_premium_access()', 'execute'),
  'RLS helper has_premium_access still executable by anon (used in policies)');
-- ALTER FUNCTION ... SET must not touch ACLs: the 11 keep exactly the ACL they had (default, NULL).
-- (Known pre-existing gap, tracked separately: private functions inherit PUBLIC EXECUTE; private is not API-exposed.)
select is((select count(*) from pg_proc
            where oid in ('private.has_premium_access()'::regprocedure, 'private.in_workflow()'::regprocedure,
                          'private.nonblank(jsonb, public.locale_code)'::regprocedure, 'private.tg_guard_claim_sources()'::regprocedure,
                          'private.tg_guard_claims()'::regprocedure, 'private.tg_guard_media()'::regprocedure,
                          'private.tg_guard_published_pointer()'::regprocedure, 'private.tg_guard_topic_blocks()'::regprocedure,
                          'private.tg_guard_workflow_row()'::regprocedure, 'private.tg_set_updated_at()'::regprocedure,
                          'private.tg_version_identity()'::regprocedure)
              and (proacl is null or oid = 'private.has_premium_access()'::regprocedure)),
  11::bigint, 'ACLs of the 11 hardened functions are unchanged');

-- Behaviour under the fixed search_path
select ok(private.nonblank('{"en": " x "}', 'en') and not private.nonblank('{"en": "  "}', 'en'),
  'nonblank behaves the same');
select ok(not private.in_workflow(), 'in_workflow is false outside transition_content');

-- 2. PT404 for not-found
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'alpha@test.local');
insert into public.staff_roles (user_id, role)
select '00000000-0000-0000-0000-0000000000a1', r from unnest(enum_range(null::public.staff_role)) r;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select is(pg_temp.state_of($$ select public.transition_content('topic_version', '00000000-0000-4000-8000-000000000000', 'published') $$),
  'PT404 reason:not_found', 'missing version: SQLSTATE PT404 with stable reason:not_found');
select is(pg_temp.state_of($$ select public.transition_content('case_version', '00000000-0000-4000-8000-000000000000', 'published') $$),
  'PT404 reason:not_found', 'same for case versions');
select is(pg_temp.state_of($$ select public.transition_content('lesson', '00000000-0000-4000-8000-000000000000', 'published') $$),
  '22023 reason:invalid_entity_type', 'other errors unchanged');

-- Trigger behaviour under the fixed search_path: updated_at still maintained
reset role;
insert into public.specialties (slug, name) values ('sp-check', '{"en":"x"}');
update public.specialties set updated_at = '2000-01-01' where slug = 'sp-check';
update public.specialties set sort_order = 9 where slug = 'sp-check';
select ok((select updated_at > '2001-01-01' from public.specialties where slug = 'sp-check'),
  'tg_set_updated_at still fires');

select * from finish();
rollback;
