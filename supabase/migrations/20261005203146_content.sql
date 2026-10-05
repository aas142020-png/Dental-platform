-- 0004 · Specialties, topics, versions, blocks
-- Localized text columns are jsonb objects keyed by locale: {"ar": "...", "en": "..."}.

create table public.specialties (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          jsonb not null check (jsonb_typeof(name) = 'object'),
  description   jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  icon_asset_id uuid references public.media_assets (id),
  sort_order    int not null default 0,
  is_active     boolean not null default false,  -- visible in the learner app
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger specialties_updated_at before update on public.specialties
  for each row execute function private.tg_set_updated_at();

create table public.topics (
  id                   uuid primary key default gen_random_uuid(),
  specialty_id         uuid not null references public.specialties (id),
  slug                 text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order           int not null default 0,
  access_level         public.access_level not null default 'authenticated',
  audience             public.user_role[] not null default '{}',
  published_version_id uuid,  -- set only by transition_content()
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (specialty_id, slug)
);
create trigger topics_updated_at before update on public.topics
  for each row execute function private.tg_set_updated_at();

create table public.topic_versions (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.topics (id) on delete cascade,
  version_no   int not null check (version_no > 0),
  status       public.content_status not null default 'draft',
  title        jsonb not null default '{}'::jsonb check (jsonb_typeof(title) = 'object'),
  subtitle     jsonb not null default '{}'::jsonb check (jsonb_typeof(subtitle) = 'object'),
  est_minutes  int check (est_minutes > 0),
  origin       public.content_origin not null default 'human',
  change_note  text,
  based_on_id  uuid references public.topic_versions (id),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  unique (topic_id, version_no)
);
create trigger topic_versions_updated_at before update on public.topic_versions
  for each row execute function private.tg_set_updated_at();

-- At most one published version and at most one in-progress version per topic.
create unique index topic_versions_one_published
  on public.topic_versions (topic_id) where status = 'published';
create unique index topic_versions_one_in_progress
  on public.topic_versions (topic_id) where status not in ('published', 'archived');

alter table public.topics
  add constraint topics_published_version_fk
  foreign key (published_version_id) references public.topic_versions (id);

-- Which locales of a version are live. Written at publish time from completeness checks,
-- so a locale can later be enabled or withheld independently of the others.
create table public.topic_version_locales (
  topic_version_id uuid not null references public.topic_versions (id) on delete cascade,
  locale           public.locale_code not null,
  is_published     boolean not null default true,
  published_at     timestamptz not null default now(),
  primary key (topic_version_id, locale)
);

-- content = {"ar": {...}, "en": {...}, "shared": {...}}. Shape per type is validated by
-- packages/content-schema (Zod) in the app layer; the DB only enforces the outer shape.
create table public.topic_blocks (
  id               uuid primary key default gen_random_uuid(),
  topic_version_id uuid not null references public.topic_versions (id) on delete cascade,
  position         int not null check (position >= 0),
  type             public.block_type not null,
  schema_version   int not null default 1 check (schema_version > 0),
  content          jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  origin           public.content_origin not null default 'human',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint topic_blocks_position_unique unique (topic_version_id, position) deferrable initially deferred
);
create trigger topic_blocks_updated_at before update on public.topic_blocks
  for each row execute function private.tg_set_updated_at();
create index topic_blocks_version_idx on public.topic_blocks (topic_version_id, position);
