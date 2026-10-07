-- Danh mục tuỳ chỉnh: Nguồn khách, Dịch vụ (thêm / sửa tên / tắt)
create table if not exists danh_muc (
  loai text not null,
  value text not null,
  label text not null,
  active boolean not null default true,
  thu_tu int not null default 0,
  primary key (loai, value)
);
alter table danh_muc enable row level security;
drop policy if exists danh_muc_doc on danh_muc;
drop policy if exists danh_muc_ghi on danh_muc;
create policy danh_muc_doc on danh_muc for select using (auth.uid() is not null);
create policy danh_muc_ghi on danh_muc for all using (is_admin()) with check (is_admin());
