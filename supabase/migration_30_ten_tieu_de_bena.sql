-- ============================================================
-- TUKI CRM — Cập nhật 30: Tên Bên A dùng ở tiêu đề hợp đồng
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================
-- Tên công ty (nếu khách là công ty) hiển thị ở dòng tiêu đề
-- "I. BÊN SỬ DỤNG DỊCH VỤ: ..." trong file hợp đồng — lưu vào hồ sơ
-- khách hàng để dùng lại cho các hợp đồng sau, không cần gõ lại mỗi lần.
alter table customers add column if not exists ten_tieu_de_bena text;
