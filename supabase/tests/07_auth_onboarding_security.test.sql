begin;
select plan(9);

-- Every pgTAP file is rolled back; fixtures from earlier files do not persist.
insert into auth.users (id,email) values
  ('10000000-0000-0000-0000-000000000001','onboarding-other@test.local'),
  ('10000000-0000-0000-0000-000000000002','onboarding-self@test.local');
do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
    where c.relnamespace=pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public',r.t);
  end loop;
end $$;

-- Disposable fixtures exercise RLS; auth delivery is checked separately in E2E.
select has_column('public','profiles','study_year','profiles has study_year');
select has_column('public','profiles','specialty_interest','profiles has specialty_interest');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);

select lives_ok($$ update public.profiles set role='student', study_year=4, preferred_locale='en' where id='10000000-0000-0000-0000-000000000002' $$,'user can persist own onboarding');
select is((select study_year from public.profiles where id='10000000-0000-0000-0000-000000000002'),4::smallint,'own onboarding persists');
select throws_ok($$ update public.profiles set role='student', study_year=null where id='10000000-0000-0000-0000-000000000002' $$,'23514',null,'student requires study year');
select throws_ok($$ insert into public.staff_roles(user_id,role) values('10000000-0000-0000-0000-000000000002','admin') $$,'42501',null,'non-staff cannot grant self staff role');
select is((select count(*)::int from public.staff_roles where user_id='10000000-0000-0000-0000-000000000002'),0,'non-staff remains non-staff');
-- UPDATE of an invisible row affects zero rows under RLS; it does not throw.
select results_eq($$ update public.profiles set preferred_locale='en' where id='10000000-0000-0000-0000-000000000001' returning id $$,$$ select null::uuid where false $$,'user cannot update another profile');
reset role;
select is((select preferred_locale::text from public.profiles where id='10000000-0000-0000-0000-000000000001'),'ar','other profile is unchanged');

select * from finish();
rollback;
