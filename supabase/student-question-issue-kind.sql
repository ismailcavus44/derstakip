-- Öğrenci soru gönderiminde: çözemedim / yanlış yaptım (konu eksikliği takibi).
-- student-question-submissions.sql uygulanmış olmalı.

alter table public.student_question_submissions
  add column if not exists issue_kind text;

update public.student_question_submissions
set issue_kind = 'could_not_solve'
where issue_kind is null;

alter table public.student_question_submissions
  alter column issue_kind set default 'could_not_solve';

alter table public.student_question_submissions
  alter column issue_kind set not null;

alter table public.student_question_submissions
  drop constraint if exists student_question_submissions_issue_kind_chk;

alter table public.student_question_submissions
  add constraint student_question_submissions_issue_kind_chk check (
    issue_kind in ('could_not_solve', 'wrong_answer')
  );

comment on column public.student_question_submissions.issue_kind is
  'Öğrenci bildirimi: could_not_solve = çözemedim, wrong_answer = yanlış yaptım; konu bazlı eksiklik skorunda kullanılır.';

create index if not exists idx_student_question_submissions_student_topic_issue
  on public.student_question_submissions (student_id, topic_id, created_at desc);

-- Bildirim metnine durum ekle
create or replace function public.notify_teacher_new_question_submission ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  sn text;
  tn text;
  issue_label text;
begin
  select p.teacher_id, p.full_name into tid, sn
  from public.profiles p
  where p.id = new.student_id;

  if tid is null then
    return new;
  end if;

  select t.name into tn from public.topics t where t.id = new.topic_id;

  issue_label := case new.issue_kind
    when 'wrong_answer' then 'Yanlış yaptım'
    else 'Çözemedim'
  end;

  insert into public.teacher_notifications (teacher_id, task_id, submission_id, message)
  values (
    tid,
    null,
    new.id,
    coalesce (nullif (trim (sn), ''), 'Öğrenci') || ' — '
      || coalesce (nullif (trim (tn), ''), 'Konu')
      || ' (' || issue_label || '): Yeni soru dosyası gönderdi.'
  );

  return new;
end;
$$;
