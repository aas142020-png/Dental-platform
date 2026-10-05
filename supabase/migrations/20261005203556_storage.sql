-- 0012 · Storage bucket for content media. Private bucket; reads gated by media review status.
-- Skipped automatically where the storage schema does not exist (plain Postgres test harness).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('content-media', 'content-media', false)
  on conflict (id) do nothing;

  execute $p$
    create policy content_media_read on storage.objects for select to anon, authenticated
    using (bucket_id = 'content-media' and (
      private.is_staff()
      or exists (select 1 from public.media_assets m
                  where m.bucket = 'content-media' and m.storage_path = name and m.review_status = 'approved')))
  $p$;
  execute $p$
    create policy content_media_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'content-media' and private.has_role('editor'))
  $p$;
  execute $p$
    create policy content_media_delete on storage.objects for delete to authenticated
    using (bucket_id = 'content-media' and private.has_role('editor')
           and not exists (select 1 from public.media_assets m
                            where m.bucket = 'content-media' and m.storage_path = name))
  $p$;
end $$;
