import { useEffect, useMemo, useState } from 'react'
import { FileDown, Plus, Trash2, RotateCcw, Save, X, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import DanhSachBaoGia from './DanhSachBaoGia'
import { Button } from './ui'
import {
  so, tinhThue, tinhXNK, tinhOrder, TEN_DV, khungXNK, ORDER_MAC_DINH, SP_ORDER,
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
function BangThue({ st, up, khoa = false, phang = false, tieuDe }) {
  const th = useMemo(() => tinhThue(st), [st])
  const setSp = (i, p) => up({ sp: st.sp.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const heads = ['STT', 'Sản phẩm', 'Số lượng', 'Đơn giá khách báo (tệ)', 'Giá trị (tệ)', 'Tiền hàng (VND)', 'Đơn giá khai (USD)', 'Giá trị khai (USD)', 'Giá trị khai (VND)', 'TS thuế NK (%)', 'TS GTGT (%)', 'CBPG (%)', 'TTDB (%)', 'BVMT (VND)', 'Thuế NK', 'CBPG', 'TTDB', 'Thuế GTGT', 'Tổng thuế', '']
  return (
    <div className={phang ? 'overflow-x-auto' : 'overflow-x-auto rounded-2xl bg-white p-4 shadow-sm'}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display font-semibold text-navy-900">{tieuDe === undefined ? '1. Khai báo thuế theo sản phẩm' : tieuDe}</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><span className="font-medium text-navy-900">Tỷ giá tệ (VND)</span>
            {khoa ? <span className="font-semibold text-navy-900">{vnd(so(st.tyGiaTe))}</span>
              : <span className="w-28"><O v={st.tyGiaTe} set={(v) => up({ tyGiaTe: v })} /></span>}</label>
          <label className="flex items-center gap-2 text-sm"><span className="font-medium text-navy-900">Tỷ giá USD (VND)</span>
            <span className="w-28"><O v={st.tyGiaUsd} set={(v) => up({ tyGiaUsd: v })} /></span></label>
        </div>
      </div>
      <table className="w-full min-w-[2000px] border-collapse">
        <thead><tr>{heads.map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {st.sp.map((p, i) => {
            const d = th.dong[i]
            return (
              <tr key={i}>
                <td className={`${TD} text-center`}>{i + 1}</td>
                {khoa ? (
                  <>
                    <td className={`${TD} min-w-[170px]`}>{p.ten || `Sản phẩm ${i + 1}`}</td>
                    <td className={`${TD} text-right`}>{vnd(so(p.sl))}</td>
                    <td className={`${TD} text-right`}>{p.dg ? String(p.dg) : ''}</td>
                  </>
                ) : (
                  <>
                    <td className={`${TD} min-w-[170px]`}><Chu v={p.ten} set={(v) => setSp(i, { ten: v })} ph={`Sản phẩm ${i + 1}`} /></td>
                    <td className={`${TD} w-24`}><O v={p.sl} set={(v) => setSp(i, { sl: v })} /></td>
                    <td className={`${TD} w-28`}><O v={p.dg} set={(v) => setSp(i, { dg: v })} tp /></td>
                  </>
                )}
                <td className={`${TD} text-right`}>{vnd(d.tri)}</td>
                <td className={`${TD} text-right`}>{vnd(d.W)}</td>
                <td className={`${TD} w-28`}><O v={p.dgUsd} set={(v) => setSp(i, { dgUsd: v })} tp /></td>
                <td className={`${TD} text-right`}>{vnd(d.usd)}</td>
                <td className={`${TD} text-right`}>{vnd(d.WU)}</td>
                {['nk', 'gtgt', 'cbpg', 'ttdb'].map((k) => <td key={k} className={`${TD} w-20`}><O v={p[k]} set={(v) => setSp(i, { [k]: v })} tp /></td>)}
                <td className={`${TD} w-28`}><O v={p.bvmt} set={(v) => setSp(i, { bvmt: v })} /></td>
                <td className={`${TD} text-right`}>{vnd(d.nk)}</td>
                <td className={`${TD} text-right`}>{vnd(d.cbpg)}</td>
                <td className={`${TD} text-right`}>{vnd(d.ttdb)}</td>
                <td className={`${TD} text-right`}>{vnd(d.gtgt)}</td>
                <td className={`${TD} bg-slate-50 text-right font-semibold`}>{vnd(d.tong)}</td>
                <td className={`${TD} w-10 text-center`}>
                  {!khoa && st.sp.length > 1 && <button type="button" onClick={() => up({ sp: st.sp.filter((_, j) => j !== i) })} className="text-ink-400 hover:text-rose-500"><Trash2 size={15} /></button>}
                </td>
              </tr>
            )
          })}
          <tr className="bg-slate-100 font-bold">
            <td className={TD} /><td className={TD}>TỔNG CỘNG</td>
            <td className={TD} /><td className={TD} /><td className={TD} />
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.W, 0))}</td>
            <td className={TD} />
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.usd, 0))}</td>
            <td className={`${TD} text-right`}>{vnd(th.dong.reduce((a, d) => a + d.WU, 0))}</td>
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
        {khoa ? <span /> : <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => up({ sp: [...st.sp, SP_THUE()] })}><Plus size={16} />Thêm sản phẩm</Button>}
        <p className="ml-4 text-xs text-ink-400">Có đơn giá khai USD thì tính thuế trên giá trị khai (VND), không có thì tính trên tiền hàng theo tệ · Thuế NK = giá trị × TS NK · TTDB = (giá trị + thuế NK) × TS TTDB · GTGT = (giá trị + NK + CBPG + TTDB + BVMT) × TS GTGT</p>
      </div>
    </div>
  )
}

