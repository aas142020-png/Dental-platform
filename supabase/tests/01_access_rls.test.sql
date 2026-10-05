-- RLS and access-model tests. Run: supabase test db
begin;
select plan(13);

-- pgTAP keeps state in temp tables; let impersonated roles write to them.
do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
            where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public', r.t);
  end loop; end $$;

select id as endo_id from public.specialties where slug = 'endodontics' \gset

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'learner1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'learner2@test.local');

select is((select count(*) from public.topic_versions v join public.topics t on t.id = v.topic_id
            join public.specialties s on s.id = t.specialty_id
            where s.slug = 'endodontics' and v.status = 'draft' and v.version_no = 1),
          5::bigint, 'seed: five Endodontics topics, each with an empty draft v1');

select is((select count(*) from public.topic_blocks), 0::bigint, 'seed: no clinical content blocks');

-- anon
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.v_specialties where slug = 'endodontics'), 0::bigint,
          'anon: inactive specialty is hidden');
select is((select count(*) from public.topic_versions), 0::bigint, 'anon: draft versions are hidden');
select throws_ok($$ select public.upsert_progress(gen_random_uuid(), 10::smallint) $$, '42501', null,
                 'anon: cannot record progress');

-- learner 1
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*) from public.profiles), 1::bigint, 'learner: sees only own profile');
update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000b2';
select throws_ok($$ insert into public.staff_roles (user_id, role)
                    values ('00000000-0000-0000-0000-0000000000b1', 'admin') $$,
                 '42501', null, 'learner: cannot grant self a staff role');
select throws_ok(format($$ insert into public.topics (specialty_id, slug) values (%L, 'x') $$, :'endo_id'),
                 '42501', null, 'learner: cannot create topics');
select is((select count(*) from public.editorial_policy), 0::bigint, 'learner: cannot read editorial policy');
select throws_ok($$ select public.get_version_bundle(gen_random_uuid()) $$, '42501', null,
                 'learner: cannot preview unpublished versions');

reset role;
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), null,
          'learner: cannot update another profile');
insert into public.user_progress (user_id, topic_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.topics limit 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
select is((select count(*) from public.user_progress), 0::bigint, 'learner 2: cannot see learner 1 progress');
select throws_ok($$ insert into public.workflow_events (entity_type, entity_id, to_status)
                    values ('topic_version', gen_random_uuid(), 'published') $$,
                 '42501', null, 'learner: cannot write the audit log');

reset role;
select * from finish();
rollback;
