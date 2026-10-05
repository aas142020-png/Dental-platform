-- 0008 · Editorial workflow: role helpers, policy, transitions, guards, immutability, transition_content()
--
-- ERROR REASON CONTRACT
-- Every application-relevant RAISE carries a machine-readable reason in HINT: 'reason:<code>'.
-- PostgREST returns it as the `hint` field; @dental/api-client maps it to ApiError.reason.
-- Messages are for humans and may change; reason codes are an API contract and must not.
-- Codes: sign_in_required, role_required, four_eyes, transition_not_allowed, note_required,
--        no_blocks, no_claims, claims_unverified, media_not_ready, locales_incomplete,
--        no_locale_complete, embeds_unpublished, embedded_live, version_in_progress, locked,
--        block_list_mismatch, not_found, invalid_entity_type, topic_unavailable.
-- The list is mirrored in packages/api-client/src/errors.ts and checked by a test that scans these files.

------------------------------------------------------------------------------
-- Role and policy helpers
------------------------------------------------------------------------------
create or replace function private.has_role(p_role public.staff_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role = p_role
  );
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()));
$$;

create or replace function private.policy_bool(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.editorial_policy where key = p_key), false);
$$;

create or replace function private.required_publish_locales()
returns public.locale_code[] language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select array_agg(l::public.locale_code)
       from public.editorial_policy p, jsonb_array_elements_text(p.value) l
      where p.key = 'required_publish_locales'),
    '{}'::public.locale_code[]);
$$;

create or replace function private.in_workflow()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.workflow', true), '') = 'on';
$$;

grant execute on function private.has_role(public.staff_role), private.is_staff()
  to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- Transition rules (configuration) and audit log
------------------------------------------------------------------------------
create table public.workflow_transitions (
  from_status    public.content_status not null,
  to_status      public.content_status not null,
  required_role  public.staff_role,              -- null = any staff role
  requires_note  boolean not null default false,
  is_review_step boolean not null default false, -- subject to four_eyes_review policy
  primary key (from_status, to_status)
);

insert into public.workflow_transitions (from_status, to_status, required_role, requires_note, is_review_step) values
  ('draft',           'source_verified', 'source_verifier',   false, true),
  ('source_verified', 'clinical_review', 'editor',            false, false),
  ('clinical_review', 'visual_review',   'clinical_reviewer', false, true),
  ('visual_review',   'approved',        'visual_reviewer',   false, true),
  ('approved',        'published',       'admin',             false, true),
  ('published',       'archived',        'admin',             true,  false),
  ('draft',           'archived',        'admin',             true,  false),
  -- Return for changes: any staff role, reason required
  ('source_verified', 'draft',           null,                true,  false),
  ('clinical_review', 'draft',           null,                true,  false),
  ('visual_review',   'draft',           null,                true,  false),
  ('approved',        'draft',           null,                true,  false);
-- No transition leaves 'archived': archived versions are immutable history. Edit = new draft version.

create table public.workflow_events (
  id          bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('topic_version', 'question_version', 'case_version')),
  entity_id   uuid not null,
  from_status public.content_status,
  to_status   public.content_status not null,
  actor_id    uuid references public.profiles (id),
  note        text,
  created_at  timestamptz not null default now()
);
create index workflow_events_entity_idx on public.workflow_events (entity_type, entity_id, created_at desc);

------------------------------------------------------------------------------
-- Guards: status and publication pointers change only inside transition_content()
------------------------------------------------------------------------------
create or replace function private.tg_guard_workflow_row()
returns trigger language plpgsql as $$
begin
  if private.in_workflow() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.published_at is not null then
      raise exception using errcode = '42501',
        message = format('%s must be created as draft; use transition_content()', tg_table_name),
        hint = 'reason:locked';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using errcode = '42501',
        message = format('%s in status %s cannot be deleted', tg_table_name, old.status),
        hint = 'reason:locked';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.status is distinct from old.status or new.published_at is distinct from old.published_at then
    raise exception using errcode = '42501',
      message = 'status changes only through transition_content()',
      hint = 'reason:locked';
  end if;
  if old.status <> 'draft' then
    raise exception using errcode = '42501',
      message = format('%s is locked in status %s; return it to draft or create a new draft version',
                       tg_table_name, old.status),
      hint = 'reason:locked';
  end if;
  return new;
end $$;

create trigger topic_versions_guard before insert or update or delete on public.topic_versions
  for each row execute function private.tg_guard_workflow_row();
