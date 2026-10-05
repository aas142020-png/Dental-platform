-- 0011 · RPCs shared by web and future mobile clients

------------------------------------------------------------------------------
-- Topic bundle: one request returns everything needed to render a topic.
-- Runs as the caller (security invoker), so RLS decides what is included.
------------------------------------------------------------------------------
create or replace function private.build_version_bundle(p_version_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_version public.topic_versions%rowtype;
  v_topic   public.topics%rowtype;
  v_can     boolean;
  v_blocks  jsonb := '[]';
  v_claims  jsonb := '{}';
  v_sources jsonb := '{}';
  v_qs      jsonb := '{}';
  v_cases   jsonb := '{}';
  v_media   jsonb := '{}';
begin
  select * into v_version from public.topic_versions where id = p_version_id;
  if not found then return null; end if;
  select * into v_topic from public.topics where id = v_version.topic_id;
  v_can := private.can_read_access_level(v_topic.access_level);

  if v_can then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', b.id, 'position', b.position, 'type', b.type,
             'schema_version', b.schema_version, 'content', b.content,
             'claims', coalesce((select jsonb_agg(jsonb_build_object('claim_id', bc.claim_id, 'anchor', bc.anchor))
                                   from public.block_claims bc where bc.block_id = b.id), '[]'))
             order by b.position), '[]')
      into v_blocks
      from public.topic_blocks b where b.topic_version_id = p_version_id;

    select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
             'statement', c.statement,
             'links', coalesce((select jsonb_agg(jsonb_build_object(
                         'source_id', cs.source_id, 'locator', cs.locator,
                         'passage', cs.supporting_passage, 'support', cs.support,
                         'verified_at', cs.verified_at) order by cs.source_id, cs.locator)
                         from public.claim_sources cs where cs.claim_id = c.id), '[]'))), '{}')
      into v_claims
      from public.claims c
     where c.id in (select bc.claim_id from public.block_claims bc
                      join public.topic_blocks b on b.id = bc.block_id
                     where b.topic_version_id = p_version_id);

    select coalesce(jsonb_object_agg(s.id, jsonb_build_object(
             'title', s.title, 'organization', s.organization, 'authors', s.authors,
             'url', s.url, 'doi', s.doi, 'publication_date', s.publication_date,
             'version_label', s.version_label, 'evidence_type', s.evidence_type,
             'status', s.status, 'last_reviewed_at', s.last_reviewed_at)), '{}')
      into v_sources
      from public.sources s
     where s.id in (select cs.source_id from public.claim_sources cs
                     join public.block_claims bc on bc.claim_id = cs.claim_id
                     join public.topic_blocks b on b.id = bc.block_id
                    where b.topic_version_id = p_version_id);

    -- Embedded questions/cases are referenced by stable identity id and resolve to the LIVE version.
    -- Editing a question creates a new draft version and does not change what learners see here.
    -- Staff previewing content that embeds a never-published item see its in-progress version.
    select coalesce(jsonb_object_agg(q.id, jsonb_build_object(
             'version_id', qv.id, 'version_no', qv.version_no, 'status', qv.status,
             'kind', qv.kind, 'stem', qv.stem, 'options', qv.options,
             'explanation', qv.explanation, 'difficulty', qv.difficulty,
             'available_locales', coalesce((select jsonb_agg(l.locale order by l.locale)
                                              from public.question_version_locales l
                                             where l.question_version_id = qv.id and l.is_published), '[]'))), '{}')
      into v_qs
      from public.questions q
      join public.question_versions qv on qv.id = coalesce(
             q.published_version_id,
             (select w.id from public.question_versions w
               where w.question_id = q.id and w.status not in ('published', 'archived') and private.is_staff()))
     where q.id::text in (select j #>> '{}' from public.topic_blocks b,
                            jsonb_path_query(b.content, 'lax $.shared.question_ids[*]') j
                           where b.topic_version_id = p_version_id and b.type = 'quiz');

    select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
             'version_id', cv.id, 'version_no', cv.version_no, 'status', cv.status,
             'title', cv.title, 'content', cv.content,
             'available_locales', coalesce((select jsonb_agg(l.locale order by l.locale)
                                              from public.case_version_locales l
                                             where l.case_version_id = cv.id and l.is_published), '[]'))), '{}')
      into v_cases
      from public.cases c
      join public.case_versions cv on cv.id = coalesce(
             c.published_version_id,
             (select w.id from public.case_versions w
               where w.case_id = c.id and w.status not in ('published', 'archived') and private.is_staff()))
     where c.id::text in (select j #>> '{}' from public.topic_blocks b,
                            jsonb_path_query(b.content, 'lax $.shared.case_id') j
                           where b.topic_version_id = p_version_id and b.type = 'clinical_case');

    select coalesce(jsonb_object_agg(m.id, jsonb_build_object(
             'bucket', m.bucket, 'path', m.storage_path, 'kind', m.kind, 'mime_type', m.mime_type,
             'width', m.width, 'height', m.height, 'alt', m.alt, 'caption', m.caption, 'credit', m.credit)), '{}')
      into v_media
      from public.media_assets m
     where m.id in (select private.version_asset_ids(p_version_id));
  end if;

  return jsonb_build_object(
    'topic', jsonb_build_object('id', v_topic.id, 'slug', v_topic.slug, 'access_level', v_topic.access_level),
    'version', jsonb_build_object('id', v_version.id, 'version_no', v_version.version_no,
                                  'status', v_version.status, 'title', v_version.title,
                                  'subtitle', v_version.subtitle, 'est_minutes', v_version.est_minutes,
                                  'published_at', v_version.published_at),
    'available_locales', coalesce((select jsonb_agg(l.locale order by l.locale) from public.topic_version_locales l
                                    where l.topic_version_id = p_version_id and l.is_published), '[]'),
    'can_read', v_can,
    'blocks', v_blocks, 'claims', v_claims, 'sources', v_sources,
    'questions', v_qs, 'cases', v_cases, 'media', v_media);
