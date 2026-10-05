-- 0010 · Read views for clients. security_invoker = true, so the caller's RLS applies.

create view public.v_specialties with (security_invoker = true) as
select s.id, s.slug, s.name, s.description, s.icon_asset_id, s.sort_order, s.is_active,
       (select count(*) from public.topics t
         where t.specialty_id = s.id and t.published_version_id is not null)::int as published_topic_count
  from public.specialties s;

-- Catalog of published topics. Titles are listed even when the caller cannot read the full content
-- (e.g. premium later); can_read tells the client whether to show content or a locked state.
create view public.v_topic_catalog with (security_invoker = true) as
select t.id            as topic_id,
       t.slug          as topic_slug,
       s.id            as specialty_id,
       s.slug          as specialty_slug,
       t.sort_order,
       t.access_level,
       t.audience,
       v.id            as version_id,
       v.version_no,
       v.title,
       v.subtitle,
       v.est_minutes,
       v.published_at,
       coalesce((select array_agg(l.locale order by l.locale) from public.topic_version_locales l
                  where l.topic_version_id = v.id and l.is_published), '{}') as available_locales,
       private.can_read_access_level(t.access_level) as can_read
  from public.topics t
  join public.specialties s    on s.id = t.specialty_id
  join public.topic_versions v on v.id = t.published_version_id;

-- Staff dashboard: every topic with its live and in-progress versions.
create view public.v_admin_topics with (security_invoker = true) as
select t.id as topic_id, t.slug as topic_slug, s.slug as specialty_slug, t.sort_order, t.access_level,
       t.published_version_id,
       w.id as working_version_id, w.version_no as working_version_no, w.status as working_status,
       coalesce(w.title, p.title) as title, coalesce(w.updated_at, p.updated_at) as last_change_at
  from public.topics t
  join public.specialties s on s.id = t.specialty_id
  left join public.topic_versions p on p.id = t.published_version_id
  left join public.topic_versions w on w.topic_id = t.id and w.status not in ('published', 'archived')
 where private.is_staff();

-- Source impact review (staff only). One row per:
--   non-active source -> verified link -> claim -> published content version using that claim.
-- No automatic unpublishing; this is the review queue.
--
-- remaining_active_direct_support = verified 'direct' links from ACTIVE sources still backing the claim.
-- severity:
--   critical  source retracted, this link was direct support, and no active direct support remains
--   high      no active direct support remains (superseded / under-review source, or a retracted partial link)
--   low       the claim still has at least one verified direct link from an active source
create view public.v_source_impact with (security_invoker = true) as
with live_uses as (
  select bc.claim_id, 'topic'::text as content_type, t.id as content_id, v.id as version_id, v.version_no,
         t.slug as content_ref, v.title as content_title
    from public.block_claims bc
    join public.topic_blocks b   on b.id = bc.block_id
    join public.topic_versions v on v.id = b.topic_version_id and v.status = 'published'
    join public.topics t         on t.id = v.topic_id
  union
  select qc.claim_id, 'question', q.id, v.id, v.version_no, q.id::text, v.stem
    from public.question_version_claims qc
    join public.question_versions v on v.id = qc.question_version_id and v.status = 'published'
    join public.questions q         on q.id = v.question_id
  union
  select cc.claim_id, 'case', c.id, v.id, v.version_no, coalesce(c.slug, c.id::text), v.title
    from public.case_version_claims cc
    join public.case_versions v on v.id = cc.case_version_id and v.status = 'published'
    join public.cases c         on c.id = v.case_id
)
select s.id                 as source_id,
       s.title              as source_title,
       s.status             as source_status,
       cs.claim_id,
       cl.statement         as claim_statement,
       cs.support           as link_support,
       cs.locator,
       u.content_type,
       u.content_id,
       u.version_id,
       u.version_no,
       u.content_ref,
       u.content_title,
       r.remaining          as remaining_active_direct_support,
       sev.severity,
       case sev.severity when 'critical' then 1 when 'high' then 2 else 3 end as severity_rank
  from public.claim_sources cs
  join public.sources s  on s.id = cs.source_id and s.status <> 'active'
  join public.claims cl  on cl.id = cs.claim_id
  join live_uses u       on u.claim_id = cs.claim_id
  cross join lateral (
    select count(*)::int as remaining
      from public.claim_sources a join public.sources sa on sa.id = a.source_id
     where a.claim_id = cs.claim_id and a.verified_at is not null
       and a.support = 'direct' and sa.status = 'active') r
  cross join lateral (
    select case
             when s.status = 'retracted' and cs.support = 'direct' and r.remaining = 0 then 'critical'
             when r.remaining = 0 then 'high'
             else 'low'
           end as severity) sev
 where cs.verified_at is not null
   and private.is_staff();

-- One row per flagged source, worst severity first.
create view public.v_flagged_sources with (security_invoker = true) as
select source_id, source_title, source_status,
       (array_agg(severity order by severity_rank))[1] as worst_severity,
       min(severity_rank)                               as worst_severity_rank,
       count(distinct claim_id)::int                    as affected_claims,
       count(distinct version_id)::int                  as affected_published_versions
  from public.v_source_impact
 group by source_id, source_title, source_status;
