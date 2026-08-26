-- ============================================================
-- TUKI CRM — Schema khởi tạo
-- Chạy toàn bộ file này trong Supabase SQL Editor (1 lần duy nhất)
-- ============================================================

-- 1) PROFILES (hồ sơ nhân viên sale, gắn với tài khoản đăng nhập)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  ma_sale text,
  role text not null default 'sale' check (role in ('sale','admin')),
  created_at timestamptz default now()
);

-- Tự tạo profile khi có tài khoản mới đăng ký
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'sale');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2) CUSTOMERS (khách hàng)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  ma_khach text unique,
  ten_khach text not null,
  ten_shop text,
  sdt text,
  nen_tang text[] default '{}',            -- shopee / tiktok
  nganh_hang text,
  loai_khach text not null default 'moi' check (loai_khach in ('moi','cu')),
  nguon_khach text,                         -- gioi_thieu / tu_tim / marketing / khac
  dich_vu text[] default '{}',              -- tên các dịch vụ đang dùng
  trang_thai_cham_soc text not null default 'tiep_can'
    check (trang_thai_cham_soc in ('tiep_can','tu_van','da_ky','dang_trien_khai','tam_dung','ngung')),
  sale_id uuid references profiles(id),
  ngay_lien_he_gan_nhat date,
  ngay_cham_soc_tiep_theo date,
  ghi_chu text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_customers_sale on customers(sale_id);
create index if not exists idx_customers_loai on customers(loai_khach);
create index if not exists idx_customers_trangthai on customers(trang_thai_cham_soc);

-- Tự sinh mã khách hàng dạng KH-000001 nếu không nhập
create sequence if not exists customer_code_seq start 1;
create or replace function gen_ma_khach()
returns trigger as $$
begin
  if new.ma_khach is null or new.ma_khach = '' then
    new.ma_khach := 'KH-' || lpad(nextval('customer_code_seq')::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gen_ma_khach on customers;
create trigger trg_gen_ma_khach
  before insert or update on customers
  for each row execute procedure gen_ma_khach();

-- 3) CUSTOMER_INTERACTIONS (lịch sử chăm sóc)
create table if not exists customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  sale_id uuid references profiles(id),
  loai text default 'khac' check (loai in ('goi_dien','nhan_tin','gap_mat','khac')),
  noi_dung text not null,
  ngay_thuc_hien timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_interactions_customer on customer_interactions(customer_id);

-- 4) SERVICES (danh mục dịch vụ — nền tảng cho module lên đơn sau này)
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  ten_dich_vu text not null,
  mo_ta text,
  gia_mac_dinh numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

insert into services (ten_dich_vu, mo_ta, gia_mac_dinh)
select * from (values
  ('Tối ưu sản phẩm', 'Tối ưu tiêu đề, hình ảnh, mô tả sản phẩm', 0),
  ('Tối ưu quảng cáo', 'Quản lý & tối ưu chiến dịch quảng cáo Shopee/TikTok Ads', 0),
  ('Vận hành gian hàng', 'Vận hành toàn diện shop: đơn hàng, tồn kho, chat khách', 0),
  ('Gói trọn gói', 'Kết hợp tối ưu sản phẩm + quảng cáo + vận hành', 0)
) as v(ten_dich_vu, mo_ta, gia_mac_dinh)
where not exists (select 1 from services);

-- 5) ORDERS (đơn dịch vụ — nền tảng, UI xây ở giai đoạn sau)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ma_don text unique,
  customer_id uuid references customers(id),
  service_id uuid references services(id),
  sale_id uuid references profiles(id),
  gia_tri numeric default 0,
  trang_thai text default 'moi' check (trang_thai in ('moi','dang_xu_ly','hoan_thanh','huy')),
  ngay_len_don date default current_date,
  ghi_chu text,
  created_at timestamptz default now()
);

-- 6) CONTRACTS (hợp đồng — nền tảng, UI xây ở giai đoạn sau)
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  so_hop_dong text unique,
  customer_id uuid references customers(id),
  order_id uuid references orders(id),
  gia_tri numeric default 0,
  ngay_ky date,
  thoi_han_thang int,
  trang_thai text default 'hieu_luc' check (trang_thai in ('hieu_luc','het_han','da_huy')),
  file_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Sale chỉ thấy khách của mình; admin thấy tất cả
-- ============================================================
alter table profiles enable row level security;
alter table customers enable row level security;
alter table customer_interactions enable row level security;
alter table services enable row level security;
alter table orders enable row level security;
alter table contracts enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer;

-- profiles: ai cũng xem được (để hiện tên sale trong dropdown), chỉ tự sửa hồ sơ mình
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- customers
drop policy if exists "customers_select" on customers;
create policy "customers_select" on customers for select
  using (is_admin() or sale_id = auth.uid());
drop policy if exists "customers_insert" on customers;
create policy "customers_insert" on customers for insert
  with check (is_admin() or sale_id = auth.uid());
drop policy if exists "customers_update" on customers;
create policy "customers_update" on customers for update
  using (is_admin() or sale_id = auth.uid());
drop policy if exists "customers_delete" on customers;
create policy "customers_delete" on customers for delete
  using (is_admin() or sale_id = auth.uid());

-- customer_interactions
drop policy if exists "interactions_select" on customer_interactions;
create policy "interactions_select" on customer_interactions for select
  using (is_admin() or exists(select 1 from customers c where c.id = customer_id and c.sale_id = auth.uid()));
drop policy if exists "interactions_insert" on customer_interactions;
create policy "interactions_insert" on customer_interactions for insert
  with check (is_admin() or exists(select 1 from customers c where c.id = customer_id and c.sale_id = auth.uid()));
drop policy if exists "interactions_update" on customer_interactions;
create policy "interactions_update" on customer_interactions for update
  using (is_admin() or sale_id = auth.uid());
drop policy if exists "interactions_delete" on customer_interactions;
create policy "interactions_delete" on customer_interactions for delete
  using (is_admin() or sale_id = auth.uid());

-- services: ai cũng xem, chỉ admin sửa
drop policy if exists "services_select" on services;
create policy "services_select" on services for select using (true);
drop policy if exists "services_write" on services;
create policy "services_write" on services for all using (is_admin());

-- orders / contracts: cùng logic như customers (dùng ở module sau)
drop policy if exists "orders_select" on orders;
create policy "orders_select" on orders for select using (is_admin() or sale_id = auth.uid());
drop policy if exists "orders_write" on orders;
create policy "orders_write" on orders for all using (is_admin() or sale_id = auth.uid());

drop policy if exists "contracts_select" on contracts;
create policy "contracts_select" on contracts for select
  using (is_admin() or exists(select 1 from customers c where c.id = customer_id and c.sale_id = auth.uid()));
drop policy if exists "contracts_write" on contracts;
create policy "contracts_write" on contracts for all
  using (is_admin() or exists(select 1 from customers c where c.id = customer_id and c.sale_id = auth.uid()));
