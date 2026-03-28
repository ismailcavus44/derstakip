-- Müfredat (ders / konu) + görev türü + öğrenci ilerleme
-- Önce schema.sql ve admin-panel.sql uygulanmış olmalı.
-- Supabase SQL Editor'de tek seferde çalıştırın.

-- 1) Dersler
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid (),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid (),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create index if not exists idx_topics_subject on public.topics (subject_id);

-- 2) Görev kolonları
alter table public.tasks
  add column if not exists topic_id uuid references public.topics (id) on delete set null;

alter table public.tasks
  add column if not exists task_kind text default 'soru_cozumu';

alter table public.tasks
  add column if not exists question_count int;

alter table public.tasks
  add column if not exists followup_question_count int default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_task_kind_check'
  ) then
    alter table public.tasks
      add constraint tasks_task_kind_check
      check (task_kind in ('soru_cozumu', 'konu_anlatimi'));
  end if;
end $$;

comment on column public.tasks.question_count is 'Soru çözümü: atanacak soru sayısı';
comment on column public.tasks.followup_question_count is 'Konu anlatımı: sonrası ek soru sayısı (varsayılan 20)';

-- 3) Konu anlatımı tamamlandı (konu başına bir kez)
create table if not exists public.student_topic_completions (
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  completed_at timestamptz not null default now(),
  task_id uuid references public.tasks (id) on delete set null,
  primary key (student_id, topic_id)
);

-- 4) Soru çözümü toplamları (konu bazlı)
create table if not exists public.student_topic_question_stats (
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  questions_solved int not null default 0,
  primary key (student_id, topic_id)
);

-- 5) Ders seed
insert into public.subjects (slug, name, sort_order)
values
  ('turkce', 'Türkçe', 1),
  ('matematik', 'Matematik', 2),
  ('geometri', 'Geometri', 3),
  ('tarih', 'Tarih', 4),
  ('cografya', 'Coğrafya', 5),
  ('vatandaslik', 'Vatandaşlık', 6)
on conflict (slug) do nothing;

-- 6) Konu seed (yalnızca topics boşsa)
do $$
declare
  n int;
