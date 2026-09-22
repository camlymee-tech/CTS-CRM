-- ============================================================
-- TUKI CRM — Cập nhật 25: Lưu nội dung triển khai của hợp đồng
-- Chạy 1 lần trong Supabase SQL Editor
-- Phục vụ tính năng "Xem trước hợp đồng" ngay trong app: khi đã
-- xuất file 1 lần, bảng nội dung triển khai được lưu lại để có thể
-- xem trước lại bất cứ lúc nào từ danh sách, không cần mở lại form.
-- ============================================================

alter table contracts add column if not exists noi_dung_hd text;
