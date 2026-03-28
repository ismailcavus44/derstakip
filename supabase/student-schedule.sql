-- Aylık ders programı: güne göre + saat aralığı (dakika cinsinden).
-- Güncelleme: önceki sürümde sadece tarih varsa tabloyu yeniden oluşturur (veri silinir).

drop table if exists public.student_schedule_entries cascade;

create table public.student_schedule_entries (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  scheduled_date date not null,
  start_minutes integer not null check (start_minutes >= 0 and start_minutes < 1440),
  end_minutes integer not null check (end_minutes > start_minutes and end_minutes <= 1440),
  created_at timestamptz not null default now (),
  unique (student_id, task_id, scheduled_date)
);

create index idx_student_schedule_student
  on public.student_schedule_entries (student_id);

create index idx_student_schedule_date
  on public.student_schedule_entries (student_id, scheduled_date);

alter table public.student_schedule_entries enable row level security;

create policy "student_schedule_select_own"
  on public.student_schedule_entries for select
  using (student_id = auth.uid ());

create policy "student_schedule_insert_own"
  on public.student_schedule_entries for insert
  with check (
    student_id = auth.uid ()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.student_id = auth.uid ()
    )
  );

create policy "student_schedule_update_own"
  on public.student_schedule_entries for update
  using (student_id = auth.uid ())
  with check (
    student_id = auth.uid ()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.student_id = auth.uid ()
    )
  );

create policy "student_schedule_delete_own"
  on public.student_schedule_entries for delete
  using (student_id = auth.uid ());
