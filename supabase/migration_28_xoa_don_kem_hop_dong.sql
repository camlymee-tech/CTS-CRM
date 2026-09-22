-- ============================================================
-- TUKI CRM — Cập nhật 28: Cho phép xoá đơn dịch vụ
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================
-- Trước đây, hợp đồng tự sinh của đơn (contracts.order_id) không có
-- ON DELETE CASCADE, nên bấm "Xoá đơn" sẽ bị chặn ngầm bởi ràng buộc
-- khoá ngoại (không báo lỗi trên giao diện, đơn vẫn còn nguyên).
-- Sửa lại: xoá đơn thì hợp đồng gắn với đơn đó cũng tự xoá theo.

alter table contracts drop constraint if exists contracts_order_id_fkey;
alter table contracts add constraint contracts_order_id_fkey
  foreign key (order_id) references orders(id) on delete cascade;