begin
  select count(*)::int into n from public.topics;
  if n > 0 then
    raise notice 'topics dolu, seed atlandı';
    return;
  end if;

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'Sözcükte Anlam'),
      (2, 'Cümlede Anlam'),
      (3, 'Paragrafta Anlam'),
      (4, 'Ses Bilgisi'),
      (5, 'Yapı Bilgisi'),
      (6, 'Sözcük Türleri'),
      (7, 'Cümle Bilgisi'),
      (8, 'Yazım Kuralları'),
      (9, 'Noktalama İşaretleri'),
      (10, 'Anlatım Bozuklukları')
  ) as x (ord, name)
  where s.slug = 'turkce';

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'Temel Kavramlar'),
      (2, 'Sayılar'),
      (3, 'Ebob - Ekok'),
      (4, 'Asal Çarpanlara Ayırma'),
      (5, 'Denklemler'),
      (6, 'Rasyonel Sayılar'),
      (7, 'Eşitsizlik - Mutlak Değer'),
      (8, 'Üslü Sayılar'),
      (9, 'Köklü Sayılar'),
      (10, 'Çarpanlara Ayırma'),
      (11, 'Oran - Orantı'),
      (12, 'Problemler'),
      (13, 'Kümeler'),
      (14, 'İşlem - Modüler Aritmetik'),
      (15, 'Permütasyon - Kombinasyon - Olasılık'),
      (16, 'Tablo ve Grafikler'),
      (17, 'Sayısal Mantık')
  ) as x (ord, name)
  where s.slug = 'matematik';

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'Geometrik Kavramlar ve Doğruda Açılar (Üçgenler dâhil)'),
      (2, 'Çokgenler ve Dörtgenler'),
      (3, 'Çember ve Daire'),
      (4, 'Analitik Geometri'),
      (5, 'Katı Cisimler')
  ) as x (ord, name)
  where s.slug = 'geometri';

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'İslamiyet Öncesi Türk Tarihi'),
      (2, 'İlk Türk - İslam Devletleri ve Beylikleri'),
      (3, 'Osmanlı Devleti Kuruluş ve Yükselme Dönemleri'),
      (4, 'Osmanlı Devleti''nde Kültür ve Uygarlık'),
      (5, 'XVII. Yüzyılda Osmanlı Devleti (Duraklama Dönemi)'),
      (6, 'XVIII. Yüzyılda Osmanlı Devleti (Gerileme Dönemi)'),
      (7, 'XIX. Yüzyılda Osmanlı Devleti (Dağılma Dönemi)'),
      (8, 'XX. Yüzyılda Osmanlı Devleti'),
      (9, 'Kurtuluş Savaşı Hazırlık Dönemi'),
      (10, 'I. TBMM Dönemi'),
      (11, 'Kurtuluş Savaşı Muharebeler Dönemi'),
      (12, 'Atatürk İnkılapları'),
      (13, 'Atatürk İlkeleri'),
      (14, 'Partiler ve Partileşme Dönemi (İç Politika)'),
      (15, 'Atatürk Dönemi Türk Dış Politikası'),
      (16, 'Atatürk Sonrası Dönem'),
      (17, 'Atatürk''ün Hayatı ve Kişiliği')
  ) as x (ord, name)
  where s.slug = 'tarih';

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'Türkiye''nin Coğrafi Konumu'),
      (2, 'Türkiye''nin Yerşekilleri ve Özellikleri'),
      (3, 'Türkiye''nin İklimi ve Bitki Örtüsü'),
      (4, 'Türkiye''de Nüfus ve Yerleşme'),
      (5, 'Türkiye''de Tarım, Hayvancılık ve Ormancılık'),
      (6, 'Türkiye''de Madenler, Enerji Kaynakları ve Sanayi'),
      (7, 'Türkiye''de Ulaşım, Ticaret ve Turizm'),
      (8, 'Türkiye''nin Coğrafi Bölgeleri')
  ) as x (ord, name)
  where s.slug = 'cografya';

  insert into public.topics (subject_id, name, sort_order)
  select s.id, x.name, x.ord
  from public.subjects s
  cross join (
    values
      (1, 'Hukukun Temel Kavramları'),
      (2, 'Devlet Biçimleri Demokrasi Ve Kuvvetler Ayrılığı'),
      (3, 'Anayasa Hukukuna Giriş Temel Kavramlar Ve Türk Anayasa Tarihi'),
      (4, '1982 Anayasasının Temel İlkeleri'),
      (5, 'Yasama'),
      (6, 'Yürütme'),
      (7, 'Yargı'),
      (8, 'Temel Hak Ve Hürriyetler'),
      (9, 'İdare Hukuku'),
      (10, 'Uluslararası Kuruluşlar Ve Güncel Olaylar')
  ) as x (ord, name)
  where s.slug = 'vatandaslik';
end $$;

-- 7) RLS
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.student_topic_completions enable row level security;
alter table public.student_topic_question_stats enable row level security;

drop policy if exists "subjects_read_all" on public.subjects;
create policy "subjects_read_all" on public.subjects for select using (true);

drop policy if exists "topics_read_all" on public.topics;
create policy "topics_read_all" on public.topics for select using (true);

drop policy if exists "stc_select_own" on public.student_topic_completions;
drop policy if exists "stc_select_teacher" on public.student_topic_completions;
drop policy if exists "stc_select_admin" on public.student_topic_completions;
drop policy if exists "stc_insert_own" on public.student_topic_completions;

create policy "stc_select_own" on public.student_topic_completions for select
  using (student_id = auth.uid ());

create policy "stc_select_teacher" on public.student_topic_completions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );

create policy "stc_select_admin" on public.student_topic_completions for select
  using (auth.uid () = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid);

create policy "stc_insert_own" on public.student_topic_completions for insert
  with check (student_id = auth.uid ());

drop policy if exists "stq_select_own" on public.student_topic_question_stats;
drop policy if exists "stq_select_teacher" on public.student_topic_question_stats;
drop policy if exists "stq_select_admin" on public.student_topic_question_stats;
drop policy if exists "stq_insert_own" on public.student_topic_question_stats;
drop policy if exists "stq_update_own" on public.student_topic_question_stats;

create policy "stq_select_own" on public.student_topic_question_stats for select
  using (student_id = auth.uid ());

create policy "stq_select_teacher" on public.student_topic_question_stats for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_id and p.teacher_id = auth.uid ()
    )
  );

create policy "stq_select_admin" on public.student_topic_question_stats for select
  using (auth.uid () = 'a75e9080-86e4-4663-a4d5-6c91f6b83546'::uuid);

create policy "stq_insert_own" on public.student_topic_question_stats for insert
  with check (student_id = auth.uid ());

create policy "stq_update_own" on public.student_topic_question_stats for update
  using (student_id = auth.uid ())
  with check (student_id = auth.uid ());
