begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gate-evidence',
  'gate-evidence',
  false,
  250000000,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

create policy gate_evidence_staff_read on storage.objects
for select using (
  bucket_id = 'gate-evidence'
  and is_staff()
  and split_part(name, '/', 1) ~ '^job_[0-9A-HJKMNP-TV-Z]{26}$'
  and can_access_job(split_part(name, '/', 1))
);

create policy gate_evidence_staff_insert on storage.objects
for insert with check (
  bucket_id = 'gate-evidence'
  and current_app_role() in ('admin', 'office', 'field')
  and split_part(name, '/', 1) ~ '^job_[0-9A-HJKMNP-TV-Z]{26}$'
  and can_access_job(split_part(name, '/', 1))
);

commit;
