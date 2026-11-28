-- Mục tiêu hàng tháng của từng nhân sự (và mục tiêu chung cả team)
create table if not exists public.muc_tieu_nhan_su (
  id uuid primary key default gen_random_uuid(),
  thang text not null,                 -- dạng 2026-10
  sale_key text not null,              -- id nhân sự, hoặc 'team' cho mục tiêu cả team
  du_lieu jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (thang, sale_key)
);
alter table public.muc_tieu_nhan_su enable row level security;
drop policy if exists "muc_tieu_all" on public.muc_tieu_nhan_su;
create policy "muc_tieu_all" on public.muc_tieu_nhan_su for all to authenticated using (true) with check (true);
