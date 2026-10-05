-- Production-safe seed: structure only, no clinical content.
-- Endodontics is created inactive (hidden from learners) until its first topic is published.
-- Topic titles are working titles; they go through the same review workflow as all content.

insert into public.specialties (slug, name, description, sort_order, is_active) values
  ('endodontics',
   '{"ar": "علاج جذور الأسنان", "en": "Endodontics"}',
   '{}', 1, false)
on conflict (slug) do nothing;

with s as (select id from public.specialties where slug = 'endodontics'),
topics_in(slug, sort_order, title) as (values
  ('pulp-anatomy',                      1, '{"ar": "تشريح لب السن", "en": "Pulp Anatomy"}'::jsonb),
  ('endodontic-diagnosis',              2, '{"ar": "التشخيص في علاج الجذور", "en": "Endodontic Diagnosis"}'::jsonb),
  ('pulp-sensibility-tests',            3, '{"ar": "اختبارات حساسية اللب", "en": "Pulp Sensibility Tests"}'::jsonb),
  ('symptomatic-irreversible-pulpitis', 4, '{"ar": "التهاب اللب غير العكوس المصحوب بأعراض", "en": "Symptomatic Irreversible Pulpitis"}'::jsonb),
  ('access-cavity-principles',          5, '{"ar": "مبادئ تحضير التجويف الوصولي", "en": "Access Cavity Principles"}'::jsonb)
),
ins_topics as (
  insert into public.topics (specialty_id, slug, sort_order, access_level)
  select s.id, t.slug, t.sort_order, 'authenticated' from s, topics_in t
  on conflict (specialty_id, slug) do nothing
  returning id, slug
)
insert into public.topic_versions (topic_id, version_no, title)
select it.id, 1, t.title
  from ins_topics it join topics_in t on t.slug = it.slug;
