// Edge Function: admin tạo / xoá tài khoản nhân sự ngay trong app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Xác định người gọi và kiểm tra là quản trị viên
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: caller } = await admin.auth.getUser(token)
    if (!caller?.user) return reply({ error: 'Bạn chưa đăng nhập.' }, 401)
    const { data: me } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).single()
    if (me?.role !== 'admin' || me?.active === false) return reply({ error: 'Chỉ quản trị viên mới được thực hiện.' }, 403)

    const body = await req.json()

    // 2. Tạo tài khoản
    if (body.action === 'create') {
      const p = body.profile || {}
      if (!p.email || !p.password || !p.full_name) return reply({ error: 'Thiếu họ tên, email hoặc mật khẩu.' }, 400)
      if (String(p.password).length < 6) return reply({ error: 'Mật khẩu cần ít nhất 6 ký tự.' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email: p.email, password: p.password, email_confirm: true,
        user_metadata: { full_name: p.full_name },
      })
      if (error) {
        const trung = /already|registered|exists/i.test(error.message)
        return reply({ error: trung ? 'Email này đã có tài khoản rồi.' : error.message }, 400)
      }
      const id = data.user!.id
      // Trigger handle_new_user tạo dòng profiles; upsert để chắc chắn có đủ thông tin
      const { error: pe } = await admin.from('profiles').upsert({
        id, email: p.email, full_name: p.full_name,
        ma_sale: p.ma_sale || null, role: p.role === 'admin' ? 'admin' : 'sale', active: true,
        sdt: p.sdt || null, sdt_lam_viec: p.sdt_lam_viec || null,
        ngay_sinh: p.ngay_sinh || null, ngay_vao_cty: p.ngay_vao_cty || null, link_fb: p.link_fb || null,
      })
      if (pe) return reply({ error: 'Đã tạo tài khoản nhưng lưu hồ sơ lỗi: ' + pe.message }, 500)
      return reply({ ok: true, id })
    }

    // 3. Xoá tài khoản
    if (body.action === 'delete') {
      const id = body.id
      if (!id) return reply({ error: 'Thiếu tài khoản cần xoá.' }, 400)
      if (id === caller.user.id) return reply({ error: 'Bạn không thể tự xoá tài khoản của chính mình.' }, 400)
      const { data: target } = await admin.from('profiles').select('role').eq('id', id).single()
      if (target?.role === 'admin') {
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
        if ((count ?? 0) <= 1) return reply({ error: 'Không thể xoá quản trị viên cuối cùng.' }, 400)
      }
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) {
        return reply({ error: 'Tài khoản này đã có dữ liệu gắn với nó (khách hàng, đơn dịch vụ, lịch sử...) nên không xoá hẳn được. Hãy dùng nút Khoá — người đó sẽ không đăng nhập được nữa nhưng dữ liệu vẫn được giữ nguyên.' }, 400)
      }
      return reply({ ok: true })
    }
    return reply({ error: 'Hành động không hợp lệ.' }, 400)
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500)
  }
})
