-- ============================================================
-- TUKI CRM — Cập nhật 29: Tách đơn hàng khỏi hợp đồng
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================
-- Nguyên tắc mới: 1 khách - 1 hợp đồng cho MỖI dịch vụ khách dùng.
-- Một dịch vụ có thể được khách đăng ký lại nhiều lần (tái ký) —
-- đơn tái ký chỉ là thêm đơn hàng/doanh số, KHÔNG tự sinh hợp đồng mới.
-- Đơn mới (lần đầu dùng dịch vụ đó) vẫn tự sinh hợp đồng như cũ.

-- ============ 1) THÊM CỘT PHÂN LOẠI ĐƠN ============
alter table orders add column if not exists loai_don text not null default 'moi'
  check (loai_don in ('moi', 'tai_ky'));
alter table orders add column if not exists tai_ky_hop_dong_id uuid references contracts(id);

-- ============ 2) SỬA TRIGGER: ĐƠN TÁI KÝ KHÔNG TỰ TẠO HỢP ĐỒNG ============
create or replace function tu_tao_hop_dong()
returns trigger as $$
begin
  if new.trang_thai = 'huy' then
    return new;
  end if;

  if new.loai_don = 'tai_ky' then
    -- Đơn tái ký: dùng lại hợp đồng đã có (tai_ky_hop_dong_id), không tạo hợp đồng mới
    return new;
  end if;

  insert into contracts (customer_id, order_id, gia_tri, ngay_ky, thoi_han_thang, trang_thai)
  values (new.customer_id, new.id, new.gia_tri, new.ngay_chot, new.so_thang, 'hieu_luc');

  return new;
end;
$$ language plpgsql security definer;
-- (trigger trg_tu_tao_hop_dong đã trỏ sẵn vào hàm này từ trước, không cần tạo lại)
