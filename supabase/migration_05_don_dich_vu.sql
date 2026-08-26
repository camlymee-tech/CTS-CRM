-- ============================================================
-- TUKI CRM — Cập nhật 5: Trạng thái mới, Dịch vụ, Đơn dịch vụ
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) TRẠNG THÁI CHĂM SÓC MỚI ============
alter table customers drop constraint if exists customers_trang_thai_cham_soc_check;

update customers set trang_thai_cham_soc = 'chua_lien_he'  where trang_thai_cham_soc = 'tiep_can';
update customers set trang_thai_cham_soc = 'dang_tu_van'   where trang_thai_cham_soc = 'tu_van';
update customers set trang_thai_cham_soc = 'tam_dung'      where trang_thai_cham_soc = 'ngung';

alter table customers
  alter column trang_thai_cham_soc set default 'chua_lien_he';

alter table customers add constraint customers_trang_thai_cham_soc_check
  check (trang_thai_cham_soc in
    ('chua_lien_he','khong_nghe_may','dang_tu_van','da_ky','dang_trien_khai','tam_dung'));

-- ============ 2) DANH MỤC DỊCH VỤ ============
delete from services where not exists (select 1 from orders o where o.service_id = services.id);

insert into services (ten_dich_vu, mo_ta, gia_mac_dinh)
select * from (values
  ('Chạy quảng cáo', 'Quản lý & tối ưu chiến dịch quảng cáo Shopee / TikTok Ads', 0),
  ('Xây shop', 'Xây dựng & vận hành gian hàng: tối ưu sản phẩm, hình ảnh, đơn hàng', 0)
) as v(ten_dich_vu, mo_ta, gia_mac_dinh)
where not exists (select 1 from services s where s.ten_dich_vu = v.ten_dich_vu);

-- ============ 3) ĐƠN DỊCH VỤ ============
alter table orders add column if not exists ngay_chot date default current_date;
alter table orders add column if not exists so_thang int;
alter table orders drop column if exists service_id;

-- Mỗi đơn có thể gồm nhiều dịch vụ
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid references services(id),
  ten_dich_vu text not null,
  gia numeric not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_orders_sale on orders(sale_id);
create index if not exists idx_orders_ngay_chot on orders(ngay_chot);

-- Số đơn tự sinh dạng DH-202608-001
create sequence if not exists order_code_seq start 1;
create or replace function gen_ma_don()
returns trigger as $$
begin
  if new.ma_don is null or new.ma_don = '' then
    new.ma_don := 'DH-' || to_char(coalesce(new.ngay_chot, current_date), 'YYYYMM')
                  || '-' || lpad(nextval('order_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gen_ma_don on orders;
create trigger trg_gen_ma_don
  before insert on orders
  for each row execute procedure gen_ma_don();

-- ============ 4) RLS CHO order_items ============
alter table order_items enable row level security;

drop policy if exists "order_items_select" on order_items;
create policy "order_items_select" on order_items for select
  using (is_admin() or exists(select 1 from orders o where o.id = order_id and o.sale_id = auth.uid()));

drop policy if exists "order_items_write" on order_items;
create policy "order_items_write" on order_items for all
  using (is_admin() or exists(select 1 from orders o where o.id = order_id and o.sale_id = auth.uid()))
  with check (is_admin() or exists(select 1 from orders o where o.id = order_id and o.sale_id = auth.uid()));

-- Cập nhật lại trigger thông báo chốt đơn (bỏ tham chiếu service_id đã xoá)
create or replace function notify_new_order()
returns trigger as $$
declare
  ten_khach_hang text;
  ten_sale text;
begin
  select ten_khach into ten_khach_hang from customers where id = new.customer_id;
  select full_name into ten_sale from profiles where id = new.sale_id;

  insert into notifications (loai, tieu_de, noi_dung, created_by)
  values (
    'don_hang',
    'Chốt đơn mới' || coalesce(' — ' || ten_sale, ''),
    'Khách hàng: ' || coalesce(ten_khach_hang, 'chưa rõ')
      || ' · Giá trị: ' || to_char(coalesce(new.gia_tri, 0), 'FM999,999,999,999') || ' đ',
    new.sale_id
  );
  return new;
end;
$$ language plpgsql security definer;
