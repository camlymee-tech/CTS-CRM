-- ============================================================
-- TUKI CRM — Cập nhật 24: Bảng giá dịch vụ 2026
-- Chạy 1 lần trong Supabase SQL Editor
-- Gồm: thêm cột số sản phẩm & nội dung hợp đồng cho gói dịch vụ,
-- cập nhật lại gói Xây shop / Chạy quảng cáo, thêm dịch vụ mới
-- Tối ưu sản phẩm và Dịch vụ bổ sung (Follow Shop, Nhân bản Shop)
-- ============================================================

-- ============ 1) THÊM CỘT CHO service_packages ============
alter table service_packages add column if not exists so_san_pham int;
alter table service_packages add column if not exists noi_dung_hd text;

-- ============ 2) CẬP NHẬT GÓI "XÂY SHOP" (đã có sẵn) ============
update service_packages set so_san_pham = 10, noi_dung_hd =
'Chuẩn hoá nền tảng|Tư vấn & hoàn thiện thủ tục khởi tạo gian hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee; Đăng tải 10 sản phẩm chuẩn SEO; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí cho 10 sản phẩm; Chuẩn hoá nội dung mô tả theo định dạng nền tảng
Xây dựng nội dung|Thiết kế đồng bộ ảnh bìa cho 10 sản phẩm; Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Xây dựng nội dung chuyên sâu cho 5 sản phẩm chủ lực (full 9 ảnh chi tiết/sản phẩm); Sản xuất video chuyển đổi cho 5 sản phẩm chủ lực
Đồng hành|Đồng hành giải đáp mọi thắc mắc trong quá trình vận hành; 1 buổi Meeting 1-1 định hướng phát triển gian hàng
Quà tặng|Tặng 3 tháng sử dụng phần mềm quản lý bán hàng trị giá 1.300.000đ; Bộ tài liệu hỗ trợ vận hành & báo cáo hiệu suất; File quản lý cấu trúc chi phí theo nhịp giá bán trên sàn; Tặng Seller Kit — bộ trang bị thực chiến độc quyền từ TUKI GROUP'
where ten_goi = 'Khởi Nghiệp'
  and service_id = (select id from services where ten_dich_vu = 'Xây shop');

update service_packages set so_san_pham = 15, noi_dung_hd =
'Chuẩn hoá nền tảng|Tư vấn & hoàn thiện thủ tục khởi tạo gian hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee; Đăng tải 15 sản phẩm chuẩn SEO; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí cho 15 sản phẩm; Chuẩn hoá nội dung mô tả theo định dạng nền tảng
Xây dựng nội dung|Thiết kế đồng bộ ảnh bìa cho 15 sản phẩm; Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Xây dựng nội dung chuyên sâu cho 8 sản phẩm chủ lực (full 9 ảnh chi tiết/sản phẩm); Sản xuất video chuyển đổi cho 8 sản phẩm chủ lực
Đồng hành|1 buổi Meeting 1-1 định hướng phát triển gian hàng; Tặng buổi hướng dẫn quy trình vận hành sàn trực tiếp tại TUKI GROUP; Đồng hành giải đáp mọi thắc mắc trong quá trình vận hành
Quà tặng|Tặng 3 tháng sử dụng phần mềm quản lý bán hàng trị giá 1.300.000đ; Bộ tài liệu hỗ trợ vận hành & báo cáo hiệu suất; File quản lý cấu trúc chi phí theo nhịp giá bán trên sàn; Tặng voucher giảm 500.000đ khi đăng ký gói dịch vụ quảng cáo; Tặng Seller Kit — bộ trang bị thực chiến độc quyền từ TUKI GROUP'
where ten_goi = 'VIP 1'
  and service_id = (select id from services where ten_dich_vu = 'Xây shop');

update service_packages set so_san_pham = 25, noi_dung_hd =
'Chuẩn hoá nền tảng|Tư vấn & hoàn thiện thủ tục khởi tạo gian hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee; Đăng tải 25 sản phẩm chuẩn SEO; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí cho 25 sản phẩm; Chuẩn hoá nội dung mô tả theo định dạng nền tảng; Xây dựng kế hoạch marketing nội sàn (Flash Sale, Voucher, Combo...)
Xây dựng nội dung|Thiết kế đồng bộ ảnh bìa cho 25 sản phẩm; Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Xây dựng nội dung chuyên sâu cho 12 sản phẩm chủ lực (full 9 ảnh chi tiết/sản phẩm); Sản xuất video chuyển đổi cho 12 sản phẩm chủ lực
Đồng hành|1 buổi Meeting 1-1 định hướng phát triển gian hàng; Tặng buổi hướng dẫn quy trình vận hành sàn trực tiếp tại TUKI GROUP; Đồng hành giải đáp mọi thắc mắc trong quá trình vận hành
Quà tặng|Tặng 3 tháng sử dụng phần mềm quản lý bán hàng trị giá 1.300.000đ; Bộ tài liệu hỗ trợ vận hành & báo cáo hiệu suất; File quản lý cấu trúc chi phí theo nhịp giá bán trên sàn; Tặng voucher giảm 1.000.000đ khi đăng ký gói dịch vụ quảng cáo; Tặng Seller Kit — bộ trang bị thực chiến độc quyền từ TUKI GROUP'
where ten_goi = 'VIP 2'
  and service_id = (select id from services where ten_dich_vu = 'Xây shop');

