-- 0009 · Content access model and row-level security
--
-- Two separate questions:
--   listed   = may this published item appear in catalogs (titles, summaries)?  published + specialty active
--   readable = may this caller read its full content?                           listed + access_level allows
-- Staff bypass both for preview and editing.

create or replace function private.has_premium_access()
returns boolean language sql stable as $$
  -- Premium is reserved. No entitlements exist in Sprint 1, so premium content is readable by staff only.
  select false;
$$;

create or replace function private.can_read_access_level(p_level public.access_level)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() or case p_level
    when 'public'        then true
    when 'authenticated' then (select auth.uid()) is not null
    when 'premium'       then private.has_premium_access()
  end;
$$;

create or replace function private.topic_is_listed(p_topic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.topics t join public.specialties s on s.id = t.specialty_id
     where t.id = p_topic_id and t.published_version_id is not null and s.is_active);
$$;

create or replace function private.topic_is_readable(p_topic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.topic_is_listed(p_topic_id)
     and private.can_read_access_level((select access_level from public.topics where id = p_topic_id));
$$;

create or replace function private.version_is_readable(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.topic_versions v
     where v.id = p_version_id and v.status = 'published' and private.topic_is_readable(v.topic_id));
$$;

-- Questions / cases: identity is readable when it has a live version and its access level allows.
create or replace function private.question_is_readable(p_question_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.questions q
                  where q.id = p_question_id and q.published_version_id is not null
                    and private.can_read_access_level(q.access_level));
$$;

create or replace function private.question_version_is_readable(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.question_versions v
                  where v.id = p_version_id and v.status = 'published'
                    and private.question_is_readable(v.question_id));
$$;

create or replace function private.case_is_readable(p_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cases c
                  where c.id = p_case_id and c.published_version_id is not null
                    and private.can_read_access_level(c.access_level));
$$;

create or replace function private.case_version_is_readable(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.case_versions v
                  where v.id = p_version_id and v.status = 'published'
                    and private.case_is_readable(v.case_id));
$$;

create or replace function private.claim_is_readable(p_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.block_claims bc join public.topic_blocks b on b.id = bc.block_id
                  where bc.claim_id = p_claim_id and private.version_is_readable(b.topic_version_id))
      or exists (select 1 from public.question_version_claims qc
                  where qc.claim_id = p_claim_id and private.question_version_is_readable(qc.question_version_id))
      or exists (select 1 from public.case_version_claims cc
                  where cc.claim_id = p_claim_id and private.case_version_is_readable(cc.case_version_id));
$$;

create or replace function private.source_is_readable(p_source_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.claim_sources cs
                  where cs.source_id = p_source_id and cs.verified_at is not null
                    and private.claim_is_readable(cs.claim_id));
$$;

grant execute on function
  private.can_read_access_level(public.access_level), private.topic_is_listed(uuid),
  private.topic_is_readable(uuid), private.version_is_readable(uuid),
  private.question_is_readable(uuid), private.question_version_is_readable(uuid),
  private.case_is_readable(uuid), private.case_version_is_readable(uuid),
  private.claim_is_readable(uuid), private.source_is_readable(uuid), private.has_premium_access()
  to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- Enable RLS everywhere
------------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.staff_roles           enable row level security;
alter table public.editorial_policy      enable row level security;
alter table public.media_assets          enable row level security;
alter table public.specialties           enable row level security;
alter table public.topics                enable row level security;
alter table public.topic_versions        enable row level security;
alter table public.topic_version_locales enable row level security;
alter table public.topic_blocks          enable row level security;
alter table public.sources               enable row level security;
alter table public.claims                enable row level security;
alter table public.claim_sources         enable row level security;
alter table public.block_claims          enable row level security;
alter table public.questions                enable row level security;
alter table public.question_versions        enable row level security;
alter table public.question_version_claims  enable row level security;
alter table public.question_version_locales enable row level security;
alter table public.cases                    enable row level security;
alter table public.case_versions            enable row level security;
alter table public.case_version_claims      enable row level security;
alter table public.case_version_locales     enable row level security;
alter table public.case_topics              enable row level security;
alter table public.user_interests        enable row level security;
alter table public.user_progress         enable row level security;
alter table public.saved_items           enable row level security;
alter table public.workflow_transitions  enable row level security;
alter table public.workflow_events       enable row level security;

------------------------------------------------------------------------------
-- Identity
------------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_role('admin'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy staff_roles_select on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));
create policy staff_roles_insert on public.staff_roles for insert to authenticated
  with check (private.has_role('admin'));
create policy staff_roles_delete on public.staff_roles for delete to authenticated
  using (private.has_role('admin'));

create policy editorial_policy_select on public.editorial_policy for select to authenticated
  using (private.is_staff());
create policy editorial_policy_update on public.editorial_policy for update to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy workflow_transitions_select on public.workflow_transitions for select to authenticated
  using (private.is_staff());
create policy workflow_events_select on public.workflow_events for select to authenticated
  using (private.is_staff());
-- workflow_transitions / workflow_events have no write policies: changed by migration or transition_content() only.

------------------------------------------------------------------------------
-- Catalog and content
------------------------------------------------------------------------------
create policy specialties_select on public.specialties for select to anon, authenticated
  using (is_active or private.is_staff());
