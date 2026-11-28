# CTS CRM — quy ước cho AI làm việc trên repo này

CRM nội bộ cho đội sale CTS Logistics (trước là TUKI agency Shopee/TikTok — còn sót tên `tuki` ở vài chỗ, giữ nguyên).
React 19 + Vite + Tailwind 4, backend là Supabase (Postgres + RLS, Auth, Storage, Edge Functions). Deploy web trên Vercel.

**Người làm dự án không phải lập trình viên.** Giải thích bằng tiếng Việt dễ hiểu, ưu tiên thay đổi nhỏ và an toàn,
không tự ý refactor lớn. Mọi chữ hiện cho người dùng viết bằng tiếng Việt có dấu.

## Kiểm tra trước khi báo xong
- `npm run build` phải chạy được.
- `npm run lint` không được tăng thêm cảnh báo ở file vừa sửa.
- Không có test tự động: sửa logic tính tiền / ngày / quyền thì tự chạy thử bằng ví dụ cụ thể và nói rõ đã thử gì.

## Dùng lại, đừng viết lại
| Việc | Dùng | Đừng |
|---|---|---|
| Chuẩn hoá số điện thoại | `chuanSo` trong `src/lib/sdt.js` | tự viết `replace(/\D/g…)` / xử lý đầu 84 |
| Kiểm tra vai trò | `laAdmin`, `laLeader`, `laSale`, `laQuanLy` trong `src/lib/quyen.js` | viết `role === 'admin'` |
| Ai xem được dữ liệu của ai | `nhanSuXemDuoc`, `locNhanSu` trong `src/lib/quyen.js` | tự lọc theo phòng ban |
| Ngày "hôm nay", định dạng ngày, cộng ngày/tháng | `src/lib/ngay.js` (`homNayLocal`, `ngayLocal`, `gioNgay`, `dinhDangNgay`, `congNgay`, `congThang`, `soNgayGiua`) | `new Date().toISOString().slice(0, 10)` — đó là giờ UTC, trước 7h sáng ra ngày hôm qua |
| Hiện lỗi cho người dùng | `loiDeHieu(error)` trong `src/lib/loi.js` | hiện thẳng `error.message` (tiếng Anh của database) |
| Danh sách nhân sự | `layNhanSu()` trong `src/lib/nhanSu.js` (nhớ tạm 1 phút) | `supabase.from('profiles').select(...)` ở từng trang |
| Lấy hơn 1.000 dòng | `layHet(() => query)` trong `src/lib/layHet.js` | gọi thẳng (Supabase cắt ở 1.000 dòng, mất dữ liệu không báo) |
| Trạng thái khách (tên, màu, khách chung, đã chốt…) | `useTrangThai()` trong `src/lib/StatusContext.jsx` | viết cứng mã trạng thái |

Đang sửa file nào mà thấy chỗ viết tay như cột "Đừng" thì đổi sang hàm dùng chung luôn (gom dần, không làm đợt lớn).

## Ghi dữ liệu
- Mọi lệnh `insert/update/delete/upsert` phải lấy `{ error }` và báo lỗi khi có — không được im lặng.
- Quyền thật nằm ở database (RLS). Lọc ở giao diện chỉ để hiển thị gọn, không thay được RLS.

## Database (Supabase)
- Không có Supabase CLI. Migration là file `supabase/migration_NN_ten.sql`, người dùng **chạy tay** trong SQL Editor.
- Đổi database = tạo file migration **số tiếp theo** (hiện mới nhất là 48), viết sao cho **chạy lại nhiều lần vẫn an toàn**
  (`create … if not exists`, `drop policy if exists` rồi `create policy`, `create or replace function`).
  Đưa file cho người dùng chạy và nói rõ cần chạy — code mới không tự có bảng/cột mới.
- `supabase/schema.sql` và các migration trong repo **không đủ** để dựng lại database: thiếu 19, 20, 26, 27, 36 (bảng
  `muc_tieu_ngay`, `muc_tieu_so` — số 36 trong repo là file khác), 37–40, 46. Cần biết schema thật thì nhờ người dùng xuất từ SQL Editor.
- Hàm SQL mới tạo chỉ `authenticated` / `service_role` gọi được (đã thu hồi quyền của PUBLIC/anon).

## Edge Functions (`supabase/functions/`)
Deploy bằng cách dán code vào Supabase Dashboard → Edge Functions.
- `callio` — lịch sử cuộc gọi + ghi âm từ Callio. Secret `CALLIO_TOKEN`. Không lưu cuộc gọi vào DB (bảng `cuoc_goi` bỏ không dùng).
- `quan-ly-tai-khoan/` — tạo/sửa/khoá/xoá tài khoản nhân sự. **Tên deploy trên Supabase là `quan-ly-tai-khoa`** (thiếu "n")
  và `TeamPage.jsx` gọi đúng tên đó. Đừng sửa cho khớp tên thư mục.
- Token / service key chỉ nằm trong secret của Supabase, không bao giờ đưa xuống trình duyệt hay vào repo.

## Cấu trúc
- `src/App.jsx` — đăng nhập + chuyển trang (state `page`, chưa có router). Menu ở `src/components/Sidebar.jsx`.
- Trang đang dùng: Checklist (`ChecklistPage`, `MucTieuNgay`), Khách hàng (`CustomerList`, `CustomerDetail`, `CustomerForm`,
  `TaiKhachLenModal`, `ChiaKhachModal`, `OrderForm`, `XuatHopDongForm`), Báo cáo (`BaoCaoPage`), Tính giá bán (`BaoGiaPage`),
  Tài liệu, Đào tạo, Thông báo, Nhân sự (`TeamPage`, chỉ admin/leader).
- `src/components/ui.jsx` — Button, Input, Select, Modal, Badge… dùng chung.
- `src/lib/` — logic không có giao diện (tính giá, hợp đồng Word/PDF, Excel, nhắc việc, tái ký ADS…).
- Thư viện nặng (`xlsx`, `exceljs`, `docx`, `jspdf`, `html2canvas`) luôn `await import(...)` lúc cần, không import ở đầu file.
- Thêm trang mới: tạo component, thêm vào `NAV` trong `Sidebar.jsx` và vào `App.jsx`. Trang bỏ khỏi menu thì xoá file luôn,
  đừng để code chết (vẫn lấy lại được từ git).

## Git
- Commit message tiếng Việt, ngắn gọn, nói thay đổi gì cho người dùng.
- Không commit `.env`.
