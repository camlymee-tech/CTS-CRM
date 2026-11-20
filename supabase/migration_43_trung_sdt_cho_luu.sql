-- ============================================================
-- TUKI CRM — Cập nhật 43: Trùng số điện thoại — cảnh báo nhưng vẫn cho lưu (trừ khách đã CHỐT)
-- Chạy 1 lần trong Supabase SQL Editor
--  • Số điện thoại trùng với khách ĐÃ CHỐT: vẫn chặn lưu.
--  • Số điện thoại trùng với khách chưa chốt: cảnh báo, vẫn cho lưu (mỗi sale có hồ sơ riêng của mình).
--  • Sale chỉ xem được hồ sơ do mình phụ trách; leader xem được hồ sơ của cả team; admin xem tất cả
--    (quy tắc xem này đã có sẵn trong phân quyền khách hàng, không đổi).
--  • Khi kiểm tra trùng, sale KHÔNG thấy thông tin khách của người khác (trừ khách đã chốt, để biết của ai).
-- ============================================================

-- 1) Chỉ chặn khi số trùng với khách đã chốt
create or replace function chan_trung_sdt()
returns trigger as $$
declare
  ten_trung text;
  ma_trung text;
begin
  if chuan_hoa_sdt(new.sdt) is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and chuan_hoa_sdt(new.sdt) = chuan_hoa_sdt(old.sdt) then
    return new;
  end if;

  select c.ten_khach, c.ma_khach into ten_trung, ma_trung
  from customers c
  join customer_statuses s on s.ma = c.trang_thai_cham_soc and s.la_chot
  where c.id <> new.id
    and chuan_hoa_sdt(c.sdt) = chuan_hoa_sdt(new.sdt)
  limit 1;

  if ten_trung is not null then
    raise exception 'SDT_TRUNG: Số điện thoại này thuộc về khách đã chốt "%" (%)', ten_trung, ma_trung;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2) Tra cứu trùng số: chỉ trả thông tin chi tiết khi người hỏi được phép xem khách đó, hoặc khách đã chốt
drop function if exists tim_khach_theo_sdt(text);
create or replace function tim_khach_theo_sdt(p_sdt text)
returns table (id uuid, da_chot boolean, xem_duoc boolean, thong_tin jsonb)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    coalesce(s.la_chot, false) as da_chot,
    v.xem as xem_duoc,
    case when v.xem or coalesce(s.la_chot, false) then to_jsonb(c) else null end as thong_tin
  from customers c
  left join customer_statuses s on s.ma = c.trang_thai_cham_soc
  cross join lateral (
    select (
      is_admin()
      or c.sale_id = auth.uid()
      or c.sale_id is null
      or la_khach_chung(c.trang_thai_cham_soc, c.ngay_lien_he_gan_nhat, c.created_at)
      or (la_leader() and xem_duoc_nhan_su(c.sale_id))
    ) as xem
  ) v
  where length(regexp_replace(coalesce(p_sdt, ''), '\D', '', 'g')) >= 8
    and regexp_replace(coalesce(c.sdt, ''), '\D', '', 'g') = regexp_replace(p_sdt, '\D', '', 'g');
$$;

revoke all on function tim_khach_theo_sdt(text) from public;
grant execute on function tim_khach_theo_sdt(text) to authenticated;

-- 3) Tải khách từ file Excel cũng theo quy tắc trên: hỏi số nào đã có (và có phải khách đã chốt không), không lộ thông tin khách
drop function if exists sdt_da_co(text[]);
create or replace function sdt_da_co(p_ds text[])
returns table (so text, da_chot boolean)
language sql
security definer
set search_path = public
as $$
  select regexp_replace(coalesce(c.sdt, ''), '\D', '', 'g') as so, bool_or(coalesce(s.la_chot, false)) as da_chot
  from customers c
  left join customer_statuses s on s.ma = c.trang_thai_cham_soc
  where length(regexp_replace(coalesce(c.sdt, ''), '\D', '', 'g')) >= 8
    and regexp_replace(coalesce(c.sdt, ''), '\D', '', 'g') in (
      select regexp_replace(x, '\D', '', 'g') from unnest(p_ds) x
    )
  group by 1;
$$;

revoke all on function sdt_da_co(text[]) from public;
grant execute on function sdt_da_co(text[]) to authenticated;

-- 4) Danh sách hồ sơ cùng số điện thoại (hiện trong chi tiết khách)
--    Hồ sơ nào người xem được phép xem (admin: tất cả; leader: cả team; sale: của mình) hoặc đã chốt thì có đủ thông tin,
--    hồ sơ còn lại chỉ được đếm (xem_duoc = false), không lộ thông tin.
drop function if exists ho_so_trung_sdt(text);
create or replace function ho_so_trung_sdt(p_sdt text)
returns table (
  id uuid, ten_khach text, sale_ten text, phong_ban text, trang_thai text, da_chot boolean,
  lien_he_gan_nhat date, ngay_tao timestamptz, xem_duoc boolean
)
language sql
security definer
set search_path = public
as $$
  with ds as (
    select c.*, coalesce(s.la_chot, false) as chot,
      (is_admin() or c.sale_id = auth.uid() or c.sale_id is null
        or la_khach_chung(c.trang_thai_cham_soc, c.ngay_lien_he_gan_nhat, c.created_at)
        or (la_leader() and xem_duoc_nhan_su(c.sale_id))) as xem
    from customers c
    left join customer_statuses s on s.ma = c.trang_thai_cham_soc
    where chuan_hoa_sdt(c.sdt) is not null and chuan_hoa_sdt(c.sdt) = chuan_hoa_sdt(p_sdt)
  )
  select d.id,
    case when d.xem or d.chot then d.ten_khach end,
    case when d.xem or d.chot then (select p.full_name from profiles p where p.id = d.sale_id) end,
    case when d.xem or d.chot then (select p.phong_ban from profiles p where p.id = d.sale_id) end,
    case when d.xem or d.chot then (select st.ten from customer_statuses st where st.ma = d.trang_thai_cham_soc) end,
    d.chot,
    case when d.xem or d.chot then d.ngay_lien_he_gan_nhat end,
    case when d.xem or d.chot then d.created_at end,
    d.xem
  from ds d
  order by d.created_at;
$$;

revoke all on function ho_so_trung_sdt(text) from public;
grant execute on function ho_so_trung_sdt(text) to authenticated;
