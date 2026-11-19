-- ============================================================
-- TUKI CRM — Cập nhật 42: Nhật ký cuộc gọi + ghi âm
-- Chạy 1 lần trong Supabase SQL Editor
-- Cuộc gọi sẽ do phần mềm gọi đẩy vào (qua hàm nhận cuộc gọi, làm ở bước sau);
-- khớp với khách theo số điện thoại, gắn với sale đã gọi từ CRM.
-- ============================================================

create table if not exists cuoc_goi (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,   -- khách khớp theo số điện thoại (có thể trống nếu chưa khớp được)
  sale_id uuid references profiles(id),                           -- sale gọi từ CRM
  so_dien_thoai text,                                             -- số của khách
  huong text not null default 'di' check (huong in ('di', 'den')),   -- gọi đi / gọi đến
  trang_thai text not null default 'nghe_may' check (trang_thai in ('nghe_may', 'khong_nghe', 'ban', 'tu_choi')),
  bat_dau timestamptz not null default now(),
  thoi_luong_giay integer not null default 0,
  link_ghi_am text,                                               -- đường dẫn file ghi âm từ phần mềm gọi
  ghi_chu text,
  nguon text,                                                     -- tên phần mềm gọi
  ma_ngoai text unique,                                           -- mã cuộc gọi bên phần mềm gọi (chống ghi trùng)
  created_at timestamptz default now()
);

create index if not exists idx_cuoc_goi_khach on cuoc_goi(customer_id, bat_dau desc);
create index if not exists idx_cuoc_goi_sale on cuoc_goi(sale_id, bat_dau desc);

alter table cuoc_goi enable row level security;

-- Xem: ai xem được khách thì xem được cuộc gọi (và ghi âm) của khách đó
drop policy if exists cuoc_goi_select on cuoc_goi;
create policy cuoc_goi_select on cuoc_goi for select
  using (exists (select 1 from customers c where c.id = customer_id));

-- Sửa ghi chú: quản trị, hoặc sale đã gọi cuộc đó
drop policy if exists cuoc_goi_update on cuoc_goi;
create policy cuoc_goi_update on cuoc_goi for update
  using (is_admin() or sale_id = auth.uid())
  with check (is_admin() or sale_id = auth.uid());

-- Xoá: chỉ quản trị
drop policy if exists cuoc_goi_delete on cuoc_goi;
create policy cuoc_goi_delete on cuoc_goi for delete using (is_admin());

-- Thêm cuộc gọi: do hàm phía máy chủ ghi vào (không cho sale tự thêm)
