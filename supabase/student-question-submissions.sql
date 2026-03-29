-- Öğrenci: ders/konu seçerek soru dosyası gönderir; öğretmen "Sorular" sayfasında görür.
-- Bildirim: teacher_notifications satırı tetikleyici ile eklenir.
-- Önce teacher-notifications.sql uygulanmış olmalı.

-- 1) Gönderiler
create table if not exists public.student_question_submissions (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes int not null check (
    size_bytes > 0
    and size_bytes <= 10485760
  ),
  created_at timestamptz not null default now (),
  constraint student_question_submissions_path_unique unique (storage_path)
);

create index if not exists idx_student_question_submissions_student
  on public.student_question_submissions (student_id);
create index if not exists idx_student_question_submissions_topic
  on public.student_question_submissions (topic_id);
create index if not exists idx_student_question_submissions_created
  on public.student_question_submissions (created_at desc);

alter table public.student_question_submissions enable row level security;

drop policy if exists "student_question_submissions_select_own_or_teacher"
  on public.student_question_submissions;
create policy "student_question_submissions_select_own_or_teacher"
  on public.student_question_submissions for select
  using (
    student_id = auth.uid ()
    or exists (
      select 1
      from public.profiles p
      where p.id = student_question_submissions.student_id
        and p.teacher_id = auth.uid ()
    )
  );

drop policy if exists "student_question_submissions_insert_own"
  on public.student_question_submissions;
create policy "student_question_submissions_insert_own"
  on public.student_question_submissions for insert
  with check (
    student_id = auth.uid ()
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'student'
    )
  );

-- 2) Bildirimler: görev dışı soru için task_id opsiyonel + submission_id
alter table public.teacher_notifications
  alter column task_id drop not null;

alter table public.teacher_notifications
  add column if not exists submission_id uuid references public.student_question_submissions (id) on delete set null;

create index if not exists idx_teacher_notifications_submission
  on public.teacher_notifications (submission_id)
  where submission_id is not null;

-- 3) Tetikleyici: soru yüklenince öğretmene bildirim
create or replace function public.notify_teacher_new_question_submission ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  sn text;
  tn text;
begin
  select p.teacher_id, p.full_name into tid, sn
  from public.profiles p
  where p.id = new.student_id;

  if tid is null then
    return new;
  end if;

  select t.name into tn from public.topics t where t.id = new.topic_id;

  insert into public.teacher_notifications (teacher_id, task_id, submission_id, message)
  values (
    tid,
    null,
    new.id,
    coalesce (nullif (trim (sn), ''), 'Öğrenci') || ' — '
      || coalesce (nullif (trim (tn), ''), 'Konu')
      || ': Yeni soru dosyası gönderdi.'
  );

  return new;
end;
$$;

drop trigger if exists student_question_submissions_notify on public.student_question_submissions;
create trigger student_question_submissions_notify
  after insert on public.student_question_submissions
  for each row execute function public.notify_teacher_new_question_submission ();

-- 4) Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-question-submissions',
  'student-question-submissions',
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

drop policy if exists "student_question_storage_insert" on storage.objects;
create policy "student_question_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-question-submissions'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

drop policy if exists "student_question_storage_select" on storage.objects;
create policy "student_question_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-question-submissions'
    and (
      split_part (name, '/', 1) = auth.uid ()::text
      or exists (
        select 1
        from public.profiles p
        where p.id::text = split_part (name, '/', 1)
          and p.role = 'student'
          and p.teacher_id = auth.uid ()
      )
    )
  );

drop policy if exists "student_question_storage_delete" on storage.objects;
create policy "student_question_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-question-submissions'
    and split_part (name, '/', 1) = auth.uid ()::text
  );
