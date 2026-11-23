-- ============================================================
-- CTS CRM — Cập nhật 45: Đào tạo sale mới (lộ trình 3 ngày + bài test)
-- Chạy 1 lần trong Supabase SQL Editor
--  • dao_tao_bai: danh sách bài học theo ngày (admin thêm / sửa / xoá, nội dung và link bổ sung sau)
--  • dao_tao_tien_do: mỗi sale đã học xong bài nào
-- ============================================================
create table if not exists dao_tao_bai (
  id uuid primary key default gen_random_uuid(),
  ngay int not null check (ngay between 1 and 7),
  thu_tu int not null default 1,
  tieu_de text not null,
  loai text not null default 'doc' check (loai in ('doc', 'video', 'thuc_hanh')),
  phut int not null default 20,
  noi_dung text,
  link text,
  created_at timestamptz default now()
);

create table if not exists dao_tao_tien_do (
  user_id uuid not null references profiles(id) on delete cascade,
  bai_id uuid not null references dao_tao_bai(id) on delete cascade,
  xong_luc timestamptz default now(),
  primary key (user_id, bai_id)
);

alter table dao_tao_bai enable row level security;
alter table dao_tao_tien_do enable row level security;

drop policy if exists dao_tao_bai_xem on dao_tao_bai;
create policy dao_tao_bai_xem on dao_tao_bai for select using (auth.uid() is not null);
drop policy if exists dao_tao_bai_admin on dao_tao_bai;
create policy dao_tao_bai_admin on dao_tao_bai for all using (is_admin()) with check (is_admin());

drop policy if exists dao_tao_td_xem on dao_tao_tien_do;
create policy dao_tao_td_xem on dao_tao_tien_do for select
  using (user_id = auth.uid() or is_admin() or (la_leader() and xem_duoc_nhan_su(user_id)));
drop policy if exists dao_tao_td_them on dao_tao_tien_do;
create policy dao_tao_td_them on dao_tao_tien_do for insert with check (user_id = auth.uid());
drop policy if exists dao_tao_td_xoa on dao_tao_tien_do;
create policy dao_tao_td_xoa on dao_tao_tien_do for delete using (user_id = auth.uid());

-- Bài học mẫu (nội dung chi tiết và link sẽ bổ sung sau trong CRM)
insert into dao_tao_bai (ngay, thu_tu, tieu_de, loai, phut)
select * from (values
  (1,1,'Giới thiệu CTS và khách hàng mục tiêu','doc',15),
  (1,2,'4 dịch vụ: vận chuyển, uỷ thác, mua bán, order','video',30),
  (1,3,'Quy trình 1 đơn hàng từ Trung Quốc về Việt Nam','doc',20),
  (1,4,'Thuật ngữ XNK: VAT, thuế NK, cước KG/M3','doc',20),
  (1,5,'Làm quen CRM: đăng nhập, menu, khách hàng','thuc_hanh',25),
  (2,1,'Báo giá vận chuyển (KG, M3, phí gửi tàu)','thuc_hanh',30),
  (2,2,'Báo giá uỷ thác: tiền hàng thanh toán hộ','thuc_hanh',30),
  (2,3,'Báo giá mua bán và giá trung bình/KG','thuc_hanh',20),
  (2,4,'Báo giá order: giá xưởng và giá về tay','thuc_hanh',30),
  (2,5,'Nhập khách, trạng thái, lịch gọi lại','thuc_hanh',25),
  (2,6,'Kịch bản gọi điện lần đầu','video',20),
  (3,1,'Xử lý từ chối: "giá cao", "đang có đơn vị khác"','video',25),
  (3,2,'Câu hỏi thường gặp của khách','doc',20),
  (3,3,'Sau khi chốt: hợp đồng, đơn dịch vụ','thuc_hanh',30),
  (3,4,'Gọi thử với leader (đóng vai)','thuc_hanh',40),
  (3,5,'Ôn tập và tổng hợp lỗi hay gặp','doc',20)
) as v(ngay, thu_tu, tieu_de, loai, phut)
where not exists (select 1 from dao_tao_bai);
