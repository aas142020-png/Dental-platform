-- 0001 · Extensions and enums
create extension if not exists pgcrypto with schema extensions;

-- Internal helpers live in "private", which PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create type public.content_status as enum (
  'draft', 'source_verified', 'clinical_review', 'visual_review',
  'approved', 'published', 'archived'
);
comment on type public.content_status is
  'Editorial workflow. Changes only through public.transition_content().';

create type public.user_role as enum ('student', 'intern', 'general_dentist', 'specialist', 'other');
create type public.study_level as enum ('preclinical', 'clinical_year', 'intern', 'postgrad', 'practitioner');
create type public.staff_role as enum ('editor', 'source_verifier', 'clinical_reviewer', 'visual_reviewer', 'admin');
create type public.locale_code as enum ('ar', 'en');

-- Who may read a piece of published content. Premium is reserved: no entitlement logic in Sprint 1.
create type public.access_level as enum ('public', 'authenticated', 'premium');

create type public.evidence_type as enum (
  'clinical_guideline', 'systematic_review', 'meta_analysis', 'rct', 'cohort',
  'case_control', 'case_series', 'expert_consensus', 'position_statement',
  'textbook', 'narrative_review', 'other'
);
create type public.source_status as enum ('active', 'under_review', 'superseded', 'retracted');
create type public.support_level as enum ('direct', 'partial', 'contextual');

create type public.block_type as enum (
  'summary', 'text', 'illustration', 'animation', 'interactive_diagram', 'comparison',
  'clinical_pearl', 'warning', 'clinical_case', 'quiz', 'source_list'
);

-- Marks content drafted with AI help. It never changes the workflow path; it is shown to reviewers.
create type public.content_origin as enum ('human', 'ai_assisted');

create type public.media_kind as enum ('image', 'svg', 'video', 'lottie', 'model3d');
create type public.media_review_status as enum ('pending', 'approved', 'rejected');

-- Shared trigger: maintain updated_at
create or replace function private.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
