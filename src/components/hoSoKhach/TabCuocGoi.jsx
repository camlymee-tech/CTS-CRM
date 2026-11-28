// Tab "Cuộc gọi" trong hồ sơ khách + hộp xác nhận trước khi gọi. Dữ liệu lấy thẳng từ Callio qua hàm máy chủ "callio".
import { useState } from 'react'
import { Phone, PhoneCall, PhoneOutgoing, PhoneIncoming, PhoneOff, CircleCheck, Clock, CalendarClock, Play, FileDown } from 'lucide-react'
import { goiHamCallio } from '../../lib/callio'
import { Badge } from '../ui'

// Hộp xác nhận trước khi gọi — Callio nhận số là tự quay luôn, nên phải hỏi để tránh gọi nhầm.
// Enter = Gọi (nút được focus sẵn), Esc hoặc bấm ra ngoài = Huỷ.
export function XacNhanGoi({ ten, sdt, onHuy, onGoi }) {
  const coCallio = !!document.getElementById('callio-extension')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onHuy} onKeyDown={(e) => { if (e.key === 'Escape') onHuy() }}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-b from-teal-50 to-white px-6 pb-2 pt-7">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span className="absolute -inset-2 rounded-full bg-teal-400/15" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg shadow-teal-500/30">
              <PhoneCall size={28} />
            </span>
          </div>
          <p className="mt-4 text-sm text-ink-400">Gọi cho khách hàng</p>
          <p className="mt-0.5 font-display text-lg font-bold leading-tight text-navy-900">{ten}</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-wide text-teal-600">{sdt}</p>
        </div>
        <p className="px-6 pt-2 text-xs text-ink-400">
          {coCallio ? 'Callio sẽ quay số ngay khi bạn bấm Gọi.' : 'Không thấy Callio — sẽ gọi bằng ứng dụng gọi của máy.'}
        </p>
        <div className="flex gap-3 p-6">
          <button type="button" onClick={onHuy}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-ink-600 transition hover:bg-slate-50">
            Huỷ
          </button>
          <button type="button" onClick={onGoi} autoFocus
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 font-semibold text-white shadow-md shadow-teal-500/30 transition hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-300">
            <Phone size={16} /> Gọi
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ NHẬT KÝ CUỘC GỌI + GHI ÂM (lấy từ Callio) ============
const TT_GOI = {
  nghe_may: { ten: 'Nghe máy', cls: 'bg-emerald-50 text-emerald-700' },
  khong_nghe: { ten: 'Không nghe máy', cls: 'bg-rose-50 text-rose-600' },
  ban: { ten: 'Máy bận', cls: 'bg-amber-50 text-amber-700' },
  tu_choi: { ten: 'Từ chối', cls: 'bg-rose-50 text-rose-600' },
}
const ngayGoi = (t) => { if (!t) return 'Không rõ giờ'; const d = new Date(t); const p2 = (n) => String(n).padStart(2, '0'); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}` }
const phutGiay = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`
const tongThoiLuong = (s) => {
  const p = Math.round((s || 0) / 60)
  return p >= 60 ? `${Math.floor(p / 60)} giờ ${p % 60} phút` : `${p} phút`
}

