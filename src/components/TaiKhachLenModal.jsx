import { useMemo, useRef, useState } from 'react'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Modal, Button } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { TINH_THANH } from '../lib/constants'
import { maChuaLienHe } from '../lib/nhacViec'
import { laQuanLy } from '../lib/quyen'

const boDau = (t = '') => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()
const chiSo = (v) => String(v || '').replace(/\D/g, '')
const chuan = (v) => String(v ?? '').trim()

// Tên cột trong file (so khớp không dấu, không phân biệt hoa thường)
const COT = {
  ten: ['ten khach hang', 'ten khach', 'ten'],
  sdt: ['so dien thoai', 'dien thoai', 'sdt'],
  nganh: ['nganh hang', 'nganh'],
  khu_vuc: ['khu vuc', 'tinh thanh', 'khu vuc khach o'],
  fb: ['link facebook', 'link fb', 'facebook'],
  shop: ['link shop', 'shop'],
  tt: ['trang thai'],
  sale: ['sale phu trach', 'sale', 'nguoi phu trach'],
}
const layCot = (row, khoa) => {
  for (const k of Object.keys(row)) if (COT[khoa].includes(boDau(k).replace(/\*/g, '').trim())) return chuan(row[k])
  return ''
}

export default function TaiKhachLenModal({ customers, profiles, currentProfile, onClose, onDone }) {
  const { statuses } = useTrangThai()
  const laAdmin = laQuanLy(currentProfile)   // admin / leader được ghi tên sale (leader: chỉ sale trong team)
  const inputRef = useRef(null)
  const [tenFile, setTenFile] = useState('')
  const [rows, setRows] = useState(null)      // đã đọc từ file
  const [loi, setLoi] = useState('')
  const [dangLam, setDangLam] = useState(false)
  const [ketQua, setKetQua] = useState(null)

  const ttHoatDong = statuses.filter((s) => s.active !== false)
  const maMacDinh = maChuaLienHe(statuses)[0] || 'chua_lien_he'

  async function taiMau() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên khách hàng *', 'Số điện thoại', 'Ngành hàng', 'Khu vực', 'Link Facebook', 'Link shop', 'Trạng thái', 'Sale phụ trách'],
      ['Shop Hoa Mai', '0901234567', 'Thời trang nữ', 'Hà Nội', 'https://facebook.com/hoamai', 'https://shopee.vn/hoamai', 'Chưa liên hệ', laAdmin ? 'Tên sale (nếu có)' : ''],
    ])
    ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Khach hang')
    XLSX.writeFile(wb, 'Mau_tai_khach_hang_len.xlsx')
  }

  async function docFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setLoi(''); setKetQua(null); setRows(null); setTenFile(f.name)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
      if (data.length === 0) { setLoi('File không có dòng dữ liệu nào.'); return }
      if (data.length > 2000) { setLoi('File quá lớn (tối đa 2.000 dòng mỗi lần). Chị chia nhỏ file rồi tải lại.'); return }
      setRows(data)
    } catch {
      setLoi('Không đọc được file. Chị dùng file Excel (.xlsx) hoặc CSV theo file mẫu.')
    }
  }

  // Kiểm tra từng dòng
  const kiemTra = useMemo(() => {
    if (!rows) return []
    const sdtCo = new Set(customers.map((c) => chiSo(c.sdt)).filter((s) => s.length >= 8))
    const sdtTrongFile = new Set()
    return rows.map((r, i) => {
      const ten = layCot(r, 'ten')
      const sdt = layCot(r, 'sdt')
      const so = chiSo(sdt)
      const canhBao = []
      let loiDong = ''
      if (!ten) loiDong = 'Thiếu tên khách hàng'
      else if (so.length >= 8 && sdtCo.has(so)) loiDong = 'SĐT đã có trong hệ thống'
      else if (so.length >= 8 && sdtTrongFile.has(so)) loiDong = 'SĐT bị lặp trong file'
      if (so.length >= 8) sdtTrongFile.add(so)

      const ttTen = layCot(r, 'tt')
      const tt = ttTen ? ttHoatDong.find((s) => boDau(s.ten) === boDau(ttTen)) : null
      if (ttTen && !tt) canhBao.push('Trạng thái không khớp → để "Chưa liên hệ"')

      const kvTen = layCot(r, 'khu_vuc')
      const kv = kvTen ? TINH_THANH.find((t) => boDau(t) === boDau(kvTen)) : null
      if (kvTen && !kv) canhBao.push('Khu vực không khớp → bỏ trống')

      let saleId = currentProfile.id
      const saleTen = layCot(r, 'sale')
      if (laAdmin && saleTen) {
        const s = profiles.find((p) => boDau(p.full_name) === boDau(saleTen))
        if (s) saleId = s.id
        else canhBao.push('Không tìm thấy sale → gán cho chị')
      }
      return {
        stt: i + 2, ten, sdt, loi: loiDong, canhBao,
        saleTen: profiles.find((p) => p.id === saleId)?.full_name || '',
        ttTen: (tt || ttHoatong(ttHoatDong, maMacDinh))?.ten || '',
        payload: {
          ten_khach: ten, sdt: sdt || null,
          nganh_hang: layCot(r, 'nganh') || null,
          khu_vuc: kv || null,
          link_fb: layCot(r, 'fb') || null,
          link_shop: layCot(r, 'shop') || null,
          trang_thai_cham_soc: tt?.ma || maMacDinh,
          sale_id: saleId,
          loai_khach: 'moi', nguon_khach: 'tu_tim',
        },
      }
    })
  }, [rows, customers, profiles, statuses])

  const hopLe = kiemTra.filter((r) => !r.loi)
  const biLoai = kiemTra.filter((r) => r.loi)

  async function taiLen() {
    setDangLam(true)
    let them = 0
    const loiThem = []
    for (let i = 0; i < hopLe.length; i += 50) {
      const nhom = hopLe.slice(i, i + 50)
      const { error } = await supabase.from('customers').insert(nhom.map((r) => r.payload))
      if (!error) { them += nhom.length; continue }
      // Lỗi cả nhóm → thử từng dòng để biết dòng nào lỗi
      for (const r of nhom) {
        const { error: e1 } = await supabase.from('customers').insert(r.payload)
        if (e1) loiThem.push({ stt: r.stt, ten: r.ten, loi: e1.message.includes('SDT_TRUNG') ? 'SĐT đã có trong hệ thống' : e1.message })
        else them += 1
      }
    }
    setDangLam(false)
    setKetQua({ them, loiThem })
    onDone()
  }

  const o = 'border border-slate-200 px-3 py-2'

  return (
    <Modal title="Tải khách hàng lên" onClose={onClose} wide>
      {ketQua ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Đã thêm <b>{ketQua.them}</b> khách hàng mới{biLoai.length + ketQua.loiThem.length > 0 && <>, bỏ qua <b>{biLoai.length + ketQua.loiThem.length}</b> dòng</>}.
          </div>
          {ketQua.loiThem.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-600">
              {ketQua.loiThem.map((x) => <li key={x.stt}>Dòng {x.stt} ({x.ten}): {x.loi}</li>)}
            </ul>
          )}
          <div className="flex justify-end"><Button onClick={onClose}>Đóng</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-600">
            <FileSpreadsheet size={18} className="text-coral-500" />
            <span className="flex-1">Chuẩn bị file Excel theo mẫu: chỉ cần cột <b>Tên khách hàng</b>, các cột còn lại có thể để trống.</span>
            <button type="button" onClick={taiMau}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
              <Download size={15} /> Tải file mẫu
            </button>
          </div>

          <div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={docFile} className="hidden" />
            <button type="button" onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
              <Upload size={18} /> {tenFile ? `Đã chọn: ${tenFile} (bấm để chọn file khác)` : 'Chọn file Excel / CSV từ máy'}
            </button>
            {loi && <p className="mt-2 text-sm text-rose-600">{loi}</p>}
          </div>

          {rows && (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Sẵn sàng thêm: <b>{hopLe.length}</b></span>
                <span className={`rounded-lg px-3 py-1.5 ${biLoai.length ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-ink-400'}`}>Sẽ bỏ qua: <b>{biLoai.length}</b></span>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-100 text-left font-semibold text-navy-900">
                      <th className={o}>Dòng</th><th className={o}>Tên khách hàng</th><th className={o}>SĐT</th>
                      <th className={o}>Trạng thái</th><th className={o}>Sale</th><th className={o}>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kiemTra.slice(0, 200).map((r) => (
                      <tr key={r.stt} className={r.loi ? 'bg-rose-50/50' : ''}>
                        <td className={o}>{r.stt}</td>
                        <td className={`${o} font-medium text-navy-900`}>{r.ten || '—'}</td>
                        <td className={o}>{r.sdt || '—'}</td>
                        <td className={o}>{r.ttTen}</td>
                        <td className={o}>{r.saleTen}</td>
                        <td className={o}>
                          {r.loi ? <span className="text-rose-600">{r.loi}</span>
                            : r.canhBao.length ? <span className="text-amber-600">{r.canhBao.join('; ')}</span>
                            : <span className="text-emerald-600">Hợp lệ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {kiemTra.length > 200 && <p className="text-xs text-ink-400">Chỉ hiện 200 dòng đầu để xem trước, các dòng còn lại vẫn được kiểm tra và thêm bình thường.</p>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Huỷ</Button>
                <Button onClick={taiLen} disabled={dangLam || hopLe.length === 0}>
                  {dangLam ? 'Đang tải lên...' : `Tải lên ${hopLe.length} khách`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function ttHoatong(ds, ma) { return ds.find((s) => s.ma === ma) }
