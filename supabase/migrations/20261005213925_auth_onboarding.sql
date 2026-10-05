-- Step 5 · Authentication/onboarding profile fields.
-- Auth identities remain owned by Supabase Auth; authorization remains exclusively in staff_roles.
alter table public.profiles
  add column study_year smallint check (study_year between 1 and 6),
  add column specialty_interest text;

comment on column public.profiles.study_year is 'Dental-school year (1–6); only applicable when role=student.';
comment on column public.profiles.specialty_interest is 'Optional free-text specialty or professional interest supplied during onboarding.';

-- Keep conditional profile state coherent even if a client bypasses the UI.
alter table public.profiles add constraint profiles_onboarding_fields_check check (
  (role = 'student' and study_year is not null)
  or (role is distinct from 'student' and study_year is null)
  or role is null
);
