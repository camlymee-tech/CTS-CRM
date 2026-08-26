-- ============================================================
-- TUKI CRM — Cập nhật 9: Phân biệt data được chia vs sale tự nhập
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

alter table customers add column if not exists created_by uuid references profiles(id);
alter table customers add column if not exists nguoi_chia uuid references profiles(id);

comment on column customers.created_by is 'Người tạo bản ghi khách hàng';
comment on column customers.nguoi_chia is 'Người giao khách này cho sale hiện tại. NULL = sale tự nhập hoặc tự nhận';

-- Tự ghi nguồn gốc data: ai tạo, ai chia cho ai
create or replace function ghi_nguon_data()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    -- Người tạo giao ngay cho người khác => đây là data được chia
    if new.sale_id is not null and new.sale_id <> auth.uid() then
      new.nguoi_chia := auth.uid();
    else
      new.nguoi_chia := null;
    end if;
    return new;
  end if;

  if new.sale_id is distinct from old.sale_id then
    if new.sale_id is not null and new.sale_id <> auth.uid() then
      new.nguoi_chia := auth.uid();   -- người khác giao cho sale này
    else
      new.nguoi_chia := null;         -- sale tự nhận data chung => không tính là được chia
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ghi_nguon_data on customers;
create trigger trg_ghi_nguon_data
  before insert or update of sale_id on customers
  for each row execute procedure ghi_nguon_data();

-- Điền dữ liệu cũ: lấy người tạo từ nhật ký
update customers c
set created_by = l.user_id
from customer_logs l
where l.customer_id = c.id
  and l.hanh_dong = 'Tạo khách hàng'
  and c.created_by is null;
