import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { BEN_B_MAC_DINH, BEN_B_TRUONG } from './benBMacDinh'

export { BEN_B_MAC_DINH, BEN_B_TRUONG }

// Gộp bản đã sửa (nếu có) lên trên bản mặc định
function gop(daLuu) {
  const kq = {}
  for (const loai of Object.keys(BEN_B_MAC_DINH)) {
    kq[loai] = { ...BEN_B_MAC_DINH[loai], ...((daLuu && daLuu[loai]) || {}) }
  }
  return kq
}

// Hook đọc thông tin Bên B. Nếu chưa chạy migration / lỗi đọc thì vẫn dùng bản mặc định.
export function useBenB() {
  const [benB, setBenB] = useState(() => gop(null))

  const tai = useCallback(async () => {
    const { data, error } = await supabase.from('ben_b_settings').select('loai, du_lieu')
    if (error || !data) return
    const daLuu = {}
    for (const r of data) daLuu[r.loai] = r.du_lieu || {}
    setBenB(gop(daLuu))
  }, [])

  useEffect(() => { tai() }, [tai])

  return { benB, taiLai: tai }
}
