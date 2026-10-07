import { useEffect, useRef, useState } from 'react'
import { Printer, FileDown, Pencil, RotateCcw } from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { Modal, Button } from './ui'

// Sau khi Vercel deploy bản mới, tab trình duyệt đang mở vẫn nhớ đường dẫn file JS
// của bản cũ — file đó không còn trên server nữa nên import động bị lỗi. Nhận diện
// đúng lỗi này để báo rõ + cho bấm tải lại trang, thay vì hiện lỗi kỹ thuật khó hiểu.
function laLoiBanCu(e) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
    .test(e?.message || '')
}

// ---- Chia trang A4 (dùng chung cho vạch hiển thị trong xem trước và cho file PDF) ----
const LE_MM = 12   // chừa lề trên (từ trang 2) và lề dưới mỗi trang
const A4_RONG = 210, A4_CAO = 297

// Trả về danh sách vị trí (px, tính từ đầu trang giấy) nơi sẽ ngắt sang trang mới.
// Chỗ ngắt luôn rơi vào khoảng trống giữa 2 đoạn/2 dòng bảng, không cắt đôi chữ.
function tinhViTriNgat(sec) {
  const f = sec.clientWidth / A4_RONG
  const goc = sec.getBoundingClientRect()
  const tong = goc.height
  const khoi = [...sec.querySelectorAll('p, tr')]
    .filter((el) => !el.closest('.dau-trang') && !(el.tagName === 'P' && el.closest('tr')))
    .map((el) => { const r = el.getBoundingClientRect(); return { top: r.top - goc.top, bottom: r.bottom - goc.top } })
  const cat = []
  let batDau = 0
  let cao = (A4_CAO - LE_MM) * f                 // trang 1 đã có lề trên sẵn trong file hợp đồng
  const caoSau = (A4_CAO - 2 * LE_MM) * f
  let an = 0
  while (batDau + cao < tong - 4 && an++ < 60) {
    const gioiHan = batDau + cao
    const dinh = khoi.find((k) => k.top < gioiHan - 1 && k.bottom > gioiHan + 1)
    const diem = dinh && dinh.top > batDau + cao * 0.3 ? dinh.top : gioiHan
    cat.push(diem)
    batDau = diem
    cao = caoSau
  }
  return cat
}

// Khi chụp ảnh, chữ có thể lệch vài px so với màn hình — nên từ vị trí ngắt dự kiến,
// tìm thêm dòng ảnh hoàn toàn trắng gần nhất (trong ±60px) để cắt cho sạch.
function timDongTrang(cv, y0) {
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const trang = (y) => {
    if (y < 1 || y >= cv.height) return false
    const d = ctx.getImageData(0, y, cv.width, 1).data
    for (let i = 0; i < d.length; i += 4) { if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) return false }
    return true
  }
  for (let k = 0; k <= 60; k++) {
    if (trang(y0 - k)) return y0 - k
    if (trang(y0 + k)) return y0 + k
  }
  return y0
}

