-- Deneme sınavı vb. görevlerde konu olmadan ders bağlamak için.
-- curriculum-and-progress.sql (subjects) uygulanmış olmalı.

alter table public.tasks
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

create index if not exists idx_tasks_subject_id on public.tasks (subject_id)
  where subject_id is not null;

comment on column public.tasks.subject_id is
  'Konu yokken ders (ör. deneme sınavı); topic_id bu durumda null olabilir.';
