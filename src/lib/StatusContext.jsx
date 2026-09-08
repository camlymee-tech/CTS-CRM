import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

// Màu badge cho từng trạng thái — khoá màu lưu trong database
export const MAU_BADGE = {
  slate:   'bg-slate-100 text-slate-600',
  orange:  'bg-orange-100 text-orange-700',
  amber:   'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  teal:    'bg-teal-50 text-teal-600',
  violet:  'bg-violet-100 text-violet-700',
  rose:    'bg-rose-100 text-rose-600',
  coral:   'bg-coral-50 text-coral-600',
  sky:     'bg-sky-100 text-sky-700',
  navy:    'bg-navy-900 text-white',
}

export const DANH_SACH_MAU = Object.keys(MAU_BADGE)

// Dùng tạm khi chưa tải xong, để giao diện không trống
const MAC_DINH = [
  { ma: 'chua_lien_he', ten: 'Chưa liên hệ', mau: 'slate', thu_tu: 1, la_chot: false, tao_don: false, chung_sau_ngay: null, active: true },
  { ma: 'khong_nghe_may', ten: 'Không nghe máy', mau: 'orange', thu_tu: 2, la_chot: false, tao_don: false, chung_sau_ngay: 5, active: true },
  { ma: 'dang_tu_van', ten: 'Đang tư vấn', mau: 'amber', thu_tu: 3, la_chot: false, tao_don: false, chung_sau_ngay: 30, active: true },
  { ma: 'da_ky', ten: 'Chốt hợp đồng', mau: 'emerald', thu_tu: 4, la_chot: true, tao_don: true, chung_sau_ngay: null, active: true },
  { ma: 'dang_trien_khai', ten: 'Đang triển khai', mau: 'teal', thu_tu: 5, la_chot: true, tao_don: false, chung_sau_ngay: null, active: true },
  { ma: 'hoan_thanh', ten: 'Hoàn thành dịch vụ', mau: 'violet', thu_tu: 6, la_chot: true, tao_don: false, chung_sau_ngay: 0, active: true },
  { ma: 'tu_choi', ten: 'Từ chối / Ngừng', mau: 'rose', thu_tu: 7, la_chot: false, tao_don: false, chung_sau_ngay: 15, active: true },
]

const Ctx = createContext(null)

export function StatusProvider({ children }) {
  const [statuses, setStatuses] = useState(MAC_DINH)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('customer_statuses').select('*').order('thu_tu')
    if (data?.length) setStatuses(data)
    setLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])

  const value = useMemo(() => {
    const dangDung = statuses.filter((s) => s.active !== false)
    const tim = (ma) => statuses.find((s) => s.ma === ma)
    return {
      statuses,                       // tất cả, kể cả đang tắt (dùng ở màn quản lý)
      options: dangDung,              // dùng cho dropdown và thẻ
      loaded,
      reload: load,
      tenTrangThai: (ma) => tim(ma)?.ten ?? ma,
      classTrangThai: (ma) => MAU_BADGE[tim(ma)?.mau] ?? MAU_BADGE.slate,
      maDaChot: dangDung.filter((s) => s.la_chot).map((s) => s.ma),
      maTaoDon: dangDung.filter((s) => s.tao_don).map((s) => s.ma),
      // Khách thành data chung khi im lặng đủ số ngày quy định
      laKhachChung: (c) => {
        const s = tim(c.trang_thai_cham_soc)
        if (!s || s.chung_sau_ngay === null || s.chung_sau_ngay === undefined) return false
        const moc = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
        if (!moc) return true
        const soNgay = Math.floor((Date.now() - new Date(moc).getTime()) / 86400000)
        return soNgay >= s.chung_sau_ngay
      },
    }
  }, [statuses, loaded, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTrangThai() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTrangThai phải nằm trong StatusProvider')
  return v
}
