-- ============================================================
-- TUKI CRM — Cập nhật 17: Bảng tính giá bán Shopee
-- Chạy 1 lần trong Supabase SQL Editor
-- ============================================================

create table if not exists shopee_fees (
  id uuid primary key default gen_random_uuid(),
  nganh_1 text not null,
  nganh_2 text not null,
  phi_phan_tram numeric not null,
  ghi_chu text,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_fees_nganh on shopee_fees(nganh_1);
create unique index if not exists uq_fees_nganh on shopee_fees(nganh_1, nganh_2);

insert into shopee_fees (nganh_1, nganh_2, phi_phan_tram) values
('Cameras & Flycam','Camera giám sát',6.87),
('Cameras & Flycam','Ống kính',6.87),
('Cameras & Flycam','Phụ kiện máy ảnh',7.85),
('Cameras & Flycam','Phụ kiện Flycam',7.85),
('Cameras & Flycam','Phụ kiện ống kính',7.85),
('Cameras & Flycam','Phụ kiện chăm sóc máy ảnh',7.85),
('Cameras & Flycam','Flycam',6.87),
('Cameras & Flycam','Máy ảnh',6.87),
('Cameras & Flycam','Khác',6.87),
('Điện Thoại & Phụ Kiện','Máy tính bảng',1.47),
('Điện Thoại & Phụ Kiện','Điện thoại',1.47),
('Điện Thoại & Phụ Kiện','Phụ kiện',9.82),
('Điện Thoại & Phụ Kiện','Thiết bị đeo thông minh',8.84),
('Điện Thoại & Phụ Kiện','Bộ đàm',9.82),
('Điện Thoại & Phụ Kiện','Thẻ sim',9.82),
('Điện Thoại & Phụ Kiện','Khác',8.84),
('Gaming & Console','Phụ kiện console',7.85),
('Gaming & Console','Video Games',7.85),
('Gaming & Console','Máy chơi game',6.87),
('Gaming & Console','Khác',6.87),
('Máy tính & Laptop','Màn Hình',1.47),
('Máy tính & Laptop','Máy Tính Bàn',1.47),
('Máy tính & Laptop','Laptop',1.47),
('Máy tính & Laptop','Phụ Kiện Máy Tính',6.87),
('Máy tính & Laptop','Linh Kiện Máy Tính',6.87),
('Máy tính & Laptop','Máy In & Máy Scan',6.87),
('Máy tính & Laptop','Thiết Bị Lưu Trữ',6.87),
('Máy tính & Laptop','Chuột & Bàn Phím',7.85),
('Máy tính & Laptop','Thiết Bị Văn Phòng',7.85),
('Máy tính & Laptop','Phần Mềm',7.85),
('Máy tính & Laptop','Thiết Bị Mạng',6.87),
('Máy tính & Laptop','Phụ Kiện Máy Tính Khác',6.87),
('Thiết Bị Âm Thanh','Tai nghe nhét tai & chụp tai',7.85),
('Thiết Bị Âm Thanh','Amply và đầu chỉnh âm',7.85),
('Thiết Bị Âm Thanh','Cáp âm thanh/ video & Đầu chuyển',6.87),
('Thiết Bị Âm Thanh','Dàn âm thanh',7.85),
('Thiết Bị Âm Thanh','Máy nghe nhạc',6.87),
('Thiết Bị Âm Thanh','Micro thu âm',7.85),
('Thiết Bị Âm Thanh','Khác',6.87),
('Thiết Bị Điện Gia Dụng','Pin',7.85),
('Thiết Bị Điện Gia Dụng','Mạch điện & Phụ tùng',7.85),
('Thiết Bị Điện Gia Dụng','Máy chiếu & Phụ kiện',7.85),
('Thiết Bị Điện Gia Dụng','Thiết bị điều khiển từ xa',7.85),
('Thiết Bị Điện Gia Dụng','Đồ gia dụng nhà bếp',7.85),
('Thiết Bị Điện Gia Dụng','Thiết bị điện gia dụng nhỏ',6.87),
('Thiết Bị Điện Gia Dụng','Thiết bị điện gia dụng lớn',6.87),
('Thiết Bị Điện Gia Dụng','Tivi & Phụ kiện',6.87),
('Thiết Bị Điện Gia Dụng','Thuốc lá điện tử',8.84),
('Thiết Bị Điện Gia Dụng','Khác',6.87),
('Voucher & Dịch vụ','Sự kiện & Giải trí',9.82),
('Voucher & Dịch vụ','Nhà hàng & Ăn uống',9.82),
('Voucher & Dịch vụ','Mua sắm',9.82),
('Voucher & Dịch vụ','Thanh toán hóa đơn',9.82),
('Voucher & Dịch vụ','Dịch vụ khác',9.82),
('Voucher & Dịch vụ','Sức khỏe & Làm đẹp',9.82),
('Voucher & Dịch vụ','Gọi xe',9.82),
('Voucher & Dịch vụ','Khóa học',9.82),
('Voucher & Dịch vụ','Nạp tiền tài khoản',9.82),
('Voucher & Dịch vụ','Du lịch & Khách sạn',9.82),
('Voucher & Dịch vụ','Tiền điện tử',9.82),
('Voucher & Dịch vụ','Bất động sản',9.82),
('Voucher & Dịch vụ','Thẻ game',9.82),
('Voucher & Dịch vụ','Streaming',9.82),
('Voucher & Dịch vụ','Mã quà tặng Shopee',9.82),
('Voucher & Dịch vụ','Khác',9.82),
('Chăm Sóc Thú Cưng','Quần áo & phụ kiện',10.80),
('Chăm Sóc Thú Cưng','Chăm sóc sức khỏe',10.80),
('Chăm Sóc Thú Cưng','Phụ kiện cho thú cưng',10.80),
('Chăm Sóc Thú Cưng','Thức ăn cho thú cưng',10.80),
('Chăm Sóc Thú Cưng','Làm đẹp cho thú cưng',10.80),
('Chăm Sóc Thú Cưng','Vệ sinh cho thú cưng',10.80),
('Chăm Sóc Thú Cưng','Khác',10.80),
('Mẹ & Bé','An toàn cho bé',10.80),
('Mẹ & Bé','Đồ dùng phòng tắm & Chăm sóc cơ thể',8.84),
('Mẹ & Bé','Đồ dùng ăn dặm cho bé',10.31),
('Mẹ & Bé','Phụ kiện cho mẹ',10.31),
('Mẹ & Bé','Bộ & Gói quà tặng',10.80),
('Mẹ & Bé','Đồ dùng phòng ngủ cho bé',10.31),
('Mẹ & Bé','Chăm sóc sức khỏe mẹ',10.31),
('Mẹ & Bé','Chăm sóc sức khỏe bé',8.84),
('Mẹ & Bé','Tã & bô em bé',8.84),
('Mẹ & Bé','Sữa công thức & Thực phẩm cho bé',8.84),
('Mẹ & Bé','Đồ chơi',10.31),
('Mẹ & Bé','Đồ dùng du lịch cho bé',9.82),
('Mẹ & Bé','Khác',10.80),
('Sắc Đẹp','Chăm sóc da mặt',11.78),
('Sắc Đẹp','Tắm & chăm sóc cơ thể',11.78),
('Sắc Đẹp','Bộ sản phẩm làm đẹp',11.78),
('Sắc Đẹp','Dụng cụ làm đẹp',11.78),
('Sắc Đẹp','Trang điểm',11.78),
('Sắc Đẹp','Nước hoa',11.78),
('Sắc Đẹp','Chăm sóc tóc',11.78),
('Sắc Đẹp','Chăm sóc nam giới',11.78),
('Sắc Đẹp','Chăm sóc tay, chân & móng',11.78),
('Sắc Đẹp','Khác',11.78),
('Sức Khỏe','Chăm sóc cá nhân',11.29),
('Sức Khỏe','Thực phẩm chức năng',11.29),
('Sức Khỏe','Hỗ trợ tình dục',11.78),
('Sức Khỏe','Vật tư y tế',10.31)
on conflict (nganh_1, nganh_2) do nothing;

-- ============ RLS ============
alter table shopee_fees enable row level security;

drop policy if exists "fees_select" on shopee_fees;
create policy "fees_select" on shopee_fees for select using (true);

drop policy if exists "fees_write" on shopee_fees;
create policy "fees_write" on shopee_fees for all
  using (is_admin()) with check (is_admin());
