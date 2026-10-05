-- 0003 · Media assets (files live in Storage bucket "content-media")

create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null default 'content-media',
  storage_path  text not null unique,
  kind          public.media_kind not null,
  mime_type     text,
  width         int check (width > 0),
  height        int check (height > 0),
  duration_s    numeric check (duration_s >= 0),
  alt           jsonb not null default '{}'::jsonb check (jsonb_typeof(alt) = 'object'),     -- {"ar": "...", "en": "..."}
  caption       jsonb not null default '{}'::jsonb check (jsonb_typeof(caption) = 'object'),
  credit        text,
  license       text,
  review_status public.media_review_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id),
  reviewed_at   timestamptz,
  origin        public.content_origin not null default 'human',
  uploaded_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function private.tg_set_updated_at();
