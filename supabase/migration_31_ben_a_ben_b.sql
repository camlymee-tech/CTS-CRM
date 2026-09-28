-- ============================================================
-- TUKI CRM — Cập nhật 31: Thông tin Bên A (khách) + Bên B (bên mình) cho hợp đồng
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- 1) Số tài khoản của khách hàng (Bên A)
alter table customers add column if not exists so_tai_khoan text;

-- (nếu chưa chạy migration_30 thì cột này cũng cần — chạy lại không sao)
alter table customers add column if not exists ten_tieu_de_bena text;

-- 2) Bảng lưu thông tin Bên B (bên cung cấp dịch vụ = công ty mình), mỗi loại hợp đồng 1 dòng
create table if not exists ben_b_settings (
  loai text primary key,                 -- 'xay_shop' | 'ads'
  du_lieu jsonb not null default '{}',   -- các ô: ten, dai_dien, chuc_vu, dia_chi, mst, sdt, so_tai_khoan...
  updated_at timestamptz default now()
);

alter table ben_b_settings enable row level security;

drop policy if exists ben_b_select on ben_b_settings;
create policy ben_b_select on ben_b_settings
  for select using (auth.uid() is not null);

drop policy if exists ben_b_write on ben_b_settings;
create policy ben_b_write on ben_b_settings
  for all using (is_admin()) with check (is_admin());
