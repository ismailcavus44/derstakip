-- Öğrenci Ders Takip — ilk kurulum (SQL Editor'de çalıştırın)
-- Not: "Öğretmen hangi öğrenciye bağlı?" için profiles tablosuna teacher_id eklendi (öğrenciler için dolu).

-- ENUM benzeri kontroller için (isteğe bağlı; text + check yeterli)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  full_name text not null default '',
  -- Öğrencinin bağlı olduğu öğretmenin profiles.id değeri; öğretmenlerde NULL
  teacher_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_profiles_teacher_id on public.profiles (teacher_id) where teacher_id is not null;

create table public.tasks (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  due_date timestamptz,
  created_at timestamptz not null default now ()
);

create index idx_tasks_student on public.tasks (student_id);
create index idx_tasks_teacher on public.tasks (teacher_id);
create index idx_tasks_status on public.tasks (status);

-- Yeni kullanıcı kaydında profil satırı (role ve full_name: signUp metadata'dan)
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  tid uuid;
begin
  r := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  if r not in ('teacher', 'student') then
    r := 'student';
  end if;

  tid := null;
  if new.raw_user_meta_data ? 'teacher_id' then
    begin
      tid := (new.raw_user_meta_data ->> 'teacher_id')::uuid;
    exception
      when invalid_text_representation then
        tid := null;
    end;
  end if;

  insert into public.profiles (id, role, full_name, teacher_id)
  values (
    new.id,
    r,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    tid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- RLS
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- profiles: kendi satırı
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid () = id);

-- profiles: öğretmen, kendisine bağlı öğrencileri görebilir
create policy "profiles_select_students_for_teacher"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles t
      where t.id = auth.uid ()
        and t.role = 'teacher'
        and public.profiles.teacher_id = t.id
    )
  );

-- profiles: kendi kaydını güncelleme
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid () = id)
  with check (auth.uid () = id);

-- İlk kayıt: kullanıcı kendi id ile insert (trigger alternatifi kullanılıyorsa bu kapatılabilir)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid () = id);

-- tasks: öğrenci veya ilgili öğretmen görebilir
create policy "tasks_select_participants"
  on public.tasks for select
  using (
    student_id = auth.uid ()
    or teacher_id = auth.uid ()
  );

-- tasks: sadece öğretmen oluşturur; öğrenci bu öğretmene bağlı olmalı
create policy "tasks_insert_by_teacher"
  on public.tasks for insert
  with check (
    teacher_id = auth.uid ()
    and exists (
      select 1 from public.profiles s
      where s.id = student_id
        and s.role = 'student'
        and s.teacher_id = auth.uid ()
    )
  );

-- tasks: öğrenci kendi görevini güncelleyebilir (tamamlandı vb.)
create policy "tasks_update_by_student"
  on public.tasks for update
  using (student_id = auth.uid ())
  with check (student_id = auth.uid ());

-- tasks: öğretmen kendi verdiği görevleri güncelleyebilir
create policy "tasks_update_by_teacher"
  on public.tasks for update
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());

-- tasks: öğretmen silebilir
create policy "tasks_delete_by_teacher"
  on public.tasks for delete
  using (teacher_id = auth.uid ());