export default function NhatKyCuocGoi({ ds, dangTai, loi, onTaiLai, customerId, tenNguoi }) {
  const [ghiAm, setGhiAm] = useState({})   // { [id cuộc gọi]: { dangTai, url, loi } }

  // Link ghi âm Callio chỉ sống 6 giờ → mỗi lần bấm nghe xin link mới, không lưu lại
  async function nghe(id) {
    setGhiAm((g) => ({ ...g, [id]: { dangTai: true } }))
    const { data, error } = await goiHamCallio({ action: 'recording', customer_id: customerId, call_id: id })
    setGhiAm((g) => ({ ...g, [id]: error ? { loi: error.text } : { url: data.url } }))
  }

  if (dangTai) {
    return <p className="py-10 text-center text-sm text-ink-400">Đang tải cuộc gọi từ Callio...</p>
  }
  if (loi) {
    const chuaKetNoi = loi.code === 'chua_ket_noi' || loi.code === 'chua_trien_khai'
    return (
      <div className={`rounded-xl border px-4 py-8 text-center ${chuaKetNoi ? 'border-dashed border-slate-200' : 'border-rose-200 bg-rose-50'}`}>
        <PhoneOff size={28} className={`mx-auto ${chuaKetNoi ? 'text-ink-400' : 'text-rose-500'}`} />
        <p className="mt-2 font-medium text-navy-900">{chuaKetNoi ? 'Chưa kết nối Callio' : 'Không tải được cuộc gọi'}</p>
        <p className="mt-1 text-sm text-ink-600">
          {chuaKetNoi ? 'Quản trị viên cần cài đặt kết nối Callio thì lịch sử cuộc gọi mới hiện ở đây.' : loi.text}
        </p>
        <button type="button" onClick={onTaiLai} className="mt-3 text-sm font-medium text-coral-500 hover:underline">Thử lại</button>
      </div>
    )
  }
  if (ds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
        <Phone size={28} className="mx-auto text-ink-400" />
        <p className="mt-2 font-medium text-navy-900">Chưa có cuộc gọi nào với khách này</p>
        <p className="mt-1 text-sm text-ink-600">Cuộc gọi qua Callio với số này sẽ tự hiện ở đây kèm ghi âm.</p>
        <button type="button" onClick={onTaiLai} className="mt-3 text-sm font-medium text-coral-500 hover:underline">Tải lại</button>
      </div>
    )
  }
  const ngheMay = ds.filter((c) => c.trang_thai === 'nghe_may')
  const gan = new Date(ds[0].bat_dau)
  const homNay = gan.toDateString() === new Date().toDateString()
  const stat = [
    ['Tổng cuộc gọi', ds.length, Phone, 'bg-navy-900 text-white', 'border-navy-900/15 bg-slate-50'],
    ['Nghe máy', ngheMay.length, CircleCheck, 'bg-emerald-500 text-white', 'border-emerald-200 bg-emerald-50'],
    ['Tổng thời lượng', tongThoiLuong(ds.reduce((a, c) => a + (c.thoi_luong_giay || 0), 0)), Clock, 'bg-coral-500 text-white', 'border-orange-200 bg-orange-50'],
    ['Gọi gần nhất', homNay ? 'Hôm nay' : gan.toLocaleDateString('vi-VN'), CalendarClock, 'bg-sky-500 text-white', 'border-sky-200 bg-sky-50'],
  ]
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat.map(([nhan, v, Ic, mauIcon, mauO]) => (
          <div key={nhan} className={`rounded-2xl border-2 px-3.5 py-3 ${mauO}`}>
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${mauIcon}`}><Ic size={16} strokeWidth={2.4} /></div>
              <p className="text-xs font-bold leading-tight text-ink-600">{nhan}</p>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold leading-tight text-navy-900">{v}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-3">
        {ds.map((c) => {
          const Icon = c.trang_thai !== 'nghe_may' ? PhoneOff : c.huong === 'den' ? PhoneIncoming : PhoneOutgoing
          const mau = c.trang_thai !== 'nghe_may' ? 'bg-rose-50 text-rose-500' : c.huong === 'den' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
          const tt = TT_GOI[c.trang_thai] || TT_GOI.nghe_may
          return (
            <li key={c.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${mau}`}><Icon size={15} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-900">
                    {c.huong === 'den' ? 'Gọi đến' : 'Gọi đi'} · {ngayGoi(c.bat_dau)}
                  </p>
                  <p className="text-xs text-ink-400">{(c.sale_id && tenNguoi(c.sale_id)) || c.ten_sale || 'Không rõ'}{c.so_dien_thoai ? ` · ${c.so_dien_thoai}` : ''}</p>
                </div>
                <Badge className={tt.cls}>{tt.ten}</Badge>
                <span className="w-12 flex-none text-right text-sm tabular-nums text-ink-600">{phutGiay(c.thoi_luong_giay)}</span>
              </div>
              {c.co_ghi_am && (() => {
                const g = ghiAm[c.id]
                if (g?.url) return (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <audio controls autoPlay src={g.url} className="h-8 w-full" />
                    <a href={g.url} download target="_blank" rel="noreferrer"
                      className="flex-none text-ink-400 hover:text-coral-500" title="Tải ghi âm"><FileDown size={15} /></a>
                  </div>
                )
                return (
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" onClick={() => nghe(c.id)} disabled={g?.dangTai}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-navy-900 hover:bg-slate-100 disabled:opacity-60">
                      <Play size={13} /> {g?.dangTai ? 'Đang lấy ghi âm...' : 'Nghe ghi âm'}
                    </button>
                    {g?.loi && <span className="text-xs text-rose-500">{g.loi}</span>}
                  </div>
                )
              })()}
              {c.ghi_chu && <p className="mt-2 text-xs text-ink-600">Ghi chú: {c.ghi_chu}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
