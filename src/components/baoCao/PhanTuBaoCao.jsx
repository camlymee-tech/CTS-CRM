// Các thẻ, thanh tiến độ và bảng hiển thị của trang Báo cáo (chỉ hiển thị, số liệu tính ở lib/baoCao.js).
import { hienPt2 } from '../../lib/dashboardXlsx'
import { mauThanh, mauChu } from '../../lib/baoCao'

export function Thanh({ pt, className = '' }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className={`h-full rounded-full ${mauThanh(pt)}`} style={{ width: `${Math.min(Math.max((pt || 0) * 100, pt ? 2 : 0), 100)}%` }} />
    </div>
  )
}

// Ô % hoàn thành: số + thanh tiến độ
function OPt({ pt }) {
  return (
    <div className="flex items-center gap-2.5">
      <Thanh pt={pt} className="h-2 flex-1" />
      <span className={`w-16 text-right font-semibold ${mauChu(pt)}`}>{pt == null ? '—' : hienPt2(pt)}</span>
    </div>
  )
}

// Vòng tròn tiến độ
export function Vong({ pt, size = 80, sang = false }) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(Math.max(pt || 0, 0), 1)
  return (
    <svg width={size} height={size} className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={sang ? 'rgba(255,255,255,0.18)' : '#e2e8f0'} strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="8" strokeLinecap="round"
        stroke={pt != null && pt >= 1 ? '#34d399' : '#ff7a00'} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
    </svg>
  )
}

const TONE = {
  emerald: { vien: '#10b981', chu: 'text-emerald-600', nen: 'bg-emerald-50', icon: 'text-emerald-600' },
  sky: { vien: '#0ea5e9', chu: 'text-sky-600', nen: 'bg-sky-50', icon: 'text-sky-600' },
  amber: { vien: '#f59e0b', chu: 'text-amber-600', nen: 'bg-amber-50', icon: 'text-amber-600' },
  violet: { vien: '#8b5cf6', chu: 'text-violet-600', nen: 'bg-violet-50', icon: 'text-violet-600' },
  rose: { vien: '#f43f5e', chu: 'text-rose-500', nen: 'bg-rose-50', icon: 'text-rose-500' },
}

