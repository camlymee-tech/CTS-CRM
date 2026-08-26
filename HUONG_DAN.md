# TUKI CRM — Hướng dẫn cài đặt (Module 1: Quản lý khách hàng)

## Bước 1 — Tạo Supabase project mới
1. Vào https://supabase.com → tạo project mới, đặt tên `tuki-crm`.
2. Vào **SQL Editor** → dán toàn bộ nội dung file `supabase/schema.sql` → bấm Run.
3. Vào **Project Settings → API** → copy `Project URL` và `anon public key`.

## Bước 2 — Tạo repo GitHub
1. Tạo repo mới trong account `camlymee-tech`, ví dụ tên `tuki-crm`.
2. Clone về máy:
```
cd ~
git clone https://github.com/camlymee-tech/tuki-crm.git
```

## Bước 3 — Copy code vào
Giải nén file zip em gửi, copy toàn bộ file/folder vào trong folder `tuki-crm` vừa clone (đè lên nếu trùng).

Tạo file `.env` trong folder gốc (copy từ `.env.example`), điền 2 giá trị đã lấy ở Bước 1:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Bước 4 — Push lên GitHub
```
cd ~/tuki-crm
git add .
git commit -m "Khoi tao TUKI CRM - module quan ly khach hang"
git push
```

## Bước 5 — Deploy lên Vercel
1. Vào https://vercel.com → Add New Project → chọn repo `tuki-crm`.
2. Ở phần **Environment Variables**, thêm đúng 2 biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (giá trị giống file `.env`).
3. Bấm Deploy.

## Bước 6 — Tạo tài khoản đăng nhập đầu tiên
Mở app đã deploy → bấm "Chưa có tài khoản? Tạo mới" → điền họ tên, email, mật khẩu → Tạo tài khoản.
Tài khoản đầu tiên sẽ có vai trò `sale` mặc định. Muốn nâng lên `admin` (xem được toàn bộ khách hàng của mọi sale), vào Supabase → Table Editor → bảng `profiles` → sửa cột `role` của tài khoản đó thành `admin`.

## Đã có trong bản này
- Đăng nhập/đăng ký tài khoản riêng cho từng bạn sale
- Thêm/sửa khách hàng: tên, shop, SĐT, nền tảng (Shopee/TikTok Shop), ngành hàng, nguồn khách, loại khách (mới/cũ), trạng thái chăm sóc, sale phụ trách, ngày liên hệ/ngày hẹn chăm sóc tiếp theo
- Lọc & tìm kiếm khách hàng theo mọi tiêu chí trên
- Lịch sử chăm sóc từng khách hàng (gọi điện/nhắn tin/gặp mặt) — ghi lại mỗi lần trao đổi, tự cập nhật "ngày liên hệ gần nhất"
- Phân quyền: sale chỉ thấy khách của mình, admin thấy toàn bộ team
- Sẵn schema nền cho các module sau (đơn dịch vụ, hợp đồng, tổng kết doanh số) — chưa có giao diện, sẽ xây tiếp

## Sắp tới (module 2 & 3)
- Lên đơn dịch vụ gắn với khách hàng + danh mục dịch vụ
- Tạo hợp đồng (số hợp đồng, giá trị, thời hạn, trạng thái)
- Tổng kết doanh số theo sale / theo tháng / theo dịch vụ
