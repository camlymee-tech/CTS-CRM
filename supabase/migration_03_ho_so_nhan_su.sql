-- ============================================================
-- TUKI CRM — Cập nhật 3: Hồ sơ nhân sự đầy đủ
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

alter table profiles add column if not exists email text;
alter table profiles add column if not exists sdt text;
alter table profiles add column if not exists sdt_lam_viec text;
alter table profiles add column if not exists ngay_sinh date;
alter table profiles add column if not exists ngay_vao_cty date;
alter table profiles add column if not exists link_fb text;

-- Lưu sẵn email vào hồ sơ khi tạo tài khoản mới
create or replace function handle_new_user()
returns trigger as $$
declare
  so_nguoi int;
begin
  select count(*) into so_nguoi from public.profiles;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case when so_nguoi = 0 then 'admin' else 'sale' end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Điền email cho các hồ sơ đã tạo trước đó
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;
