-- ============================================================
-- CTS CRM — Cập nhật 41: Sale xem được báo cáo của phòng mình
-- Chạy 1 lần trong Supabase SQL Editor (chạy lại nhiều lần cũng an toàn)
--
-- Sale vẫn KHÔNG xem được danh sách khách của đồng nghiệp.
-- Các hàm dưới đây chỉ trả số liệu thô cho báo cáo (mã khách, trạng thái, ngày),
-- không có tên khách, số điện thoại hay nội dung trao đổi, và chỉ cho người cùng phòng ban.
-- ============================================================

create or replace function team_khach()
returns table (id uuid, sale_id uuid, trang_thai_cham_soc text, created_at timestamptz, ngay_lien_he_gan_nhat text)
language sql stable security definer set search_path = public as $$
  select c.id, c.sale_id, c.trang_thai_cham_soc::text, c.created_at, c.ngay_lien_he_gan_nhat::text
  from customers c
  join profiles t on t.id = c.sale_id
  join profiles me on me.id = auth.uid() and coalesce(me.active, true)
    and me.phong_ban is not null and t.phong_ban = me.phong_ban
  order by c.id;
$$;

create or replace function team_logs()
returns table (customer_id uuid, user_id uuid, hanh_dong text, chi_tiet text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.customer_id, l.user_id, l.hanh_dong::text, l.chi_tiet::text, l.created_at
  from customer_logs l
  join profiles t on t.id = l.user_id
  join profiles me on me.id = auth.uid() and coalesce(me.active, true)
    and me.phong_ban is not null and t.phong_ban = me.phong_ban
  where l.hanh_dong = 'Đổi trạng thái'
  order by l.created_at desc, l.id;
$$;

create or replace function team_interactions()
returns table (customer_id uuid, sale_id uuid, ngay_thuc_hien text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.customer_id, i.sale_id, i.ngay_thuc_hien::text, i.created_at
  from customer_interactions i
  join profiles t on t.id = i.sale_id
  join profiles me on me.id = auth.uid() and coalesce(me.active, true)
    and me.phong_ban is not null and t.phong_ban = me.phong_ban
  order by i.id;
$$;

create or replace function team_muc_tieu_so()
returns table (user_id uuid, ngay text, loai text, muc_tieu numeric)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.ngay::text, s.loai::text, s.muc_tieu::numeric
  from muc_tieu_so s
  join profiles t on t.id = s.user_id
  join profiles me on me.id = auth.uid() and coalesce(me.active, true)
    and me.phong_ban is not null and t.phong_ban = me.phong_ban
  order by s.user_id, s.ngay, s.loai;
$$;

create or replace function team_muc_tieu_ngay()
returns table (user_id uuid, ngay text, customer_id uuid)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.ngay::text, m.customer_id
  from muc_tieu_ngay m
  join profiles t on t.id = m.user_id
  join profiles me on me.id = auth.uid() and coalesce(me.active, true)
    and me.phong_ban is not null and t.phong_ban = me.phong_ban
  order by m.user_id, m.ngay, m.customer_id;
$$;

grant execute on function team_khach(), team_logs(), team_interactions(), team_muc_tieu_so(), team_muc_tieu_ngay() to authenticated;
