-- ============================================================
-- TUKI CRM — Cập nhật 4: Tài liệu & Thông báo
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) TÀI LIỆU ============
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tieu_de text not null,
  danh_muc text not null default 'tai_lieu_cong_viec'
    check (danh_muc in ('tai_lieu_cong_viec','dao_tao_sale','quy_dinh','chinh_sach','kiem_tra')),
  mo_ta text,
  noi_dung text,
  link_ngoai text,
  ghim boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_documents_danh_muc on documents(danh_muc);

-- ============ 2) THÔNG BÁO ============
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  loai text not null default 'chung'
    check (loai in ('chung','tai_lieu','chia_khach','don_hang','sinh_nhat')),
  tieu_de text not null,
  noi_dung text,
  target_user_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_notifications_created on notifications(created_at desc);

create table if not exists notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (notification_id, user_id)
);

-- ============ 3) TỰ ĐỘNG TẠO THÔNG BÁO ============
create or replace function notify_new_document()
returns trigger as $$
declare
  ten_danh_muc text;
begin
  ten_danh_muc := case new.danh_muc
    when 'quy_dinh' then 'Quy định mới'
    when 'chinh_sach' then 'Chính sách mới'
    when 'dao_tao_sale' then 'Tài liệu đào tạo mới'
    when 'kiem_tra' then 'Bài kiểm tra mới'
    else 'Tài liệu mới' end;

  insert into notifications (loai, tieu_de, noi_dung, created_by)
  values (
    'tai_lieu',
    ten_danh_muc || ': ' || new.tieu_de,
    coalesce(new.mo_ta, 'Vào mục Tài liệu để xem chi tiết.'),
    new.created_by
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_document on documents;
create trigger trg_notify_new_document
  after insert on documents
  for each row execute procedure notify_new_document();

create or replace function notify_customer_assigned()
returns trigger as $$
begin
  if new.sale_id is not null
     and (tg_op = 'INSERT' or new.sale_id is distinct from old.sale_id)
     and new.sale_id <> auth.uid() then
    insert into notifications (loai, tieu_de, noi_dung, target_user_id, created_by)
    values (
      'chia_khach',
      'Bạn được giao khách hàng mới',
      'Khách hàng: ' || new.ten_khach || coalesce(' (' || new.ma_khach || ')', ''),
      new.sale_id,
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_customer_assigned on customers;
create trigger trg_notify_customer_assigned
  after insert or update of sale_id on customers
  for each row execute procedure notify_customer_assigned();

create or replace function notify_new_order()
returns trigger as $$
declare
  ten_khach_hang text;
  ten_sale text;
begin
  select ten_khach into ten_khach_hang from customers where id = new.customer_id;
  select full_name into ten_sale from profiles where id = new.sale_id;

  insert into notifications (loai, tieu_de, noi_dung, created_by)
  values (
    'don_hang',
    'Chốt đơn mới' || coalesce(' — ' || ten_sale, ''),
    'Khách hàng: ' || coalesce(ten_khach_hang, 'chưa rõ')
      || ' · Giá trị: ' || to_char(coalesce(new.gia_tri, 0), 'FM999,999,999,999') || ' đ',
    new.sale_id
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_order on orders;
create trigger trg_notify_new_order
  after insert on orders
  for each row execute procedure notify_new_order();

-- ============ 4) ROW LEVEL SECURITY ============
alter table documents enable row level security;
alter table notifications enable row level security;
alter table notification_reads enable row level security;

drop policy if exists "documents_select" on documents;
create policy "documents_select" on documents for select using (true);
drop policy if exists "documents_write" on documents;
create policy "documents_write" on documents for all using (is_admin()) with check (is_admin());

drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select
  using (target_user_id is null or target_user_id = auth.uid());
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert with check (is_admin());
drop policy if exists "notifications_delete" on notifications;
create policy "notifications_delete" on notifications for delete using (is_admin());

drop policy if exists "reads_select" on notification_reads;
create policy "reads_select" on notification_reads for select using (user_id = auth.uid());
drop policy if exists "reads_insert" on notification_reads;
create policy "reads_insert" on notification_reads for insert with check (user_id = auth.uid());
drop policy if exists "reads_delete" on notification_reads;
create policy "reads_delete" on notification_reads for delete using (user_id = auth.uid());
