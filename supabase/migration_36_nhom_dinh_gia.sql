-- Nhóm sản phẩm đã tính giá (Tính giá bán Shopee)
create table if not exists public.nhom_dinh_gia (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  ghi_chu text,
  du_lieu jsonb not null default '[]'::jsonb,   -- danh sách sản phẩm và thông số tính
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nhom_dinh_gia enable row level security;
drop policy if exists "nhom_dinh_gia_all" on public.nhom_dinh_gia;
create policy "nhom_dinh_gia_all" on public.nhom_dinh_gia for all to authenticated using (true) with check (true);