update service_packages set so_san_pham = 35, noi_dung_hd =
'Chuẩn hoá nền tảng|Tư vấn & hoàn thiện thủ tục khởi tạo gian hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee; Đăng tải 35 sản phẩm chuẩn SEO; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí cho 35 sản phẩm; Chuẩn hoá nội dung mô tả theo định dạng nền tảng; Xây dựng kế hoạch marketing nội sàn (Flash Sale, Voucher, Combo...)
Xây dựng nội dung|Thiết kế đồng bộ ảnh bìa cho 35 sản phẩm; Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Xây dựng nội dung chuyên sâu cho 20 sản phẩm chủ lực (full 9 ảnh chi tiết/sản phẩm); Sản xuất video chuyển đổi cho 20 sản phẩm chủ lực
Đồng hành|Đào tạo 1-1 chuyển giao quy trình vận hành chuyên nghiệp sau bàn giao; 1 buổi Meeting 1-1 định hướng phát triển gian hàng; Đồng hành giải đáp mọi thắc mắc trong quá trình vận hành
Quà tặng|Tặng 3 tháng sử dụng phần mềm quản lý bán hàng trị giá 1.300.000đ; Bộ tài liệu hỗ trợ vận hành & báo cáo hiệu suất; File quản lý cấu trúc chi phí theo nhịp giá bán trên sàn; Tặng voucher giảm 1.500.000đ khi đăng ký gói dịch vụ quảng cáo; Tặng Seller Kit — bộ trang bị thực chiến độc quyền từ TUKI GROUP'
where ten_goi = 'Premium'
  and service_id = (select id from services where ten_dich_vu = 'Xây shop');

-- ============ 3) CẬP NHẬT GÓI "CHẠY QUẢNG CÁO": thêm mốc 2 tháng + nội dung hợp đồng ============
-- Sắp lại thứ tự hiển thị cho gọn theo tháng trong từng gói
update service_packages set thu_tu = 1, so_san_pham = 5 where ten_goi = 'Basic - 1 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');
update service_packages set thu_tu = 3, so_san_pham = 5 where ten_goi = 'Basic - 3 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');
update service_packages set thu_tu = 4, so_san_pham = 10 where ten_goi = 'Plus - 1 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');
update service_packages set thu_tu = 6, so_san_pham = 10 where ten_goi = 'Plus - 3 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');
update service_packages set thu_tu = 7, so_san_pham = 20 where ten_goi = 'Pro - 1 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');
update service_packages set thu_tu = 9, so_san_pham = 20 where ten_goi = 'Pro - 3 tháng'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');

insert into service_packages (service_id, ten_goi, mo_ta, gia, so_thang, thu_tu, so_san_pham)
select s.id, v.ten_goi, v.mo_ta, v.gia, v.so_thang, v.thu_tu, v.so_san_pham
from services s
cross join (values
  ('Basic - 2 tháng', '5 sản phẩm quảng cáo · Báo cáo 2 lần/tuần. Phù hợp shop mới test ads', 5940000, 2, 2, 5),
  ('Plus - 2 tháng', 'Tối đa 10 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing', 9720000, 2, 5, 10),
  ('Pro - 2 tháng', 'Tối đa 20 sản phẩm · Báo cáo & tối ưu hàng tuần · Tối ưu nội dung/hình ảnh · Flash Sale & kế hoạch marketing. Phù hợp shop lớn muốn bứt phá', 17280000, 2, 8, 20)
) as v(ten_goi, mo_ta, gia, so_thang, thu_tu, so_san_pham)
where s.ten_dich_vu = 'Chạy quảng cáo'
  and not exists (select 1 from service_packages p where p.service_id = s.id and p.ten_goi = v.ten_goi);

-- Nội dung hợp đồng theo LIKE để phủ cả 3 mốc tháng (1/2/3) của mỗi gói
update service_packages set noi_dung_hd =
'Phân tích & lựa chọn sản phẩm|Lựa chọn 5 sản phẩm phân bổ ngân sách cho từng nhóm sản phẩm quảng cáo
Lên & care quảng cáo|Lên quảng cáo và care quảng cáo cho 5 sản phẩm của Shop
Kiểm tra & báo cáo|Tổng hợp kết quả & đánh giá hiệu quả quảng cáo 2 lần/tuần'
where ten_goi like 'Basic%'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');

