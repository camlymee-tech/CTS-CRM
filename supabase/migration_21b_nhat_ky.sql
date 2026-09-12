-- Bổ sung ghi nhật ký cho Vấn đề / Giải pháp / Gói tư vấn
create or replace function ghi_nhat_ky_khach()
returns trigger as $$
declare
  ten_cu text;
  ten_moi text;
begin
  if tg_op = 'INSERT' then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Tạo khách hàng', new.ten_khach);
    return new;
  end if;

  if new.sale_id is distinct from old.sale_id then
    select full_name into ten_cu  from profiles where id = old.sale_id;
    select full_name into ten_moi from profiles where id = new.sale_id;
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Chuyển sale phụ trách',
            coalesce(ten_cu, 'Chưa gán') || ' → ' || coalesce(ten_moi, 'Chưa gán'));
  end if;

  if new.trang_thai_cham_soc is distinct from old.trang_thai_cham_soc then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Đổi trạng thái',
            old.trang_thai_cham_soc || ' → ' || new.trang_thai_cham_soc);
  end if;

  if new.sdt is distinct from old.sdt then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Sửa số điện thoại',
            coalesce(old.sdt, 'trống') || ' → ' || coalesce(new.sdt, 'trống'));
  end if;

  if new.dich_vu is distinct from old.dich_vu then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Sửa dịch vụ quan tâm',
            array_to_string(coalesce(new.dich_vu, '{}'), ', '));
  end if;

  if new.ten_khach is distinct from old.ten_khach then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Đổi tên khách', old.ten_khach || ' → ' || new.ten_khach);
  end if;

  if new.van_de is distinct from old.van_de then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Cập nhật vấn đề', null);
  end if;

  if new.giai_phap is distinct from old.giai_phap then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Cập nhật giải pháp', null);
  end if;

  if new.goi_tu_van is distinct from old.goi_tu_van then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Cập nhật gói tư vấn', null);
  end if;

  return new;
end;
$$ language plpgsql security definer;
