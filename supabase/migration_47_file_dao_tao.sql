-- ============================================================
-- CTS CRM — Cập nhật 47: Đính kèm file (slide, PDF, Word…) vào bài đào tạo
-- Chạy 1 lần trong Supabase SQL Editor (sau migration_45). Dùng chung kho file "tai-lieu" đã có.
-- Ai đăng nhập cũng xem/tải được; chỉ admin được tải lên và xoá.
-- ============================================================
create table if not exists dao_tao_file (
  id uuid primary key default gen_random_uuid(),
  bai_id uuid not null references dao_tao_bai(id) on delete cascade,
  ten_file text not null,
  duong_dan text not null,
  loai text,
  kich_thuoc bigint,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists idx_dao_tao_file_bai on dao_tao_file(bai_id);
alter table dao_tao_file enable row level security;
drop policy if exists dao_tao_file_xem on dao_tao_file;
create policy dao_tao_file_xem on dao_tao_file for select using (auth.uid() is not null);
drop policy if exists dao_tao_file_admin on dao_tao_file;
create policy dao_tao_file_admin on dao_tao_file for all using (is_admin()) with check (is_admin());
