-- ============================================================
-- TUKI CRM — Cập nhật 6: Link FB/shop, quyền xem khách chung
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) TRƯỜNG MỚI ============
alter table customers add column if not exists link_fb text;
alter table customers add column if not exists link_shop text;

-- ============ 2) QUY TẮC "KHÁCH CHUNG" ============
-- Khách rơi vào các trạng thái sau thì cả team đều xem được:
--   - Chưa liên hệ
--   - Tạm dừng
--   - Không nghe máy, quá 5 ngày chưa liên hệ lại
--   - Đang tư vấn, quá 30 ngày chưa chốt
create or replace function la_khach_chung(tt text, ngay_lien_he date, ngay_tao timestamptz)
returns boolean
language sql stable as $$
  select case tt
    when 'chua_lien_he'   then true
    when 'tam_dung'       then true
    when 'khong_nghe_may' then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 5
    when 'dang_tu_van'    then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 30
    else false
  end;
$$;

-- ============ 3) RLS MỚI CHO customers ============
drop policy if exists "customers_select" on customers;
create policy "customers_select" on customers for select
  using (
    is_admin()
    or sale_id = auth.uid()
    or sale_id is null
    or la_khach_chung(trang_thai_cham_soc, ngay_lien_he_gan_nhat, created_at)
  );

-- Sale nhận được khách chung về mình; khách đã có chủ thì chỉ chủ hoặc admin sửa
drop policy if exists "customers_update" on customers;
create policy "customers_update" on customers for update
  using (
    is_admin()
    or sale_id = auth.uid()
    or sale_id is null
    or la_khach_chung(trang_thai_cham_soc, ngay_lien_he_gan_nhat, created_at)
  )
  with check (
    is_admin()
    or sale_id = auth.uid()
  );

-- ============ 4) TRA CỨU THEO SỐ ĐIỆN THOẠI ============
-- Nhập đúng SĐT thì xem được khách đó dù không phải khách của mình
-- (chống trùng số khi sale mới lấy data)
create or replace function tim_khach_theo_sdt(p_sdt text)
returns setof customers
language sql
security definer
set search_path = public
as $$
  select *
  from customers
  where length(regexp_replace(coalesce(p_sdt, ''), '\D', '', 'g')) >= 8
    and regexp_replace(coalesce(sdt, ''), '\D', '', 'g')
      = regexp_replace(p_sdt, '\D', '', 'g');
$$;

revoke all on function tim_khach_theo_sdt(text) from public;
grant execute on function tim_khach_theo_sdt(text) to authenticated;
