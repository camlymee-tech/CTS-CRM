// Gọi hàm máy chủ (Edge Function) "callio" — lịch sử cuộc gọi + link ghi âm theo khách.
import { supabase } from '../supabaseClient'
import { loiDeHieu } from './loi'

// Gọi hàm máy chủ "callio"; trả { data } hoặc { error: { text, code } } với câu báo lỗi dễ hiểu
export async function goiHamCallio(body) {
  try {
    const { data, error } = await supabase.functions.invoke('callio', { body })
    if (error) {
      let text = ''
      try { text = (await error.context?.json())?.error || '' } catch { /* không đọc được nội dung lỗi */ }
      return { error: { text: text || 'Chưa gọi được chức năng Callio trên máy chủ.', code: text ? 'loi' : 'chua_trien_khai' } }
    }
    if (data?.error) return { error: { text: data.error, code: data.code || 'loi' } }
    return { data }
  } catch (e) {
    return { error: { text: 'Lỗi kết nối: ' + loiDeHieu(e), code: 'loi' } }
  }
}
