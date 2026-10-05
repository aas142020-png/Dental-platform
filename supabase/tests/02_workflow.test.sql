-- Editorial workflow, immutability, evidence, locales, access levels. Run: supabase test db
-- Uses a non-clinical test specialty and placeholder text; rolled back at the end.
begin;
select plan(38);

do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
            where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public', r.t);
  end loop; end $$;

-- Users: alpha holds all five roles (Alpha setup); editor holds editor only; one learner.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alpha@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'learner@test.local');
insert into public.staff_roles (user_id, role)
select '00000000-0000-0000-0000-0000000000a1', r from unnest(enum_range(null::public.staff_role)) r;
insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'editor');

---------------------------------------------------------------- fixture, as alpha
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.specialties (slug, name, is_active)
values ('test-specialty', '{"ar": "اختبار", "en": "Test"}', true) returning id as spec_id \gset
insert into public.topics (specialty_id, slug, access_level, created_by)
values (:'spec_id', 'demo', 'authenticated', '00000000-0000-0000-0000-0000000000a1') returning id as topic_id \gset
select public.create_topic_draft(:'topic_id') as v1 \gset
update public.topic_versions set title = '{"ar": "عنوان", "en": "Title"}' where id = :'v1';
insert into public.topic_blocks (topic_version_id, position, type, content)
values (:'v1', 0, 'text', '{"ar": {"body": "نص {claim:c1}"}, "en": {"body": "Text {claim:c1}"}, "shared": {}}')
returning id as blk_id \gset

select throws_ok(format($$ update public.topic_versions set status = 'published' where id = %L $$, :'v1'),
  '42501', 'status changes only through transition_content()', 'direct status update is rejected');
select throws_like(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1'),
  '%no clinical claims%', 'source verification needs at least one claim');

insert into public.sources (title, organization, evidence_type, status, created_by)
values ('Placeholder source', 'Test Org', 'textbook', 'active', '00000000-0000-0000-0000-0000000000a1')
returning id as src_id \gset
insert into public.claims (statement, created_by)
values ('{"ar": "ادعاء", "en": "Claim"}', '00000000-0000-0000-0000-0000000000a1') returning id as clm_id \gset
insert into public.block_claims (block_id, claim_id, anchor) values (:'blk_id', :'clm_id', 'c1');
insert into public.claim_sources (claim_id, source_id, locator, supporting_passage, created_by)
values (:'clm_id', :'src_id', 'p. 1', 'exact passage', '00000000-0000-0000-0000-0000000000a1');

select throws_like(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1'),
  '%lack a verified link%', 'unverified source link blocks source verification');

---------------------------------------------------------------- editor-only user
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select throws_ok(format($$ update public.claim_sources set verified_at = now() where claim_id = %L $$, :'clm_id'),
  '42501', null, 'editor cannot verify a source link');
select throws_ok(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1'),
  '42501', null, 'editor cannot perform the source-verification step');

---------------------------------------------------------------- alpha moves it through
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lives_ok(format($$ update public.claim_sources set verified_at = now() where claim_id = %L $$, :'clm_id'),
  'source verifier verifies the link');
