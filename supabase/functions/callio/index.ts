// Edge Function "callio": lấy lịch sử cuộc gọi + ghi âm của 1 khách từ Callio.
// Token Callio chỉ nằm ở đây (Supabase → Edge Functions → Secrets: CALLIO_TOKEN), không bao giờ gửi xuống trình duyệt.
// Người gọi phải đăng nhập và xem được khách đó (kiểm tra bằng chính quyền của họ trên bảng customers).
//
// body: { action: 'list', customer_id }               → { calls: [...] }
//       { action: 'recording', customer_id, call_id }  → { url }   (link Callio chỉ sống 6 giờ, nên mỗi lần nghe xin lại)
// Lỗi dự kiến trả về { error, code } với mã HTTP 200 để giao diện hiện được câu dễ hiểu.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// +84 / 84 / 0 coi là cùng một số (giống chuan_hoa_sdt trong migration_44)
const chuanSo = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return /^84\d{9,10}$/.test(d) ? '0' + d.slice(2) : d
}

// Thời gian Callio có thể là số (giây hoặc mili giây) hoặc chuỗi ngày giờ → đổi hết ra mili giây
const toMs = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v)
    return n > 0 && n < 1e12 ? n * 1000 : n
  }
  const t = Date.parse(String(v))
  return Number.isNaN(t) ? 0 : t
}

class LoiCallio extends Error {
  code: string
  constructor(message: string, code: string) { super(message); this.code = code }
}

const CALLIO_URL = (Deno.env.get('CALLIO_URL') || 'https://clientapi.phonenet.io').replace(/\/+$/, '')

async function goiCallio(path: string) {
  const token = Deno.env.get('CALLIO_TOKEN')
  if (!token) throw new LoiCallio('CRM chưa được kết nối với Callio.', 'chua_ket_noi')
  let res: Response
  try {
    res = await fetch(CALLIO_URL + path, { headers: { token }, signal: AbortSignal.timeout(15000) })
  } catch {
    throw new LoiCallio('Không kết nối được tới Callio, thử lại sau ít phút.', 'loi_mang')
  }
  if (res.status === 401 || res.status === 403) {
    throw new LoiCallio('Token Callio không hợp lệ hoặc đã hết hạn. Báo quản trị viên tạo token mới.', 'sai_token')
  }
  if (res.status === 404) return null
  if (!res.ok) throw new LoiCallio(`Callio đang báo lỗi (mã ${res.status}), thử lại sau.`, 'loi_callio')
  return await res.json()
}

// Danh sách người dùng Callio (chỉ giữ _id, email, tên — bỏ hẳn extPassword). Nhớ tạm 10 phút.
let boNhoUser: { luc: number; map: Map<string, { email: string; name: string }> } | null = null
async function nguoiDungCallio() {
  if (boNhoUser && Date.now() - boNhoUser.luc < 10 * 60 * 1000) return boNhoUser.map
  const map = new Map<string, { email: string; name: string }>()
  for (let page = 1; page <= 10; page++) {
    const r = await goiCallio(`/user?page=${page}&pageSize=100`)
    for (const u of r?.docs || []) {
      if (u?._id) map.set(String(u._id), { email: String(u.email || '').trim().toLowerCase(), name: String(u.name || '') })
    }
    if (!r?.hasNextPage) break
  }
  boNhoUser = { luc: Date.now(), map }
  return map
}

const laNoiBo = (d: unknown) => String(d) === '3' || /internal|local|noi_bo/i.test(String(d ?? ''))
const laGoiVao = (d: unknown) => String(d) === '1' || /^(in|inbound|incoming)$/i.test(String(d ?? ''))

// Đổi 1 cuộc gọi Callio sang dạng tab "Cuộc gọi" đang dùng
function doiCuocGoi(c: any, sdtKhach: string) {
  const khachLaNguoiGoi = chuanSo(c.fromNumber) === sdtKhach
  const khachLaNguoiNghe = chuanSo(c.toNumber) === sdtKhach
  const huong = khachLaNguoiNghe && !khachLaNguoiGoi ? 'di'
    : khachLaNguoiGoi && !khachLaNguoiNghe ? 'den'
    : laGoiVao(c.direction) ? 'den' : 'di'

  const traLoi = toMs(c.answerTime)
  const ketThuc = toMs(c.endTime)
  const ngheMay = traLoi > 0 || Number(c.billDuration) > 0
  let trangThai = 'nghe_may'
  if (!ngheMay) {
    const lyDo = String(c.hangupCause || '').toUpperCase()
    trangThai = /BUSY/.test(lyDo) ? 'ban' : /REJECT|DECLINE/.test(lyDo) ? 'tu_choi' : 'khong_nghe'
  }
  const thoiLuong = !ngheMay ? 0
    : ketThuc > traLoi && traLoi > 0 ? Math.round((ketThuc - traLoi) / 1000)
    : Math.round(Number(c.billDuration) || 0)

  const batDau = toMs(c.startTime) || toMs(c.createTime)
  return {
    id: String(c._id),
    huong,
    trang_thai: trangThai,
    bat_dau: batDau ? new Date(batDau).toISOString() : null,
    thoi_luong_giay: thoiLuong,
    so_dien_thoai: huong === 'di' ? c.toNumber : c.fromNumber,
    nguoi_callio: huong === 'di' ? (c.fromUser || c.toUser) : (c.toUser || c.fromUser),
    // Callio có cờ recording=true khi có ghi âm (đã soát 2026-11-26); thiếu cờ thì đoán theo việc nghe máy
    co_ghi_am: c.recording !== undefined ? c.recording === true : ngheMay,
  }
}

