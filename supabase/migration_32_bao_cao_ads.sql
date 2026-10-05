-- ============================================================
-- TUKI CRM — Cập nhật 32: Ghi nhận báo cáo chỉ số ADS định kỳ (2 tuần/lần)
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

create table if not exists ads_bao_cao (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  ngay_bao_cao date not null default current_date,
  ghi_chu text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_ads_bao_cao_hd on ads_bao_cao(contract_id, ngay_bao_cao desc);

alter table ads_bao_cao enable row level security;

-- Xem: ai xem được khách thì xem được báo cáo của khách đó
drop policy if exists ads_bao_cao_select on ads_bao_cao;
create policy ads_bao_cao_select on ads_bao_cao for select
  using (exists (select 1 from customers c where c.id = customer_id));

-- Thêm / sửa / xoá: quản trị, hoặc sale phụ trách đơn của hợp đồng đó
drop policy if exists ads_bao_cao_write on ads_bao_cao;
create policy ads_bao_cao_write on ads_bao_cao for all
  using (is_admin() or exists (
    select 1 from contracts h join orders o on o.id = h.order_id
    where h.id = contract_id and o.sale_id = auth.uid()))
  with check (is_admin() or exists (
    select 1 from contracts h join orders o on o.id = h.order_id
    where h.id = contract_id and o.sale_id = auth.uid()));
