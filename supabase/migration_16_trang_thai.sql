-- ============================================================
-- TUKI CRM — Cập nhật 16: Trạng thái khách hàng tự quản lý
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

create table if not exists customer_statuses (
  ma text primary key,
  ten text not null,
  mau text not null default 'slate',
  thu_tu int not null default 0,
  active boolean not null default true,
  -- Tính là đã ký hợp đồng: loại khỏi danh sách cần chăm sóc, dùng cho báo cáo
  la_chot boolean not null default false,
  -- Chuyển sang trạng thái này thì app mời tạo đơn dịch vụ
  tao_don boolean not null default false,
  -- Số ngày im lặng thì khách thành data chung. NULL = không bao giờ. 0 = ngay lập tức
  chung_sau_ngay int,
  created_at timestamptz default now()
);

insert into customer_statuses (ma, ten, mau, thu_tu, la_chot, tao_don, chung_sau_ngay)
select * from (values
  ('chua_lien_he',    'Chưa liên hệ',       'slate',   1, false, false, null::int),
  ('khong_nghe_may',  'Không nghe máy',     'orange',  2, false, false, 5),
  ('dang_tu_van',     'Đang tư vấn',        'amber',   3, false, false, 30),
  ('da_ky',           'Chốt hợp đồng',      'emerald', 4, true,  true,  null::int),
  ('dang_trien_khai', 'Đang triển khai',    'teal',    5, true,  false, null::int),
  ('hoan_thanh',      'Hoàn thành dịch vụ', 'violet',  6, true,  false, 0),
  ('tu_choi',         'Từ chối / Ngừng',    'rose',    7, false, false, 15)
) as v(ma, ten, mau, thu_tu, la_chot, tao_don, chung_sau_ngay)
where not exists (select 1 from customer_statuses);

-- Bỏ ràng buộc cứng, chuyển sang khoá ngoại tới bảng trạng thái
alter table customers drop constraint if exists customers_trang_thai_cham_soc_check;
alter table customers drop constraint if exists customers_trang_thai_fk;
alter table customers add constraint customers_trang_thai_fk
  foreign key (trang_thai_cham_soc) references customer_statuses(ma);

-- Quy tắc data chung đọc thẳng từ bảng trạng thái
create or replace function la_khach_chung(tt text, ngay_lien_he date, ngay_tao timestamptz)
returns boolean
language sql stable as $$
  select case
    when s.chung_sau_ngay is null then false
    else coalesce(ngay_lien_he, ngay_tao::date) <= current_date - s.chung_sau_ngay
  end
  from customer_statuses s
  where s.ma = tt;
$$;

-- ============ RLS ============
alter table customer_statuses enable row level security;

drop policy if exists "statuses_select" on customer_statuses;
create policy "statuses_select" on customer_statuses for select using (true);

drop policy if exists "statuses_write" on customer_statuses;
create policy "statuses_write" on customer_statuses for all
  using (is_admin()) with check (is_admin());
