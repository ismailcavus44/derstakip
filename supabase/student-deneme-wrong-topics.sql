-- Deneme tamamlanınca öğrencinin işaretlediği yanlış konular (konu eksikleri listesinde birleşir).
-- tasks (subject_id), topics, profiles mevcut olmalı.

create table if not exists public.student_deneme_wrong_topics (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now (),
  constraint student_deneme_wrong_topics_uq unique (student_id, topic_id, task_id)
);

create index if not exists idx_student_deneme_wrong_topics_student_created
  on public.student_deneme_wrong_topics (student_id, created_at desc);

create index if not exists idx_student_deneme_wrong_topics_topic
  on public.student_deneme_wrong_topics (topic_id);

alter table public.student_deneme_wrong_topics enable row level security;

drop policy if exists "student_deneme_wrong_topics_select_own_or_teacher"
  on public.student_deneme_wrong_topics;
create policy "student_deneme_wrong_topics_select_own_or_teacher"
  on public.student_deneme_wrong_topics for select to authenticated
  using (
    student_id = auth.uid ()
    or exists (
      select 1
      from public.profiles p
      where p.id = student_deneme_wrong_topics.student_id
        and p.teacher_id = auth.uid ()
    )
  );

drop policy if exists "student_deneme_wrong_topics_insert_own"
  on public.student_deneme_wrong_topics;
create policy "student_deneme_wrong_topics_insert_own"
  on public.student_deneme_wrong_topics for insert to authenticated
  with check (
    student_id = auth.uid ()
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid ()
        and me.role = 'student'
    )
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.student_id = auth.uid ()
    )
  );

comment on table public.student_deneme_wrong_topics is
  'Deneme sınavı tamamlanınca öğrencinin yanlış yaptığını işaretlediği konular; konu eksikleri rollup ile birleşir.';
