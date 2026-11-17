import { useMemo, useState } from 'react'
import { FileDown, Plus, Trash2, RotateCcw } from 'lucide-react'
import { Button } from './ui'
import {
  so, tinhThue, tinhXNK, khungXNK, khungMuaBan,
  MUA_BAN_MAC_DINH, VAN_CHUYEN_MAC_DINH, UY_THAC_MAC_DINH, SP_THUE, HINH_THUC_UT,
} from '../lib/baoGia'
import { xuatBaoGia } from '../lib/baoGiaXlsx'

const vnd = (n) => (n === null || n === undefined || n === '' ? '' : Math.round(Number(n) || 0).toLocaleString('vi-VN'))
const pt2 = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + '%'
const lamSach = (s, tp) => {
  let v = String(s).replace(tp ? /[^\d,]/g : /[^\d]/g, '')
  if (tp) { const i = v.indexOf(','); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '') }
  return v
}
const hien = (s, tp) => (tp ? s : String(s).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))

const TD = 'border border-slate-300 px-2 py-1.5 text-sm'
const TH = 'border border-slate-300 bg-navy-900 px-2 py-2 text-center text-xs font-semibold text-white'

// Ô nhập số: nền cam nhạt để biết là ô sale tự nhập
function O({ v, set, tp = false, w = 'w-full', canh = 'text-right', ph = '' }) {
  return (
    <input
      inputMode="decimal" value={hien(v ?? '', tp)} placeholder={ph}
      onChange={(e) => set(lamSach(e.target.value, tp))}
      className={`${w} ${canh} rounded bg-orange-50 px-1.5 py-1 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-coral-500/30`}
    />
  )
}
function Chu({ v, set, w = 'w-full', ph = '' }) {
  return (
    <input value={v} placeholder={ph} onChange={(e) => set(e.target.value)}
      className={`${w} rounded bg-orange-50 px-1.5 py-1 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-coral-500/30`} />
  )
}

function ThongTinChung({ st, up }) {
  return (
    <div className="flex flex-wrap gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm"><span className="font-medium text-navy-900">Tên khách hàng</span>
        <Chu v={st.khach} set={(v) => up({ khach: v })} ph="VD: Anh Minh - Shop ABC" /></label>
      <label className="flex w-52 flex-col gap-1 text-sm"><span className="font-medium text-navy-900">Mã báo giá</span>
        <Chu v={st.ma} set={(v) => up({ ma: v })} ph="VD: CTS38001" /></label>
    </div>
  )
}

// ================= BẢNG KHAI BÁO THUẾ (Uỷ thác) =================
function BangThue({ st, up }) {
  const th = useMemo(() => tinhThue(st), [st])
  const setSp = (i, p) => up({ sp: st.sp.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const heads = ['STT', 'Sản phẩm', 'Số lượng', 'Đơn giá khách báo (tệ)', 'Giá trị (tệ)', 'Giá trị (VND)', 'TS thuế NK (%)', 'TS GTGT (%)', 'CBPG (%)', 'TTDB (%)', 'BVMT (VND)', 'Thuế NK', 'CBPG', 'TTDB', 'Thuế GTGT', 'Tổng thuế', '']
  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display font-semibold text-navy-900">1. Khai báo thuế theo sản phẩm</p>
        <label className="flex items-center gap-2 text-sm"><span className="font-medium text-navy-900">Tỷ giá tệ (VND)</span>
          <span className="w-28"><O v={st.tyGiaTe} set={(v) => up({ tyGiaTe: v })} /></span></label>
      </div>
      <table className="w-full min-w-[1700px] border-collapse">
        <thead><tr>{heads.map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {st.sp.map((p, i) => {
            const d = th.dong[i]
            return (
              <tr key={i}>
                <td className={`${TD} text-center`}>{i + 1}</td>
                <td className={`${TD} min-w-[170px]`}><Chu v={p.ten} set={(v) => setSp(i, { ten: v })} ph={`Sản phẩm ${i + 1}`} /></td>
                <td className={`${TD} w-24`}><O v={p.sl} set={(v) => setSp(i, { sl: v })} /></td>
                <td className={`${TD} w-28`}><O v={p.dg} set={(v) => setSp(i, { dg: v })} tp /></td>
                <td className={`${TD} text-right`}>{vnd(d.tri)}</td>
                <td className={`${TD} text-right`}>{vnd(d.W)}</td>
                {['nk', 'gtgt', 'cbpg', 'ttdb'].map((k) => <td key={k} className={`${TD} w-20`}><O v={p[k]} set={(v) => setSp(i, { [k]: v })} tp /></td>)}
                <td className={`${TD} w-28`}><O v={p.bvmt} set={(v) => setSp(i, { bvmt: v })} /></td>
                <td className={`${TD} text-right`}>{vnd(d.nk)}</td>
                <td className={`${TD} text-right`}>{vnd(d.cbpg)}</td>
                <td className={`${TD} text-right`}>{vnd(d.ttdb)}</td>
                <td className={`${TD} text-right`}>{vnd(d.gtgt)}</td>
                <td className={`${TD} bg-slate-50 text-right font-semibold`}>{vnd(d.tong)}</td>
                <td className={`${TD} w-10 text-center`}>
                  {st.sp.length > 1 && <button type="button" onClick={() => up({ sp: st.sp.filter((_, j) => j !== i) })} className="text-ink-400 hover:text-rose-500"><Trash2 size={15} /></button>}
                </td>
              </tr>
            )
          })}
          <tr className="bg-slate-100 font-bold">
            <td className={TD} /><td className={TD}>TỔNG CỘNG</td>
            <td className={TD} /><td className={TD} /><td className={TD} />
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.W, 0))}</td>
            <td className={TD} /><td className={TD} /><td className={TD} /><td className={TD} /><td className={TD} />
            <td className={`${TD} text-right`}>{vnd(th.tong.nk)}</td>
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.cbpg, 0))}</td>
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.ttdb, 0))}</td>
            <td className={`${TD} text-right`}>{vnd(th.tong.vat)}</td>
            <td className={`${TD} text-right`}>{vnd(th.tong.tong)}</td>
            <td className={TD} />
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="secondary" onClick={() => up({ sp: [...st.sp, SP_THUE()] })}><Plus size={16} />Thêm sản phẩm</Button>
        <p className="text-xs text-ink-400">Thuế NK = giá trị × TS NK · TTDB = (giá trị + thuế NK) × TS TTDB · GTGT = (giá trị + NK + CBPG + TTDB + BVMT) × TS GTGT</p>
      </div>
    </div>
  )
}

