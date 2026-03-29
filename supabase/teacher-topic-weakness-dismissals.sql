-- Öğretmen: konu eksik satırını listeden kaldırır (dismissed_at).
-- Aynı öğrenci+konuya sonradan yeni soru gönderilirse satır tekrar görünür.
-- profiles ve topics tabloları mevcut olmalı.

create table if not exists public.teacher_topic_weakness_dismissals (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  dismissed_at timestamptz not null default now (),
  constraint teacher_topic_weakness_dismissal_uq unique (student_id, topic_id, teacher_id)
);

create index if not exists idx_teacher_topic_weakness_dismissals_teacher
  on public.teacher_topic_weakness_dismissals (teacher_id);

create index if not exists idx_teacher_topic_weakness_dismissals_student_topic
  on public.teacher_topic_weakness_dismissals (student_id, topic_id);

alter table public.teacher_topic_weakness_dismissals enable row level security;

drop policy if exists "teacher_topic_weakness_dismissals_select_own"
  on public.teacher_topic_weakness_dismissals;
create policy "teacher_topic_weakness_dismissals_select_own"
  on public.teacher_topic_weakness_dismissals for select to authenticated
  using (teacher_id = auth.uid ());

drop policy if exists "teacher_topic_weakness_dismissals_insert_own_student"
  on public.teacher_topic_weakness_dismissals;
create policy "teacher_topic_weakness_dismissals_insert_own_student"
  on public.teacher_topic_weakness_dismissals for insert to authenticated
  with check (
    teacher_id = auth.uid ()
    and exists (
      select 1
      from public.profiles s
      where s.id = student_id
        and s.role = 'student'
        and s.teacher_id = auth.uid ()
    )
  );

drop policy if exists "teacher_topic_weakness_dismissals_update_own"
  on public.teacher_topic_weakness_dismissals;
create policy "teacher_topic_weakness_dismissals_update_own"
  on public.teacher_topic_weakness_dismissals for update to authenticated
  using (teacher_id = auth.uid ())
  with check (
    teacher_id = auth.uid ()
    and exists (
      select 1
      from public.profiles s
      where s.id = student_id
        and s.role = 'student'
        and s.teacher_id = auth.uid ()
    )
  );

comment on table public.teacher_topic_weakness_dismissals is
  'Öğretmenin (student_id, topic_id) eksikliğini listeden gizlemesi; dismissed_at sonrası yeni gönderimler tekrar listeler.';
