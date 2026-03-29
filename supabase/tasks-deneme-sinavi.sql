-- Deneme sınavı görev türü + önerilen süre + öğrenci sonuç alanları.
-- curriculum-and-progress.sql uygulanmış olmalı.

alter table public.tasks drop constraint if exists tasks_task_kind_check;

alter table public.tasks
  add constraint tasks_task_kind_check
  check (
    task_kind in ('soru_cozumu', 'konu_anlatimi', 'deneme_sinavi')
  );

alter table public.tasks
  add column if not exists deneme_branch text;

alter table public.tasks
  add column if not exists deneme_target_minutes int;

alter table public.tasks
  add column if not exists deneme_correct int;

alter table public.tasks
  add column if not exists deneme_wrong int;

alter table public.tasks
  add column if not exists deneme_actual_minutes int;

comment on column public.tasks.deneme_branch is
  'Deneme kolu: turkce | matematik_geometri | tarih | cografya | vatandaslik | diger';

comment on column public.tasks.deneme_target_minutes is
  'Öğretmen atarken kaydedilen önerilen süre (dk); öğrenci gerçek süreyi deneme_actual_minutes ile girer.';

comment on column public.tasks.deneme_correct is 'Öğrenci tamamlayınca doğru sayısı';

comment on column public.tasks.deneme_wrong is 'Öğrenci tamamlayınca yanlış sayısı';

comment on column public.tasks.deneme_actual_minutes is 'Öğrencinin bildirdiği süre (dk)';
