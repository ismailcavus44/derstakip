-- Öğrenci: göreve soru / çözüm dosyası yükleme (Storage + metadata)
-- schema.sql ve curriculum-and-progress.sql sonrası SQL Editor'de çalıştırın.

-- 1) Metadata tablosu
create table if not exists public.task_question_uploads (
  id uuid primary key default gen_random_uuid (),
  task_id uuid not null references public.tasks (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes int not null check (
    size_bytes > 0
    and size_bytes <= 10485760
  ),
  created_at timestamptz not null default now(),
  constraint task_question_uploads_path_unique unique (storage_path)
);

create index if not exists idx_task_question_uploads_task on public.task_question_uploads (task_id);
create index if not exists idx_task_question_uploads_student on public.task_question_uploads (student_id);

comment on table public.task_question_uploads is 'Öğrencinin göreve yüklediği soru / PDF / görsel dosyaları';

alter table public.task_question_uploads enable row level security;

create policy "task_question_uploads_select_participants"
  on public.task_question_uploads for select
  using (
    student_id = auth.uid ()
    or exists (
      select 1
      from public.tasks t
      where t.id = task_question_uploads.task_id
        and t.teacher_id = auth.uid ()
    )
  );

create policy "task_question_uploads_insert_student"
  on public.task_question_uploads for insert
  with check (
    student_id = auth.uid ()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.student_id = auth.uid ()
    )
  );

create policy "task_question_uploads_delete_own"
  on public.task_question_uploads for delete
  using (student_id = auth.uid ());

-- 2) Storage bucket (10 MB, izin verilen MIME)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-question-uploads',
  'task-question-uploads',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- 3) Storage RLS — yol: {student_id}/{task_id}/{dosya}
-- Öğrenci: kendi klasörüne yükleme; görev kendisine ait olmalı
drop policy if exists "task_question_storage_insert_student" on storage.objects;
create policy "task_question_storage_insert_student"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-question-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
    and exists (
      select 1
      from public.tasks t
      where t.id::text = split_part (name, '/', 2)
        and t.student_id = auth.uid ()
    )
  );

drop policy if exists "task_question_storage_select_participants" on storage.objects;
create policy "task_question_storage_select_participants"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-question-uploads'
    and (
      split_part (name, '/', 1) = auth.uid ()::text
      or exists (
        select 1
        from public.tasks t
        where t.id::text = split_part (name, '/', 2)
          and t.teacher_id = auth.uid ()
      )
    )
  );

drop policy if exists "task_question_storage_delete_participants" on storage.objects;
create policy "task_question_storage_delete_participants"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-question-uploads'
    and (
      split_part (name, '/', 1) = auth.uid ()::text
      or exists (
        select 1
        from public.tasks t
        where t.id::text = split_part (name, '/', 2)
          and t.teacher_id = auth.uid ()
      )
    )
  );