update service_packages set noi_dung_hd =
'Phân tích & lựa chọn sản phẩm|Lựa chọn 10 sản phẩm phân bổ ngân sách cho từng nhóm sản phẩm quảng cáo
Lên & care quảng cáo|Lên quảng cáo và care quảng cáo cho tối đa 10 sản phẩm của Shop
Kiểm tra & báo cáo|Báo cáo chi tiết hiệu suất từng sản phẩm quảng cáo mỗi tuần; Phân tích số liệu & đề xuất phương án tối ưu định kỳ hàng tuần; Tổng hợp kết quả & đánh giá hiệu quả quảng cáo 1 lần/tuần
Tối ưu nội dung & hình ảnh quảng cáo|Thiết kế banner & hình ảnh chuẩn nhận diện gian hàng; Viết tiêu đề, mô tả thu hút, tối ưu tỷ lệ click quảng cáo; Đồng hành cải thiện đánh giá & tối ưu hiển thị sản phẩm
Tư vấn mục tiêu & kế hoạch marketing|Hỗ trợ tạo Flash Sale hằng ngày, tăng hiển thị & doanh số cho Shop; Đề xuất mục tiêu & kế hoạch quảng cáo — marketing theo từng giai đoạn sản phẩm
Báo cáo tài chính lợi nhuận|Phân tích lợi nhuận dự kiến và lợi nhuận thực tế của từng sản phẩm quảng cáo dựa trên giá nhập và giá bán của Shop'
where ten_goi like 'Plus%'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');

update service_packages set noi_dung_hd =
'Phân tích & lựa chọn sản phẩm|Lựa chọn 20 sản phẩm phân bổ ngân sách cho từng nhóm sản phẩm quảng cáo
Lên & care quảng cáo|Lên quảng cáo và care quảng cáo cho tối đa 20 sản phẩm của Shop
Kiểm tra & báo cáo|Báo cáo chi tiết hiệu suất từng sản phẩm quảng cáo mỗi tuần; Phân tích số liệu & đề xuất phương án tối ưu định kỳ hàng tuần; Tổng hợp kết quả & đánh giá hiệu quả quảng cáo 1 lần/tuần
Tối ưu nội dung & hình ảnh quảng cáo|Hỗ trợ thiết kế banner & hình ảnh chuẩn nhận diện gian hàng nếu cần; Viết tiêu đề, mô tả thu hút, tối ưu tỷ lệ click cho sản phẩm quảng cáo; Đồng hành cải thiện đánh giá & tối ưu hiển thị sản phẩm
Tư vấn mục tiêu & kế hoạch marketing|Hỗ trợ tạo Flash Sale hằng ngày, tăng hiển thị & doanh số cho Shop; Đề xuất mục tiêu & kế hoạch quảng cáo — marketing theo từng giai đoạn sản phẩm'
where ten_goi like 'Pro%'
  and service_id = (select id from services where ten_dich_vu = 'Chạy quảng cáo');

-- ============ 4) DỊCH VỤ MỚI: "TỐI ƯU SẢN PHẨM" ============
insert into services (ten_dich_vu, mo_ta, gia_mac_dinh)
select 'Tối ưu sản phẩm', 'Tối ưu & trang trí gian hàng Shopee: đăng sản phẩm chuẩn SEO, ảnh bìa, marketing nội sàn (không kèm tối ưu quảng cáo trả phí)', 0
where not exists (select 1 from services where ten_dich_vu = 'Tối ưu sản phẩm');

