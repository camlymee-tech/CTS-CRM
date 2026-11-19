// Xuất báo giá dịch vụ CTS ra PDF: mở hộp thoại in của trình duyệt → chọn "Lưu dưới dạng PDF"
import { so, tinhXNK, tinhOrder, khungXNK, TEN_DV } from './baoGia'
import logoUrl from '../assets/cts-logo.png'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const so2 = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? Math.round(v).toLocaleString('vi-VN') : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })) : v)
const tien = (v) => (typeof v === 'number' ? Math.round(v).toLocaleString('vi-VN') : '')
const pt = (v) => (so(v) ? `${so(v).toFixed(2).replace('.', ',')}%` : '')
const te = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

const CSS = `
@page { size: A4; margin: 14mm 12mm 16mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Be Vietnam Pro", "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 10.5px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 3px solid #0a2463; }
.top img { height: 46px; }
.top .ct { text-align: right; color: #64748b; font-size: 9.5px; line-height: 1.5; }
.tt { text-align: center; margin: 16px 0 12px; }
.tt h1 { margin: 0; font-size: 20px; letter-spacing: .5px; color: #0a2463; }
.tt p { margin: 4px 0 0; color: #64748b; font-size: 10.5px; }
.info { display: flex; gap: 10px; margin-bottom: 14px; }
.info div { flex: 1; background: #f1f5f9; border-left: 3px solid #f97316; border-radius: 4px; padding: 7px 10px; }
.info small { display: block; color: #64748b; font-size: 8.5px; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 2px; }
.info b { font-size: 11.5px; color: #0a2463; }
h2 { font-size: 12.5px; color: #0a2463; margin: 16px 0 6px; }
table { width: 100%; border-collapse: collapse; }
th { background: #0a2463; color: #fff; font-weight: 700; padding: 7px 6px; border: 1px solid #0a2463; font-size: 10px; }
td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: middle; }
tr { page-break-inside: avoid; }
.c { text-align: center; } .r { text-align: right; font-variant-numeric: tabular-nums; }
.dam td { font-weight: 700; }
.nhom td { background: #eef2f8; font-weight: 700; color: #0a2463; }
.sub1 td:nth-child(2) { padding-left: 18px; }
.sub2 td:nth-child(2) { padding-left: 32px; color: #475569; }
.tong td { background: #f1f5f9; font-weight: 700; }
.nhan td { background: #fef3c7; color: #78350f; font-weight: 800; font-size: 11.5px; }
.lon td { background: #0a2463; color: #fff; font-weight: 800; font-size: 12.5px; border-color: #0a2463; }
.ft { margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 9px; text-align: center; }
`