create policy specialties_write on public.specialties for all to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

create policy topics_select on public.topics for select to anon, authenticated
  using (private.topic_is_listed(id) or private.is_staff());
create policy topics_insert on public.topics for insert to authenticated
  with check (private.has_role('editor'));
create policy topics_update on public.topics for update to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));
create policy topics_delete on public.topics for delete to authenticated
  using (private.has_role('admin'));

create policy topic_versions_select on public.topic_versions for select to anon, authenticated
  using ((status = 'published' and private.topic_is_listed(topic_id)) or private.is_staff());
create policy topic_versions_write on public.topic_versions for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy topic_version_locales_select on public.topic_version_locales for select to anon, authenticated
  using (is_published or private.is_staff());

create policy topic_blocks_select on public.topic_blocks for select to anon, authenticated
  using (private.version_is_readable(topic_version_id) or private.is_staff());
create policy topic_blocks_write on public.topic_blocks for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy media_select on public.media_assets for select to anon, authenticated
  using (review_status = 'approved' or private.is_staff());
create policy media_insert on public.media_assets for insert to authenticated
  with check (private.has_role('editor'));
create policy media_update on public.media_assets for update to authenticated
  using (private.has_role('editor') or private.has_role('visual_reviewer'))
  with check (private.has_role('editor') or private.has_role('visual_reviewer'));
create policy media_delete on public.media_assets for delete to authenticated
  using (private.has_role('editor'));

------------------------------------------------------------------------------
-- Evidence
------------------------------------------------------------------------------
create policy sources_select on public.sources for select to anon, authenticated
  using (private.source_is_readable(id) or private.is_staff());
create policy sources_insert on public.sources for insert to authenticated
  with check (private.has_role('editor') or private.has_role('source_verifier'));
create policy sources_update on public.sources for update to authenticated
  using (private.has_role('editor') or private.has_role('source_verifier'))
  with check (private.has_role('editor') or private.has_role('source_verifier'));
create policy sources_delete on public.sources for delete to authenticated
  using (private.has_role('admin'));

create policy claims_select on public.claims for select to anon, authenticated
  using (private.claim_is_readable(id) or private.is_staff());
create policy claims_write on public.claims for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy claim_sources_select on public.claim_sources for select to anon, authenticated
  using ((verified_at is not null and private.claim_is_readable(claim_id)) or private.is_staff());
create policy claim_sources_write on public.claim_sources for all to authenticated
  using (private.has_role('editor') or private.has_role('source_verifier'))
  with check (private.has_role('editor') or private.has_role('source_verifier'));

create policy block_claims_select on public.block_claims for select to anon, authenticated
  using (private.is_staff() or exists (
    select 1 from public.topic_blocks b where b.id = block_id and private.version_is_readable(b.topic_version_id)));
create policy block_claims_write on public.block_claims for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

------------------------------------------------------------------------------
-- Questions and cases: identity rows + versions
------------------------------------------------------------------------------
create policy questions_select on public.questions for select to anon, authenticated
  using (private.question_is_readable(id) or private.is_staff());
create policy questions_insert on public.questions for insert to authenticated
  with check (private.has_role('editor'));
create policy questions_update on public.questions for update to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));
create policy questions_delete on public.questions for delete to authenticated
  using (private.has_role('admin'));

create policy question_versions_select on public.question_versions for select to anon, authenticated
  using (private.question_version_is_readable(id) or private.is_staff());
create policy question_versions_write on public.question_versions for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy question_version_claims_select on public.question_version_claims for select to anon, authenticated
  using (private.question_version_is_readable(question_version_id) or private.is_staff());
create policy question_version_claims_write on public.question_version_claims for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy question_version_locales_select on public.question_version_locales for select to anon, authenticated
  using (is_published or private.is_staff());

create policy cases_select on public.cases for select to anon, authenticated
  using (private.case_is_readable(id) or private.is_staff());
create policy cases_insert on public.cases for insert to authenticated
  with check (private.has_role('editor'));
create policy cases_update on public.cases for update to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));
create policy cases_delete on public.cases for delete to authenticated
  using (private.has_role('admin'));

create policy case_versions_select on public.case_versions for select to anon, authenticated
  using (private.case_version_is_readable(id) or private.is_staff());
create policy case_versions_write on public.case_versions for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy case_version_claims_select on public.case_version_claims for select to anon, authenticated
  using (private.case_version_is_readable(case_version_id) or private.is_staff());
create policy case_version_claims_write on public.case_version_claims for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

create policy case_version_locales_select on public.case_version_locales for select to anon, authenticated
  using (is_published or private.is_staff());

create policy case_topics_select on public.case_topics for select to anon, authenticated
  using (private.case_is_readable(case_id) or private.is_staff());
create policy case_topics_write on public.case_topics for all to authenticated
  using (private.has_role('editor')) with check (private.has_role('editor'));

------------------------------------------------------------------------------
-- Per-user data: owner only
------------------------------------------------------------------------------
create policy user_interests_own on public.user_interests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_progress_own on public.user_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_items_own on public.saved_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Users may not grant themselves anything through profile columns: there are none that confer rights.
-- Staff rights live only in staff_roles, writable by admins.