// Xem trước hợp đồng Word ngay trong app: dựng lại đúng file .docx (dùng chung
// hàm taoFileHopDong với lúc xuất file) rồi render thành HTML trong khung cuộn.
// `hd` có cùng cấu trúc với tham số truyền cho taoFileHopDong().
export default function ContractPreview({ hd, onClose }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banCu, setBanCu] = useState(false)
  const [lanDung, setLanDung] = useState(0)      // bấm "Về bản gốc" thì dựng lại
  const [dangXuatPdf, setDangXuatPdf] = useState(false)
  const [soTrang, setSoTrang] = useState(0)
  const hen = useRef(null)

  useEffect(() => {
    let huy = false
    async function render() {
      setLoading(true); setError(''); setBanCu(false)
      try {
        const { taoFileHopDong } = await import('../lib/hopDong')
        const blob = await taoFileHopDong(hd)
        if (huy || !containerRef.current) return
        containerRef.current.innerHTML = ''
        await renderAsync(blob, containerRef.current, containerRef.current, {
          className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: true,
        })
        setTimeout(capNhatTrang, 150)
      } catch (e) {
        if (huy) return
        if (laLoiBanCu(e)) {
          setBanCu(true)
          setError('Trang đang mở là bản cũ (do vừa có cập nhật mới) — tải lại trang rồi mở xem trước lại nhé.')
        } else {
          setError('Không tạo được bản xem trước: ' + e.message)
        }
      } finally {
        if (!huy) setLoading(false)
      }
    }
    render()
    return () => { huy = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(hd), lanDung])

  // Vẽ vạch đứt "Hết trang N" ở những chỗ sẽ sang trang khi in / tải PDF
  function capNhatTrang() {
    const goc = containerRef.current
    if (!goc) return
    let tong = 0
    goc.querySelectorAll('.dau-trang').forEach((e) => e.remove())
    const ds = [...goc.querySelectorAll('section.docx')]
    for (const sec of ds.length ? ds : []) {
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative'
      const cat = tinhViTriNgat(sec)
      cat.forEach((y, i) => {
        const v = document.createElement('div')
        v.className = 'dau-trang'
        v.contentEditable = 'false'
        v.style.cssText = `position:absolute;left:0;right:0;top:${y}px;border-top:2px dashed #f97316;pointer-events:none;z-index:5;`
        const nhan = document.createElement('span')
        nhan.textContent = `Hết trang ${tong + i + 1}  ·  Trang ${tong + i + 2}`
        nhan.style.cssText = 'position:absolute;left:8px;top:-11px;background:#fff7ed;color:#c2410c;font:600 11px sans-serif;padding:1px 8px;border-radius:9px;border:1px solid #fdba74;'
        v.appendChild(nhan)
        sec.appendChild(v)
      })
      tong += cat.length + 1
    }
    setSoTrang(tong)
  }
  function hoanCapNhat() {
    clearTimeout(hen.current)
    hen.current = setTimeout(capNhatTrang, 300)
  }
  useEffect(() => {
    window.addEventListener('resize', hoanCapNhat)
    return () => { window.removeEventListener('resize', hoanCapNhat); clearTimeout(hen.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tải PDF: chụp từng trang đang hiển thị (kể cả chỗ chị vừa sửa) rồi ghép thành file A4.
  // Cắt trang ở dòng trắng gần nhất để không bị cắt đôi chữ.
  async function taiPdf() {
    if (!containerRef.current) return
    setDangXuatPdf(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const trang = [...containerRef.current.querySelectorAll('section.docx')]
      const ds = trang.length ? trang : [containerRef.current]
      let dauTien = true
      for (const el of ds) {
        const cat = tinhViTriNgat(el)
        const cv = await html2canvas(el, {
          scale: 2, backgroundColor: '#ffffff', useCORS: true,
          ignoreElements: (e) => e.classList?.contains('dau-trang'),
        })
        const heSo = cv.width / el.clientWidth          // px màn hình -> px ảnh
        const mmMotPx = A4_RONG / cv.width               // px ảnh -> mm trên giấy
        const moc = [0, ...cat.map((y) => timDongTrang(cv, Math.round(y * heSo))), cv.height]
        for (let i = 0; i < moc.length - 1; i++) {
          const y = moc[i], h = moc[i + 1] - moc[i]
          if (h < 3) continue
          const phan = document.createElement('canvas')
          phan.width = cv.width; phan.height = h
          const pctx = phan.getContext('2d')
          pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, phan.width, phan.height)
          pctx.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h)
          if (!dauTien) pdf.addPage()
          pdf.addImage(phan.toDataURL('image/jpeg', 0.95), 'JPEG', 0, i === 0 ? 0 : LE_MM, A4_RONG, h * mmMotPx)
          dauTien = false
        }
      }
      const url = URL.createObjectURL(pdf.output('blob'))
      const link = document.createElement('a')
      link.href = url
      link.download = `HopDong_${String(hd?.so_hop_dong || 'hop-dong').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_.-]+/g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      setError('Không tạo được file PDF: ' + e.message)
    } finally {
      setDangXuatPdf(false)
    }
  }

  function inHopDong() {
    if (!containerRef.current) return
    const cuaSo = window.open('', '_blank')
    if (!cuaSo) return
    cuaSo.document.write(`<html><head><title>In hợp đồng</title></head><body>${containerRef.current.innerHTML}</body></html>`)
    cuaSo.document.close()
    cuaSo.focus()
    setTimeout(() => cuaSo.print(), 300)
  }

  return (
    <Modal title="Xem trước hợp đồng" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
          <Pencil size={14} /> Bấm vào chữ trong hợp đồng để sửa trực tiếp
        </p>
        {soTrang > 0 && (
          <p className="rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700">
            Khi in / tải PDF: {soTrang} trang A4
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setLanDung((n) => n + 1)} disabled={loading}>
            <RotateCcw size={15} /> Về bản gốc
          </Button>
          <Button type="button" variant="secondary" onClick={inHopDong} disabled={loading || !!error}>
            <Printer size={15} /> In hợp đồng
          </Button>
          <Button type="button" onClick={taiPdf} disabled={loading || !!error || dangXuatPdf}>
            <FileDown size={15} /> {dangXuatPdf ? 'Đang tạo PDF...' : 'Tải PDF'}
          </Button>
        </div>
      </div>
      <p className="mb-2 text-xs text-ink-400">
        Phần chị sửa ở đây chỉ áp dụng cho bản in / file PDF này, không lưu vào hệ thống và không đổi file Word. Vạch cam đứt nét là chỗ sang trang mới.
      </p>
      {loading && <p className="mb-2 text-sm text-ink-400">Đang dựng bản xem trước...</p>}
      {error && (
        <div className="mb-2">
          <p className="text-sm text-rose-600">{error}</p>
          {banCu && (
            <Button type="button" onClick={() => window.location.reload()} className="mt-2">
              Tải lại trang
            </Button>
          )}
        </div>
      )}
      <style>{`.docx table td, .docx table th { padding-top: 4px !important; padding-bottom: 4px !important; vertical-align: middle; }
        .docx table p { line-height: 1.4 !important; margin: 0 !important; }`}</style>
      <div className="max-h-[75vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div ref={containerRef} onInput={hoanCapNhat} contentEditable={!loading && !error} suppressContentEditableWarning
          spellCheck={false} className="outline-none" />
      </div>
    </Modal>
  )
}
