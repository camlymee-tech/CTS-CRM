-- ============================================================
-- TUKI CRM — Cập nhật 11: Chặn trùng số điện thoại khách hàng
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- Chuẩn hoá số: bỏ mọi ký tự không phải chữ số
create or replace function chuan_hoa_sdt(s text)
returns text
language sql immutable as $$
  select nullif(regexp_replace(coalesce(s, ''), '\D', '', 'g'), '');
$$;

-- Chặn tạo mới / sửa sang số đã tồn tại
create or replace function chan_trung_sdt()
returns trigger as $$
declare
  ten_trung text;
  ma_trung text;
begin
  if chuan_hoa_sdt(new.sdt) is null then
    return new;
  end if;

  -- Chỉ kiểm tra khi thêm mới hoặc khi số điện thoại thực sự thay đổi
  if tg_op = 'UPDATE' and chuan_hoa_sdt(new.sdt) = chuan_hoa_sdt(old.sdt) then
    return new;
  end if;

  select ten_khach, ma_khach into ten_trung, ma_trung
  from customers
  where id <> new.id
    and chuan_hoa_sdt(sdt) = chuan_hoa_sdt(new.sdt)
  limit 1;

  if ten_trung is not null then
    raise exception 'SDT_TRUNG: Số điện thoại này đã thuộc về khách "%" (%)', ten_trung, ma_trung;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_chan_trung_sdt on customers;
create trigger trg_chan_trung_sdt
  before insert or update of sdt on customers
  for each row execute procedure chan_trung_sdt();

-- Xem các số đang bị trùng sẵn trong dữ liệu cũ (nếu có, nên gộp/sửa thủ công)
-- select chuan_hoa_sdt(sdt) as so, count(*), string_agg(ten_khach || ' (' || ma_khach || ')', ', ')
-- from customers where chuan_hoa_sdt(sdt) is not null
-- group by 1 having count(*) > 1;