create trigger question_versions_guard before insert or update or delete on public.question_versions
  for each row execute function private.tg_guard_workflow_row();
create trigger case_versions_guard before insert or update or delete on public.case_versions
  for each row execute function private.tg_guard_workflow_row();

-- A version's parent id and version_no never change. TG_ARGV[0] = parent id column.
create or replace function private.tg_version_identity()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) ->> tg_argv[0]) is distinct from (to_jsonb(old) ->> tg_argv[0])
     or new.version_no <> old.version_no then
    raise exception using message = format('%s and version_no are immutable', tg_argv[0]),
                          hint = 'reason:locked';
  end if;
  return new;
end $$;
create trigger topic_versions_identity before update on public.topic_versions
  for each row execute function private.tg_version_identity('topic_id');
create trigger question_versions_identity before update on public.question_versions
  for each row execute function private.tg_version_identity('question_id');
create trigger case_versions_identity before update on public.case_versions
  for each row execute function private.tg_version_identity('case_id');

-- Identity rows: published_version_id is written only by transition_content().
create or replace function private.tg_guard_published_pointer()
returns trigger language plpgsql as $$
begin
  if not private.in_workflow() then
    if tg_op = 'INSERT' and new.published_version_id is not null then
      raise exception using errcode = '42501', message = 'published_version_id is set only by transition_content()',
                                               hint = 'reason:locked';
    elsif tg_op = 'UPDATE' and new.published_version_id is distinct from old.published_version_id then
      raise exception using errcode = '42501', message = 'published_version_id is set only by transition_content()',
                                               hint = 'reason:locked';
    end if;
  end if;
  return new;
end $$;
create trigger topics_guard_pointer before insert or update on public.topics
  for each row execute function private.tg_guard_published_pointer();
create trigger questions_guard_pointer before insert or update on public.questions
  for each row execute function private.tg_guard_published_pointer();
create trigger cases_guard_pointer before insert or update on public.cases
  for each row execute function private.tg_guard_published_pointer();

------------------------------------------------------------------------------
-- Immutability of everything hanging off non-draft content
------------------------------------------------------------------------------
create or replace function private.version_status(p_version_id uuid)
returns public.content_status language sql stable security definer set search_path = '' as $$
  select status from public.topic_versions where id = p_version_id;
$$;

-- topic_blocks: editable only while their version is draft; never move between versions
create or replace function private.tg_guard_topic_blocks()
returns trigger language plpgsql as $$
declare v_version uuid := coalesce(new.topic_version_id, old.topic_version_id);
begin
  if tg_op = 'UPDATE' and new.topic_version_id <> old.topic_version_id then
    raise exception using message = 'blocks cannot move between versions',
                          hint = 'reason:locked';
  end if;
  -- A cascade from deleting a draft version passes: the version row is already gone (status null).
  if coalesce(private.version_status(v_version), 'draft') <> 'draft' then
    raise exception using errcode = '42501', message = 'blocks of a non-draft version are locked',
                                             hint = 'reason:locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger topic_blocks_guard before insert or update or delete on public.topic_blocks
  for each row execute function private.tg_guard_topic_blocks();

create or replace function private.tg_guard_block_claims()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.content_status;
begin
  select v.status into v_status
    from public.topic_blocks b join public.topic_versions v on v.id = b.topic_version_id
   where b.id = coalesce(new.block_id, old.block_id);
  if coalesce(v_status, 'draft') <> 'draft' then
    raise exception using errcode = '42501', message = 'claim links of a non-draft version are locked',
                                             hint = 'reason:locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger block_claims_guard before insert or update or delete on public.block_claims
  for each row execute function private.tg_guard_block_claims();

-- question_version_claims / case_version_claims follow their version's status
create or replace function private.tg_guard_child_of_workflow_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.content_status;
begin
  if tg_table_name = 'question_version_claims' then
    select status into v_status from public.question_versions
     where id = coalesce(new.question_version_id, old.question_version_id);
  else
    select status into v_status from public.case_versions
     where id = coalesce(new.case_version_id, old.case_version_id);
  end if;
  if coalesce(v_status, 'draft') <> 'draft' then
    raise exception using errcode = '42501', message = format('%s of non-draft content are locked', tg_table_name),
                                             hint = 'reason:locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger question_version_claims_guard before insert or update or delete on public.question_version_claims
  for each row execute function private.tg_guard_child_of_workflow_row();
