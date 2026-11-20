-- ============================================================
-- CTS CRM — Cập nhật 44: Số điện thoại +84 / 84 / 0 coi là cùng một số
-- Chạy 1 lần trong Supabase SQL Editor (sau migration_43)
-- ============================================================
create or replace function chuan_hoa_sdt(s text)
returns text
language sql immutable as $$
  select nullif(
    case
      when regexp_replace(coalesce(s, ''), '\D', '', 'g') ~ '^84[0-9]{9,10}$'
        then '0' || substr(regexp_replace(coalesce(s, ''), '\D', '', 'g'), 3)
      else regexp_replace(coalesce(s, ''), '\D', '', 'g')
    end, '');
$$;

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
  where length(coalesce(chuan_hoa_sdt(p_sdt), '')) >= 8
    and chuan_hoa_sdt(c.sdt) = chuan_hoa_sdt(p_sdt);
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
  select chuan_hoa_sdt(c.sdt) as so, bool_or(coalesce(s.la_chot, false)) as da_chot
  from customers c
  left join customer_statuses s on s.ma = c.trang_thai_cham_soc
  where length(chuan_hoa_sdt(c.sdt)) >= 8
    and chuan_hoa_sdt(c.sdt) in (
      select chuan_hoa_sdt(x) from unnest(p_ds) x
    )
  group by 1;
$$;

revoke all on function sdt_da_co(text[]) from public;
grant execute on function sdt_da_co(text[]) to authenticated;