insert into service_packages (service_id, ten_goi, mo_ta, gia, so_thang, thu_tu, so_san_pham, noi_dung_hd)
select s.id, v.ten_goi, v.mo_ta, v.gia, null::int, v.thu_tu, v.so_san_pham, v.noi_dung_hd
from services s
cross join (values
  ('Tối ưu 10 sản phẩm', 'Tối ưu & trang trí gian hàng Shopee chuyên nghiệp. Giá đã bao gồm VAT', 2200000, 1, 10,
   'Tư vấn nhận diện thương hiệu|Tư vấn nhận diện thương hiệu & thiết kế banner gian hàng chuyên nghiệp
Cài đặt Marketing nội sàn|Cài đặt Marketing nội sàn Shopee
Đăng sản phẩm|Đăng 10 sản phẩm chuẩn SEO Shopee (chỉ thiết kế ảnh bìa)'),
  ('Tối ưu 20 sản phẩm', 'Tối ưu & trang trí gian hàng Shopee chuyên nghiệp. Giá đã bao gồm VAT', 3250000, 2, 20,
   'Tư vấn nhận diện thương hiệu|Tư vấn nhận diện thương hiệu & thiết kế banner gian hàng chuyên nghiệp
Cài đặt Marketing nội sàn|Cài đặt Marketing nội sàn Shopee
Đăng sản phẩm|Đăng 20 sản phẩm chuẩn SEO Shopee (chỉ thiết kế ảnh bìa)'),
  ('Thiết kế chuẩn SEO — 30 sản phẩm', 'Thiết kế gian hàng chuẩn SEO, tối ưu tối đa 30 sản phẩm. Đã bao gồm VAT', 4000000, 3, 30,
   'Thiết kế gian hàng chuẩn SEO|Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Thiết kế ảnh bìa sản phẩm theo USP & hành vi khách hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee
Chuẩn hoá nội dung|Chuẩn hoá nội dung mô tả theo định dạng nền tảng; Xây dựng hệ thống marketing nội sàn tối ưu và đồng bộ; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí sản phẩm'),
  ('Thiết kế chuẩn SEO — 50 sản phẩm', 'Thiết kế gian hàng chuẩn SEO, tối ưu tối đa 50 sản phẩm. Đã bao gồm VAT', 6000000, 4, 50,
   'Thiết kế gian hàng chuẩn SEO|Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Thiết kế ảnh bìa sản phẩm theo USP & hành vi khách hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee
Chuẩn hoá nội dung|Chuẩn hoá nội dung mô tả theo định dạng nền tảng; Xây dựng hệ thống marketing nội sàn tối ưu và đồng bộ; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí sản phẩm'),
  ('Thiết kế chuẩn SEO — 100 sản phẩm', 'Thiết kế gian hàng chuẩn SEO, tối ưu tối đa 100 sản phẩm. Đã bao gồm VAT', 10000000, 5, 100,
   'Thiết kế gian hàng chuẩn SEO|Trang trí banner chuyên nghiệp chuẩn nhận diện thương hiệu; Thiết kế ảnh bìa sản phẩm theo USP & hành vi khách hàng; Tối ưu tiêu đề theo hành vi tìm kiếm & thuật toán Shopee
Chuẩn hoá nội dung|Chuẩn hoá nội dung mô tả theo định dạng nền tảng; Xây dựng hệ thống marketing nội sàn tối ưu và đồng bộ; Xây dựng file phân tích lợi nhuận & cấu trúc chi phí sản phẩm')
) as v(ten_goi, mo_ta, gia, thu_tu, so_san_pham, noi_dung_hd)
where s.ten_dich_vu = 'Tối ưu sản phẩm'
  and not exists (select 1 from service_packages p where p.service_id = s.id and p.ten_goi = v.ten_goi);

-- ============ 5) DỊCH VỤ MỚI: "DỊCH VỤ BỔ SUNG" (Follow Shop, Nhân bản Shop) ============
insert into services (ten_dich_vu, mo_ta, gia_mac_dinh)
select 'Dịch vụ bổ sung', 'Follow Shop, Nhân bản Shop và các dịch vụ đi kèm khác', 0
where not exists (select 1 from services where ten_dich_vu = 'Dịch vụ bổ sung');

insert into service_packages (service_id, ten_goi, mo_ta, gia, thu_tu, so_san_pham)
select s.id, v.ten_goi, v.mo_ta, v.gia, v.thu_tu, v.so_san_pham
from services s
cross join (values
  ('Follow Shop — 1.000 follow', 'Tăng follow gian hàng Shopee', 300000, 1, null::int),
  ('Follow Shop — 2.000 follow', 'Tăng follow gian hàng Shopee', 500000, 2, null::int),
  ('Follow Shop — 4.500 follow', 'Tăng follow gian hàng Shopee', 1000000, 3, null::int),
  ('Follow Shop — 6.500 follow', 'Tăng follow gian hàng Shopee', 1500000, 4, null::int),
  ('Follow Shop — 10.000 follow', 'Tăng follow gian hàng Shopee', 2000000, 5, null::int),
  ('Follow Shop — 20.000 follow', 'Tăng follow gian hàng Shopee', 3800000, 6, null::int),
  ('Nhân bản Shop — ≤100 SP', 'Nhân bản gian hàng, shop có tối đa 100 sản phẩm', 400000, 7, 100),
  ('Nhân bản Shop — ≤200 SP', 'Nhân bản gian hàng, shop có tối đa 200 sản phẩm', 700000, 8, 200),
  ('Nhân bản Shop — ≤300 SP', 'Nhân bản gian hàng, shop có tối đa 300 sản phẩm', 1000000, 9, 300),
  ('Nhân bản Shop — ≤400 SP', 'Nhân bản gian hàng, shop có tối đa 400 sản phẩm', 1400000, 10, 400)
) as v(ten_goi, mo_ta, gia, thu_tu, so_san_pham)
where s.ten_dich_vu = 'Dịch vụ bổ sung'
  and not exists (select 1 from service_packages p where p.service_id = s.id and p.ten_goi = v.ten_goi);
