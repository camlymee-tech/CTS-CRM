-- ============================================================
-- TUKI CRM — Cập nhật 12: Quy tắc data chung mới
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================
--   Chưa liên hệ        -> RIÊNG của sale (không ai khác xem được)
--   Không nghe máy      -> chung sau 5 ngày
--   Đang tư vấn         -> chung sau 30 ngày
--   Chốt hợp đồng       -> riêng
--   Đang triển khai     -> riêng
--   Hoàn thành dịch vụ  -> chung ngay
--   Từ chối / Ngừng     -> chung sau 15 ngày
-- ============================================================

create or replace function la_khach_chung(tt text, ngay_lien_he date, ngay_tao timestamptz)
returns boolean
language sql stable as $$
  select case tt
    when 'hoan_thanh'     then true
    when 'khong_nghe_may' then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 5
    when 'dang_tu_van'    then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 30
    when 'tu_choi'        then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 15
    else false
  end;
$$;
