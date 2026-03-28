-- Admin paneli: rol genişletme, admin RLS ve tetikleyici güncellemesi
-- Supabase SQL Editor'de çalıştırın. Admin kullanıcı UUID'si aşağıda sabit.

-- 1) Rol: teacher | student | admin
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('teacher', 'student', 'admin'));

-- 2) Yeni kullanıcı profili (admin metadata ile kayıt nadir; yine de desteklenir)
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
  if r not in ('teacher', 'student', 'admin') then
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

-- 3) Sabit admin UUID (uygulama .env ADMIN_USER_ID ile aynı olmalı)
-- Aşağıdaki kullanıcıyı yönetici yapın (auth.users’da bu id ile hesap olmalı):
update public.profiles
set role = 'admin'
where id = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid;

-- 4) RLS: admin tüm profilleri görebilir
create policy "profiles_select_admin"
  on public.profiles for select
  using (auth.uid () = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid);

-- 5) RLS: admin yalnızca öğrenci satırlarını güncelleyebilir (teacher_id atama / kaldırma)
create policy "profiles_update_students_by_admin"
  on public.profiles for update
  using (
    auth.uid () = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid
    and role = 'student'
  )
  with check (
    auth.uid () = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid
    and role = 'student'
  );
