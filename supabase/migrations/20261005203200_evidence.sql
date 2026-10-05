-- 0005 · Sources, claims, and the exact passages that link them

create table public.sources (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  organization     text,
  authors          text,
  url              text,
  doi              text,
  publication_date date,
  version_label    text,   -- e.g. '2021 update', '11th ed.'
  evidence_type    public.evidence_type not null,
  status           public.source_status not null default 'under_review',
  last_reviewed_at date,
  last_reviewed_by uuid references public.profiles (id),
  notes            text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger sources_updated_at before update on public.sources
  for each row execute function private.tg_set_updated_at();
create unique index sources_doi_unique on public.sources (lower(doi)) where doi is not null;

-- A single checkable clinical statement, reusable across topics, questions and cases.
-- Locked once referenced by any non-draft content (see 0008); change = new claim.
create table public.claims (
  id           uuid primary key default gen_random_uuid(),
  statement    jsonb not null check (jsonb_typeof(statement) = 'object'),
  specialty_id uuid references public.specialties (id),
  origin       public.content_origin not null default 'human',
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger claims_updated_at before update on public.claims
  for each row execute function private.tg_set_updated_at();

create table public.claim_sources (
  claim_id           uuid not null references public.claims (id) on delete cascade,
  source_id          uuid not null references public.sources (id),
  locator            text not null check (length(trim(locator)) > 0),           -- 'Sec 4.2, p. 12, Table 3'
  supporting_passage text not null check (length(trim(supporting_passage)) > 0), -- exact original wording
  support            public.support_level not null default 'direct',
  verified_by        uuid references public.profiles (id),
  verified_at        timestamptz,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  primary key (claim_id, source_id, locator),
  check ((verified_by is null) = (verified_at is null))
);
create index claim_sources_source_idx on public.claim_sources (source_id);

create table public.block_claims (
  block_id uuid not null references public.topic_blocks (id) on delete cascade,
  claim_id uuid not null references public.claims (id),
  anchor   text not null default '' ,  -- marker key used inside the block text: {claim:<anchor>}
  primary key (block_id, claim_id)
);
create index block_claims_claim_idx on public.block_claims (claim_id);