select is((select verified_by from public.claim_sources where claim_id = :'clm_id'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'verified_by is stamped from the session');
select lives_ok(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1'),
  'draft -> source_verified');

select throws_ok(format($$ update public.topic_blocks set content = '{}' where id = %L $$, :'blk_id'),
  '42501', null, 'blocks are locked after draft');
select throws_ok(format($$ update public.claims set statement = '{"en": "changed"}' where id = %L $$, :'clm_id'),
  '42501', null, 'claims used by non-draft content are locked');
select throws_ok(format($$ update public.claim_sources set supporting_passage = 'other' where claim_id = %L $$, :'clm_id'),
  '42501', null, 'source links of locked claims are locked');
select throws_like(format($$ select public.transition_content('topic_version', %L, 'draft') $$, :'v1'),
  '%note is required%', 'returning to draft requires a reason');

select lives_ok(format($$ select public.transition_content('topic_version', %L, 'clinical_review') $$, :'v1'), '-> clinical_review');
select lives_ok(format($$ select public.transition_content('topic_version', %L, 'visual_review') $$, :'v1'), '-> visual_review');
select lives_ok(format($$ select public.transition_content('topic_version', %L, 'approved') $$, :'v1'), '-> approved');
select lives_ok(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v1'), '-> published');

select is((select published_version_id from public.topics where id = :'topic_id'), :'v1'::uuid,
  'topic points to the published version');
select is((select array_agg(locale order by locale)::text from public.topic_version_locales where topic_version_id = :'v1'),
  '{ar,en}', 'both complete locales go live');
select is((select count(*) from public.workflow_events where entity_id = :'v1'), 5::bigint,
  'every transition is logged');
select throws_like(format($$ select public.transition_content('topic_version', %L, 'draft', 'x') $$, :'v1'),
  '%not allowed%', 'a published version cannot return to draft');
select throws_ok(format($$ update public.topic_versions set title = '{"en": "x"}' where id = %L $$, :'v1'),
  '42501', null, 'a published version is immutable');

---------------------------------------------------------------- learner reads it
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(jsonb_array_length(public.get_topic_bundle('test-specialty', 'demo') -> 'blocks'), 1,
  'learner receives the published blocks');
select is(public.get_topic_bundle('test-specialty', 'demo') -> 'claims' -> (:'clm_id') -> 'links' -> 0 ->> 'passage',
  'exact passage', 'learner receives the exact supporting passage');
select is((select count(*) from public.v_topic_catalog where topic_slug = 'demo'), 1::bigint,
  'topic appears in the catalog');

---------------------------------------------------------------- anon: authenticated-level topic
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((public.get_topic_bundle('test-specialty', 'demo') ->> 'can_read')::boolean, false,
  'anon: authenticated topic is listed but not readable');
select is(jsonb_array_length(public.get_topic_bundle('test-specialty', 'demo') -> 'blocks'), 0,
  'anon: no blocks returned');
select is((select count(*) from public.claims), 0::bigint, 'anon: claims of unreadable topics hidden');

---------------------------------------------------------------- premium is reserved
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update public.topics set access_level = 'premium' where id = :'topic_id';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((public.get_topic_bundle('test-specialty', 'demo') ->> 'can_read')::boolean, false,
  'premium: listed but not readable without entitlement');

---------------------------------------------------------------- draft-on-edit, policies
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update public.topics set access_level = 'public' where id = :'topic_id';
select public.create_topic_draft(:'topic_id', 'revision') as v2 \gset
select is((select count(*) from public.block_claims bc join public.topic_blocks b on b.id = bc.block_id
            where b.topic_version_id = :'v2'), 1::bigint, 'new draft copies blocks and claim links');
select throws_like(format($$ select public.create_topic_draft(%L) $$, :'topic_id'),
  '%already has a version in progress%', 'only one version in progress per topic');

reset role;
update public.editorial_policy set value = 'true' where key = 'four_eyes_review';
set local role authenticated;
select throws_like(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v2'),
  '%four-eyes%', 'four-eyes policy blocks self-review when enabled');
reset role;
update public.editorial_policy set value = 'false' where key = 'four_eyes_review';

-- Arabic-only revision; editorial policy changed to require Arabic only.
update public.editorial_policy set value = '["ar"]' where key = 'required_publish_locales';
set local role authenticated;
update public.topic_blocks set content = content - 'en' where topic_version_id = :'v2';
select public.transition_content('topic_version', :'v2', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved', 'published']::public.content_status[]) s;

select is((select status::text from public.topic_versions where id = :'v1'), 'archived', 'previous version archived');
select is((select published_version_id from public.topics where id = :'topic_id'), :'v2'::uuid, 'pointer moved to v2');
select is((select array_agg(locale)::text from public.topic_version_locales where topic_version_id = :'v2' and is_published),
  '{ar}', 'locales publish independently under policy');

-- Back to AR+EN policy: an Arabic-only version can no longer publish.
reset role;
update public.editorial_policy set value = '["ar","en"]' where key = 'required_publish_locales';
set local role authenticated;
select public.create_topic_draft(:'topic_id') as v3 \gset
select public.transition_content('topic_version', :'v3', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved']::public.content_status[]) s;
select throws_like(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v3'),
  '%required locales incomplete%', 'publishing blocked when a required locale is missing');

---------------------------------------------------------------- anon reads a public topic
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(jsonb_array_length(public.get_topic_bundle('test-specialty', 'demo') -> 'blocks'), 1,
  'anon: public topic is readable');

---------------------------------------------------------------- no human session = no workflow
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v3'),
  '42501', null, 'service role / background job cannot transition content');
select throws_ok(format($$ update public.topic_versions set status = 'published' where id = %L $$, :'v3'),
  '42501', null, 'service role cannot bypass the status guard');

reset role;
select * from finish();
rollback;