end $$;
grant execute on function private.build_version_bundle(uuid) to anon, authenticated, service_role;

-- Published topic for learners. Returns null when the topic is not listed for this caller.
create or replace function public.get_topic_bundle(p_specialty_slug text, p_topic_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.build_version_bundle(t.published_version_id)
    from public.topics t join public.specialties s on s.id = t.specialty_id
   where s.slug = p_specialty_slug and t.slug = p_topic_slug
     and private.topic_is_listed(t.id);
$$;

-- Any version, for staff preview. RLS hides unpublished versions from non-staff.
create or replace function public.get_version_bundle(p_version_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception using errcode = '42501', message = 'staff only',
                                             hint = 'reason:role_required';
  end if;
  return private.build_version_bundle(p_version_id);
end $$;
revoke execute on function public.get_version_bundle(uuid) from anon;

------------------------------------------------------------------------------
-- Draft-on-edit: open a new draft version from the published (or latest) one
------------------------------------------------------------------------------
create or replace function public.create_topic_draft(p_topic_id uuid, p_change_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_base   public.topic_versions%rowtype;
  v_new_id uuid;
  v_next   int;
  r        record;
  v_block  uuid;
begin
  if not private.has_role('editor') then
    raise exception using errcode = '42501', message = 'editor role required',
                                             hint = 'reason:role_required';
  end if;
  if exists (select 1 from public.topic_versions
              where topic_id = p_topic_id and status not in ('published', 'archived')) then
    raise exception using errcode = 'P0001', message = 'this topic already has a version in progress',
                                             hint = 'reason:version_in_progress';
  end if;

  select * into v_base from public.topic_versions v
   where v.id = (select published_version_id from public.topics where id = p_topic_id);
  if not found then
    select * into v_base from public.topic_versions where topic_id = p_topic_id
     order by version_no desc limit 1;
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next from public.topic_versions where topic_id = p_topic_id;

  insert into public.topic_versions (topic_id, version_no, title, subtitle, est_minutes, origin, change_note, based_on_id, created_by)
  values (p_topic_id, v_next,
          coalesce(v_base.title, '{}'), coalesce(v_base.subtitle, '{}'), v_base.est_minutes,
          coalesce(v_base.origin, 'human'), p_change_note, v_base.id, auth.uid())
  returning id into v_new_id;

  if v_base.id is not null then
    for r in select * from public.topic_blocks where topic_version_id = v_base.id order by position loop
      insert into public.topic_blocks (topic_version_id, position, type, schema_version, content, origin)
      values (v_new_id, r.position, r.type, r.schema_version, r.content, r.origin)
      returning id into v_block;
      insert into public.block_claims (block_id, claim_id, anchor)
      select v_block, claim_id, anchor from public.block_claims where block_id = r.id;
    end loop;
  end if;
  return v_new_id;
end $$;
revoke execute on function public.create_topic_draft(uuid, text) from public, anon;
grant execute on function public.create_topic_draft(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Draft-on-edit for questions and cases. Same rules as topics:
-- one version in progress; copy from the live version (or latest); claim links copied.
------------------------------------------------------------------------------
create or replace function public.create_question_draft(p_question_id uuid, p_change_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_base   public.question_versions%rowtype;
  v_new_id uuid;
begin
  if not private.has_role('editor') then
    raise exception using errcode = '42501', message = 'editor role required',
                                             hint = 'reason:role_required';
  end if;
  if exists (select 1 from public.question_versions
              where question_id = p_question_id and status not in ('published', 'archived')) then
    raise exception using errcode = 'P0001', message = 'this question already has a version in progress',
                                             hint = 'reason:version_in_progress';
  end if;

  select * into v_base from public.question_versions
   where id = (select published_version_id from public.questions where id = p_question_id);
  if not found then
    select * into v_base from public.question_versions where question_id = p_question_id
     order by version_no desc limit 1;
  end if;

  insert into public.question_versions
    (question_id, version_no, kind, stem, options, explanation, difficulty, origin, change_note, based_on_id, created_by)
  values (p_question_id,
          (select coalesce(max(version_no), 0) + 1 from public.question_versions where question_id = p_question_id),
          coalesce(v_base.kind, 'single_choice'), coalesce(v_base.stem, '{}'), coalesce(v_base.options, '[]'),
          coalesce(v_base.explanation, '{}'), v_base.difficulty, coalesce(v_base.origin, 'human'),
          p_change_note, v_base.id, auth.uid())
  returning id into v_new_id;

  if v_base.id is not null then
    insert into public.question_version_claims (question_version_id, claim_id)
    select v_new_id, claim_id from public.question_version_claims where question_version_id = v_base.id;
  end if;
  return v_new_id;
end $$;
revoke execute on function public.create_question_draft(uuid, text) from public, anon;
grant execute on function public.create_question_draft(uuid, text) to authenticated;

create or replace function public.create_case_draft(p_case_id uuid, p_change_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_base   public.case_versions%rowtype;
  v_new_id uuid;
begin
  if not private.has_role('editor') then
    raise exception using errcode = '42501', message = 'editor role required',
                                             hint = 'reason:role_required';
  end if;
  if exists (select 1 from public.case_versions
              where case_id = p_case_id and status not in ('published', 'archived')) then
    raise exception using errcode = 'P0001', message = 'this case already has a version in progress',
                                             hint = 'reason:version_in_progress';
  end if;

  select * into v_base from public.case_versions
   where id = (select published_version_id from public.cases where id = p_case_id);
  if not found then
    select * into v_base from public.case_versions where case_id = p_case_id
     order by version_no desc limit 1;
  end if;

  insert into public.case_versions (case_id, version_no, title, content, origin, change_note, based_on_id, created_by)
  values (p_case_id,
          (select coalesce(max(version_no), 0) + 1 from public.case_versions where case_id = p_case_id),
          coalesce(v_base.title, '{}'), coalesce(v_base.content, '{}'), coalesce(v_base.origin, 'human'),
          p_change_note, v_base.id, auth.uid())
  returning id into v_new_id;

  if v_base.id is not null then
    insert into public.case_version_claims (case_version_id, claim_id)
    select v_new_id, claim_id from public.case_version_claims where case_version_id = v_base.id;
  end if;
  return v_new_id;
end $$;
revoke execute on function public.create_case_draft(uuid, text) from public, anon;
grant execute on function public.create_case_draft(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Reorder blocks of a draft version. p_block_ids must list every block exactly once.
------------------------------------------------------------------------------
create or replace function public.reorder_blocks(p_version_id uuid, p_block_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.has_role('editor') then
    raise exception using errcode = '42501', message = 'editor role required',
                                             hint = 'reason:role_required';
  end if;
  if (select array_agg(id order by id) from public.topic_blocks where topic_version_id = p_version_id)
     is distinct from (select array_agg(x order by x) from unnest(p_block_ids) x) then
    raise exception using errcode = 'P0001', message = 'block list must contain every block of the version exactly once',
                                             hint = 'reason:block_list_mismatch';
  end if;
  update public.topic_blocks b
     set position = o.ord - 1
    from unnest(p_block_ids) with ordinality as o(id, ord)
   where b.id = o.id and b.topic_version_id = p_version_id;
end $$;
revoke execute on function public.reorder_blocks(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_blocks(uuid, uuid[]) to authenticated;

------------------------------------------------------------------------------
-- Learner progress. Percent only moves forward; completion is sticky.
------------------------------------------------------------------------------
create or replace function public.upsert_progress(
  p_topic_id uuid, p_percent smallint, p_last_block_id uuid default null, p_completed boolean default false
) returns public.user_progress language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_version uuid;
  v_row public.user_progress;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'sign in required',
                                             hint = 'reason:sign_in_required';
  end if;
  if not private.topic_is_readable(p_topic_id) then
    raise exception using errcode = '42501', message = 'topic not available',
                                             hint = 'reason:topic_unavailable';
  end if;
  select published_version_id into v_version from public.topics where id = p_topic_id;

  insert into public.user_progress as up (user_id, topic_id, topic_version_id, status, last_block_id, percent, completed_at)
  values (v_uid, p_topic_id, v_version,
          case when p_completed then 'completed' else 'in_progress' end,
          p_last_block_id, least(greatest(p_percent, 0), 100),
          case when p_completed then now() end)
  on conflict (user_id, topic_id) do update set
    topic_version_id = excluded.topic_version_id,
    last_block_id    = coalesce(excluded.last_block_id, up.last_block_id),
    percent          = greatest(up.percent, excluded.percent),
    status           = case when up.status = 'completed' or p_completed then 'completed' else 'in_progress' end,
    completed_at     = coalesce(up.completed_at, excluded.completed_at)
  returning * into v_row;
  return v_row;
end $$;
revoke execute on function public.upsert_progress(uuid, smallint, uuid, boolean) from public, anon;
grant execute on function public.upsert_progress(uuid, smallint, uuid, boolean) to authenticated;
