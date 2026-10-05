-- 0006 · Questions and teaching cases (no patient data), versioned like topics.
--
-- Identity rows (questions, cases) hold what must stay stable: the id that topic blocks embed,
-- relationships, access level, and the pointer to the live version.
-- Version rows hold everything editorial: content, status, claims, locales, author, publication time.
-- Editing published content = new draft version; the published version stays live until replaced.

------------------------------------------------------------------------------
-- Questions
------------------------------------------------------------------------------
create table public.questions (
  id                   uuid primary key default gen_random_uuid(),
  topic_id             uuid references public.topics (id),
  access_level         public.access_level not null default 'authenticated',
  published_version_id uuid,  -- set only by transition_content()
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger questions_updated_at before update on public.questions
  for each row execute function private.tg_set_updated_at();

create table public.question_versions (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  version_no   int not null check (version_no > 0),
  status       public.content_status not null default 'draft',
  kind         text not null default 'single_choice'
               check (kind in ('single_choice', 'multi_choice', 'true_false')),
  stem         jsonb not null default '{}'::jsonb check (jsonb_typeof(stem) = 'object'),
  options      jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),  -- [{id, text:{ar,en}, correct}]
  explanation  jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  difficulty   smallint check (difficulty between 1 and 5),
  origin       public.content_origin not null default 'human',
  change_note  text,
  based_on_id  uuid references public.question_versions (id),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  unique (question_id, version_no)
);
create trigger question_versions_updated_at before update on public.question_versions
  for each row execute function private.tg_set_updated_at();
create unique index question_versions_one_published
  on public.question_versions (question_id) where status = 'published';
create unique index question_versions_one_in_progress
  on public.question_versions (question_id) where status not in ('published', 'archived');

alter table public.questions
  add constraint questions_published_version_fk
  foreign key (published_version_id) references public.question_versions (id);

create table public.question_version_claims (
  question_version_id uuid not null references public.question_versions (id) on delete cascade,
  claim_id            uuid not null references public.claims (id),
  primary key (question_version_id, claim_id)
);
create index question_version_claims_claim_idx on public.question_version_claims (claim_id);

create table public.question_version_locales (
  question_version_id uuid not null references public.question_versions (id) on delete cascade,
  locale              public.locale_code not null,
  is_published        boolean not null default true,
  published_at        timestamptz not null default now(),
  primary key (question_version_id, locale)
);

------------------------------------------------------------------------------
-- Cases
------------------------------------------------------------------------------
create table public.cases (
  id                   uuid primary key default gen_random_uuid(),
  specialty_id         uuid references public.specialties (id),
  slug                 text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  access_level         public.access_level not null default 'authenticated',
  published_version_id uuid,  -- set only by transition_content()
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger cases_updated_at before update on public.cases
  for each row execute function private.tg_set_updated_at();

create table public.case_versions (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  version_no   int not null check (version_no > 0),
  status       public.content_status not null default 'draft',
  title        jsonb not null default '{}'::jsonb check (jsonb_typeof(title) = 'object'),
  content      jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),  -- {"ar":{stages:[...]},"en":{...},"shared":{...}}
  origin       public.content_origin not null default 'human',
  change_note  text,
  based_on_id  uuid references public.case_versions (id),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  unique (case_id, version_no)
);
create trigger case_versions_updated_at before update on public.case_versions
  for each row execute function private.tg_set_updated_at();
create unique index case_versions_one_published
  on public.case_versions (case_id) where status = 'published';
create unique index case_versions_one_in_progress
  on public.case_versions (case_id) where status not in ('published', 'archived');

alter table public.cases
  add constraint cases_published_version_fk
  foreign key (published_version_id) references public.case_versions (id);

create table public.case_version_claims (
  case_version_id uuid not null references public.case_versions (id) on delete cascade,
  claim_id        uuid not null references public.claims (id),
  primary key (case_version_id, claim_id)
);
create index case_version_claims_claim_idx on public.case_version_claims (claim_id);

create table public.case_version_locales (
  case_version_id uuid not null references public.case_versions (id) on delete cascade,
  locale          public.locale_code not null,
  is_published    boolean not null default true,
  published_at    timestamptz not null default now(),
  primary key (case_version_id, locale)
);

-- Relationship: stays on identity, unaffected by edits.
create table public.case_topics (
  case_id  uuid not null references public.cases (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  primary key (case_id, topic_id)
);
