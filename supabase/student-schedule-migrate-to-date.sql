-- Mevcut haftalık/saat şemasından tarih şemasına geçiş (veriler silinir).
-- Güvenli yol: tabloyu yeniden oluştur.

drop table if exists public.student_schedule_entries cascade;

-- Ardından student-schedule.sql içeriğini çalıştırın (tablo zaten drop edildiği için
-- student-schedule.sql dosyasındaki DROP satırı no-op olur; create + policy yeterli).
