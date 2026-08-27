-- ============================================================
-- TUKI CRM — Cập nhật 13: Gói dịch vụ và bảng giá
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

create table if not exists service_packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade,
  ten_goi text not null,
  mo_ta text,
  gia numeric not null default 0,
  so_thang int,
  thu_tu int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_packages_service on service_packages(service_id);

-- Ghi nhận gói đã chọn trong từng dòng đơn
alter table order_items add column if not exists package_id uuid references service_packages(id);
alter table order_items add column if not exists ten_goi text;
alter table order_items add column if not exists so_thang int;

-- ============ SEED BẢNG GIÁ ============
-- Xây shop
insert into service_packages (service_id, ten_goi, mo_ta, gia, so_thang, thu_tu)
select s.id, v.ten_goi, v.mo_ta, v.gia, v.so_thang, v.thu_tu
from services s
cross join (values
  ('Khởi Nghiệp', '10 SP chuẩn SEO · 5 SP nội dung chuyên sâu · 5 video bán hàng. Phù hợp shop mới, ngân sách thấp', 7500000, null::int, 1),
  ('VIP 1', '15 SP chuẩn SEO · 8 SP nội dung chuyên sâu · 8 video bán hàng · Kế hoạch marketing nội sàn. Phù hợp shop muốn tăng chuyển đổi', 12500000, null::int, 2),
  ('VIP 2', '25 SP chuẩn SEO · 12 SP nội dung chuyên sâu · 12 video bán hàng · Kế hoạch marketing nội sàn. Phù hợp shop đang tăng trưởng', 18600000, null::int, 3),
  ('Premium', '35 SP chuẩn SEO · 20 SP nội dung chuyên sâu · 20 video bán hàng · Đào tạo 1-1 & chuyển giao. Phù hợp shop lớn / thương hiệu nghiêm túc', 25000000, null::int, 4)
) as v(ten_goi, mo_ta, gia, so_thang, thu_tu)
where s.ten_dich_vu = 'Xây shop'
  and not exists (select 1 from service_packages p where p.service_id = s.id and p.ten_goi = v.ten_goi);

-- Chạy quảng cáo (mỗi gói có mốc 1 tháng và 3 tháng)
insert into service_packages (service_id, ten_goi, mo_ta, gia, so_thang, thu_tu)
select s.id, v.ten_goi, v.mo_ta, v.gia, v.so_thang, v.thu_tu
from services s
cross join (values
  ('Basic - 1 tháng', '5 sản phẩm quảng cáo · Báo cáo 2 tuần/lần. Phù hợp shop mới test ads', 3240000, 1, 1),
  ('Basic - 3 tháng', '5 sản phẩm quảng cáo · Báo cáo 2 tuần/lần. Phù hợp shop mới test ads', 8640000, 3, 2),
  ('Plus - 1 tháng', 'Tối đa 10 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing', 5400000, 1, 3),
  ('Plus - 3 tháng', 'Tối đa 10 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing', 14040000, 3, 4),
  ('Pro - 1 tháng', 'Tối đa 20 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing. Phù hợp shop lớn muốn bứt phá', 9720000, 1, 5),
  ('Pro - 3 tháng', 'Tối đa 20 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing. Phù hợp shop lớn muốn bứt phá', 24840000, 3, 6)
) as v(ten_goi, mo_ta, gia, so_thang, thu_tu)
where s.ten_dich_vu = 'Chạy quảng cáo'
  and not exists (select 1 from service_packages p where p.service_id = s.id and p.ten_goi = v.ten_goi);

-- ============ RLS ============
alter table service_packages enable row level security;

drop policy if exists "packages_select" on service_packages;
create policy "packages_select" on service_packages for select using (true);

drop policy if exists "packages_write" on service_packages;
create policy "packages_write" on service_packages for all
  using (is_admin()) with check (is_admin());