// fromUser/toUser trong /call là object { _id, email, name, ext } (đã soát 2026-11-26), phòng khi chỉ là mã _id
function docNguoiCallio(v: any, ds: Map<string, { email: string; name: string }>) {
  if (!v) return undefined
  if (typeof v === 'object') {
    const tuDs = v._id ? ds.get(String(v._id)) : undefined
    return {
      email: String(v.email || tuDs?.email || '').trim().toLowerCase(),
      name: String(v.name || tuDs?.name || '').trim(),
    }
  }
  return ds.get(String(v))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Người dùng phải đăng nhập và đang hoạt động
    const auth = req.headers.get('Authorization') || ''
    const { data: caller } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (!caller?.user) return reply({ error: 'Bạn chưa đăng nhập.' }, 401)
    const { data: me } = await admin.from('profiles').select('active').eq('id', caller.user.id).single()
    if (me?.active === false) return reply({ error: 'Tài khoản đã bị khoá.' }, 403)

    const body = await req.json().catch(() => ({}))
    if (!body?.customer_id) return reply({ error: 'Thiếu khách hàng.' }, 400)

    // 2. Kiểm tra quyền xem khách bằng chính quyền của người dùng (RLS) — không dùng quyền quản trị
    const nguoiDung = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: khach } = await nguoiDung.from('customers').select('id, sdt').eq('id', body.customer_id).maybeSingle()
    if (!khach) return reply({ error: 'Bạn không có quyền xem khách này.' }, 403)
    const sdt = chuanSo(khach.sdt)
    if (sdt.length < 8) return reply({ calls: [] })

    // 3a. Danh sách cuộc gọi
    if (body.action === 'list') {
      // Không biết Callio lưu số dạng 0… hay 84… nên tìm cả 3 kiểu, rồi lọc lại cho đúng số khách
      const kieuSo = [sdt, '84' + sdt.slice(1), sdt.slice(1)]
      const ketQua = await Promise.allSettled(kieuSo.map((k) => goiCallio(`/call?page=1&pageSize=50&keyword=${encodeURIComponent(k)}`)))
      const thanhCong = ketQua.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      if (thanhCong.length === 0) throw (ketQua[0] as PromiseRejectedResult).reason   // cả 3 lần đều lỗi → báo lỗi thật
      const gom = new Map<string, any>()
      for (const r of thanhCong) for (const c of r.value?.docs || []) if (c?._id) gom.set(String(c._id), c)
      const ds = [...gom.values()]
        .filter((c) => !laNoiBo(c.direction))
        .filter((c) => chuanSo(c.fromNumber) === sdt || chuanSo(c.toNumber) === sdt)
        .map((c) => doiCuocGoi(c, sdt))
        .sort((a, b) => String(b.bat_dau || '').localeCompare(String(a.bat_dau || '')))

      // Ghép người dùng Callio ↔ sale CRM theo email
      let userCallio = new Map<string, { email: string; name: string }>()
      try { userCallio = await nguoiDungCallio() } catch { /* không ghép được tên thì vẫn hiện cuộc gọi */ }
      const { data: pf } = await admin.from('profiles').select('id, email')
      const saleTheoEmail = new Map((pf || []).map((p: any) => [String(p.email || '').trim().toLowerCase(), p.id]))
      const calls = ds.map(({ nguoi_callio, ...c }) => {
        const u = docNguoiCallio(nguoi_callio, userCallio)
        return { ...c, sale_id: (u?.email && saleTheoEmail.get(u.email)) || null, ten_sale: u?.name || null }
      })
      return reply({ calls })
    }

    // 3b. Link nghe ghi âm (chỉ cho cuộc gọi đúng là của khách này)
    if (body.action === 'recording') {
      const id = String(body.call_id || '')
      if (!/^[a-f0-9]{24}$/i.test(id)) return reply({ error: 'Mã cuộc gọi không hợp lệ.' }, 400)
      const c = await goiCallio(`/call/${id}`)
      if (!c || (chuanSo(c.fromNumber) !== sdt && chuanSo(c.toNumber) !== sdt)) {
        return reply({ error: 'Không tìm thấy cuộc gọi này của khách.' }, 404)
      }
      const r = await goiCallio(`/call/${id}/recording`)
      if (!r?.url) return reply({ error: 'Cuộc gọi này không có ghi âm.', code: 'khong_ghi_am' })
      return reply({ url: r.url })
    }

    return reply({ error: 'Thao tác không hợp lệ.' }, 400)
  } catch (e) {
    if (e instanceof LoiCallio) return reply({ error: e.message, code: e.code })
    return reply({ error: 'Lỗi máy chủ: ' + (e as Error).message }, 500)
  }
})
