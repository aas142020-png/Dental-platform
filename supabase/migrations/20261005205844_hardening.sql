-- Hardening (forward migration; applied migrations are immutable)
--
-- 1. Fixed search_path on the 11 internal functions flagged by the Supabase security advisor
--    (function_search_path_mutable). Every object they reference is already schema-qualified or in
--    pg_catalog, so behaviour is unchanged. ALTER FUNCTION ... SET does not change signatures,
--    owners, privileges or SECURITY INVOKER/DEFINER.
--
-- 2. Application-level "not found" from transition_content() now uses SQLSTATE PT404, which PostgREST
--    returns as HTTP 404 (P0002 was returned as HTTP 500). The stable hint 'reason:not_found' is unchanged.
--    The function body below is identical to migration 20261005203357_workflow except that one errcode.
--    CREATE OR REPLACE keeps the owner, SECURITY DEFINER and the existing EXECUTE grants.

alter function private.has_premium_access() set search_path = '';
alter function private.in_workflow() set search_path = '';
alter function private.nonblank(jsonb, public.locale_code) set search_path = '';
alter function private.tg_guard_claim_sources() set search_path = '';
alter function private.tg_guard_claims() set search_path = '';
alter function private.tg_guard_media() set search_path = '';
alter function private.tg_guard_published_pointer() set search_path = '';
alter function private.tg_guard_topic_blocks() set search_path = '';
alter function private.tg_guard_workflow_row() set search_path = '';
alter function private.tg_set_updated_at() set search_path = '';
alter function private.tg_version_identity() set search_path = '';

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
    raise exception using errcode = 'PT404', message = format('%s %s not found', p_entity_type, p_entity_id),
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

-- Grants restated for clarity; identical to the original migration.
revoke execute on function public.transition_content(text, uuid, public.content_status, text) from public, anon;
grant execute on function public.transition_content(text, uuid, public.content_status, text) to authenticated;
