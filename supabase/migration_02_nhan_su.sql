-- ============================================================
-- TUKI CRM — Cập nhật 2: Quản lý nhân sự trên web
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- 1) Thêm cột khoá/mở tài khoản
alter table profiles add column if not exists active boolean not null default true;

-- 2) Người đăng ký ĐẦU TIÊN tự động là admin, các người sau là sale
create or replace function handle_new_user()
returns trigger as $$
declare
  so_nguoi int;
begin
  select count(*) into so_nguoi from public.profiles;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when so_nguoi = 0 then 'admin' else 'sale' end
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3) Nâng tài khoản đăng ký sớm nhất lên admin (nếu hiện chưa có admin nào)
update profiles
set role = 'admin'
where id = (select id from profiles order by created_at asc limit 1)
  and not exists (select 1 from profiles where role = 'admin');

-- 4) Cho phép admin sửa hồ sơ của mọi người (đổi vai trò, khoá tài khoản)
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id or is_admin());

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin" on profiles for delete
  using (is_admin());
