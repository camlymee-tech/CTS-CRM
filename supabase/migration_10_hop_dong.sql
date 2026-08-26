-- ============================================================
-- TUKI CRM — Cập nhật 10: Hợp đồng tự sinh từ đơn dịch vụ
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) BỔ SUNG CỘT CHO HỢP ĐỒNG ============
alter table contracts add column if not exists ngay_het_han date;
alter table contracts add column if not exists ghi_chu text;
alter table contracts add column if not exists created_at timestamptz default now();

-- ============ 2) SỐ HỢP ĐỒNG TỰ SINH: HD-202608-001 ============
create sequence if not exists contract_code_seq start 1;

create or replace function gen_so_hop_dong()
returns trigger as $$
begin
  if new.so_hop_dong is null or new.so_hop_dong = '' then
    new.so_hop_dong := 'HD-' || to_char(coalesce(new.ngay_ky, current_date), 'YYYYMM')
                       || '-' || lpad(nextval('contract_code_seq')::text, 3, '0');
  end if;
  -- Tự tính ngày hết hạn từ thời hạn tháng
  if new.ngay_het_han is null and new.ngay_ky is not null and new.thoi_han_thang is not null then
    new.ngay_het_han := (new.ngay_ky + (new.thoi_han_thang || ' months')::interval)::date;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gen_so_hop_dong on contracts;
create trigger trg_gen_so_hop_dong
  before insert or update on contracts
  for each row execute procedure gen_so_hop_dong();

-- ============ 3) TẠO ĐƠN DỊCH VỤ => TỰ TẠO HỢP ĐỒNG ============
create or replace function tu_tao_hop_dong()
returns trigger as $$
begin
  if new.trang_thai = 'huy' then
    return new;
  end if;

  insert into contracts (customer_id, order_id, gia_tri, ngay_ky, thoi_han_thang, trang_thai)
  values (new.customer_id, new.id, new.gia_tri, new.ngay_chot, new.so_thang, 'hieu_luc');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_tu_tao_hop_dong on orders;
create trigger trg_tu_tao_hop_dong
  after insert on orders
  for each row execute procedure tu_tao_hop_dong();

-- Sửa đơn thì hợp đồng cập nhật theo
create or replace function dong_bo_hop_dong()
returns trigger as $$
begin
  update contracts
  set gia_tri = new.gia_tri,
      ngay_ky = new.ngay_chot,
      thoi_han_thang = new.so_thang,
      ngay_het_han = case
        when new.ngay_chot is not null and new.so_thang is not null
        then (new.ngay_chot + (new.so_thang || ' months')::interval)::date
        else ngay_het_han end,
      trang_thai = case when new.trang_thai = 'huy' then 'da_huy' else trang_thai end
  where order_id = new.id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_dong_bo_hop_dong on orders;
create trigger trg_dong_bo_hop_dong
  after update on orders
  for each row execute procedure dong_bo_hop_dong();

-- Tạo hợp đồng cho các đơn đã có từ trước
insert into contracts (customer_id, order_id, gia_tri, ngay_ky, thoi_han_thang, trang_thai)
select o.customer_id, o.id, o.gia_tri, o.ngay_chot, o.so_thang, 'hieu_luc'
from orders o
where o.trang_thai <> 'huy'
  and not exists (select 1 from contracts c where c.order_id = o.id);

-- ============ 4) KHÔNG XOÁ ĐƯỢC KHÁCH ĐÃ CÓ ĐƠN / HỢP ĐỒNG ============
create or replace function chan_xoa_khach_co_hop_dong()
returns trigger as $$
declare
  so_don int;
begin
  select count(*) into so_don from orders where customer_id = old.id;
  if so_don > 0 then
    raise exception 'Không thể xoá khách hàng đã có đơn dịch vụ hoặc hợp đồng. Dữ liệu này phải được lưu lại.';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_chan_xoa_khach on customers;
create trigger trg_chan_xoa_khach
  before delete on customers
  for each row execute procedure chan_xoa_khach_co_hop_dong();

-- ============ 5) RLS ============
drop policy if exists "contracts_select" on contracts;
create policy "contracts_select" on contracts for select
  using (exists (select 1 from customers c where c.id = customer_id));

drop policy if exists "contracts_write" on contracts;
create policy "contracts_write" on contracts for all
  using (is_admin() or exists (select 1 from orders o where o.id = order_id and o.sale_id = auth.uid()))
  with check (is_admin() or exists (select 1 from orders o where o.id = order_id and o.sale_id = auth.uid()));
