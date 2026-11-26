-- ============================================================
-- CTS CRM — Cập nhật 48: Vá lỗ hổng phân quyền
-- Chạy 1 lần trong Supabase SQL Editor (chạy lại nhiều lần cũng an toàn)
-- ============================================================

-- 1) CHẶN SALE TỰ NÂNG QUYỀN
-- Trước đây ai cũng sửa được dòng hồ sơ của mình, kể cả cột role -> có thể tự đổi thành admin.
-- Từ giờ: chỉ admin được đổi role, phòng ban, trạng thái hoạt động. (Chạy từ SQL Editor vẫn được.)
create or replace function chan_tu_nang_quyen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role
       or new.phong_ban is distinct from old.phong_ban
       or new.active is distinct from old.active then
      raise exception 'Chỉ quản trị mới được đổi vai trò, phòng ban hoặc trạng thái nhân sự';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_chan_tu_nang_quyen on profiles;
create trigger trg_chan_tu_nang_quyen before update on profiles
  for each row execute procedure chan_tu_nang_quyen();

-- 2) LEADER XEM ĐƠN DỊCH VỤ CỦA TEAM MÌNH
-- Trước đây bảng orders / order_items chỉ cho admin và chính sale -> leader xem báo cáo doanh thu team bị thiếu.
drop policy if exists "orders_leader_select" on orders;
create policy "orders_leader_select" on orders for select
  using (la_leader() and xem_duoc_nhan_su(sale_id));

drop policy if exists "order_items_leader_select" on order_items;
create policy "order_items_leader_select" on order_items for select
  using (la_leader() and exists (select 1 from orders o where o.id = order_id and xem_duoc_nhan_su(o.sale_id)));

notify pgrst, 'reload schema';