function bangChinh(st, dv, order) {
  const kq = tinhXNK(st, dv, order)
  const cao = kq.kg.cuoc > kq.m3.cuoc ? 'kg' : kq.m3.cuoc > kq.kg.cuoc ? 'm3' : null
  const gt = (x) => (x && typeof x === 'object' ? (x.fix ?? so(st[x.k])) : x)
  const heads = cao
    ? ['STT', 'Nội dung', 'ĐVT', 'Số lượng', 'Đơn giá', `Thành tiền (theo ${cao === 'kg' ? 'KG' : 'M3'})`]
    : ['STT', 'Nội dung', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền theo KG', 'Thành tiền theo M3']
  const W = cao ? [6, 40, 7, 11, 15, 21] : [6, 32, 6, 10, 13, 16, 17]
  let h = `<table><colgroup>${W.map((w) => `<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${heads.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>`
  khungXNK(st, kq, dv, order).forEach((row) => {
    if (cao && row.nd.startsWith('Cước vận chuyển')) { if (row.t[cao] == null) return; row = { ...row, stt: 'I' } }
    const cls = row.loai === 'tong' ? (row.lon ? 'lon' : row.cong ? '' : 'tong') : row.loai === 'nhom' ? (row.nhan ? 'nhan' : 'nhom') : [row.dam ? 'dam' : '', row.sub ? 'sub' + row.sub : ''].join(' ')
    const slv = row.sl === undefined ? '' : gt(row.sl)
    const dgv = row.dg === undefined ? '' : gt(row.dg)
    const tc = (v) => `<td class="r">${typeof v === 'number' ? (v === 0 && (row.loai === 'dong' || row.loai === 'nhom') ? '–' : tien(v)) : ''}</td>`
    h += `<tr class="${cls}"><td class="c">${esc(row.stt)}</td><td>${esc(row.nd)}${row.pct ? ` (${esc(pt(st[row.pct.k]))})` : ''}</td><td class="c">${esc(row.dvt || '')}</td><td class="r">${typeof slv === 'number' ? so2(slv) : ''}</td><td class="r">${typeof dgv === 'number' ? (dgv === 0 ? '–' : so2(dgv)) : ''}</td>`
    h += cao ? tc(row.t[cao]) : tc(row.t.kg) + tc(row.t.m3)
    h += '</tr>'
  })
  return h + '</tbody></table>'
}

function bangOrder(st, phan) {
  const kq = tinhOrder(st)
  const tb = (heads, rows) => `<table><thead><tr>${heads.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.c || ''}">${r.v.map((v, i) => `<td class="${i === 0 ? 'c' : i >= 2 ? 'r' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const sp = st.sp.map((p, i) => ({ v: [i + 1, p.ten || `Sản phẩm ${i + 1}`, so2(so(p.sl)), te(so(p.dg)), te(kq.tri[i])] }))
  if (phan === 'truoc') return `<h2>1. Danh sách sản phẩm</h2>${tb(['STT', 'Sản phẩm', 'Số lượng', 'Giá web (¥)', 'Giá trị (¥)'], sp)}
  <h2>2. Giá xưởng</h2>${tb(['STT', 'Nội dung', 'Số tiền (¥)', 'Quy đổi VND'], [
    { v: [1, 'Giá trị đơn hàng', te(kq.gt1.te), tien(kq.gt1.vnd)] },
    { v: [2, 'Tổng tiền ship nội địa', te(kq.ship.te), tien(kq.ship.vnd)] },
    { c: 'lon', v: [3, 'TỔNG THANH TOÁN CHO XƯỞNG', te(kq.gt3.te), tien(kq.gt3.vnd)] },
  ])}`
  return `<h2>4. Giá về tay</h2>${tb(['STT', 'Nội dung', 'Thành tiền'], [
    { v: [1, 'Tổng số lượng sản phẩm', so2(kq.tongSl)] },
    { v: [2, 'Tổng thanh toán cho xưởng', tien(kq.tong.vnd)] },
    { v: [3, `Phí dịch vụ mua hàng (${pt(st.phiDVPct)})`, tien(kq.phi.vnd)] },
    { v: [4, `Chi phí vận chuyển + thuế (theo ${kq.cao === 'kg' ? 'KG' : 'M3'}) và VAT dịch vụ ${pt(st.vatDV)} trên phí mua hàng + ship nội địa`, tien(kq.ve.vcGop)] },
    { c: 'tong', v: [5, 'TỔNG TIỀN HÀNG VỀ TAY', tien(kq.ve.tongVe)] },
    { c: 'nhan', v: [6, `TIỀN TẠM ỨNG (${pt(st.tamUngPct)} × tiền hàng + ship nội địa)`, tien(kq.ve.tamUng)] },
    { c: 'nhan', v: [7, 'TIỀN THANH TOÁN CÒN LẠI SAU KHI HÀNG VỀ', tien(kq.ve.conLai)] },
    { c: 'lon', v: [8, 'GIÁ VỀ TAY 1 SẢN PHẨM', tien(kq.ve.motSp)] },
  ])}`
}

export async function xuatBaoGiaPdf({ loai, st }) {
  const order = loai === 'order'
  const dv = order ? (st.dichVu || 'van_chuyen') : loai
  const tieu = order ? 'BÁO GIÁ ORDER' : `BÁO GIÁ DỊCH VỤ ${TEN_DV[loai]}`
  const logo = new URL(logoUrl, window.location.href).href
  const body = `
  <div class="top"><img src="${logo}" alt="CTS GROUP"><div class="ct"><b style="color:#0a2463">CTS GROUP</b><br>Dịch vụ logistics &amp; xuất nhập khẩu</div></div>
  <div class="tt"><h1>${esc(tieu)}</h1><p>Mã báo giá: ${esc(st.ma || '..........')}</p></div>
  <div class="info"><div><small>Khách hàng</small><b>${esc(st.khach || '..........')}</b></div><div><small>Ngày báo giá</small><b>${new Date().toLocaleDateString('vi-VN')}</b></div>${order ? `<div><small>Tỷ giá tệ</small><b>${so2(so(st.tyGiaTe))}</b></div>` : `<div><small>Tuyến</small><b>${esc(st.tuyen || 'BT-HN')}</b></div>`}</div>
  ${order ? bangOrder(st, 'truoc') + `<h2>3. Báo giá vận chuyển - ${esc(TEN_DV[dv] || '')}</h2>` : ''}
  ${bangChinh(st, dv, order)}
  ${order ? bangOrder(st, 'sau') : ''}
  <div class="ft">Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ của CTS GROUP</div>`
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(tieu)}${st.khach ? ' - ' + esc(st.khach) : ''}</title><style>${CSS}</style></head><body>${body}</body></html>`

  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(f)
  const w = f.contentWindow
  w.document.open(); w.document.write(html); w.document.close()
  await new Promise((ok) => { const img = w.document.images[0]; if (!img || img.complete) ok(); else { img.onload = ok; img.onerror = ok } })
  await new Promise((ok) => setTimeout(ok, 150))
  w.focus(); w.print()
  setTimeout(() => f.remove(), 60000)
}
