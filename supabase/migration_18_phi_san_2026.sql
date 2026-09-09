-- ============================================================
-- TUKI CRM — Cập nhật 18: Tham số phí sàn Shopee (cập nhật 2026)
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- Ghi chú thời điểm áp dụng cho từng dòng phí ngành hàng
alter table shopee_fees add column if not exists ap_dung_tu text;
update shopee_fees set ap_dung_tu = '01/07/2025' where ap_dung_tu is null;

-- ============ THAM SỐ PHÍ CHUNG ============
create table if not exists shopee_settings (
  id smallint primary key default 1,
  phi_xu_ly numeric not null default 6,          -- % phí xử lý giao dịch
  phi_ha_tang numeric not null default 3000,     -- đồng/đơn, số tiền cố định
  voucher_xtra_pct numeric not null default 4,   -- % giá trị sản phẩm
  voucher_xtra_cap numeric not null default 50000,
  freeship_xtra_pct numeric not null default 6,
  dong_tai_tro_pct numeric not null default 30,  -- % giá trị mã ưu đãi shop phải chịu
  dong_tai_tro_cap numeric not null default 50000,
  thue_pct numeric not null default 1.5,         -- 1% GTGT + 0,5% TNCN (hộ kinh doanh)
  ghi_chu text,
  cap_nhat_luc timestamptz default now(),
  constraint chi_mot_dong check (id = 1)
);

insert into shopee_settings (id, ghi_chu)
values (1, 'Phí xử lý giao dịch 6% từ 01/05/2026. Phí hạ tầng 3.000đ/đơn từ 01/07/2025. Voucher Xtra 4% tối đa 50.000đ/sp từ 29/12/2025. Đồng tài trợ mã ưu đãi: shop chịu 30%, tối đa 50.000đ/sp.')
on conflict (id) do nothing;

alter table shopee_settings enable row level security;

drop policy if exists "settings_select" on shopee_settings;
create policy "settings_select" on shopee_settings for select using (true);

drop policy if exists "settings_write" on shopee_settings;
create policy "settings_write" on shopee_settings for all
  using (is_admin()) with check (is_admin());
