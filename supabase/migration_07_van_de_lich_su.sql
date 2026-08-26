-- ============================================================
-- TUKI CRM — Cập nhật 7: Trạng thái mới, Vấn đề/Giải pháp, Nhật ký thay đổi
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) TRẠNG THÁI: tam_dung -> hoan_thanh + tu_choi ============
alter table customers drop constraint if exists customers_trang_thai_cham_soc_check;

update customers set trang_thai_cham_soc = 'tu_choi' where trang_thai_cham_soc = 'tam_dung';

alter table customers add constraint customers_trang_thai_cham_soc_check
  check (trang_thai_cham_soc in
    ('chua_lien_he','khong_nghe_may','dang_tu_van','da_ky','dang_trien_khai','hoan_thanh','tu_choi'));

-- Khách chung: hoàn thành KHÔNG vào data chung (giữ cho sale tái ký)
create or replace function la_khach_chung(tt text, ngay_lien_he date, ngay_tao timestamptz)
returns boolean
language sql stable as $$
  select case tt
    when 'chua_lien_he'   then true
    when 'tu_choi'        then true
    when 'khong_nghe_may' then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 5
    when 'dang_tu_van'    then coalesce(ngay_lien_he, ngay_tao::date) <= current_date - 30
    else false
  end;
$$;

-- ============ 2) VẤN ĐỀ & GIẢI PHÁP ============
create table if not exists customer_issues (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  van_de text not null,
  giai_phap text,
  trang_thai text not null default 'dang_xu_ly'
    check (trang_thai in ('dang_xu_ly','da_giai_quyet')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_issues_customer on customer_issues(customer_id);

-- ============ 3) NHẬT KÝ THAY ĐỔI ============
create table if not exists customer_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  user_id uuid references profiles(id),
  hanh_dong text not null,
  chi_tiet text,
  created_at timestamptz default now()
);

create index if not exists idx_logs_customer on customer_logs(customer_id, created_at desc);

-- Tự ghi nhật ký mỗi khi sửa thông tin khách
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

  if new.ghi_chu is distinct from old.ghi_chu then
    insert into customer_logs (customer_id, user_id, hanh_dong, chi_tiet)
    values (new.id, auth.uid(), 'Sửa ghi chú', null);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ghi_nhat_ky_khach on customers;
create trigger trg_ghi_nhat_ky_khach
  after insert or update on customers
  for each row execute procedure ghi_nhat_ky_khach();

-- ============ 4) RLS ============
alter table customer_issues enable row level security;
alter table customer_logs enable row level security;

-- Vấn đề/giải pháp: ai xem được khách thì xem được, ai sửa được khách thì ghi được
drop policy if exists "issues_select" on customer_issues;
create policy "issues_select" on customer_issues for select
  using (exists (select 1 from customers c where c.id = customer_id));

drop policy if exists "issues_write" on customer_issues;
create policy "issues_write" on customer_issues for all
  using (exists (select 1 from customers c where c.id = customer_id))
  with check (exists (select 1 from customers c where c.id = customer_id));

-- Nhật ký: chỉ đọc, không ai sửa/xoá được (trigger tự ghi)
drop policy if exists "logs_select" on customer_logs;
create policy "logs_select" on customer_logs for select
  using (exists (select 1 from customers c where c.id = customer_id));
