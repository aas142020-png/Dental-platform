-- Source retraction review: no automatic unpublishing; severity graded by remaining active direct support.
begin;
select plan(13);

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

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.specialties (slug, name, is_active)
values ('test-specialty', '{"ar": "اختبار", "en": "Test"}', true) returning id as spec_id \gset

-- Sources
insert into public.sources (title, evidence_type, status) values ('Source A', 'clinical_guideline', 'active') returning id as a_id \gset
insert into public.sources (title, evidence_type, status) values ('Source B', 'systematic_review', 'active') returning id as b_id \gset
insert into public.sources (title, evidence_type, status) values ('Source C', 'rct', 'active') returning id as c_id \gset
insert into public.sources (title, evidence_type, status) values ('Source D', 'textbook', 'active') returning id as d_id \gset
insert into public.sources (title, evidence_type, status) values ('Source E', 'cohort', 'active') returning id as e_id \gset

-- Claim X: two direct sources (A, B). Claim Y: sole direct source C. Claim Z: sole direct source D.
-- Claim W: source E, used only by draft content.
insert into public.claims (statement) values ('{"en": "Claim X"}') returning id as x_id \gset
insert into public.claims (statement) values ('{"en": "Claim Y"}') returning id as y_id \gset
insert into public.claims (statement) values ('{"en": "Claim Z"}') returning id as z_id \gset
insert into public.claims (statement) values ('{"en": "Claim W"}') returning id as w_id \gset
insert into public.claim_sources (claim_id, source_id, locator, supporting_passage, support) values
  (:'x_id', :'a_id', 'p. 1', 'passage A', 'direct'),
  (:'x_id', :'b_id', 'p. 2', 'passage B', 'direct'),
  (:'y_id', :'c_id', 'p. 3', 'passage C', 'direct'),
  (:'z_id', :'d_id', 'p. 4', 'passage D', 'direct'),
  (:'w_id', :'e_id', 'p. 5', 'passage E', 'direct');
update public.claim_sources set verified_at = now();

-- Published topic using X, Y, Z
insert into public.topics (specialty_id, slug, access_level) values (:'spec_id', 'impact-demo', 'public')
returning id as topic_id \gset
select public.create_topic_draft(:'topic_id') as tv \gset
update public.topic_versions set title = '{"ar": "عنوان", "en": "Title"}' where id = :'tv';
insert into public.topic_blocks (topic_version_id, position, type, content)
select :'tv', g, 'text', '{"ar": {"body": "نص"}, "en": {"body": "Text"}, "shared": {}}' from generate_series(0, 2) g;
insert into public.block_claims (block_id, claim_id)
select b.id, (array[:'x_id', :'y_id', :'z_id']::uuid[])[b.position + 1]
  from public.topic_blocks b where b.topic_version_id = :'tv';
select public.transition_content('topic_version', :'tv', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s;

-- Published question also using Y
insert into public.questions (access_level) values ('public') returning id as q_id \gset
select public.create_question_draft(:'q_id') as qv \gset
update public.question_versions set stem = '{"ar": "س", "en": "Q"}',
       options = '[{"id":"a","text":{"ar":"أ","en":"A"},"correct":true}]' where id = :'qv';
insert into public.question_version_claims (question_version_id, claim_id) values (:'qv', :'y_id');
select public.transition_content('question_version', :'qv', s)
  from unnest(array['source_verified','clinical_review','visual_review','approved','published']::public.content_status[]) s;

-- Draft-only use of W
insert into public.questions (access_level) values ('public') returning id as q2_id \gset
select public.create_question_draft(:'q2_id') as q2v \gset
insert into public.question_version_claims (question_version_id, claim_id) values (:'q2v', :'w_id');

-- Events
update public.sources set status = 'retracted'  where id in (:'a_id', :'c_id', :'e_id');
update public.sources set status = 'superseded' where id = :'d_id';

---------------------------------------------------------------- severity
select is((select severity from public.v_source_impact where source_id = :'a_id' and claim_id = :'x_id'),
  'low', 'retracted source with another active verified direct source: flagged, not critical');
select is((select remaining_active_direct_support from public.v_source_impact where source_id = :'a_id' and claim_id = :'x_id'),
  1, 'remaining active direct support counted (source B)');
select is((select distinct severity from public.v_source_impact where source_id = :'c_id' and claim_id = :'y_id'),
  'critical', 'retracted sole direct source: critical');
select is((select distinct remaining_active_direct_support from public.v_source_impact where source_id = :'c_id'),
  0, 'no remaining active direct support for claim Y');
select is((select array_agg(content_type order by content_type)::text from public.v_source_impact where source_id = :'c_id'),
  '{question,topic}', 'impact lists every published content item using the claim');
select is((select content_ref from public.v_source_impact where source_id = :'c_id' and content_type = 'topic'),
  'impact-demo', 'impact identifies the affected topic');
select is((select severity from public.v_source_impact where source_id = :'d_id'),
  'high', 'superseded sole direct source: high, below critical');
select is((select count(*) from public.v_source_impact where source_id = :'e_id'), 0::bigint,
  'sources used only by draft content are not in the published-impact queue');

select is((select worst_severity from public.v_flagged_sources where source_id = :'c_id'), 'critical',
  'per-source summary: C is critical');
select is((select worst_severity from public.v_flagged_sources where source_id = :'a_id'), 'low',
  'per-source summary: A is low');
select is((select array_agg(source_title order by worst_severity_rank, source_title)::text from public.v_flagged_sources),
  '{"Source C","Source D","Source A"}', 'summary sorts critical, high, low');

---------------------------------------------------------------- no automatic unpublishing; staff only
select is((select published_version_id from public.topics where id = :'topic_id'), :'tv'::uuid,
  'retraction does not unpublish the topic');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*) from public.v_source_impact), 0::bigint, 'learners cannot see the impact queue');

reset role;
select * from finish();
rollback;