create trigger case_version_claims_guard before insert or update or delete on public.case_version_claims
  for each row execute function private.tg_guard_child_of_workflow_row();

-- A claim is locked once any non-draft content references it. Changing it = new claim.
create or replace function private.claim_is_locked(p_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.block_claims bc
        join public.topic_blocks b on b.id = bc.block_id
        join public.topic_versions v on v.id = b.topic_version_id
       where bc.claim_id = p_claim_id and v.status <> 'draft')
    or exists (
      select 1 from public.question_version_claims qc join public.question_versions q on q.id = qc.question_version_id
       where qc.claim_id = p_claim_id and q.status <> 'draft')
    or exists (
      select 1 from public.case_version_claims cc join public.case_versions c on c.id = cc.case_version_id
       where cc.claim_id = p_claim_id and c.status <> 'draft');
$$;

create or replace function private.tg_guard_claims()
returns trigger language plpgsql as $$
begin
  if private.claim_is_locked(old.id) then
    raise exception using errcode = '42501',
      message = 'claim is used by content under review or published; create a new claim instead',
      hint = 'reason:locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger claims_guard before update or delete on public.claims
  for each row execute function private.tg_guard_claims();

-- claim_sources: locked with the claim; verification fields set only by a source verifier;
-- any change to passage, locator, source or support level clears verification.
create or replace function private.tg_guard_claim_sources()
returns trigger language plpgsql as $$
declare v_uid uuid := auth.uid();
begin
  if private.claim_is_locked(coalesce(new.claim_id, old.claim_id)) then
    raise exception using errcode = '42501',
      message = 'source links of a claim used by content under review or published are locked',
      hint = 'reason:locked';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and (new.supporting_passage, new.locator, new.source_id, new.support)
                         is distinct from (old.supporting_passage, old.locator, old.source_id, old.support)
     and new.verified_at is not distinct from old.verified_at then
    new.verified_at := null;
    new.verified_by := null;
  end if;

  if new.verified_at is not null
     and (tg_op = 'INSERT' or old.verified_at is null or new.verified_at is distinct from old.verified_at) then
    if v_uid is not null and not private.has_role('source_verifier') then
      raise exception using errcode = '42501', message = 'only a source verifier can verify a claim source',
                                               hint = 'reason:role_required';
    end if;
    if v_uid is not null and private.policy_bool('four_eyes_review')
       and v_uid = coalesce(new.created_by, old.created_by) then
      raise exception using errcode = '42501', message = 'four-eyes policy: verifier must differ from the person who added the source link',
                                               hint = 'reason:four_eyes';
    end if;
    new.verified_by := coalesce(v_uid, new.verified_by);
    new.verified_at := now();
  end if;
  return new;
end $$;
create trigger claim_sources_guard before insert or update or delete on public.claim_sources
  for each row execute function private.tg_guard_claim_sources();

