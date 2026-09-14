-- ============================================================
-- TUKI CRM — Cập nhật 22: Admin xoá được khách đã có đơn
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- Bỏ chặn cứng cũ. Thay bằng: admin xoá được tất cả;
-- sale chỉ xoá được khách CHƯA có đơn dịch vụ.
create or replace function chan_xoa_khach_co_hop_dong()
returns trigger as $$
declare
  la_admin boolean;
  so_don int;
begin
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin') into la_admin;
  if la_admin then
    return old;   -- admin xoá thoải mái, đơn & hợp đồng tự xoá theo (ON DELETE CASCADE)
  end if;

  select count(*) into so_don from orders where customer_id = old.id;
  if so_don > 0 then
    raise exception 'KHACH_CO_DON: Khách hàng đã có đơn dịch vụ, chỉ quản trị viên mới xoá được.';
  end if;
  return old;
end;
$$ language plpgsql;

-- Đảm bảo đơn & hợp đồng tự xoá khi xoá khách (tránh lỗi ràng buộc)
alter table orders   drop constraint if exists orders_customer_id_fkey;
alter table orders   add  constraint orders_customer_id_fkey
  foreign key (customer_id) references customers(id) on delete cascade;

alter table contracts drop constraint if exists contracts_customer_id_fkey;
alter table contracts add  constraint contracts_customer_id_fkey
  foreign key (customer_id) references customers(id) on delete cascade;
