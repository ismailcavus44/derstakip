-- Öğrenci: kendi soru gönderimini ve (varsa) cevap görselini depodan silebilir.
-- student-question-submissions.sql ve student-question-answers.sql uygulanmış olmalı.

drop policy if exists "student_question_submissions_delete_own"
  on public.student_question_submissions;
create policy "student_question_submissions_delete_own"
  on public.student_question_submissions for delete to authenticated
  using (
    student_id = auth.uid ()
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'student'
    )
  );

-- Cevap bucket yolu: {student_id}/{submission_id}/dosya
drop policy if exists "question_answer_storage_delete_student_own" on storage.objects;
create policy "question_answer_storage_delete_student_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-question-answers'
    and split_part (name, '/', 1) = auth.uid ()::text
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid () and me.role = 'student'
    )
  );
