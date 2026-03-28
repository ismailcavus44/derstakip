-- Öğrencinin kendi soru ilerlemesi satırını silebilmesi (hatalı giriş düzeltme)
-- curriculum-and-progress.sql ve teacher-task-delete-progress-rls.sql sonrası çalıştırın.

drop policy if exists "stq_delete_own" on public.student_topic_question_stats;
create policy "stq_delete_own" on public.student_topic_question_stats for delete
  using (student_id = auth.uid ());
