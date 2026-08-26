-- ============================================================
-- TUKI CRM — Cập nhật 8: Quyền xoá dữ liệu
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- Vấn đề/giải pháp: người tạo hoặc admin được xoá
drop policy if exists "issues_write" on customer_issues;

drop policy if exists "issues_insert" on customer_issues;
create policy "issues_insert" on customer_issues for insert
  with check (exists (select 1 from customers c where c.id = customer_id));

drop policy if exists "issues_update" on customer_issues;
create policy "issues_update" on customer_issues for update
  using (exists (select 1 from customers c where c.id = customer_id));

drop policy if exists "issues_delete" on customer_issues;
create policy "issues_delete" on customer_issues for delete
  using (created_by = auth.uid() or is_admin());

-- Lịch sử chăm sóc: người ghi hoặc admin được xoá
drop policy if exists "interactions_delete" on customer_interactions;
create policy "interactions_delete" on customer_interactions for delete
  using (sale_id = auth.uid() or is_admin());

-- Khách hàng: sale phụ trách hoặc admin được xoá
drop policy if exists "customers_delete" on customers;
create policy "customers_delete" on customers for delete
  using (is_admin() or sale_id = auth.uid());
