import { useEffect, useMemo, useState } from 'react'
import { FileDown, Plus, Trash2, RotateCcw, Save, X, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button } from './ui'
import {
  so, tinhThue, tinhXNK, tinhOrder, TEN_DV, khungXNK, ORDER_MAC_DINH, SP_ORDER,
  MUA_BAN_MAC_DINH, VAN_CHUYEN_MAC_DINH, UY_THAC_MAC_DINH, SP_THUE,
} from '../lib/baoGia'
import { xuatBaoGia } from '../lib/baoGiaXlsx'
import { xuatBaoGiaPdf } from '../lib/baoGiaPdf'

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
  // Cột có tiền cước cao hơn (KG hay M3) là cột chi phí được tính theo
  const cao = kq.kg.cuoc > kq.m3.cuoc ? 'kg' : kq.m3.cuoc > kq.kg.cuoc ? 'm3' : null
  const KHUNG = phang ? 'overflow-x-auto rounded-xl border border-slate-200 p-4' : 'overflow-x-auto rounded-2xl bg-white p-4 shadow-sm'
  const nhapO = (x) => <O v={st[x.k]} set={(v) => up({ [x.k]: v })} tp={!!x.tp} />
  const hienO = (x) => (x && typeof x === 'object' ? (x.fix !== undefined ? <span className="block px-1.5 py-1 text-right">{x.money ? vnd(x.fix) : x.fix ? String(x.fix).replace('.', ',') : ''}</span> : nhapO(x)) : x === undefined || x === null ? '' : vnd(x))

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
            {['STT', 'Nội dung', 'ĐVT', 'Số lượng', 'Đơn giá'].map((h) => <th key={h} className={TH}>{h}</th>)}
            {[['kg', 'Thành tiền theo KG'], ['m3', 'Thành tiền theo M3']].map(([k, h]) => (
              <th key={k} className={TH}>{h}{cao === k && <span className="mx-auto mt-1 block w-fit rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">✓ Tính theo cột này</span>}</th>
            ))}
          </tr></thead>
          <tbody>
            {khung.map((r, i) => {
              const nen = r.loai === 'tong' ? (r.lon ? 'bg-navy-900 text-white' : r.cong ? 'bg-white' : 'bg-slate-50') : r.loai === 'nhom' ? (r.nhan ? 'bg-amber-100 text-amber-900' : 'bg-slate-100') : ''
              const dam = r.nhan ? 'font-extrabold text-[15px]' : r.loai !== 'dong' || r.dam ? 'font-semibold' : ''
              return (
                <tr key={i} className={`${nen} ${dam}`}>
                  <td className={`${TD} w-14 text-center`}>{r.stt}</td>
                  <td className={`${TD} ${r.sub === 2 ? 'pl-12' : r.sub ? 'pl-6' : ''}`}>
                    {r.nd}
                    {r.pct && <span className="ml-2 inline-block w-20 align-middle"><O v={st[r.pct.k]} set={(v) => up({ [r.pct.k]: v })} tp /></span>}
                    {r.pct && ' %'}
                  </td>
                  <td className={`${TD} w-16 text-center`}>{r.dvt}</td>
                  <td className={`${TD} w-32 text-right`}>{r.loai === 'dong' ? hienO(r.sl) : ''}</td>
                  <td className={`${TD} w-36 text-right`}>{r.loai === 'dong' ? hienO(r.dg) : ''}</td>
                  <td className={`${TD} w-44 text-right ${r.lon ? 'text-base font-bold text-white' : ''}`}>{vnd(r.t.kg)}</td>
                  <td className={`${TD} w-44 text-right ${r.lon ? 'text-base font-bold text-white' : ''}`}>{vnd(r.t.m3)}</td>
                </tr>
              )
            })}
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
    up({ sp })
  }
  const heads1 = ['STT', 'Sản phẩm', 'Link SP', 'Số lượng', 'Giá web (¥)', 'Giá trị đơn hàng (¥)', '']

  return (
    <div className="space-y-5">
      {/* BƯỚC 1 */}
      <Buoc n={1} id="order-b1" ten="Giá xưởng" mota="Nhập sản phẩm khách muốn order: số lượng và giá web (tệ). Ship nội địa Trung Quốc nhập một lần ở dòng tổng bên dưới.">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {[['tyGiaTe', 'Tỷ giá tệ (VND)', false], ['phiDVPct', 'Tỷ lệ phí dịch vụ mua hàng (%)', true], ['tamUngPct', 'Tiền tạm ứng (%)', true]].map(([k, nhan, tp]) => (
            <label key={k} className="flex w-52 flex-col gap-1 text-sm"><span className="font-medium text-navy-900">{nhan}</span>
              <O v={st[k]} set={(v) => up({ [k]: v })} tp={tp} /></label>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead><tr>{heads1.map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {st.sp.map((p, i) => (
                <tr key={i}>
                  <td className={`${TD} text-center`}>{i + 1}</td>
                  <td className={`${TD} min-w-[170px]`}><Chu v={p.ten} set={(v) => setSp(i, { ten: v })} ph={`Sản phẩm ${i + 1}`} /></td>
                  <td className={`${TD} min-w-[140px]`}><Chu v={p.link} set={(v) => setSp(i, { link: v })} ph="Dán link" /></td>
                  <td className={`${TD} w-24`}><O v={p.sl} set={(v) => setSp(i, { sl: v })} /></td>
                  <td className={`${TD} w-28`}><O v={p.dg} set={(v) => setSp(i, { dg: v })} tp /></td>
                  <td className={`${TD} bg-amber-50 text-right font-semibold`}>{te2(kq.tri[i])}</td>
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
                ['3', 'TỔNG THANH TOÁN CHO XƯỞNG (hàng + ship nội địa TQ)', kq.gt3, 'bg-orange-100 font-bold'],
              ].map(([stt, nd, v, cls = '']) => (
                <tr key={stt} className={cls}>
                  <td className={`${TD} w-14 text-center`}>{stt}</td><td className={TD}>{nd}</td>
                  {stt === '2'
                    ? <td className={`${TD} w-48`}><O v={st.shipTong} set={(x) => up({ shipTong: x })} tp /></td>
                    : <td className={`${TD} text-right`}>¥ {te2(v.te)}</td>}
                  <td className={`${TD} text-right`}>{vnd(v.vnd)}</td>
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
              onClick={() => up({ dichVu: d.k })}
              className={`rounded-xl border-2 p-3 text-left transition ${st.dichVu === d.k ? 'border-coral-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className="font-semibold text-navy-900">{d.ten}</p>
              <p className="text-xs text-ink-600">{d.mota}</p>
            </button>
          ))}
        </div>
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-600">
          Nhập số <b className="text-navy-900">KG</b> và <b className="text-navy-900">M3</b> cùng đơn giá ở hai dòng cước vận chuyển bên dưới.
        </p>
        <BangXNK st={st} up={up} loai={st.dichVu} order phang tieuDe={`Báo giá ${st.dichVu === 'uy_thac' ? 'dịch vụ uỷ thác xuất nhập khẩu' : st.dichVu === 'mua_ban' ? 'dịch vụ mua bán' : 'vận chuyển'}`} />
      </Buoc>

      {/* BƯỚC 4 */}
      <Buoc n={4} id="order-b4" ten="Giá về tay" mota="Tổng tiền hàng ở bước 1 cộng chi phí vận chuyển và thuế ở bước 3, chia cho số lượng sản phẩm.">
        <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-600">Vận chuyển tính theo {kq.cao === 'kg' ? 'KG' : 'M3'}</p>
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">Cước cao hơn</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-navy-900">{vnd(kq.ve.motSp)} <span className="text-base font-medium text-ink-600">đ / sản phẩm</span></p>
          <p className="mt-1 text-sm text-ink-600">Tổng tiền hàng về tay: <b className="text-navy-900">{vnd(kq.ve.tongVe)}</b></p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['STT', 'Nội dung', 'Thành tiền'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ['1', 'Tổng số lượng sản phẩm', kq.tongSl, ''],
                ['2', 'Tổng thanh toán cho xưởng (tiền hàng + ship nội địa, bước 1)', kq.tong.vnd, ''],
                ['3', `Phí dịch vụ mua hàng (${pt2(so(st.phiDVPct))})`, kq.phi.vnd, ''],
                ['4', `Chi phí vận chuyển + thuế (bước 2, 3, theo ${kq.cao === 'kg' ? 'KG' : 'M3'}) và VAT dịch vụ ${pt2(so(st.vatDV))} trên phí mua hàng + ship nội địa`, kq.ve.vcGop, ''],
                ['5', 'TỔNG TIỀN HÀNG VỀ TAY', kq.ve.tongVe, 'bg-slate-200 font-extrabold text-navy-900 text-base'],
                ['6', `TIỀN TẠM ỨNG (${pt2(so(st.tamUngPct))} × tiền hàng + ship nội địa)`, kq.ve.tamUng, 'bg-amber-100 font-extrabold text-amber-900 text-base'],
                ['7', 'TIỀN THANH TOÁN CÒN LẠI SAU KHI HÀNG VỀ', kq.ve.conLai, 'bg-amber-100 font-extrabold text-amber-900 text-base'],
                ['8', 'GIÁ VỀ TAY 1 SẢN PHẨM', kq.ve.motSp, 'bg-orange-100 font-bold text-base'],
              ].map(([stt, nd, v, cls]) => (
                <tr key={stt} className={cls}><td className={`${TD} w-14 text-center`}>{stt}</td><td className={TD}>{nd}</td><td className={`${TD} text-right`}>{vnd(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {st.sp.length > 1 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['Sản phẩm', 'SL', 'Giá về tay 1 SP'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {st.sp.map((x, i) => (
                  <tr key={i}>
                    <td className={TD}>{x.ten || `Sản phẩm ${i + 1}`}</td>
                    <td className={`${TD} text-right`}>{vnd(so(x.sl))}</td>
                    <td className={`${TD} text-right font-semibold`}>{vnd(kq.ve.dong[i]?.mot)}</td>
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
    const tong = tab === 'order' ? tinhOrder(st).ve : null   // order: chỉ 1 cột (cước cao hơn)
    const kq = tab === 'order' ? null : tinhXNK(st, tab)
    const row = {
      customer_id: khach.id, loai: tab, ten: (st.ma || '').trim() || `Báo giá ${TEN_DV[tab].toLowerCase()}`,
      du_lieu: st, tong_kg: tong ? tong.tongVe : kq.kg.phaiTra, tong_m3: tong ? tong.tongVe : kq.m3.phaiTra, updated_at: new Date().toISOString(),
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
          <Button variant="secondary" onClick={() => xuatBaoGiaPdf({ loai: tab, st })}><FileDown size={16} />Xuất PDF</Button>
          {khachCo && <Button onClick={luu} disabled={dangLuu}><Save size={16} />{dangLuu ? 'Đang lưu...' : idLuu ? 'Cập nhật báo giá' : 'Lưu báo giá'}</Button>}
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
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <BaoGiaEditor key={khoa} baoGiaMo={mo} currentProfile={currentProfile} onSaved={() => setLamMoi((n) => n + 1)} />
    </div>
  )
}
