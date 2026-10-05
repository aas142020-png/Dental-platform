-- Questions and cases are versioned: editing published content creates a new draft version,
-- the live version keeps serving learners until the replacement is published,
-- and topics embed the stable identity id. Run: supabase test db
begin;
select plan(24);

do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
            where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public', r.t);
  end loop; end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alpha@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'learner@test.local');
insert into public.staff_roles (user_id, role)
select '00000000-0000-0000-0000-0000000000a1', r from unnest(enum_range(null::public.staff_role)) r;

---------------------------------------------------------------- fixture as alpha
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.specialties (slug, name, is_active)
values ('test-specialty', '{"ar": "اختبار", "en": "Test"}', true) returning id as spec_id \gset
insert into public.sources (title, evidence_type, status) values ('Placeholder source', 'textbook', 'active')
returning id as src_id \gset
insert into public.claims (statement) values ('{"ar": "ادعاء", "en": "Claim"}') returning id as clm_id \gset
insert into public.claim_sources (claim_id, source_id, locator, supporting_passage)
values (:'clm_id', :'src_id', 'p. 1', 'exact passage');
update public.claim_sources set verified_at = now() where claim_id = :'clm_id';

-- Question v1, published
insert into public.questions (access_level) values ('public') returning id as q_id \gset
select public.create_question_draft(:'q_id') as qv1 \gset
update public.question_versions
   set stem = '{"ar": "سؤال ١", "en": "Question v1"}',
       options = '[{"id":"a","text":{"ar":"أ","en":"A"},"correct":true},{"id":"b","text":{"ar":"ب","en":"B"},"correct":false}]'
 where id = :'qv1';
insert into public.question_version_claims (question_version_id, claim_id) values (:'qv1', :'clm_id');
select public.transition_content('question_version', :'qv1', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s;

-- Case v1, published
insert into public.cases (specialty_id, slug, access_level) values (:'spec_id', 'case-demo', 'public')
returning id as c_id \gset
select public.create_case_draft(:'c_id') as cv1 \gset
update public.case_versions
   set title = '{"ar": "حالة ١", "en": "Case v1"}',
       content = '{"ar": {"stages": []}, "en": {"stages": []}, "shared": {}}'
 where id = :'cv1';
insert into public.case_version_claims (case_version_id, claim_id) values (:'cv1', :'clm_id');
select public.transition_content('case_version', :'cv1', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s;

-- Topic embedding both by identity id, published
insert into public.topics (specialty_id, slug, access_level) values (:'spec_id', 'embed-demo', 'public')
returning id as topic_id \gset
select public.create_topic_draft(:'topic_id') as tv1 \gset
update public.topic_versions set title = '{"ar": "عنوان", "en": "Title"}' where id = :'tv1';
insert into public.topic_blocks (topic_version_id, position, type, content) values
  (:'tv1', 0, 'text', '{"ar": {"body": "نص"}, "en": {"body": "Text"}, "shared": {}}'),
  (:'tv1', 1, 'quiz', jsonb_build_object('ar', '{}'::jsonb, 'en', '{}'::jsonb,
                                         'shared', jsonb_build_object('question_ids', jsonb_build_array(:'q_id')))),
  (:'tv1', 2, 'clinical_case', jsonb_build_object('ar', '{}'::jsonb, 'en', '{}'::jsonb,
                                                  'shared', jsonb_build_object('case_id', :'c_id')));
insert into public.block_claims (block_id, claim_id)
select id, :'clm_id' from public.topic_blocks where topic_version_id = :'tv1' and position = 0;
select public.transition_content('topic_version', :'tv1', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s;

---------------------------------------------------------------- baseline
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.get_topic_bundle('test-specialty', 'embed-demo') -> 'questions' -> (:'q_id') ->> 'version_id',
  :'qv1', 'learner: embedded question resolves to its live version');
select is((select array_agg(locale order by locale)::text from public.question_version_locales
            where question_version_id = :'qv1' and is_published), '{ar,en}', 'question locales recorded per version');

---------------------------------------------------------------- editing a published question
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok(format($$ update public.question_versions set stem = '{"en": "x"}' where id = %L $$, :'qv1'),
  '42501', null, 'published question version is immutable');
select public.create_question_draft(:'q_id', 'reword') as qv2 \gset
select is((select count(*) from public.question_version_claims where question_version_id = :'qv2'), 1::bigint,
  'question draft copies claim links');
select lives_ok(format($$ update public.question_versions
                          set stem = '{"ar": "سؤال ٢", "en": "Question v2"}' where id = %L $$, :'qv2'),
  'question draft is editable');
select throws_like(format($$ select public.create_question_draft(%L) $$, :'q_id'),
  '%already has a version in progress%', 'one question version in progress at a time');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.get_topic_bundle('test-specialty', 'embed-demo') -> 'questions' -> (:'q_id') -> 'stem' ->> 'en',
  'Question v1', 'learner: published topic still shows question v1 while v2 is drafted');
select is((select count(*) from public.question_versions where question_id = :'q_id'), 1::bigint,
  'learner: cannot see the draft question version');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_like(format($$ select public.transition_content('question_version', %L, 'archived', 'remove') $$, :'qv1'),
  '%embedded in 1 published topic%', 'cannot unpublish a question embedded in a live topic');

select lives_ok(format($$ select public.transition_content('question_version', %L, s)
                          from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s $$,
                       :'qv2'),
  'question v2 goes through the full workflow');
select is((select status::text from public.question_versions where id = :'qv1'), 'archived', 'question v1 superseded');
select is((select published_version_id from public.questions where id = :'q_id'), :'qv2'::uuid,
  'question identity points to v2');
select is((select count(*) from public.workflow_events where entity_type = 'question_version' and entity_id = :'qv1'),
  6::bigint, 'question v1 audit trail: five steps + superseded');
select throws_like(format($$ select public.transition_content('question_version', %L, 'draft', 'reopen') $$, :'qv1'),
  '%not allowed%', 'archived question versions cannot be reopened');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.get_topic_bundle('test-specialty', 'embed-demo') -> 'questions' -> (:'q_id') -> 'stem' ->> 'en',
  'Question v2', 'learner: topic shows question v2 once published');
