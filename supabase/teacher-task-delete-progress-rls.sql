-- Öğretmen görev sildiğinde ilerleme geri alma (deleteTeacherTask) için RLS
-- curriculum-and-progress.sql sonrası çalıştırın.

drop policy if exists "stc_delete_teacher" on public.student_topic_completions;
create policy "stc_delete_teacher" on public.student_topic_completions for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );

drop policy if exists "stq_update_teacher" on public.student_topic_question_stats;
create policy "stq_update_teacher" on public.student_topic_question_stats for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );

drop policy if exists "stq_delete_teacher" on public.student_topic_question_stats;
create policy "stq_delete_teacher" on public.student_topic_question_stats for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );

-- Öğretmen: öğrencisi için soru toplamı satırı ilk kez oluşturma (setTeacherStudentTopicQuestionsSolved)
drop policy if exists "stq_insert_teacher" on public.student_topic_question_stats;
create policy "stq_insert_teacher" on public.student_topic_question_stats for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );
