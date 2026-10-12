import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, ClipboardPaste, CircleCheck, TriangleAlert } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select } from './ui'

// Nhận diện cột theo tên tiêu đề, không phụ thuộc thứ tự
const NHAN = {
  uudai: ['ưu đãi', 'uu dai', 'người bán mới', 'nguoi ban moi'],
  cap1: ['ngành hàng cấp 1', 'nganh hang cap 1', 'cấp 1', 'cap 1'],
  cap2: ['ngành hàng cấp 2', 'nganh hang cap 2', 'cấp 2', 'cap 2'],
  cap3: ['ngành hàng cấp 3', 'nganh hang cap 3', 'cấp 3', 'cap 3'],
  chuan: ['mức phí tiêu chuẩn', 'muc phi tieu chuan', 'phí cố định', 'phi co dinh', 'mức phí', 'phí'],
}

const chuanHoa = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim().toLowerCase()

// Đọc dữ liệu dán từ Excel: ô tiêu đề có xuống dòng bên trong được Excel bọc trong dấu ngoặc kép
function tachBang(text) {
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"' && cell === '') q = true
    else if (ch === '\t') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  row.push(cell); rows.push(row)
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

function doanCot(headers) {
  const map = {}
  headers.forEach((h, i) => {
    const t = chuanHoa(h)
    if (!t) return
    for (const [khoa, tuKhoa] of Object.entries(NHAN)) {
      if (map[khoa] !== undefined) continue
      if (tuKhoa.some((k) => t.includes(chuanHoa(k)))) { map[khoa] = i; return }
    }
  })
  return map
}

// "11,50%" / "11.5%" / 0.115 -> 11.5
function doPhanTram(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v > 0 && v < 1 ? +(v * 100).toFixed(2) : +v.toFixed(2)
  const s = String(v).replace('%', '').replace(/\s/g, '').replace(',', '.')
  const n = Number(s)
  if (Number.isNaN(n)) return null
  return n > 0 && n < 1 ? +(n * 100).toFixed(2) : +n.toFixed(2)
}

export default function FeesImportModal({ onXong }) {
  const [rows, setRows] = useState([])
  const [loi, setLoi] = useState('')
  const [canhBao, setCanhBao] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const [tienDo, setTienDo] = useState(0)
  const [xong, setXong] = useState(null)
  const [cachThem, setCachThem] = useState('thay_the')
  const [ngayApDung, setNgayApDung] = useState('')
  const [dan, setDan] = useState('')
  const inputRef = useRef(null)

  function xuLyBang(bang) {
    setLoi(''); setCanhBao(''); setXong(null)
    if (!bang.length) { setLoi('File không có dữ liệu.'); return }

    // Tìm dòng tiêu đề trong 15 dòng đầu
    let iHeader = -1, cot = null
    for (let i = 0; i < Math.min(bang.length, 60); i++) {
      const m = doanCot(bang[i])
      if (m.cap1 !== undefined && m.chuan !== undefined) { iHeader = i; cot = m; break }
    }
    if (iHeader === -1) {
      setLoi('Không tìm thấy dòng tiêu đề. File cần có cột "Ngành hàng cấp 1" và cột phí (VD "Mức phí tiêu chuẩn" hoặc "Phí cố định..."). Nếu chị copy từ file PDF thì không dán được, chị dùng file Excel và bấm "Chọn file bảng phí" nhé.')
      return
    }

    const ds = []
    let boQua = 0
    for (let i = iHeader + 1; i < bang.length; i++) {
      const d = bang[i]
      const c1 = String(d[cot.cap1] ?? '').trim()
      const phi = doPhanTram(d[cot.chuan])
      if (!c1 || phi === null) { boQua++; continue }

      const c2 = cot.cap2 !== undefined ? String(d[cot.cap2] ?? '').trim() : ''
      const c3 = cot.cap3 !== undefined ? String(d[cot.cap3] ?? '').trim() : ''
      const ten = [c2, c3].filter(Boolean).join(' — ') || 'Tất cả'
      const ud = cot.uudai !== undefined ? doPhanTram(d[cot.uudai]) : null

      ds.push({ nganh_1: c1, nganh_2: ten, phi_phan_tram: phi, phi_nguoi_ban_moi: ud })
    }

    // Bỏ trùng, giữ dòng cuối
    const gom = new Map()
    for (const r of ds) gom.set(`${r.nganh_1}|||${r.nganh_2}`, r)
    const ketQua = [...gom.values()]

    if (!ketQua.length) { setLoi('Đọc được file nhưng không có dòng dữ liệu hợp lệ nào.'); return }
    if (boQua > 0) setCanhBao(`Bỏ qua ${boQua} dòng không có tên ngành hàng hoặc mức phí (thường là dòng tiêu đề lặp lại giữa các trang).`)
    setRows(ketQua)
  }

  async function chonFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setLoi(''); setRows([]); setXong(null)
    try {
      const buf = await f.arrayBuffer()
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const bang = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
      xuLyBang(bang)
    } catch (err) {
      setLoi('Không đọc được file: ' + err.message)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  function xuLyDan() {
    if (!dan.trim()) return
    const bang = tachBang(dan.trim())
    xuLyBang(bang)
  }

  async function nhapVao() {
    setDangChay(true); setLoi(''); setTienDo(0)

    if (cachThem === 'thay_the') {
      const { error } = await supabase.from('shopee_fees').delete().neq('nganh_1', '___khong_bao_gio___')
      if (error) { setDangChay(false); setLoi('Không xoá được bảng cũ: ' + error.message); return }
    }

    const duLieu = rows.map((r) => ({ ...r, ap_dung_tu: ngayApDung.trim() || null, active: true }))
    const LO = 400
    let daXong = 0

    for (let i = 0; i < duLieu.length; i += LO) {
      const lo = duLieu.slice(i, i + LO)
      const { error } = await supabase.from('shopee_fees')
        .upsert(lo, { onConflict: 'nganh_1,nganh_2' })
      if (error) {
        setDangChay(false)
        setLoi(`Lỗi khi lưu (đã lưu ${daXong}/${duLieu.length} dòng): ${error.message}`)
        return
      }
      daXong += lo.length
      setTienDo(Math.round((daXong / duLieu.length) * 100))
    }

    setDangChay(false)
    setXong(daXong)
  }

  const nhomCap1 = [...new Set(rows.map((r) => r.nganh_1))]

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        File cần có các cột <b>Ngành hàng cấp 1</b>, <b>Ngành hàng cấp 2</b>, <b>Ngành hàng cấp 3</b>,
        {' '}<b>Mức phí tiêu chuẩn</b> và (nếu có) <b>Mức phí ưu đãi cho Người bán mới</b>.
        App tự tìm đúng cột theo tên tiêu đề nên thứ tự cột thế nào cũng được.
        Nhận file Excel (.xlsx, .xls) và CSV.
      </div>

      {!rows.length && (
        <>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={chonFile} />
          <Button type="button" onClick={() => inputRef.current?.click()} className="w-full">
            <Upload size={16} /> Chọn file bảng phí
          </Button>

          <div className="flex items-center gap-3 text-xs text-ink-400">
            <div className="h-px flex-1 bg-slate-200" /> hoặc dán dữ liệu <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div>
            <textarea rows={4} value={dan} onChange={(e) => setDan(e.target.value)}
              placeholder="Mở file Excel, bôi đen toàn bộ bảng, copy rồi dán vào đây..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
            <Button type="button" variant="secondary" onClick={xuLyDan} className="mt-2 w-full">
              <ClipboardPaste size={15} /> Đọc dữ liệu vừa dán
            </Button>
          </div>
        </>
      )}

      {loi && (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-600">
          <TriangleAlert size={15} className="mt-0.5 flex-none" /> {loi}
        </p>
      )}

      {rows.length > 0 && !xong && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <FileSpreadsheet size={16} />
              <p className="font-display font-semibold">Đọc được {rows.length} ngành hàng</p>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Thuộc {nhomCap1.length} nhóm ngành cấp 1: {nhomCap1.slice(0, 6).join(', ')}
              {nhomCap1.length > 6 && `, và ${nhomCap1.length - 6} nhóm khác`}
            </p>
          </div>

          {canhBao && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{canhBao}</p>
          )}

          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-ink-400">
                  <th className="px-3 py-2">Ngành cấp 1</th>
                  <th className="px-3 py-2">Ngành hàng</th>
                  <th className="px-3 py-2 text-right">Tiêu chuẩn</th>
                  <th className="px-3 py-2 text-right">Người bán mới</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((r, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="px-3 py-1.5 text-ink-600">{r.nganh_1}</td>
                    <td className="px-3 py-1.5 text-navy-900">{r.nganh_2}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-coral-500">{r.phi_phan_tram}%</td>
                    <td className="px-3 py-1.5 text-right text-emerald-600">
                      {r.phi_nguoi_ban_moi != null ? r.phi_nguoi_ban_moi + '%' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 60 && (
              <p className="border-t border-slate-100 px-3 py-2 text-center text-xs text-ink-400">
                Xem trước 60 dòng đầu, sẽ nhập đủ {rows.length} dòng
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Cách nhập" value={cachThem} onChange={(e) => setCachThem(e.target.value)}>
              <option value="thay_the">Thay thế toàn bộ bảng phí cũ</option>
              <option value="gop">Giữ bảng cũ, chỉ thêm/cập nhật</option>
            </Select>
            <Input label="Áp dụng từ" value={ngayApDung}
              onChange={(e) => setNgayApDung(e.target.value)} placeholder="VD: 23/05/2026" />
          </div>

          {dangChay && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-coral-500 transition-all" style={{ width: `${tienDo}%` }} />
              </div>
              <p className="mt-1 text-center text-xs text-ink-600">Đang lưu... {tienDo}%</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={dangChay}
              onClick={() => { setRows([]); setDan(''); setCanhBao('') }}>
              Chọn file khác
            </Button>
            <Button type="button" onClick={nhapVao} disabled={dangChay}>
              {dangChay ? 'Đang nhập...' : `Nhập ${rows.length} ngành hàng`}
            </Button>
          </div>
        </>
      )}

      {xong && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CircleCheck size={36} className="mx-auto text-emerald-500" />
          <p className="mt-2 font-display font-semibold text-navy-900">
            Đã nhập xong {xong} ngành hàng
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            Bảng tính giá đã dùng biểu phí mới ngay lập tức.
          </p>
          <Button type="button" onClick={onXong} className="mt-3">Xong</Button>
        </div>
      )}
    </div>
  )
}
