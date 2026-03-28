-- Coğrafya dersi: video / alt konu başlıkları (görev formu dropdown ile birebir eşleşir)
-- curriculum-and-progress.sql uygulandıktan sonra çalıştırın.
-- Mevcut konu adıyla aynı satır varsa eklenmez.

insert into public.topics (subject_id, name, sort_order)
select s.id, x.name, x.ord
from public.subjects s
cross join (
  values
    (1, '1) Coğrafi Konum - 1'),
    (2, '2) Coğrafi Konum - 2'),
    (3, '3) Coğrafi Konum - 3'),
    (4, '4) Coğrafi Konum - 4'),
    (5, '5) Coğrafi Konum - 5'),
    (6, '6) Türkiye''nin Yer Şekilleri - 1 (İç ve Dış Kuvvet)'),
    (7, '7) Türkiye''nin Yer Şekilleri - 2 (Jeolojik Zamanlar)'),
    (8, '8) Türkiye''nin Yer Şekilleri - 3 (Dağlar 1)'),
    (9, '9) Türkiye''nin Yer Şekilleri - 4 (Dağlar 2)'),
    (10, '10) Türkiye''nin Yer Şekilleri - 5 (Platolar)'),
    (11, '11) Türkiye''nin Yer Şekilleri - 6 (Ovalar)'),
    (12, '12) Türkiye''nin Yer Şekilleri - 7 (Akarsu Şekilleri)'),
    (13, '13) Türkiye''nin Yer Şekilleri - 8 (Rüzgar ve Buzullar)'),
    (14, '14) Türkiye''nin Yer Şekilleri - 9 (Karstik Şekiller)'),
    (15, '15) Türkiye''nin Yer Şekilleri - 10 (Kıyı Şekillenmesi)'),
    (16, '16) Türkiye''nin Yer Şekilleri - 11 (Genel Özellikler)'),
    (17, '17) Türkiye İklimi - 1 (Sıcaklık)'),
    (18, '18) Türkiye İklimi - 2 (Basınç ve Rüzgar)'),
    (19, '19) Türkiye İklimi - 3 (Nemlilik ve Yağış)'),
    (20, '20) Türkiye İklimi - 4 (Mikroklimalar)'),
    (21, '21) Türkiye''nin Su, Toprak ve Bitki Varlığı - 1 (Akarsular 1)'),
    (22, '22) Türkiye''nin Su, Toprak ve Bitki Varlığı - 2 (Akarsular 2)'),
    (23, '23) Türkiye''nin Su, Toprak ve Bitki Varlığı - 3 (Göller)'),
    (24, '24) Türkiye''nin Su, Toprak ve Bitki Varlığı - 4 (Denizler)'),
    (25, '25) Türkiye''nin Su, Toprak ve Bitki Varlığı - 5 (Yeraltı Suları)'),
    (26, '26) Türkiye''nin Su, Toprak ve Bitki Varlığı - 6 (Topraklar 1)'),
    (27, '27) Türkiye''nin Su, Toprak ve Bitki Varlığı - 7 (Topraklar 2)'),
    (28, '28) Türkiye''nin Su, Toprak ve Bitki Varlığı - 8 (Bitki 1)'),
    (29, '29) Türkiye''nin Su, Toprak ve Bitki Varlığı - 9 (Bitki 2)'),
    (30, '30) Türkiye''nin Su, Toprak ve Bitki Varlığı - 10 (Bitki 3)'),
    (31, '31) Türkiye''de Çevre ve Doğal Afetler - 1'),
    (32, '32) Türkiye''de Çevre ve Doğal Afetler - 2'),
    (33, '33) Türkiye''de Çevre ve Doğal Afetler - 3'),
    (34, '34) Türkiye''nin Beşeri Coğrafyası - 1 (Nüfus 1)'),
    (35, '35) Türkiye''nin Beşeri Coğrafyası - 2 (Nüfus 2)'),
    (36, '36) Türkiye''nin Beşeri Coğrafyası - 3 (Nüfus 3)'),
    (37, '37) Türkiye''nin Beşeri Coğrafyası - 4 (Nüfus 4)'),
    (38, '38) Türkiye''nin Beşeri Coğrafyası - 5 (Yerleşme 1)'),
    (39, '39) Türkiye''nin Beşeri Coğrafyası - 6 (Yerleşme 2)'),
    (40, '40) Türkiye''nin Beşeri Coğrafyası - 7 (Yerleşme 3)'),
    (41, '41) Türkiye''nin Beşeri Coğrafyası - 8 (Göçler)'),
    (42, '42) Türkiye''nin Ekonomik Coğrafyası - 1 (Ekonomi Politikaları)'),
    (43, '43) Türkiye''nin Ekonomik Coğrafyası - 2 (Tarım 1)'),
    (44, '44) Türkiye''nin Ekonomik Coğrafyası - 3 (Tarım 2)'),
    (45, '45) Türkiye''nin Ekonomik Coğrafyası - 4 (Tarım 3)'),
    (46, '46) Türkiye''nin Ekonomik Coğrafyası - 5 (Tarım 4)'),
    (47, '47) Türkiye''nin Ekonomik Coğrafyası - 6 (Hayvancılık)'),
    (48, '48) Türkiye''nin Ekonomik Coğrafyası - 7 (Madenler 1)'),
    (49, '49) Türkiye''nin Ekonomik Coğrafyası - 8 (Madenler 2)'),
    (50, '50) Türkiye''nin Ekonomik Coğrafyası - 9 (Enerji Kaynakları 1)'),
    (51, '51) Türkiye''nin Ekonomik Coğrafyası - 10 (Enerji Kaynakları 2)'),
    (52, '52) Türkiye''nin Ekonomik Coğrafyası - 11 (Sanayi)'),
    (53, '53) Türkiye''nin Ekonomik Coğrafyası - 12 (Sanayi ve Ticaret)'),
    (54, '54) Türkiye''nin Ekonomik Coğrafyası - 13 (Ulaşım 1)'),
    (55, '55) Türkiye''nin Ekonomik Coğrafyası - 14 (Ulaşım 2)'),
    (56, '56) Türkiye''nin Ekonomik Coğrafyası - 15 (Turizm 1)'),
    (57, '57) Türkiye''nin Ekonomik Coğrafyası - 16 (Turizm 2)'),
    (58, '58) Türkiye''de Bölge Kavramı ve Sistematiği (Jeopolitik Bölge 1)'),
    (59, '59) Türkiye''de Bölge Kavramı ve Sistematiği (Jeopolitik Bölge 2)'),
    (60, '60) Türkiye''de Bölge Kavramı ve Sistematiği (Plan Bölgeler)')
) as x (ord, name)
where s.slug = 'cografya'
  and not exists (
    select 1
    from public.topics t
    where t.subject_id = s.id
      and t.name = x.name
  );
