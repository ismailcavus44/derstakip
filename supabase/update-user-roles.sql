-- Supabase SQL Editor: elif@elif.com → öğrenci (student), admin@admin.com → öğretmen (teacher)
-- Şemada rol sadece 'teacher' | 'student' olduğu için "admin" paneli = teacher.

update public.profiles p
set
  role = 'student',
  teacher_id = null,
  full_name = coalesce(nullif(p.full_name, ''), 'Elif')
where p.id = (select id from auth.users where email = 'elif@elif.com' limit 1);

update public.profiles p
set
  role = 'teacher',
  teacher_id = null,
  full_name = coalesce(nullif(p.full_name, ''), 'Admin')
where p.id = (select id from auth.users where email = 'admin@admin.com' limit 1);

-- Profil satırı yoksa (nadiren) ekle:
insert into public.profiles (id, role, full_name, teacher_id)
select u.id, 'student', 'Elif', null
from auth.users u
where u.email = 'elif@elif.com'
  and not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.profiles (id, role, full_name, teacher_id)
select u.id, 'teacher', 'Admin', null
from auth.users u
where u.email = 'admin@admin.com'
  and not exists (select 1 from public.profiles p where p.id = u.id);
