-- Öğretmen bildirimleri + görev güncelleme kuralları (Supabase SQL Editor)
-- Öğrenci: yalnızca pending → completed; tamamlanan görevi geri açamaz.
-- Tamamlanınca öğretmene teacher_notifications satırı eklenir.

create table if not exists public.teacher_notifications (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now ()
);

create index if not exists idx_teacher_notifications_teacher on public.teacher_notifications (teacher_id);
create index if not exists idx_teacher_notifications_unread on public.teacher_notifications (teacher_id)
  where read_at is null;

alter table public.teacher_notifications enable row level security;

drop policy if exists "teacher_notifications_select_own" on public.teacher_notifications;
create policy "teacher_notifications_select_own"
  on public.teacher_notifications for select
  using (teacher_id = auth.uid ());

drop policy if exists "teacher_notifications_update_own" on public.teacher_notifications;
create policy "teacher_notifications_update_own"
  on public.teacher_notifications for update
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());

-- Öğrenci: tamamlanmış görevde değişiklik yok; pending iken sadece status → completed
create or replace function public.enforce_task_update_rules ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  select p.role into r from public.profiles p where p.id = auth.uid ();

  if r = 'teacher' and old.teacher_id = auth.uid () then
    return new;
  end if;

  if r = 'student' and old.student_id = auth.uid () then
    if old.status = 'completed' then
      raise exception 'Tamamlanan görev değiştirilemez';
    end if;
    if old.status = 'pending' then
      if new.status is distinct from 'completed' then
        raise exception 'Görevi yalnızca tamamlandı olarak işaretleyebilirsiniz';
      end if;
      if new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.student_id is distinct from old.student_id
        or new.teacher_id is distinct from old.teacher_id
        or new.due_date is distinct from old.due_date
        or new.created_at is distinct from old.created_at
      then
        raise exception 'Yalnızca durum güncellenebilir';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_update on public.tasks;
create trigger tasks_enforce_update
  before update on public.tasks
  for each row execute procedure public.enforce_task_update_rules ();

-- Tamamlanınca öğretmene bildirim
create or replace function public.notify_teacher_task_completed ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sn text;
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'completed' then
    select p.full_name into sn from public.profiles p where p.id = new.student_id;
    insert into public.teacher_notifications (teacher_id, task_id, message)
    values (
      new.teacher_id,
      new.id,
      coalesce (nullif (trim (sn), ''), 'Öğrenci') || ' şu görevi tamamladı: ' || new.title
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_notify_teacher_on_complete on public.tasks;
create trigger tasks_notify_teacher_on_complete
  after update on public.tasks
  for each row execute procedure public.notify_teacher_task_completed ();

-- Not: PostgreSQL 15+ sürümlerinde "execute procedure" yerine "execute function" kullanılabilir.
