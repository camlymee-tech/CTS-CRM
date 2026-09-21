-- ============================================================
-- TUKI CRM — Cập nhật 23: Thông tin pháp lý khách hàng cho hợp đồng
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- Thông tin Bên A cần cho hợp đồng (lưu trên khách hàng, khai 1 lần dùng nhiều lần)
alter table customers add column if not exists dia_chi text;
alter table customers add column if not exists mst text;
alter table customers add column if not exists nguoi_dai_dien text;
alter table customers add column if not exists chuc_vu text;
alter table customers add column if not exists email text;
alter table customers add column if not exists ten_viet_tat text;

-- Thông tin riêng của từng hợp đồng
alter table contracts add column if not exists so_luong_gian_hang int default 1;
alter table contracts add column if not exists so_san_pham int;      -- số SP theo gói
alter table contracts add column if not exists ten_goi text;
alter table contracts add column if not exists loai_dich_vu text;    -- 'ads' | 'xay_shop'
alter table contracts add column if not exists ngay_bat_dau date;
