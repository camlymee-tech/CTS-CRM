-- ============================================================
-- TUKI CRM — Cập nhật 15: Checklist công việc
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) DANH SÁCH VIỆC ============
create table if not exists checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  tieu_de text not null,
  mo_ta text,
  loai text not null default 'ca_nhan' check (loai in ('co_dinh','ca_nhan')),
  -- co_dinh: lặp lại mỗi ngày, áp dụng cho toàn team (user_id = null)
  -- ca_nhan: việc riêng của một người trong một ngày cụ thể
  user_id uuid references profiles(id) on delete cascade,
  ngay date,
  thu_tu int default 0,
  active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_tasks_loai on checklist_tasks(loai, active);
create index if not exists idx_tasks_user_ngay on checklist_tasks(user_id, ngay);

-- ============ 2) ĐÁNH DẤU HOÀN THÀNH THEO NGÀY ============
create table if not exists checklist_done (
  task_id uuid not null references checklist_tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  ngay date not null default current_date,
  done_at timestamptz default now(),
  primary key (task_id, user_id, ngay)
);

create index if not exists idx_done_user_ngay on checklist_done(user_id, ngay);

-- ============ 3) VIỆC CỐ ĐỊNH MẪU ============
insert into checklist_tasks (tieu_de, mo_ta, loai, thu_tu)
select * from (values
  ('Gọi lại khách đến hạn chăm sóc', 'Xử lý hết danh sách khách bên dưới, ghi lại nội dung và đặt lịch hẹn tiếp', 'co_dinh', 1),
  ('Xử lý data mới được chia', 'Liên hệ khách mới nhận trong ngày, cập nhật trạng thái ngay sau khi gọi', 'co_dinh', 2),
  ('Cập nhật trạng thái khách đang tư vấn', 'Rà lại nhóm đang tư vấn, đẩy tiếp hoặc chốt', 'co_dinh', 3),
  ('Báo cáo cuối ngày cho quản lý', 'Số data đã gọi, số khách vào tư vấn, số chốt trong ngày', 'co_dinh', 4)
) as v(tieu_de, mo_ta, loai, thu_tu)
where not exists (select 1 from checklist_tasks where loai = 'co_dinh');

-- ============ 4) RLS ============
alter table checklist_tasks enable row level security;
alter table checklist_done enable row level security;

-- Việc cố định ai cũng xem được; việc cá nhân chỉ chủ nhân và admin xem
drop policy if exists "tasks_select" on checklist_tasks;
create policy "tasks_select" on checklist_tasks for select
  using (loai = 'co_dinh' or user_id = auth.uid() or is_admin());

-- Chỉ admin tạo được việc cố định; ai cũng tạo được việc cá nhân của mình
drop policy if exists "tasks_insert" on checklist_tasks;
create policy "tasks_insert" on checklist_tasks for insert
  with check (
    (loai = 'co_dinh' and is_admin())
    or (loai = 'ca_nhan' and user_id = auth.uid())
  );

drop policy if exists "tasks_update" on checklist_tasks;
create policy "tasks_update" on checklist_tasks for update
  using ((loai = 'co_dinh' and is_admin()) or user_id = auth.uid());

drop policy if exists "tasks_delete" on checklist_tasks;
create policy "tasks_delete" on checklist_tasks for delete
  using ((loai = 'co_dinh' and is_admin()) or user_id = auth.uid());

-- Đánh dấu hoàn thành: mỗi người tự quản lý của mình
drop policy if exists "done_select" on checklist_done;
create policy "done_select" on checklist_done for select
  using (user_id = auth.uid() or is_admin());

drop policy if exists "done_insert" on checklist_done;
create policy "done_insert" on checklist_done for insert
  with check (user_id = auth.uid());

drop policy if exists "done_delete" on checklist_done;
create policy "done_delete" on checklist_done for delete
  using (user_id = auth.uid());
