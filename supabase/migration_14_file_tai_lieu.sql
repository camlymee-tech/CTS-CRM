-- ============================================================
-- TUKI CRM — Cập nhật 14: Tải file cứng lên tài liệu
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

-- ============ 1) KHO LƯU FILE ============
insert into storage.buckets (id, name, public)
values ('tai-lieu', 'tai-lieu', false)
on conflict (id) do nothing;

-- Ai đăng nhập cũng xem/tải được; chỉ admin được tải lên và xoá
drop policy if exists "tai_lieu_doc" on storage.objects;
create policy "tai_lieu_doc" on storage.objects for select
  using (bucket_id = 'tai-lieu' and auth.role() = 'authenticated');

drop policy if exists "tai_lieu_tai_len" on storage.objects;
create policy "tai_lieu_tai_len" on storage.objects for insert
  with check (bucket_id = 'tai-lieu' and is_admin());

drop policy if exists "tai_lieu_xoa" on storage.objects;
create policy "tai_lieu_xoa" on storage.objects for delete
  using (bucket_id = 'tai-lieu' and is_admin());

-- ============ 2) DANH SÁCH FILE THEO TÀI LIỆU ============
create table if not exists document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  ten_file text not null,
  duong_dan text not null,
  loai text,
  kich_thuoc bigint,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_document_files_doc on document_files(document_id);

alter table document_files enable row level security;

drop policy if exists "doc_files_select" on document_files;
create policy "doc_files_select" on document_files for select using (true);

drop policy if exists "doc_files_write" on document_files;
create policy "doc_files_write" on document_files for all
  using (is_admin()) with check (is_admin());
