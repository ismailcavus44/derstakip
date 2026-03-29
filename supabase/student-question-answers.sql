-- Öğrenci soru gönderisine admin cevap görseli ekler; öğrenci kendi klasöründen okur.
-- Önce student-question-submissions.sql uygulanmış olmalı.

alter table public.student_question_submissions
  add column if not exists answer_status text not null default 'pending'
    check (answer_status in ('pending', 'answered'));

alter table public.student_question_submissions
  add column if not exists answer_storage_path text;

alter table public.student_question_submissions
  add column if not exists answer_file_name text;

alter table public.student_question_submissions
  add column if not exists answer_content_type text;

alter table public.student_question_submissions
  add column if not exists answer_size_bytes int;

alter table public.student_question_submissions
  add column if not exists answered_at timestamptz;

alter table public.student_question_submissions
  add column if not exists answered_by uuid references public.profiles (id) on delete set null;

create unique index if not exists student_question_submissions_answer_path_uq
  on public.student_question_submissions (answer_storage_path)
  where answer_storage_path is not null;

create index if not exists idx_student_question_submissions_answer_status
  on public.student_question_submissions (answer_status, created_at desc);

comment on column public.student_question_submissions.answer_status is 'pending = cevap bekleniyor; answered = admin cevap görseli yüklendi';

-- Bucket: yol student_id/submission_id/dosya
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-question-answers',
  'student-question-answers',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

drop policy if exists "question_answer_storage_select" on storage.objects;
create policy "question_answer_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-question-answers'
    and (
      split_part (name, '/', 1) = auth.uid ()::text
      or exists (
        select 1
        from public.profiles p
        where p.id::text = split_part (name, '/', 1)
          and p.role = 'student'
          and p.teacher_id = auth.uid ()
      )
      or exists (
        select 1 from public.profiles me
        where me.id = auth.uid () and me.role = 'admin'
      )
    )
  );

-- Öğretmen: kendi öğrencisinin soru satırına cevap alanlarını yazar
drop policy if exists "student_question_submissions_update_answer_teacher"
  on public.student_question_submissions;
create policy "student_question_submissions_update_answer_teacher"
  on public.student_question_submissions for update to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = student_question_submissions.student_id
        and p.teacher_id = auth.uid ()
    )
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'teacher'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = student_question_submissions.student_id
        and p.teacher_id = auth.uid ()
    )
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'teacher'
    )
  );

-- Öğretmen: yalnızca kendi öğrencisinin klasörüne (student_id/...) cevap dosyası yükler
drop policy if exists "question_answer_storage_insert_teacher" on storage.objects;
create policy "question_answer_storage_insert_teacher"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-question-answers'
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'teacher'
    )
    and exists (
      select 1
      from public.profiles p
      where p.id::text = split_part (name, '/', 1)
        and p.role = 'student'
        and p.teacher_id = auth.uid ()
    )
  );

-- Öğretmen: eski cevap dosyasını silebilsin (yenisiyle değişim)
drop policy if exists "question_answer_storage_delete_teacher" on storage.objects;
create policy "question_answer_storage_delete_teacher"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-question-answers'
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'teacher'
    )
    and exists (
      select 1
      from public.profiles p
      where p.id::text = split_part (name, '/', 1)
        and p.role = 'student'
        and p.teacher_id = auth.uid ()
    )
  );