-- Media: review status set only by visual reviewers; assets used by non-draft versions are locked.
create or replace function private.version_asset_ids(p_version_id uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct (j #>> '{}')::uuid
    from public.topic_blocks b,
         jsonb_path_query(b.content, 'lax $.**.asset_id') j
   where b.topic_version_id = p_version_id
     and (j #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function private.asset_is_locked(p_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.topic_versions v
     where v.status <> 'draft'
       and p_asset_id in (select private.version_asset_ids(v.id)));
$$;

create or replace function private.tg_guard_media()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if private.asset_is_locked(old.id) then
      raise exception using errcode = '42501', message = 'asset is used by content under review or published',
                                               hint = 'reason:locked';
    end if;
    return old;
  end if;

  if new.review_status is distinct from old.review_status then
    if auth.uid() is not null and not private.has_role('visual_reviewer') then
      raise exception using errcode = '42501', message = 'only a visual reviewer can change media review status',
                                               hint = 'reason:role_required';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  if (new.storage_path, new.bucket, new.kind, new.alt, new.caption)
     is distinct from (old.storage_path, old.bucket, old.kind, old.alt, old.caption)
     and private.asset_is_locked(old.id) then
    raise exception using errcode = '42501', message = 'asset is used by content under review or published; upload a new asset',
                                             hint = 'reason:locked';
  end if;
  return new;
end $$;
create trigger media_assets_guard before update or delete on public.media_assets
  for each row execute function private.tg_guard_media();

------------------------------------------------------------------------------
-- Readiness checks used by transition_content()
------------------------------------------------------------------------------
create or replace function private.nonblank(p jsonb, p_locale public.locale_code)
returns boolean language sql immutable as $$
  select coalesce(length(trim(p ->> p_locale::text)) > 0, false);
$$;

-- Locales in which an entity is complete enough to publish.
create or replace function private.complete_locales(p_entity_type text, p_entity_id uuid)
returns public.locale_code[] language plpgsql stable security definer set search_path = '' as $$
declare v_result public.locale_code[] := '{}';
        l public.locale_code;
        ok boolean;
begin
  foreach l in array enum_range(null::public.locale_code) loop
    if p_entity_type = 'topic_version' then
      select private.nonblank(v.title, l)
             and exists (select 1 from public.topic_blocks b where b.topic_version_id = v.id)
             and not exists (select 1 from public.topic_blocks b
                              where b.topic_version_id = v.id
                                and jsonb_typeof(b.content -> l::text) is distinct from 'object')
        into ok
        from public.topic_versions v where v.id = p_entity_id;
    elsif p_entity_type = 'question_version' then
      select private.nonblank(q.stem, l)
             and jsonb_array_length(q.options) > 0
             and not exists (select 1 from jsonb_array_elements(q.options) o
                              where not private.nonblank(o -> 'text', l))
        into ok
        from public.question_versions q where q.id = p_entity_id;
    elsif p_entity_type = 'case_version' then
      select private.nonblank(c.title, l) and jsonb_typeof(c.content -> l::text) = 'object'
        into ok
        from public.case_versions c where c.id = p_entity_id;
    end if;
    if coalesce(ok, false) then
      v_result := v_result || l;
    end if;
  end loop;
  return v_result;
end $$;

create or replace function private.entity_claim_ids(p_entity_type text, p_entity_id uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select bc.claim_id from public.block_claims bc
    join public.topic_blocks b on b.id = bc.block_id
   where p_entity_type = 'topic_version' and b.topic_version_id = p_entity_id
  union
  select claim_id from public.question_version_claims
   where p_entity_type = 'question_version' and question_version_id = p_entity_id
  union
  select claim_id from public.case_version_claims
   where p_entity_type = 'case_version' and case_version_id = p_entity_id;
$$;

create or replace function private.assert_claims_verified(p_entity_type text, p_entity_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_total int; v_unverified int;
begin
  if p_entity_type = 'topic_version'
     and not exists (select 1 from public.topic_blocks where topic_version_id = p_entity_id) then
    raise exception using errcode = 'P0001', message = 'version has no blocks',
                                             hint = 'reason:no_blocks';
  end if;

  select count(*) into v_total from private.entity_claim_ids(p_entity_type, p_entity_id);
  if v_total = 0 and private.policy_bool('require_claims_for_source_verification') then
    raise exception using errcode = 'P0001', message = 'no clinical claims are linked; link claims before source verification',
                                             hint = 'reason:no_claims';
  end if;

  select count(*) into v_unverified
    from private.entity_claim_ids(p_entity_type, p_entity_id) c(id)
   where not exists (
     select 1 from public.claim_sources cs join public.sources s on s.id = cs.source_id
      where cs.claim_id = c.id and cs.verified_at is not null and s.status = 'active');
  if v_unverified > 0 then
    raise exception using errcode = 'P0001',
      message = format('%s of %s claims lack a verified link to an active source', v_unverified, v_total),
      hint = 'reason:claims_unverified';
  end if;
end $$;

create or replace function private.assert_media_ready(p_version_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_missing int; v_bad int; v_required public.locale_code[] := private.required_publish_locales();
begin
  select count(*) into v_missing
    from private.version_asset_ids(p_version_id) a(id)
   where not exists (select 1 from public.media_assets m where m.id = a.id);
  if v_missing > 0 then
    raise exception using errcode = 'P0001', message = format('%s referenced media assets do not exist', v_missing),
                                             hint = 'reason:media_not_ready';
  end if;

  select count(*) into v_bad
    from public.media_assets m
   where m.id in (select private.version_asset_ids(p_version_id))
     and (m.review_status <> 'approved'
          or (private.policy_bool('require_alt_text') and m.kind in ('image', 'svg')
              and exists (select 1 from unnest(v_required) l where not private.nonblank(m.alt, l))));
  if v_bad > 0 then
    raise exception using errcode = 'P0001',
      message = format('%s media assets are not approved or lack alt text in a required locale', v_bad),
      hint = 'reason:media_not_ready';
  end if;
end $$;

-- Questions and cases embedded by quiz / clinical_case blocks must be live before the topic goes live.
create or replace function private.assert_embeds_published(p_version_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_bad int;
begin
  with refs as (
    select 'question' as t, (j #>> '{}') as id
      from public.topic_blocks b, jsonb_path_query(b.content, 'lax $.shared.question_ids[*]') j
     where b.topic_version_id = p_version_id and b.type = 'quiz'
    union all
    select 'case', (j #>> '{}')
      from public.topic_blocks b, jsonb_path_query(b.content, 'lax $.shared.case_id') j
     where b.topic_version_id = p_version_id and b.type = 'clinical_case'
  )
  -- Blocks embed the stable identity id; it must have a live (published) version.
  select count(*) into v_bad from refs r
   where not exists (select 1 from public.questions q
                      where r.t = 'question' and q.id::text = r.id and q.published_version_id is not null)
     and not exists (select 1 from public.cases c
                      where r.t = 'case' and c.id::text = r.id and c.published_version_id is not null);
  if v_bad > 0 then
    raise exception using errcode = 'P0001', message = format('%s embedded questions/cases have no published version', v_bad),
                                             hint = 'reason:embeds_unpublished';
  end if;
end $$;

-- Reverse guard: a question/case embedded by a live topic cannot be unpublished (only superseded).
create or replace function private.assert_not_embedded_live(p_entity_type text, p_identity_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_count int;
begin
  select count(*) into v_count
    from public.topic_blocks b join public.topic_versions v on v.id = b.topic_version_id
   where v.status = 'published'
     and ((p_entity_type = 'question_version' and b.type = 'quiz'
           and jsonb_path_exists(b.content, '$.shared.question_ids[*] ? (@ == $id)',
                                 jsonb_build_object('id', p_identity_id::text)))
       or (p_entity_type = 'case_version' and b.type = 'clinical_case'
           and jsonb_path_exists(b.content, '$.shared.case_id ? (@ == $id)',
                                 jsonb_build_object('id', p_identity_id::text))));
  if v_count > 0 then
    raise exception using errcode = 'P0001',
      message = format('embedded in %s published topic version(s); publish a replacement version instead of unpublishing', v_count),
      hint = 'reason:embedded_live';
  end if;
end $$;

------------------------------------------------------------------------------
-- transition_content(): the only way to change editorial status.
-- Works on versions: topic_version | question_version | case_version.
------------------------------------------------------------------------------
create or replace function public.transition_content(
  p_entity_type text,
  p_entity_id   uuid,
  p_to          public.content_status,
  p_note        text default null
) returns public.content_status
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_vtab       text;   -- version table
  v_ptab       text;   -- identity table
  v_pcol       text;   -- parent id column on the version table
  v_ltab       text;   -- locale table
  v_lcol       text := p_entity_type || '_id';
  v_from       public.content_status;
  v_author     uuid;
  v_parent_id  uuid;
  v_version_no int;
  v_live       uuid;
  v_rule       public.workflow_transitions%rowtype;
  v_required   public.locale_code[];
  v_complete   public.locale_code[];
  v_missing    public.locale_code[];
begin
  -- A human session is required. Service-role and background jobs cannot move content.
  if v_uid is null then
    raise exception using errcode = '42501', message = 'transition_content requires a signed-in staff user',
                                             hint = 'reason:sign_in_required';
  end if;

  case p_entity_type
    when 'topic_version'    then v_vtab := 'topic_versions';    v_ptab := 'topics';    v_pcol := 'topic_id';    v_ltab := 'topic_version_locales';
    when 'question_version' then v_vtab := 'question_versions'; v_ptab := 'questions'; v_pcol := 'question_id'; v_ltab := 'question_version_locales';
    when 'case_version'     then v_vtab := 'case_versions';     v_ptab := 'cases';     v_pcol := 'case_id';     v_ltab := 'case_version_locales';
    else raise exception using errcode = '22023', message = format('unknown entity type %s', p_entity_type),
                                                  hint = 'reason:invalid_entity_type';
  end case;

  execute format('select status, created_by, %I, version_no from public.%I where id = $1 for update', v_pcol, v_vtab)
     into v_from, v_author, v_parent_id, v_version_no using p_entity_id;
  if v_from is null then
    raise exception using errcode = 'P0002', message = format('%s %s not found', p_entity_type, p_entity_id),
                                             hint = 'reason:not_found';
  end if;

  select * into v_rule from public.workflow_transitions where from_status = v_from and to_status = p_to;
  if not found then
    raise exception using errcode = 'P0001', message = format('transition %s -> %s is not allowed', v_from, p_to),
                                             hint = 'reason:transition_not_allowed';
  end if;

  if v_rule.required_role is null then
    if not private.is_staff() then
      raise exception using errcode = '42501', message = 'staff role required',
                                               hint = 'reason:role_required';
    end if;
  elsif not private.has_role(v_rule.required_role) then
    raise exception using errcode = '42501', message = format('role %s required for %s -> %s', v_rule.required_role, v_from, p_to),
                                             hint = 'reason:role_required';
  end if;

  if v_rule.requires_note and coalesce(trim(p_note), '') = '' then
    raise exception using errcode = 'P0001', message = 'a note is required for this transition',
                                             hint = 'reason:note_required';
  end if;

  if v_rule.is_review_step and private.policy_bool('four_eyes_review') and v_uid = v_author then
    raise exception using errcode = '42501', message = 'four-eyes policy: the author cannot perform review steps',
                                             hint = 'reason:four_eyes';
  end if;

  -- Preconditions
  if p_to = 'source_verified' then
    perform private.assert_claims_verified(p_entity_type, p_entity_id);
  elsif p_to = 'approved' and p_entity_type = 'topic_version' then
    perform private.assert_media_ready(p_entity_id);
  elsif p_to = 'published' then
    v_required := private.required_publish_locales();
    v_complete := private.complete_locales(p_entity_type, p_entity_id);
    select coalesce(array_agg(l), '{}') into v_missing from unnest(v_required) l where l <> all (v_complete);
    if cardinality(v_complete) = 0 then
      raise exception using errcode = 'P0001', message = 'no locale is complete',
                                               hint = 'reason:no_locale_complete';
    elsif cardinality(v_missing) > 0 then
      raise exception using errcode = 'P0001', message = format('required locales incomplete: %s', v_missing),
                                               hint = 'reason:locales_incomplete';
    end if;
    if p_entity_type = 'topic_version' then
      perform private.assert_media_ready(p_entity_id);
      perform private.assert_embeds_published(p_entity_id);
    end if;
  elsif p_to = 'archived' and v_from = 'published' and p_entity_type <> 'topic_version' then
    perform private.assert_not_embedded_live(p_entity_type, v_parent_id);
  end if;

  perform set_config('app.workflow', 'on', true);

  if p_to = 'published' then
    -- Supersede the live version, then promote this one.
    execute format('select published_version_id from public.%I where id = $1 for update', v_ptab)
       into v_live using v_parent_id;
    if v_live is not null then
      execute format('update public.%I set status = ''archived'' where id = $1', v_vtab) using v_live;
      execute format('update public.%I set is_published = false where %I = $1', v_ltab, v_lcol) using v_live;
      insert into public.workflow_events (entity_type, entity_id, from_status, to_status, actor_id, note)
      values (p_entity_type, v_live, 'published', 'archived', v_uid, format('superseded by version %s', v_version_no));
    end if;
    execute format('update public.%I set status = ''published'', published_at = now() where id = $1', v_vtab)
      using p_entity_id;
    execute format('insert into public.%I (%I, locale) select $1, unnest($2::public.locale_code[])', v_ltab, v_lcol)
      using p_entity_id, v_complete;
    execute format('update public.%I set published_version_id = $1 where id = $2', v_ptab)
      using p_entity_id, v_parent_id;

  elsif p_to = 'archived' and v_from = 'published' then
    execute format('update public.%I set status = ''archived'' where id = $1', v_vtab) using p_entity_id;
    execute format('update public.%I set is_published = false where %I = $1', v_ltab, v_lcol) using p_entity_id;
    execute format('update public.%I set published_version_id = null where id = $1 and published_version_id = $2', v_ptab)
      using v_parent_id, p_entity_id;

  else
    execute format('update public.%I set status = $1 where id = $2', v_vtab) using p_to, p_entity_id;
  end if;

  insert into public.workflow_events (entity_type, entity_id, from_status, to_status, actor_id, note)
  values (p_entity_type, p_entity_id, v_from, p_to, v_uid, nullif(trim(p_note), ''));

  perform set_config('app.workflow', 'off', true);
  return p_to;
end $$;

revoke execute on function public.transition_content(text, uuid, public.content_status, text) from public, anon;
grant execute on function public.transition_content(text, uuid, public.content_status, text) to authenticated;
