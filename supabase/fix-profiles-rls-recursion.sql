-- "infinite recursion detected in policy for relation profiles" düzeltmesi
-- Eski politika profiles üzerinde tekrar SELECT yaptığı için RLS döngüye giriyordu.
-- Öğretmen, öğrenci satırında teacher_id = kendi id olduğunda görebilir; alt sorgu gerekmez.

drop policy if exists "profiles_select_students_for_teacher" on public.profiles;

create policy "profiles_select_students_for_teacher"
  on public.profiles for select
  using (teacher_id = auth.uid ());
