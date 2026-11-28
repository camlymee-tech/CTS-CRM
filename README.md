# CTS CRM

CRM nội bộ cho đội sale **CTS Logistics**: quản lý khách hàng, chia data, lịch sử chăm sóc, đơn dịch vụ,
báo giá, checklist việc hằng ngày, báo cáo theo sale / team, tài liệu, đào tạo và gọi điện qua Callio.

- **Giao diện:** React 19 + Vite + Tailwind CSS 4
- **Máy chủ & dữ liệu:** Supabase (Postgres có phân quyền theo dòng, đăng nhập, lưu file, Edge Functions)
- **Chạy web:** Vercel

## Phân quyền
| Vai trò | Xem được |
|---|---|
| Quản trị (admin) | Toàn bộ |
| Leader | Khách và số liệu của sale cùng phòng ban |
| Sale | Khách của mình, khách chung và data chưa chia |

## Chạy trên máy
```
npm install
copy .env.example .env      # rồi điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm run dev                 # mở http://localhost:5173
```
Kiểm tra trước khi đẩy code: `npm run lint` và `npm run build`.

## Tài liệu
- [HUONG_DAN.md](HUONG_DAN.md) — cài đặt, deploy, cập nhật database, kết nối Callio.
- [CLAUDE.md](CLAUDE.md) — quy ước code (dành cho AI và người sửa code).

## Thư mục
```
src/App.jsx            đăng nhập, chuyển trang (trang đang mở ghi trên địa chỉ web: …/#/khach-hang)
src/components/        các màn hình và cửa sổ (trang lớn chia thư mục con: hoSoKhach/, khachHang/, baoCao/)
src/lib/               logic dùng chung (quyền, ngày, SĐT, báo lỗi, tính giá, báo cáo, lọc khách, Excel…)
supabase/              file SQL cập nhật database (migration_NN_*.sql) + Edge Functions
```