// Thẻ chỉ số: lon = thẻ nền xanh đậm (chỉ số quan trọng nhất)
export function TheKpi({ tieuDe, so, phu, tone, icon: Icon, lon = false, nho = false }) {
  if (lon) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-navy-900 px-6 py-5 text-white shadow-sm">
        <div>
          <p className="text-sm text-white/70">{tieuDe}</p>
          <p className="mt-1 font-display text-4xl font-bold">{so}</p>
          {phu && <p className="mt-1 text-xs text-white/60">{phu}</p>}
        </div>
        {Icon && <Icon size={34} className="text-white/30" />}
      </div>
    )
  }
  const t = TONE[tone] || TONE.sky
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm" style={{ borderTop: `4px solid ${t.vien}` }}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">{tieuDe}</p>
        {Icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.nen}`}><Icon size={16} className={t.icon} /></span>}
      </div>
      <p className={`mt-1 font-display ${nho ? 'text-2xl' : 'text-3xl'} font-bold ${t.chu}`}>{so}</p>
      {phu && <p className="mt-1 text-xs text-ink-400">{phu}</p>}
    </div>
  )
}

// Chi tiết từng phòng: mỗi phòng là một khối riêng (tên phòng + tóm tắt ở đầu, bảng từng sale, dòng tổng phòng)
export function BangChiTietPhong({ chiTiet, trangThai, tiLeChotRow }) {
  if (chiTiet.length === 0) return <p className="py-6 text-center text-sm text-ink-400">Chưa có dữ liệu.</p>
  const o = 'border border-slate-200 px-3 py-2.5'
  return (
    <div className="space-y-6">
      {chiTiet.map((g) => (
        <div key={g.ten} className="overflow-hidden rounded-2xl border-2 border-navy-900/15">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 rounded-full bg-coral-500" />
              <p className="font-display text-lg font-bold">Phòng {g.ten}</p>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{g.rows.length} sale</span>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-white/70">Tổng khách <b className="ml-1 font-display text-lg text-white">{g.tong.toLocaleString('vi-VN')}</b></span>
              <span className="text-white/70">Tỷ lệ chốt <b className="ml-1 font-display text-lg text-emerald-300">{tiLeChotRow(g.dem, g.tong)}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '17%' }} /><col style={{ width: '8%' }} />
                {trangThai.map((b) => <col key={b.ma} />)}
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-xs font-semibold text-ink-600">
                  <th className={`${o} text-left`}>Sale</th>
                  <th className={`${o} text-center`}>Tổng khách</th>
                  {trangThai.map((b) => <th key={b.ma} className={`${o} text-center leading-tight`}>{b.ten}</th>)}
                  <th className={`${o} text-center`}>Tỷ lệ chốt</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.sale.id} className="bg-white hover:bg-blue-50/40">
                    <td className={`${o} font-semibold text-navy-900`}>{r.sale.full_name}</td>
                    <td className={`${o} text-center font-display text-base font-bold text-navy-900`}>{r.tong.toLocaleString('vi-VN')}</td>
                    {trangThai.map((b) => <td key={b.ma} className={`${o} text-center ${r.dem[b.ma] ? 'font-semibold text-navy-900' : 'text-slate-300'}`}>{r.dem[b.ma] || 0}</td>)}
                    <td className={`${o} text-center font-semibold text-emerald-600`}>{tiLeChotRow(r.dem, r.tong)}</td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-bold text-navy-900">
                  <td className={o}>Tổng phòng {g.ten}</td>
                  <td className={`${o} text-center font-display text-base`}>{g.tong.toLocaleString('vi-VN')}</td>
                  {trangThai.map((b) => <td key={b.ma} className={`${o} text-center`}>{g.dem[b.ma] || 0}</td>)}
                  <td className={`${o} text-center text-emerald-600`}>{tiLeChotRow(g.dem, g.tong)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// Báo cáo mục tiêu — mỗi phòng một khối riêng: thanh tên phòng (tóm tắt), bảng từng sale, dòng tổng và trung bình
export function BangMucTieuPhong({ nhomPhong, tatCa, soNgay, tb1 }) {
  const o = 'border border-slate-200 px-3 py-2.5'
  const tomTat = (ten, g, tb, cls) => {
    const f = tb ? (x) => tb1(x / g.n) : (x) => x
    const pt = tb ? g.ptTb : g.ptTong
    return (
      <tr className={`font-bold ${cls}`}>
        <td className={o}>{ten}</td>
        <td className={`${o} text-center`}>{f(g.sum.phuTrach)}</td>
        <td className={`${o} text-center`}>{f(g.sum.moi)}</td>
        <td className={`${o} text-center`}>{f(g.sum.luot)}</td>
        <td className={`${o} text-center`}>{f(g.sum.nghe)}</td>
        <td className={`${o} text-center`}>{f(g.sum.ht)} / {f(g.sum.mt)}</td>
        <td className={o}><OPt pt={pt} /></td>
        <td className={`${o} text-center ${g.sum.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{f(g.sum.ton)}</td>
      </tr>
    )
  }
  const khung = (g, children, tieuDe, phu) => (
    <div key={g.ten} className="overflow-hidden rounded-2xl border-2 border-navy-900/15">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-coral-500" />
          <p className="font-display text-lg font-bold">{tieuDe}</p>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{g.n} sale</span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="text-white/70">Hoàn thành <b className="ml-1 font-display text-lg text-white">{g.sum.ht.toLocaleString('vi-VN')} / {g.sum.mt.toLocaleString('vi-VN')}</b></span>
          <span className="text-white/70">% hoàn thành <b className="ml-1 font-display text-lg text-emerald-300">{g.ptTong == null ? '—' : hienPt2(g.ptTong)}</b></span>
          {phu}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-xs font-semibold text-ink-600">
              <th className={`${o} text-left`}>Sale</th>
              <th className={`${o} text-center`}>Số data phụ trách</th>
              <th className={`${o} text-center`}>Data sale tìm kiếm</th>
              <th className={`${o} text-center`}>Lượt chăm sóc</th>
              <th className={`${o} text-center`}>KH liên hệ được</th>
              <th className={`${o} text-center`}>Hoàn thành / mục tiêu</th>
              <th className={`${o} text-center`}>% hoàn thành</th>
              <th className={`${o} text-center`}>Khách tồn quá {soNgay} ngày</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
  return (
    <div className="space-y-6">
      {nhomPhong.map((g) => khung(g, (
        <>
          {g.rows.map((r) => (
            <tr key={r.sale.id} className="bg-white hover:bg-blue-50/40">
              <td className={`${o} font-semibold text-navy-900`}>{r.sale.full_name}</td>
              <td className={`${o} text-center`}>{r.phuTrach}</td>
              <td className={`${o} text-center`}>{r.moi}</td>
              <td className={`${o} text-center`}>{r.luot}</td>
              <td className={`${o} text-center`}>{r.nghe}</td>
              <td className={`${o} text-center font-semibold text-navy-900`}>{r.ht} / {r.mt}</td>
              <td className={o}><OPt pt={r.pt} /></td>
              <td className={`${o} text-center font-semibold ${r.ton > 0 ? 'text-rose-500' : 'text-ink-400'}`}>{r.ton}</td>
            </tr>
          ))}
          {tomTat(`Tổng phòng ${g.ten}`, g, false, 'bg-amber-50 text-navy-900')}
          {tomTat('Trung bình / sale', g, true, 'bg-orange-50 text-navy-900')}
        </>
      ), `Phòng ${g.ten}`, null))}
      {nhomPhong.length > 1 && (
        <div className="overflow-hidden rounded-2xl border-2 border-navy-900">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-5 py-3 text-white">
            <p className="font-display text-lg font-bold">Toàn công ty <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{tatCa.n} sale</span></p>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-white/70">Hoàn thành <b className="ml-1 font-display text-lg text-white">{tatCa.sum.ht.toLocaleString('vi-VN')} / {tatCa.sum.mt.toLocaleString('vi-VN')}</b></span>
              <span className="text-white/70">% hoàn thành <b className="ml-1 font-display text-lg text-emerald-300">{tatCa.ptTong == null ? '—' : hienPt2(tatCa.ptTong)}</b></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} />
              </colgroup>
              <tbody>
                {tomTat('TỔNG TOÀN CÔNG TY', tatCa, false, 'bg-amber-50 text-navy-900')}
                {tomTat('Trung bình / sale toàn công ty', tatCa, true, 'bg-orange-50 text-navy-900')}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
