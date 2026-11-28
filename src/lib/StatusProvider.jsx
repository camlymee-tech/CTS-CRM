// Tải danh sách trạng thái khách từ database và cấp cho toàn app (đọc bằng useTrangThai() trong StatusContext.jsx)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Ctx, MAC_DINH, MAU_BADGE } from './StatusContext'

export function StatusProvider({ children }) {
  const [statuses, setStatuses] = useState(MAC_DINH)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('customer_statuses').select('*').order('thu_tu')
    if (data?.length) setStatuses(data)
    setLoaded(true)
  }, [])

  // oxlint-disable-next-line react/set-state-in-effect -- chỉ gán sau khi tải xong
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
      // Khách ở trạng thái này: toàn bộ doanh số của khách được tính là hoàn / huỷ
      maHoanHuy: statuses.filter((s) => s.la_hoan_huy).map((s) => s.ma),
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
