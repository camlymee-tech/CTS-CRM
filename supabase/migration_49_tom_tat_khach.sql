-- ============================================================
-- CTS CRM — Cập nhật 49: Tóm tắt khách cho trang Khách hàng (tải nhanh hơn)
-- Chạy 1 lần trong Supabase SQL Editor (chạy lại nhiều lần cũng an toàn). Không sửa / xoá dữ liệu nào.
-- ============================================================
-- Trước đây trang Khách hàng tải TOÀN BỘ nhật ký và lịch sử chăm sóc (hàng nghìn dòng, tăng mỗi ngày)
-- chỉ để lấy dòng mới nhất + đếm số lượt của từng khách. Hàm này tính sẵn trên database: mỗi khách 1 mục,
-- trả về gọn trong 1 lần gọi (dạng JSON, không bị giới hạn 1.000 dòng nên không phải gọi nhiều lần).
-- Chưa chạy file này thì app vẫn chạy bình thường theo cách cũ (chậm hơn).
--
-- Quyền: hàm chạy với quyền NGƯỜI GỌI (security invoker) -> chỉ thấy đúng những dòng người đó được xem,
-- y như khi app đọc thẳng từng bảng.
--
-- Mỗi mục là 1 mảng theo thứ tự:
--   [mã khách, nhật ký mới nhất: hành động, người làm, thời gian,
--    lần chăm sóc gần nhất: loại, sale, nội dung, thời gian, số lượt chăm sóc]

drop function if exists tom_tat_khach();   -- bản thử đầu tiên trả về dạng bảng; đổi kiểu trả về thì phải xoá trước

create or replace function tom_tat_khach()
returns jsonb
language sql stable security invoker set search_path = public as $$
  with nk as (
    select distinct on (l.customer_id)
      l.customer_id, l.hanh_dong, l.user_id, to_json(l.created_at) #>> '{}' as created_at
    from customer_logs l
    order by l.customer_id, l.created_at desc, l.id
  ),
  cs as (
    select i.*,
      coalesce(to_json(i.ngay_thuc_hien) #>> '{}', to_json(i.created_at) #>> '{}', '') as tg
    from customer_interactions i
  ),
  td as (
    select distinct on (cs.customer_id)
      cs.customer_id, coalesce(nullif(cs.loai, ''), 'khac') as loai, cs.sale_id, cs.noi_dung, cs.tg
    from cs
    order by cs.customer_id, cs.tg collate "C" desc, cs.ngay_thuc_hien desc, cs.id
  ),
  dem as (
    select i.customer_id, count(*)::int as so from customer_interactions i group by i.customer_id
  ),
  ids as (
    select nk.customer_id from nk union select td.customer_id from td
  )
  select coalesce(jsonb_agg(jsonb_build_array(
    ids.customer_id,
    nk.hanh_dong, nk.user_id, nk.created_at,
    td.loai, td.sale_id, td.noi_dung, td.tg,
    coalesce(dem.so, 0)
  )), '[]'::jsonb)
  from ids
  left join nk on nk.customer_id = ids.customer_id
  left join td on td.customer_id = ids.customer_id
  left join dem on dem.customer_id = ids.customer_id
$$;

revoke all on function tom_tat_khach() from public, anon;
grant execute on function tom_tat_khach() to authenticated, service_role;

-- Kiểm tra (chạy riêng nếu muốn): số khách có nhật ký / chăm sóc
-- select jsonb_array_length(tom_tat_khach());
