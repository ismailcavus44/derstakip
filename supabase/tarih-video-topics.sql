-- Tarih dersi: video/alt konu başlıkları (görev formu dropdown ile birebir eşleşir)
-- curriculum-and-progress.sql uygulandıktan sonra çalıştırın.
-- Mevcut konu adıyla aynı satır varsa eklenmez.

insert into public.topics (subject_id, name, sort_order)
select s.id, x.name, x.ord
from public.subjects s
cross join (
  values
    (100, '1) İslamiyet Öncesi Türk Tarihi I'),
    (101, '2) İslamiyet Öncesi Türk Tarihi II'),
    (102, '3) İslamiyet Öncesi Türk Devletleri Kültür ve Medeniyeti I'),
    (103, '4) İslamiyet Öncesi Türk Tarihi Kültür ve Medeniyeti II'),
    (104, '5) İlk Türk İslam Devletleri I'),
    (105, '6) İlk Türk İslam Devletleri II'),
    (106, '7) İlk Türk İslam Devletleri Kültür ve Medeniyeti I'),
    (107, '8) İlk Türk İslam Devletleri Kültür ve Medeniyeti II'),
    (108, '9) Anadolu Selçuklu Devleti (1075 - 1308)'),
    (109, '10) 99 Soruda Genel Tekrar'),
    (110, '11) Osmanlı Devleti Kültür ve Medeniyeti I'),
    (111, '12) Osmanlı Devleti Kültür ve Medeniyeti II'),
    (112, '13) Osmanlı Devleti Kültür ve Medeniyeti III'),
    (113, '14) Osmanlı Devleti Kültür ve Medeniyeti IV'),
    (114, '15) Osmanlı Devleti Kültür ve Medeniyeti V'),
    (115, '16) 59 Soruda Genel Tekrar'),
    (116, '17) Osmanlı Devleti Kuruluş Dönemi I'),
    (117, '18) Osmanlı Devleti Kuruluş Dönemi II'),
    (118, '19) Osmanlı Devleti Yükselme Dönemi I'),
    (119, '20) Osmanlı Devleti Yükselme Dönemi II'),
    (120, '21) XVII. Yüzyılda Osmanlı Devleti (Duraklama Dönemi) I'),
    (121, '22) XVII. Yüzyılda Osmanlı Devleti (Duraklama Dönemi) II'),
    (122, '23) XVIII. Yüzyılda Osmanlı Devleti Gerileme Dönemi I'),
    (123, '24) XVIII. Yüzyılda Osmanlı Devleti Gerileme Dönemi II'),
    (124, '25) XIX. Yüzyılda Osmanlı Devleti Siyasi Tarihi I'),
    (125, '26) XIX. Yüzyılda Osmanlı Devleti Siyasi Tarihi II'),
    (126, '27) XIX. Yüzyıl Islahatları I'),
    (127, '28) XIX. Yüzyıl Islahatları II'),
    (128, '29) XIX. Yüzyıl Islahatları III'),
    (129, '30) 59 Soruda Osmanlı Devleti Tarihi - Genel Tekrar'),
    (130, '31) XX. Yüzyıl Başlarında Osmanlı Devleti I'),
    (131, '32) XX. Yüzyıl Başlarında Osmanlı Devleti II'),
    (132, '33) XX. Yüzyıl Başlarında Osmanlı Devleti III'),
    (133, '34) Mondros Ateşkes Antlaşması ve Cemiyetler'),
    (134, '35) Milli Mücadele Hazırlık Dönemi I'),
    (135, '36) Milli Mücadele Hazırlık Dönemi II'),
    (136, '37) I. TBMM Dönemi ve Gelişmeleri I'),
    (137, '38) I. TBMM Dönemi ve Gelişmeleri II'),
    (138, '39) Milli Mücadele Muharebeler Dönemi I'),
    (139, '40) Milli Mücadele Muharebeler Dönemi II'),
    (140, '41) Milli Mücadele Muharebeler Dönemi III'),
    (141, '42) Milli Mücadele Muharebeler Dönemi IV (Diplomatik Dönem)'),
    (142, '43) Atatürk''ün Hayatı (1881 - 1938)'),
    (143, '44) Atatürk Dönemi İç Politika Gelişmeleri'),
    (144, '45) Atatürk İlkeleri'),
    (145, '46) Atatürk İnkılapları I'),
    (146, '47) Atatürk İnkılapları II (Hukuk Ve Toplumsal)'),
    (147, '48) Atatürk İnkılapları III (Eğitim ve Kültür)'),
    (148, '49) Atatürk İnkılapları IV (Ekonomi, Sağlık, Ulaştırma, Bayındırlık)'),
    (149, '50) Atatürk Dönemi Türk Dış Politikası (1923 - 1938)'),
    (150, '51) Cumhuriyet Dönemi Kültür ve Medeniyeti'),
    (151, '52) XX. Yüzyıl Başlarında Dünya I (1918-1939)'),
    (152, '53) XX. Yüzyıl Başlarında Dünya II (1918-1939)'),
    (153, '54) II. Dünya Savaşı (1939 - 1945)'),
    (154, '55) II. Dünya Savaşı''nda Türkiye (1939-1945)'),
    (155, '56) Soğuk Savaş Dönemi (1947-1990)'),
    (156, '57) Soğuk Savaş Döneminde Türkiye'),
    (157, '58) Yumuşama Dönemi I (1961-1990)'),
    (158, '59) Yumuşama Dönemi II'),
    (159, '60) Küreselleşen Dünya (1990-2026)')
) as x (ord, name)
where s.slug = 'tarih'
  and not exists (
    select 1
    from public.topics t
    where t.subject_id = s.id
      and t.name = x.name
  );