// ================= VẬN CHUYỂN / UỶ THÁC (khung báo giá XNK) =================
function BangXNK({ st, up, loai, order = false, phang = false, tieuDe }) {
  const kq = useMemo(() => tinhXNK(st, loai, order), [st, loai, order])
  const khung = useMemo(() => khungXNK(st, kq, loai, order), [st, kq, loai, order])
  const KHUNG = phang ? 'overflow-x-auto rounded-xl border border-slate-200 p-4' : 'overflow-x-auto rounded-2xl bg-white p-4 shadow-sm'
  const nhapO = (x) => <O v={st[x.k]} set={(v) => up({ [x.k]: v })} tp={!!x.tp} />
  const hienO = (x) => (x && typeof x === 'object' ? nhapO(x) : x === undefined || x === null ? '' : vnd(x))

  return (
    <div className="space-y-5">
      <div className={KHUNG}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display font-semibold text-navy-900">{tieuDe !== undefined ? tieuDe : `2. Báo giá ${loai === 'uy_thac' ? 'dịch vụ uỷ thác xuất nhập khẩu' : loai === 'mua_ban' ? 'dịch vụ mua bán' : 'dịch vụ vận chuyển'}`}</p>
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

      <div className={KHUNG}>
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
  { key: 'order', ten: 'Báo giá Order' },
  { key: 'mua_ban', ten: 'Mua bán' },
  { key: 'van_chuyen', ten: 'Vận chuyển' },
  { key: 'uy_thac', ten: 'Uỷ thác' },
]
const MAC_DINH = { order: ORDER_MAC_DINH, mua_ban: MUA_BAN_MAC_DINH, van_chuyen: VAN_CHUYEN_MAC_DINH, uy_thac: UY_THAC_MAC_DINH }



// ================= BÁO GIÁ ORDER: 4 bước =================
const te2 = (n) => (Number(n) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const BUOC = [
  { n: 1, ten: 'Giá xưởng', id: 'order-b1' },
  { n: 2, ten: 'Khai thuế', id: 'order-b2' },
  { n: 3, ten: 'Vận chuyển', id: 'order-b3' },
  { n: 4, ten: 'Giá về tay', id: 'order-b4' },
]
const DICH_VU = [
  { k: 'van_chuyen', ten: 'Vận chuyển', mota: 'Khách tự mua hàng, CTS vận chuyển và làm thủ tục' },
  { k: 'uy_thac', ten: 'Uỷ thác XNK', mota: 'CTS đứng ra nhập khẩu uỷ thác cho khách' },
  { k: 'mua_ban', ten: 'Mua bán', mota: 'CTS mua hàng và bán lại cho khách' },
]

function Buoc({ n, id, ten, mota, children }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-coral-500 font-display text-base font-bold text-white shadow-sm shadow-coral-500/30">{n}</span>
        <div>
          <h2 className="font-display text-lg font-bold text-navy-900">{ten}</h2>
          <p className="text-sm text-ink-600">{mota}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function OrderFlow({ st, up }) {
  const kq = useMemo(() => tinhOrder(st), [st])
  const setSp = (i, p) => {
    const sp = st.sp.map((x, j) => (j === i ? { ...x, ...p } : x))
    const extra = {}
    if ('can' in p || 'khoi' in p) {
      // cân và khối tổng tự chuyển sang bước vận chuyển
      const tong = (k) => sp.reduce((a, x) => a + so(x[k]), 0)
      const chuoi = (n) => (n > 0 ? String(Math.round(n * 1000) / 1000).replace('.', ',') : '')
      extra.kg = chuoi(tong('can')); extra.m3 = chuoi(tong('khoi'))
    }
    up({ sp, ...extra })
  }
  const nhay = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const tongCan = st.sp.reduce((a, x) => a + so(x.can), 0)
  const tongKhoi = st.sp.reduce((a, x) => a + so(x.khoi), 0)
  const reHon = kq.ve.kg.motSp && kq.ve.m3.motSp ? (kq.ve.kg.motSp <= kq.ve.m3.motSp ? 'kg' : 'm3') : null
  const heads1 = ['STT', 'Sản phẩm', 'Link SP', 'Cân (KG)', 'Khối (M3)', 'Số lượng', 'Giá web (¥)', 'Ship nội địa (¥)', 'Giá trị đơn hàng (¥)', 'Giá về tay 1 SP theo KG', 'Giá về tay 1 SP theo M3', '']

  return (
    <div className="space-y-5">
      {/* Thanh tiến trình 4 bước */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        {BUOC.map((b, i) => (
          <div key={b.n} className="flex items-center gap-2">
            <button type="button" onClick={() => nhay(b.id)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-navy-900 transition hover:bg-orange-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral-500 text-xs font-bold text-white">{b.n}</span>
              {b.ten}
            </button>
            {i < BUOC.length - 1 && <span className="text-ink-400">→</span>}
          </div>
        ))}
      </div>

      {/* BƯỚC 1 */}
      <Buoc n={1} id="order-b1" ten="Giá xưởng" mota="Nhập sản phẩm khách muốn order: số lượng, giá web (tệ), ship nội địa Trung Quốc, cân nặng và khối.">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {[['tyGiaTe', 'Tỷ giá tệ (VND)', false], ['phiDVPct', 'Tỷ lệ phí dịch vụ mua hàng (%)', true], ['tamUngPct', 'Tiền tạm ứng (%)', true]].map(([k, nhan, tp]) => (
            <label key={k} className="flex w-52 flex-col gap-1 text-sm"><span className="font-medium text-navy-900">{nhan}</span>
              <O v={st[k]} set={(v) => up({ [k]: v })} tp={tp} /></label>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] border-collapse">
            <thead><tr>{heads1.map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {st.sp.map((p, i) => (
                <tr key={i}>
                  <td className={`${TD} text-center`}>{i + 1}</td>
                  <td className={`${TD} min-w-[170px]`}><Chu v={p.ten} set={(v) => setSp(i, { ten: v })} ph={`Sản phẩm ${i + 1}`} /></td>
                  <td className={`${TD} min-w-[140px]`}><Chu v={p.link} set={(v) => setSp(i, { link: v })} ph="Dán link" /></td>
                  <td className={`${TD} w-24`}><O v={p.can} set={(v) => setSp(i, { can: v })} tp /></td>
                  <td className={`${TD} w-24`}><O v={p.khoi} set={(v) => setSp(i, { khoi: v })} tp /></td>
                  <td className={`${TD} w-24`}><O v={p.sl} set={(v) => setSp(i, { sl: v })} /></td>
                  <td className={`${TD} w-28`}><O v={p.dg} set={(v) => setSp(i, { dg: v })} tp /></td>
                  <td className={`${TD} w-28`}><O v={p.ship} set={(v) => setSp(i, { ship: v })} tp /></td>
                  <td className={`${TD} bg-amber-50 text-right font-semibold`}>{te2(kq.tri[i])}</td>
                  <td className={`${TD} text-right font-semibold ${reHon === 'kg' ? 'bg-emerald-50 text-emerald-700' : ''}`}>{vnd(kq.ve.kg.dong[i]?.mot)}</td>
                  <td className={`${TD} text-right font-semibold ${reHon === 'm3' ? 'bg-emerald-50 text-emerald-700' : ''}`}>{vnd(kq.ve.m3.dong[i]?.mot)}</td>
                  <td className={`${TD} w-10 text-center`}>
                    {st.sp.length > 1 && <button type="button" onClick={() => { const sp = st.sp.filter((_, j) => j !== i); up({ sp }) }} className="text-ink-400 hover:text-rose-500"><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Button variant="secondary" className="whitespace-nowrap" onClick={() => up({ sp: [...st.sp, SP_ORDER()] })}><Plus size={16} />Thêm sản phẩm</Button>
        </div>

        <div className="mt-5 max-w-2xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['STT', 'Nội dung', 'Số tiền (¥ - RMB)', 'Quy đổi VND'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ['1', 'Giá trị đơn hàng', kq.gt1],
                ['2', 'Tổng tiền ship nội địa', kq.ship],
                ['3', 'Giá trị đơn hàng + ship nội địa TQ', kq.gt3],
                ['4', `Phí dịch vụ mua hàng (${pt2(so(st.phiDVPct))})`, kq.phi],
                ['5', 'TỔNG PHẢI THANH TOÁN', kq.tong, 'bg-orange-100 font-bold'],
                ['6', `${pt2(so(st.tamUngPct))} tiền tạm ứng`, kq.tamUng],
              ].map(([stt, nd, v, cls = '']) => (
                <tr key={stt} className={cls}>
                  <td className={`${TD} w-14 text-center`}>{stt}</td><td className={TD}>{nd}</td>
                  <td className={`${TD} text-right`}>¥ {te2(v.te)}</td><td className={`${TD} text-right`}>{vnd(v.vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Buoc>

      {/* BƯỚC 2 */}
      <Buoc n={2} id="order-b2" ten="Khai thuế" mota="Sản phẩm, số lượng và giá lấy từ bước 1. Nhập thêm giá khai USD (nếu khai riêng) và thuế suất từng sản phẩm.">
        <BangThue st={st} up={up} khoa phang tieuDe={null} />
      </Buoc>

      {/* BƯỚC 3 */}
      <Buoc n={3} id="order-b3" ten="Vận chuyển" mota="Chọn 1 trong 3 dịch vụ để tính cước, phí và thuế nộp hộ. Tiền hàng và phí mua hàng đã tính ở bước 1 nên không tính lại ở đây.">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {DICH_VU.map((d) => (
            <button key={d.k} type="button"
              onClick={() => up({ dichVu: d.k, ...(d.k === 'uy_thac' ? { phiTach: HINH_THUC_UT[st.hinhThuc]?.phiTach || st.phiTach } : {}) })}
              className={`rounded-xl border-2 p-3 text-left transition ${st.dichVu === d.k ? 'border-coral-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className="font-semibold text-navy-900">{d.ten}</p>
              <p className="text-xs text-ink-600">{d.mota}</p>
            </button>
          ))}
        </div>
        {st.dichVu === 'uy_thac' && (
          <label className="mb-4 flex max-w-sm flex-col gap-1 text-sm"><span className="font-medium text-navy-900">Hình thức uỷ thác</span>
            <select value={st.hinhThuc} onChange={(e) => up({ hinhThuc: e.target.value, phiTach: HINH_THUC_UT[e.target.value].phiTach })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500">
              {Object.entries(HINH_THUC_UT).map(([k, v]) => <option key={k} value={k}>{v.ten}</option>)}
            </select></label>
        )}
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-600">
          Cân và khối lấy từ bước 1: <b className="text-navy-900">{tongCan.toLocaleString('vi-VN')} KG</b> và <b className="text-navy-900">{tongKhoi.toLocaleString('vi-VN')} M3</b>. Cần chỉnh thì sửa trực tiếp ở dòng cước bên dưới.
        </p>
        <BangXNK st={st} up={up} loai={st.dichVu} order phang tieuDe="Báo giá vận chuyển" />
      </Buoc>

      {/* BƯỚC 4 */}
      <Buoc n={4} id="order-b4" ten="Giá về tay" mota="Tổng tiền hàng ở bước 1 cộng chi phí vận chuyển và thuế ở bước 3, chia cho số lượng sản phẩm.">
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {[['kg', 'Vận chuyển theo KG'], ['m3', 'Vận chuyển theo M3']].map(([k, nhan]) => (
            <div key={k} className={`rounded-2xl border-2 p-5 ${reHon === k ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-600">{nhan}</p>
                {reHon === k && <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">Rẻ hơn</span>}
              </div>
              <p className="mt-2 font-display text-3xl font-bold text-navy-900">{vnd(kq.ve[k].motSp)} <span className="text-base font-medium text-ink-600">đ / sản phẩm</span></p>
              <p className="mt-1 text-sm text-ink-600">Tổng tiền hàng về tay: <b className="text-navy-900">{vnd(kq.ve[k].tongVe)}</b></p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Nội dung', 'Theo KG', 'Theo M3'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              <tr><td className={TD}>Tổng số lượng sản phẩm</td><td className={`${TD} text-right`}>{vnd(kq.tongSl)}</td><td className={`${TD} text-right`}>{vnd(kq.tongSl)}</td></tr>
              <tr><td className={TD}>Tổng phải thanh toán tiền hàng (bước 1, đã gồm phí mua hàng)</td><td className={`${TD} text-right`}>{vnd(kq.tong.vnd)}</td><td className={`${TD} text-right`}>{vnd(kq.tong.vnd)}</td></tr>
              <tr><td className={TD}>Chi phí vận chuyển + thuế (bước 2 và 3)</td><td className={`${TD} text-right`}>{vnd(kq.ve.kg.vc)}</td><td className={`${TD} text-right`}>{vnd(kq.ve.m3.vc)}</td></tr>
              <tr className="bg-slate-100 font-bold"><td className={TD}>TỔNG TIỀN HÀNG VỀ TAY</td><td className={`${TD} text-right`}>{vnd(kq.ve.kg.tongVe)}</td><td className={`${TD} text-right`}>{vnd(kq.ve.m3.tongVe)}</td></tr>
              <tr className="bg-orange-100 font-bold"><td className={TD}>GIÁ VỀ TAY 1 SẢN PHẨM</td><td className={`${TD} text-right text-base`}>{vnd(kq.ve.kg.motSp)}</td><td className={`${TD} text-right text-base`}>{vnd(kq.ve.m3.motSp)}</td></tr>
            </tbody>
          </table>
        </div>
        {st.sp.length > 1 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['Sản phẩm', 'SL', 'Giá về tay 1 SP theo KG', 'Giá về tay 1 SP theo M3'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {st.sp.map((x, i) => (
                  <tr key={i}>
                    <td className={TD}>{x.ten || `Sản phẩm ${i + 1}`}</td>
                    <td className={`${TD} text-right`}>{vnd(so(x.sl))}</td>
                    <td className={`${TD} text-right font-semibold`}>{vnd(kq.ve.kg.dong[i]?.mot)}</td>
                    <td className={`${TD} text-right font-semibold`}>{vnd(kq.ve.m3.dong[i]?.mot)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-400">Chi phí vận chuyển chia theo tỷ lệ giá trị hàng; thuế tính đúng theo từng sản phẩm.</p>
          </div>
        )}
      </Buoc>
    </div>
  )
}

// Chọn khách hàng để gắn báo giá (tìm theo tên, mã hoặc số điện thoại)
function ChonKhach({ khach, onChon }) {
  const [tim, setTim] = useState('')
  const [kq, setKq] = useState([])
  const [mo, setMo] = useState(false)
  useEffect(() => {
    if (tim.trim().length < 2) { setKq([]); return }
    const t = setTimeout(async () => {
      const s = tim.trim().replace(/[,()%]/g, ' ')
      const { data } = await supabase.from('customers').select('id, ma_khach, ten_khach, sdt')
        .or(`ten_khach.ilike.%${s}%,ma_khach.ilike.%${s}%,sdt.ilike.%${s}%`).limit(10)
      setKq(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [tim])
  if (khach) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm">
        <span className="font-medium text-navy-900">{khach.ten_khach}</span>
        <span className="text-xs text-ink-400">{khach.ma_khach}{khach.sdt ? ` · ${khach.sdt}` : ''}</span>
        {onChon && <button type="button" onClick={() => onChon(null)} className="ml-auto text-ink-400 hover:text-rose-500"><X size={15} /></button>}
      </div>
    )
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <Search size={15} className="text-ink-400" />
        <input value={tim} onChange={(e) => { setTim(e.target.value); setMo(true) }} placeholder="Gõ tên, mã hoặc số điện thoại khách để chọn..."
          className="w-full text-sm outline-none" />
      </div>
      {mo && kq.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {kq.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChon(c); setMo(false); setTim('') }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="font-medium text-navy-900">{c.ten_khach}</span>
              <span className="text-xs text-ink-400">{c.ma_khach}{c.sdt ? ` · ${c.sdt}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Phần tính báo giá. khachCo: khách cố định (khi mở từ hồ sơ khách). baoGiaMo: báo giá đã lưu cần mở lại.
export function BaoGiaEditor({ khachCo = null, baoGiaMo = null, currentProfile, onSaved, onClose, duoi = null }) {
  const [tab, setTab] = useState(baoGiaMo?.loai || 'order')
  const [data, setData] = useState(() => {
    const d = { order: ORDER_MAC_DINH(), mua_ban: MUA_BAN_MAC_DINH(), van_chuyen: VAN_CHUYEN_MAC_DINH(), uy_thac: UY_THAC_MAC_DINH() }
    if (baoGiaMo) d[baoGiaMo.loai] = { ...d[baoGiaMo.loai], ...baoGiaMo.du_lieu }
    return d
  })
  const [khach, setKhach] = useState(khachCo || (baoGiaMo?.khach ? { id: baoGiaMo.customer_id, ...baoGiaMo.khach } : null))
  const [idLuu, setIdLuu] = useState(baoGiaMo?.id || null)
  const [daLuu, setDaLuu] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)
  const st = data[tab]
  const up = (p) => { setDaLuu(false); setData((d) => ({ ...d, [tab]: { ...d[tab], ...p } })) }
  const [dang, setDang] = useState(false)
  const xuat = async () => { setDang(true); try { await xuatBaoGia({ loai: tab, st }) } finally { setDang(false) } }

  const chonKhach = (c) => { setKhach(c); setDaLuu(false); if (c) setData((d) => ({ ...d, [tab]: { ...d[tab], khach: c.ten_khach } })) }
  // Đổi tab khi đã lưu: lần lưu tiếp theo sẽ tạo báo giá mới cho dịch vụ khác
  const doiTab = (k) => { if (k !== tab) { setTab(k); setIdLuu(k === baoGiaMo?.loai ? baoGiaMo.id : null); setDaLuu(false) } }

  async function luu() {
    if (!khach) { alert('Chọn khách hàng để lưu báo giá vào hồ sơ khách.'); return }
    setDangLuu(true)
    const tong = tab === 'order' ? tinhOrder(st).ve : null
    const kq = tab === 'order' ? null : tinhXNK(st, tab)
    const row = {
      customer_id: khach.id, loai: tab, ten: (st.ma || '').trim() || `Báo giá ${TEN_DV[tab].toLowerCase()}`,
      du_lieu: st, tong_kg: tong ? tong.kg.tongVe : kq.kg.phaiTra, tong_m3: tong ? tong.m3.tongVe : kq.m3.phaiTra, updated_at: new Date().toISOString(),
    }
    const { data: r, error } = idLuu
      ? await supabase.from('bao_gia').update(row).eq('id', idLuu).select('id').single()
      : await supabase.from('bao_gia').insert({ ...row, created_by: currentProfile?.id }).select('id').single()
    setDangLuu(false)
    if (error) { alert('Không lưu được báo giá: ' + error.message); return }
    setIdLuu(r.id); setDaLuu(true); onSaved?.()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">{khachCo ? `Báo giá cho ${khachCo.ten_khach}` : 'Tính giá bán'}</h1>
          <p className="text-sm text-ink-600">Báo giá dịch vụ Mua bán, Vận chuyển, Uỷ thác. Ô nền cam là ô sale tự nhập</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {daLuu && <span className="text-sm font-medium text-emerald-600">✓ Đã lưu vào hồ sơ khách</span>}
          <Button variant="secondary" onClick={() => { setDaLuu(false); setIdLuu(null); setData((d) => ({ ...d, [tab]: MAC_DINH[tab]() })) }}><RotateCcw size={16} />Làm lại</Button>
          <Button variant="secondary" onClick={xuat} disabled={dang}><FileDown size={16} />{dang ? 'Đang xuất...' : 'Xuất Excel'}</Button>
          <Button onClick={luu} disabled={dangLuu}><Save size={16} />{dangLuu ? 'Đang lưu...' : idLuu ? 'Cập nhật báo giá' : 'Lưu báo giá'}</Button>
          {onClose && <Button variant="ghost" onClick={onClose}><X size={16} />Đóng</Button>}
        </div>
      </header>

      <div className="space-y-5 p-8">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-1.5 text-sm font-medium text-navy-900">Khách hàng của báo giá {!khach && <span className="font-normal text-rose-500">(chọn để lưu vào hồ sơ)</span>}</p>
          <ChonKhach khach={khach} onChon={khachCo ? null : chonKhach} />
        </div>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => doiTab(t.key)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'bg-navy-900 text-white shadow-sm' : 'bg-white text-ink-600 hover:bg-slate-100'}`}>
              {t.key === 'order' ? t.ten : `Dịch vụ ${t.ten}`}
            </button>
          ))}
        </div>

        <ThongTinChung st={st} up={up} />
        {tab === 'order' && <OrderFlow st={st} up={up} />}
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
        {tab !== 'order' && <BangThue st={st} up={up} />}
        {tab !== 'order' && <BangXNK st={st} up={up} loai={tab} />}
        {duoi}
      </div>
    </div>
  )
}

// Trang Tính giá bán: bảng tính ở trên, danh sách báo giá đã lưu ngay bên dưới
export default function BaoGiaPage({ currentProfile }) {
  const [mo, setMo] = useState(null)         // báo giá đang mở lại
  const [khoa, setKhoa] = useState(0)        // đổi để dựng lại editor
  const [lamMoi, setLamMoi] = useState(0)
  const duoi = (
    <div id="bao-gia-da-luu" className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-3 font-display font-semibold text-navy-900">Báo giá đã lưu</p>
      <DanhSachBaoGia currentProfile={currentProfile} lamMoi={lamMoi}
        onMo={(b) => { setMo(b); setKhoa((n) => n + 1) }} />
    </div>
  )
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <BaoGiaEditor key={khoa} baoGiaMo={mo} currentProfile={currentProfile} onSaved={() => setLamMoi((n) => n + 1)} duoi={duoi} />
    </div>
  )
}