// ================= VẬN CHUYỂN / UỶ THÁC (khung báo giá XNK) =================
function BangXNK({ st, up, loai }) {
  const kq = useMemo(() => tinhXNK(st, loai), [st, loai])
  const khung = useMemo(() => khungXNK(st, kq, loai), [st, kq, loai])
  const nhapO = (x) => <O v={st[x.k]} set={(v) => up({ [x.k]: v })} tp={!!x.tp} />
  const hienO = (x) => (x && typeof x === 'object' ? nhapO(x) : x === undefined || x === null ? '' : vnd(x))

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display font-semibold text-navy-900">2. Báo giá {loai === 'uy_thac' ? 'dịch vụ uỷ thác xuất nhập khẩu' : loai === 'mua_ban' ? 'dịch vụ mua bán' : 'dịch vụ vận chuyển'}</p>
          <label className="flex items-center gap-2 text-sm"><span className="font-medium text-navy-900">Tuyến</span>
            <span className="w-28"><Chu v={st.tuyen} set={(v) => up({ tuyen: v })} /></span></label>
        </div>
        <table className="w-full min-w-[900px] border-collapse">
          <thead><tr>
            {['STT', 'Nội dung', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền theo KG', 'Thành tiền theo M3'].map((h) => <th key={h} className={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {khung.map((r, i) => {
              const nen = r.loai === 'tong' ? (r.lon ? 'bg-orange-100' : 'bg-slate-100') : r.loai === 'nhom' ? 'bg-slate-100' : ''
              const dam = r.loai !== 'dong' || r.dam ? 'font-semibold' : ''
              return (
                <tr key={i} className={`${nen} ${dam}`}>
                  <td className={`${TD} w-14 text-center`}>{r.stt}</td>
                  <td className={`${TD} ${r.sub ? 'pl-6' : ''}`}>
                    {r.nd}
                    {r.pct && <span className="ml-2 inline-block w-20 align-middle"><O v={st[r.pct.k]} set={(v) => up({ [r.pct.k]: v })} tp /></span>}
                    {r.pct && ' %'}
                  </td>
                  <td className={`${TD} w-16 text-center`}>{r.dvt}</td>
                  <td className={`${TD} w-32 text-right`}>{r.loai === 'dong' ? hienO(r.sl) : ''}</td>
                  <td className={`${TD} w-36 text-right`}>{r.loai === 'dong' ? hienO(r.dg) : ''}</td>
                  <td className={`${TD} w-44 text-right ${r.lon ? 'text-base font-bold text-navy-900' : ''}`}>{vnd(r.t.kg)}</td>
                  <td className={`${TD} w-44 text-right ${r.lon ? 'text-base font-bold text-navy-900' : ''}`}>{vnd(r.t.m3)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-display font-semibold text-navy-900">Tổng hợp so sánh: theo KG và theo M3</p>
        <table className="w-full min-w-[640px] border-collapse">
          <thead><tr>{['Nội dung', 'Theo KG', 'Theo M3'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ['Số lượng (KG / M3)', so(st.kg).toLocaleString('vi-VN'), so(st.m3).toLocaleString('vi-VN')],
              ['Giá bán dự kiến (thành tiền) = cước + phí tách tờ khai + thuế + CP nội địa VN + CP nội địa TQ', vnd(kq.kg.duKien), vnd(kq.m3.duKien), true],
              ['Giá bán dự kiến (đơn giá)', vnd(kq.kg.duKienDg), vnd(kq.m3.duKienDg)],
              ['Giá bán chốt (đơn giá, sale nhập)', <O key="a" v={st.chotKg} set={(v) => up({ chotKg: v })} />, <O key="b" v={st.chotM3} set={(v) => up({ chotM3: v })} />],
              ['Giá bán chốt (thành tiền)', so(st.chotKg) ? vnd(kq.kg.chotTT) : '', so(st.chotM3) ? vnd(kq.m3.chotTT) : ''],
              ['Chênh lệch chốt - dự kiến', kq.kg.cl === null ? '' : vnd(kq.kg.cl), kq.m3.cl === null ? '' : vnd(kq.m3.cl), true],
              ['Cước vận chuyển chốt', kq.kg.cuocChot === null ? '' : vnd(kq.kg.cuocChot), kq.m3.cuocChot === null ? '' : vnd(kq.m3.cuocChot)],
            ].map(([nd, a, b, dam], i) => (
              <tr key={i} className={dam ? 'bg-slate-50 font-semibold' : ''}>
                <td className={TD}>{nd}</td><td className={`${TD} w-52 text-right`}>{a}</td><td className={`${TD} w-52 text-right`}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ================= TRANG CHÍNH =================
const TABS = [
  { key: 'mua_ban', ten: 'Mua bán' },
  { key: 'van_chuyen', ten: 'Vận chuyển' },
  { key: 'uy_thac', ten: 'Uỷ thác' },
]
const MAC_DINH = { mua_ban: MUA_BAN_MAC_DINH, van_chuyen: VAN_CHUYEN_MAC_DINH, uy_thac: UY_THAC_MAC_DINH }

export default function BaoGiaPage() {
  const [tab, setTab] = useState('mua_ban')
  const [data, setData] = useState({ mua_ban: MUA_BAN_MAC_DINH(), van_chuyen: VAN_CHUYEN_MAC_DINH(), uy_thac: UY_THAC_MAC_DINH() })
  const st = data[tab]
  const up = (p) => setData((d) => ({ ...d, [tab]: { ...d[tab], ...p } }))
  const [dang, setDang] = useState(false)
  const xuat = async () => { setDang(true); try { await xuatBaoGia({ loai: tab, st }) } finally { setDang(false) } }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tính giá bán</h1>
          <p className="text-sm text-ink-600">Báo giá dịch vụ Mua bán, Vận chuyển, Uỷ thác. Ô nền cam là ô sale tự nhập</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setData((d) => ({ ...d, [tab]: MAC_DINH[tab]() }))}><RotateCcw size={16} />Làm lại</Button>
          <Button onClick={xuat} disabled={dang}><FileDown size={16} />{dang ? 'Đang xuất...' : 'Xuất Excel báo giá'}</Button>
        </div>
      </header>

      <div className="space-y-5 p-8">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'bg-navy-900 text-white shadow-sm' : 'bg-white text-ink-600 hover:bg-slate-100'}`}>
              Dịch vụ {t.ten}
            </button>
          ))}
        </div>

        {(
          <>
            <ThongTinChung st={st} up={up} />
            {tab === 'uy_thac' && (
              <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow-sm">
                <label className="flex min-w-[320px] flex-col gap-1 text-sm"><span className="font-medium text-navy-900">Hình thức uỷ thác</span>
                  <select value={st.hinhThuc}
                    onChange={(e) => up({ hinhThuc: e.target.value, phiTach: HINH_THUC_UT[e.target.value].phiTach })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500">
                    {Object.entries(HINH_THUC_UT).map(([k, v]) => <option key={k} value={k}>{v.ten}</option>)}
                  </select></label>
                <p className="pb-2 text-xs text-ink-400">Chọn hình thức sẽ tự điền phí tách tờ khai (3.000.000 hoặc 5.000.000), vẫn sửa tay được.</p>
              </div>
            )}
            <BangThue st={st} up={up} />
            <BangXNK st={st} up={up} loai={tab} />
          </>
        )}
      </div>
    </div>
  )
}
