-- ============================================================
-- TUKI CRM — Cập nhật 21: Vấn đề / Giải pháp / Gói tư vấn gọn
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

alter table customers add column if not exists van_de text;
alter table customers add column if not exists giai_phap text;
alter table customers add column if not exists goi_tu_van text;

-- Chuyển ghi chú cũ sang ô Vấn đề (nếu chưa có vấn đề)
update customers set van_de = ghi_chu
where van_de is null and ghi_chu is not null and ghi_chu <> '';

-- Gộp dữ liệu từ bảng vấn đề cũ (nếu có) vào 2 ô mới, lấy bản ghi mới nhất
update customers c set
  van_de = coalesce(c.van_de, sub.van_de),
  giai_phap = coalesce(c.giai_phap, sub.giai_phap)
from (
  select distinct on (customer_id) customer_id, van_de, giai_phap
  from customer_issues
  order by customer_id, created_at desc
) sub
where sub.customer_id = c.id
  and (c.van_de is null or c.giai_phap is null);
