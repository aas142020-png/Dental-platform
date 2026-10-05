-- Stable error reasons: real failures carry HINT 'reason:<code>', independent of message wording.
begin;
select plan(12);

do $$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c
            where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r','S') loop
    execute format('grant all on %s to public', r.t);
  end loop; end $$;

-- Runs a statement and returns the HINT of the error it raised (null if it succeeded).
create function pg_temp.reason_of(p_sql text) returns text language plpgsql as $$
declare h text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  return nullif(h, '');  -- Postgres reports a missing hint as ''
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alpha@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test.local');
insert into public.staff_roles (user_id, role)
select '00000000-0000-0000-0000-0000000000a1', r from unnest(enum_range(null::public.staff_role)) r;
insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'editor');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.specialties (slug, name, is_active) values ('reasons', '{"en": "R"}', true) returning id as spec_id \gset
insert into public.topics (specialty_id, slug, access_level, created_by)
values (:'spec_id', 'reasons', 'public', '00000000-0000-0000-0000-0000000000a1') returning id as topic_id \gset
select public.create_topic_draft(:'topic_id') as v1 \gset
update public.topic_versions set title = '{"ar": "ع", "en": "T"}' where id = :'v1';
insert into public.topic_blocks (topic_version_id, position, type, content)
values (:'v1', 0, 'text', '{"ar": {}, "en": {}, "shared": {}}') returning id as blk_id \gset
insert into public.sources (title, evidence_type, status) values ('S', 'textbook', 'active') returning id as src_id \gset
insert into public.claims (statement) values ('{"en": "C"}') returning id as clm_id \gset
insert into public.block_claims (block_id, claim_id) values (:'blk_id', :'clm_id');
insert into public.claim_sources (claim_id, source_id, locator, supporting_passage)
values (:'clm_id', :'src_id', 'p. 1', 'passage');

select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1')),
  'reason:claims_unverified', 'claims_unverified');
select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v1')),
  'reason:transition_not_allowed', 'transition_not_allowed');
select is(pg_temp.reason_of(format($$ select public.create_topic_draft(%L) $$, :'topic_id')),
  'reason:version_in_progress', 'version_in_progress');

reset role;
update public.editorial_policy set value = 'true' where key = 'four_eyes_review';
set local role authenticated;
select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'source_verified') $$, :'v1')),
  'reason:four_eyes', 'four_eyes');
reset role;
update public.editorial_policy set value = 'false' where key = 'four_eyes_review';
set local role authenticated;

update public.claim_sources set verified_at = now() where claim_id = :'clm_id';
select public.transition_content('topic_version', :'v1', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved']::public.content_status[]) s;
-- Block payloads are present in ar+en; remove en from the title to make en incomplete.
select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'draft') $$, :'v1')),
  'reason:note_required', 'note_required');
select is(pg_temp.reason_of(format($$ update public.topic_blocks set content = '{}' where id = %L $$, :'blk_id')),
  'reason:locked', 'locked (block of a non-draft version)');
select is(pg_temp.reason_of(format($$ update public.claims set statement = '{"en": "x"}' where id = %L $$, :'clm_id')),
  'reason:locked', 'locked (claim in use)');

-- Locale gate: an Arabic-only draft cannot publish under the AR+EN policy.
select public.transition_content('topic_version', :'v1', 'draft', 'edit title');
update public.topic_versions set title = '{"ar": "ع"}' where id = :'v1';
select public.transition_content('topic_version', :'v1', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved']::public.content_status[]) s;
select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v1')),
  'reason:locales_incomplete', 'locales_incomplete');

-- embedded_live: a question used by a live topic cannot be unpublished.
insert into public.questions (access_level) values ('public') returning id as q_id \gset
select public.create_question_draft(:'q_id') as qv \gset
update public.question_versions set stem = '{"ar": "س", "en": "Q"}',
  options = '[{"id":"a","text":{"ar":"أ","en":"A"},"correct":true},{"id":"b","text":{"ar":"ب","en":"B"},"correct":false}]' where id = :'qv';
insert into public.question_version_claims (question_version_id, claim_id) values (:'qv', :'clm_id');
select public.transition_content('question_version', :'qv', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved', 'published']::public.content_status[]) s;
insert into public.topics (specialty_id, slug, access_level) values (:'spec_id', 'host', 'public') returning id as host_id \gset
select public.create_topic_draft(:'host_id') as hv \gset
update public.topic_versions set title = '{"ar": "ع", "en": "T"}' where id = :'hv';
insert into public.topic_blocks (topic_version_id, position, type, content) values
  (:'hv', 0, 'quiz', jsonb_build_object('ar', '{}'::jsonb, 'en', '{}'::jsonb, 'shared', jsonb_build_object('question_ids', jsonb_build_array(:'q_id'))))
returning id as qblk \gset
insert into public.block_claims (block_id, claim_id) values (:'qblk', :'clm_id');
select public.transition_content('topic_version', :'hv', s)
  from unnest(array['source_verified', 'clinical_review', 'visual_review', 'approved', 'published']::public.content_status[]) s;
select is(pg_temp.reason_of(format($$ select public.transition_content('question_version', %L, 'archived', 'remove') $$, :'qv')),
  'reason:embedded_live', 'embedded_live');

-- role_required: an editor cannot perform the source-verification step.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select public.create_question_draft(:'q_id') as qv2 \gset
select is(pg_temp.reason_of(format($$ select public.transition_content('question_version', %L, 'source_verified') $$, :'qv2')),
  'reason:role_required', 'role_required');

-- sign_in_required: no session.
select set_config('request.jwt.claim.sub', '', true);
select is(pg_temp.reason_of(format($$ select public.transition_content('topic_version', %L, 'published') $$, :'v1')),
  'reason:sign_in_required', 'sign_in_required');

-- RLS denials are not workflow rules: no reason hint.
select is(pg_temp.reason_of($$ insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'admin') $$),
  null, 'RLS violations carry no reason (mapped by SQLSTATE instead)');

reset role;
select * from finish();
rollback;
