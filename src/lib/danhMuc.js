import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { NGUON_KHACH_OPTIONS, DICH_VU_OPTIONS, DA_AN } from './constants'

// Danh mục có thể thêm / sửa / ẩn trong app: Nguồn khách và Dịch vụ quan tâm
export const DANH_MUC = {
  nguon_khach: { ten: 'Nguồn khách', mang: NGUON_KHACH_OPTIONS, cot: 'nguon_khach', mang_cot: false },
  dich_vu: { ten: 'Dịch vụ', mang: DICH_VU_OPTIONS, cot: 'dich_vu', mang_cot: true },
}

// Bản gốc (mặc định) chụp lại trước khi bị ghi đè
const MAC_DINH = {
  nguon_khach: NGUON_KHACH_OPTIONS.map((o) => ({ ...o })),
  dich_vu: DICH_VU_OPTIONS.map((o) => ({ ...o })),
}
const CLASS_TUY_CHINH = 'bg-slate-100 text-slate-600 border border-slate-300'

export function macDinhCua(loai) { return MAC_DINH[loai] }

let hang = []          // các dòng trong database
let phienBan = 0
const nguoiNghe = new Set()

export function dongTuyChinh() { return hang }

// Ghép mặc định + dòng trong database, ghi đè thẳng vào các mảng mà cả app đang dùng
function ghep() {
  for (const k of Object.keys(DA_AN)) delete DA_AN[k]
  for (const loai of Object.keys(DANH_MUC)) {
    const mac = MAC_DINH[loai]
    const dong = hang.filter((r) => r.loai === loai)
    const ra = []
    const macVal = new Set(mac.map((m) => m.value))
    for (const m of mac) {
      const ov = dong.find((r) => r.value === m.value)
      const muc = { ...m, label: ov?.label || m.label }
      if (ov && ov.active === false) DA_AN[m.value] = muc
      else ra.push({ ...muc, thu_tu: ov?.thu_tu ?? 0 })
    }
    for (const r of dong.filter((x) => !macVal.has(x.value)).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))) {
      const muc = { value: r.value, label: r.label, className: CLASS_TUY_CHINH }
      if (r.active === false) DA_AN[r.value] = muc
      else ra.push(muc)
    }
    const mang = DANH_MUC[loai].mang
    mang.splice(0, mang.length, ...ra.map(({ thu_tu, ...m }) => m))
  }
  phienBan += 1
  nguoiNghe.forEach((f) => f(phienBan))
}

export async function taiDanhMuc() {
  const { data, error } = await supabase.from('danh_muc').select('*')
  if (error) return false    // chưa chạy SQL thì dùng danh mục mặc định
  hang = data || []
  ghep()
  return true
}

// Gọi 1 lần ở App; trả về số phiên bản để App render lại khi danh mục đổi
export function useDanhMuc(daDangNhap) {
  const [, setV] = useState(0)
  useEffect(() => {
    nguoiNghe.add(setV)
    return () => nguoiNghe.delete(setV)
  }, [])
  useEffect(() => { if (daDangNhap) taiDanhMuc() }, [daDangNhap])
}
