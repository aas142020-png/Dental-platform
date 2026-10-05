-- 0007 · Per-user data: interests, progress, saved items

create table public.user_interests (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, specialty_id)
);

create table public.user_progress (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  topic_id         uuid not null references public.topics (id) on delete cascade,
  topic_version_id uuid references public.topic_versions (id) on delete set null,
  status           text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  last_block_id    uuid,
  percent          smallint not null default 0 check (percent between 0 and 100),
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create trigger user_progress_updated_at before update on public.user_progress
  for each row execute function private.tg_set_updated_at();

create table public.saved_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_type  text not null check (item_type in ('topic', 'block', 'question', 'case', 'source')),
  item_id    uuid not null,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