select is((select published_version_id from public.topics where id = :'topic_id'), :'tv1'::uuid,
  'topic version unchanged by question publication');

---------------------------------------------------------------- editing a published case
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok(format($$ update public.case_versions set title = '{"en": "x"}' where id = %L $$, :'cv1'),
  '42501', null, 'published case version is immutable');
select public.create_case_draft(:'c_id') as cv2 \gset
select lives_ok(format($$ update public.case_versions set title = '{"ar": "حالة ٢", "en": "Case v2"}' where id = %L $$, :'cv2'),
  'case draft is editable');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.get_topic_bundle('test-specialty', 'embed-demo') -> 'cases' -> (:'c_id') -> 'title' ->> 'en',
  'Case v1', 'learner: published topic still shows case v1 while v2 is drafted');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_like(format($$ select public.transition_content('case_version', %L, 'archived', 'remove') $$, :'cv1'),
  '%embedded in 1 published topic%', 'cannot unpublish a case embedded in a live topic');
select lives_ok(format($$ select public.transition_content('case_version', %L, s)
                          from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s $$,
                       :'cv2'),
  'case v2 goes through the full workflow');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.get_topic_bundle('test-specialty', 'embed-demo') -> 'cases' -> (:'c_id') -> 'title' ->> 'en',
  'Case v2', 'learner: topic shows case v2 once published');

---------------------------------------------------------------- topic cannot embed a never-published question
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.questions (access_level) values ('public') returning id as q2_id \gset
select public.create_question_draft(:'q2_id') as q2v1 \gset
select public.create_topic_draft(:'topic_id') as tv2 \gset
insert into public.topic_blocks (topic_version_id, position, type, content)
values (:'tv2', 3, 'quiz', jsonb_build_object('ar', '{}'::jsonb, 'en', '{}'::jsonb,
                                              'shared', jsonb_build_object('question_ids', jsonb_build_array(:'q2_id'))));
select public.transition_content('topic_version', :'tv2', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved']::public.content_status[]) s;
select throws_like(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'tv2'),
  '%have no published version%', 'topic cannot go live embedding a question with no published version');
select is(public.get_version_bundle(:'tv2') -> 'questions' -> (:'q2_id') ->> 'status', 'draft',
  'staff preview shows the in-progress version of a never-published embed');

reset role;
select * from finish();
rollback;
