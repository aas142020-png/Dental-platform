-- 0002 · Profiles, staff roles, editorial policy

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  role             public.user_role,
  study_level      public.study_level,
  preferred_locale public.locale_code not null default 'ar',
  institution      text,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.tg_set_updated_at();

-- Create a profile row for every new auth user.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_locale public.locale_code := 'ar';
begin
  if new.raw_user_meta_data ->> 'preferred_locale' in ('ar', 'en') then
    v_locale := (new.raw_user_meta_data ->> 'preferred_locale')::public.locale_code;
  end if;
  insert into public.profiles (id, full_name, preferred_locale)
  values (new.id, new.raw_user_meta_data ->> 'full_name', v_locale)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- One user may hold several roles (Alpha: one person holds all five).
create table public.staff_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.staff_role not null,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Editorial policy: configuration, not code. Changing a value changes enforcement immediately.
create table public.editorial_policy (
  key         text primary key,
  value       jsonb not null,
  description text not null,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
create trigger editorial_policy_updated_at before update on public.editorial_policy
  for each row execute function private.tg_set_updated_at();

insert into public.editorial_policy (key, value, description) values
  ('required_publish_locales', '["ar","en"]',
   'Locales that must be complete before a topic version, question or case can be published. '
   'A version publishes with every complete locale; at least one locale is always required.'),
  ('four_eyes_review', 'false',
   'When true, the author of a version cannot perform any review step on it '
   '(source verification, clinical review, visual review, publish). Off for Alpha.'),
  ('require_claims_for_source_verification', 'true',
   'When true, a topic version needs at least one linked claim before it can reach Source Verified.'),
  ('require_alt_text', 'true',
   'When true, every image/SVG referenced by a version needs alt text in each required locale before Approved.');
