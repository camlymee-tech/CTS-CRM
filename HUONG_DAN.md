# CTS CRM — Hướng dẫn vận hành

Tài liệu cho người quản trị hệ thống: chạy thử trên máy, đưa bản mới lên web, cập nhật database, quản lý tài khoản, kết nối Callio.

## 1. Hệ thống gồm những gì
| Phần | Ở đâu | Ghi chú |
|---|---|---|
| Code | GitHub `camlymee-tech/TUKI-CRM`, nhánh `main` | |
| Web | Vercel | Đẩy code lên `main` là Vercel tự deploy bản mới |
| Database, đăng nhập, file | Supabase | Sửa cấu trúc bằng file SQL (mục 4) |
| Hàm máy chủ | Supabase → Edge Functions | `callio` và `quan-ly-tai-khoa` (mục 5) |
| Tổng đài | Callio | Chỉ đọc lịch sử cuộc gọi + ghi âm (mục 7) |

Ứng dụng chỉ cần 2 biến môi trường, đặt ở file `.env` (trên máy) và ở Vercel → Settings → Environment Variables:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```
Lấy ở Supabase → Project Settings → API. `anon key` là khoá công khai (nằm sẵn trong web), an toàn nhờ phân quyền trong database.
**Không bao giờ** đặt `service_role key` vào `.env` hay Vercel.

## 2. Chạy thử trên máy
```
npm install
npm run dev
```
Mở http://localhost:5173. Bản chạy trên máy dùng **chung database thật** — thao tác ở đây là sửa dữ liệu thật.

## 3. Đưa bản mới lên web
1. Kiểm tra: `npm run lint` và `npm run build` (build phải báo `✓ built`).
2. Commit rồi `git push` lên `main`. Vercel tự build và thay bản mới sau 1–2 phút.
3. Nếu bản mới cần bảng / cột mới: **chạy file SQL trước** (mục 4), rồi mới đẩy code.
4. Bản mới lỗi: Vercel → Deployments → chọn bản trước đó → *Promote to Production* để quay lại ngay.

## 4. Cập nhật database (migration)
- Mỗi thay đổi database là một file `supabase/migration_NN_ten.sql`, đánh số tăng dần (mới nhất hiện là **48**).
- Cách chạy: Supabase → SQL Editor → *New query* → dán toàn bộ nội dung file → *Run*. Các file đều viết để chạy lại nhiều lần vẫn an toàn.
- Nên ghi lại ngày chạy từng file (ví dụ ở cuối mục này), vì database không tự ghi nhớ file nào đã chạy.

**Lưu ý quan trọng:** các file trong repo **không đủ** để dựng lại database từ đầu. `supabase/schema.sql` chỉ là bản đầu tiên,
và thiếu các migration 19, 20, 26, 27, 37–40, 46 (vai trò leader, phòng ban, vá bảo mật…) cùng file tạo bảng
`muc_tieu_ngay` / `muc_tieu_so`. Database thật trên Supabase là bản duy nhất đầy đủ, nên:
- Bật sao lưu: Supabase → Database → Backups (gói trả phí có sao lưu hằng ngày).
- Không xoá project Supabase, không chạy lệnh `drop table` khi chưa sao lưu.

Bảng còn trong database nhưng app **không dùng nữa** (từ các trang cũ đã gỡ): `cuoc_goi`, `checklist_tasks`, `checklist_done`,
`muc_tieu_nhan_su`, `nhom_dinh_gia`, `shopee_fees`, `shopee_settings`. Cứ để đó, không ảnh hưởng gì; chỉ xoá khi đã sao lưu và chắc chắn không cần dữ liệu cũ.

## 5. Hàm máy chủ (Edge Functions)
Không có Supabase CLI, nên deploy bằng tay: Supabase → Edge Functions → mở hàm → *Code* → dán bản mới → *Deploy*.

| Tên trên Supabase | Code trong repo | Việc | Secret cần đặt |
|---|---|---|---|
| `callio` | `supabase/functions/callio/index.ts` | Lịch sử cuộc gọi + ghi âm | `CALLIO_TOKEN` |
| `quan-ly-tai-khoa` | `supabase/functions/quan-ly-tai-khoan/index.ts` | Tạo / sửa / khoá / xoá / đặt lại mật khẩu nhân sự | (không cần) |

⚠️ Tên trên Supabase của hàm thứ hai là `quan-ly-tai-khoa` (thiếu chữ "n") — app gọi đúng tên này. Khi deploy lại, dán vào đúng hàm cũ, **không** tạo hàm mới tên khác.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase tự có sẵn, không phải thêm.

## 6. Tài khoản nhân sự
- **Tạo tài khoản:** trong app → *Nhân sự* → *Tạo tài khoản*. Admin tạo được mọi vai trò; leader chỉ tạo được sale trong phòng ban của mình.
  Phòng ban phải được admin tạo trước.
- **Nghỉ việc:** bấm *Khoá* (người đó không đăng nhập được, dữ liệu vẫn giữ). Chỉ xoá hẳn được tài khoản chưa có dữ liệu.
- **Quên mật khẩu:** admin / leader đặt lại trong trang Nhân sự, hoặc người dùng bấm "Quên mật khẩu" ở màn đăng nhập (nhận email).
- **Tắt tự đăng ký (nên làm):** Supabase → Authentication → Sign In / Providers → tắt *Allow new users to sign up*.
  App không có nút đăng ký, nhưng nếu tuỳ chọn này còn bật thì người ngoài vẫn tự tạo được tài khoản sale qua API.
  Tạo tài khoản trong trang Nhân sự vẫn hoạt động bình thường sau khi tắt.
- **Admin đầu tiên** (chỉ khi dựng hệ thống mới): Supabase → Authentication → *Add user* → rồi trong SQL Editor chạy
  `update profiles set role = 'admin' where email = '<email>';`

## 7. Kết nối Callio (tab "Cuộc gọi" trong hồ sơ khách)
CRM không lưu cuộc gọi: mỗi lần mở hồ sơ, hàm máy chủ `callio` hỏi thẳng Callio lịch sử gọi + ghi âm theo SĐT khách. Token Callio chỉ nằm trên Supabase, không bao giờ xuống trình duyệt.

1. **Tạo token trên Callio** (tài khoản prod): Callio → Cài đặt → Token → tạo token mới. Không gửi token qua chat/Zalo/email.
2. **Deploy hàm**: Supabase → Edge Functions → *Deploy a new function* → đặt tên đúng **`callio`** → dán toàn bộ file `supabase/functions/callio/index.ts` → Deploy.
   (Đã deploy rồi mà code đổi thì mở hàm `callio` → Code → dán bản mới → Deploy lại.)
3. **Đặt secret**: Supabase → Edge Functions → *Secrets* → thêm `CALLIO_TOKEN` = token vừa tạo → Save. Không cần deploy lại sau khi đổi secret.
4. **Ghép sale**: email tài khoản người dùng trên Callio phải **trùng** email đăng nhập CRM của sale đó, thì cuộc gọi mới gắn đúng sale. Không trùng thì vẫn hiện cuộc gọi, kèm tên người gọi bên Callio.
5. **Kiểm tra**: mở một khách đã từng được gọi qua Callio → tab hiện "Cuộc gọi (số cuộc)" → bấm vào thấy danh sách, nghe được ghi âm.
   - Báo "CRM chưa được kết nối với Callio" → chưa đặt secret `CALLIO_TOKEN` (bước 3).
   - Báo "Token Callio không hợp lệ hoặc đã hết hạn" → tạo token mới, cập nhật lại secret.
   - Báo "Chưa gọi được chức năng Callio trên máy chủ" → hàm chưa deploy hoặc đặt sai tên (bước 2).

**Gọi điện từ CRM**: cài extension **Callio** cho trình duyệt (Chrome/Edge) và đăng nhập. Bấm vào SĐT trong hồ sơ khách → xác nhận → Callio quay số ngay. Máy không có extension thì gọi bằng ứng dụng gọi mặc định.

## 8. Gặp lỗi thường gặp
| Hiện tượng | Thường do |
|---|---|
| "Cần chạy file SQL migration_NN…" | Chưa chạy file SQL đó (mục 4) |
| "Bạn không có quyền thực hiện thao tác này" | Phân quyền trong database chặn — đúng thiết kế, hoặc tài khoản sai vai trò / phòng ban |
| Trang Nhân sự báo lỗi khi tạo / sửa tài khoản | Hàm `quan-ly-tai-khoa` chưa deploy hoặc deploy nhầm tên (mục 5) |
| "Phiên đăng nhập đã hết hạn" | Tải lại trang, đăng nhập lại |
| Web trắng sau khi deploy | Thiếu biến môi trường trên Vercel (mục 1), hoặc quay lại bản trước (mục 3) |
