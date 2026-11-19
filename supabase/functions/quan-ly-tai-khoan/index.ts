// Edge Function: admin tạo / sửa / xoá / đặt lại mật khẩu nhân sự; leader tạo, sửa, xoá và đặt lại mật khẩu cho sale trong team mình.
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
    const { data: me } = await admin.from('profiles').select('role, active, phong_ban').eq('id', caller.user.id).single()
    const laAdmin = me?.role === 'admin'
    const laLeader = me?.role === 'leader'
    if ((!laAdmin && !laLeader) || me?.active === false) return reply({ error: 'Chỉ quản trị viên hoặc leader mới được thực hiện.' }, 403)

    const body = await req.json()
    if (laLeader && !me?.phong_ban) return reply({ error: 'Hồ sơ của bạn chưa có phòng ban. Hãy nhờ quản trị viên cập nhật trước.' }, 400)

    // 2. Tạo tài khoản
    if (body.action === 'create') {
      const p = body.profile || {}
      if (!p.email || !p.password || !p.full_name) return reply({ error: 'Thiếu họ tên, email hoặc mật khẩu.' }, 400)
      if (String(p.password).length < 6) return reply({ error: 'Mật khẩu cần ít nhất 6 ký tự.' }, 400)
      // Leader chỉ tạo được sale, thuộc đúng phòng ban của mình
      const vaiTro = laLeader ? 'sale' : (['admin', 'leader', 'sale'].includes(p.role) ? p.role : 'sale')
      const phongBan = laLeader ? me!.phong_ban : String(p.phong_ban || '').trim()
      if (vaiTro !== 'admin' && !phongBan) return reply({ error: 'Cần chọn phòng ban cho Sale và Leader.' }, 400)
      if (vaiTro !== 'admin') {
        const { data: pb } = await admin.from('phong_ban').select('id').eq('ten', phongBan).maybeSingle()
        if (!pb) return reply({ error: 'Phòng ban này chưa được tạo. Quản trị viên cần tạo phòng ban trước.' }, 400)
      }
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
        ma_sale: p.ma_sale || null, role: vaiTro, phong_ban: vaiTro === 'admin' ? null : phongBan, active: true,
        sdt: p.sdt || null, sdt_lam_viec: p.sdt_lam_viec || null,
        ngay_sinh: p.ngay_sinh || null, ngay_vao_cty: p.ngay_vao_cty || null, link_fb: p.link_fb || null,
      })
      if (pe) return reply({ error: 'Đã tạo tài khoản nhưng lưu hồ sơ lỗi: ' + pe.message }, 500)
      return reply({ ok: true, id })
    }

    // 3. Sửa hồ sơ / khoá tài khoản (leader: chỉ sale cùng phòng ban, không đổi vai trò và phòng ban)
    if (body.action === 'update') {
      const id = body.id
      if (!id) return reply({ error: 'Thiếu tài khoản cần sửa.' }, 400)
      const { data: target } = await admin.from('profiles').select('role, phong_ban').eq('id', id).single()
      if (!target) return reply({ error: 'Không tìm thấy tài khoản.' }, 404)
      if (laLeader && (target.role !== 'sale' || target.phong_ban !== me!.phong_ban)) {
        return reply({ error: 'Bạn chỉ sửa được tài khoản sale trong team của mình.' }, 403)
      }
      const cho = ['full_name', 'ma_sale', 'sdt', 'sdt_lam_viec', 'ngay_sinh', 'ngay_vao_cty', 'link_fb', 'active']
      const patch: Record<string, unknown> = {}
      for (const k of cho) if (body.patch && k in body.patch) patch[k] = body.patch[k]
      if (laAdmin && body.patch) for (const k of ['role', 'phong_ban']) if (k in body.patch) patch[k] = body.patch[k]
      if (id === caller.user.id && patch.active === false) return reply({ error: 'Bạn không thể tự khoá tài khoản của chính mình.' }, 400)
      const { error } = await admin.from('profiles').update(patch).eq('id', id)
      if (error) return reply({ error: error.message }, 500)
      return reply({ ok: true })
    }

    // 4. Xoá tài khoản
    if (body.action === 'delete') {
      const id = body.id
      if (!id) return reply({ error: 'Thiếu tài khoản cần xoá.' }, 400)
      if (id === caller.user.id) return reply({ error: 'Bạn không thể tự xoá tài khoản của chính mình.' }, 400)
      const { data: target } = await admin.from('profiles').select('role, phong_ban').eq('id', id).single()
      if (!target) return reply({ error: 'Không tìm thấy tài khoản.' }, 404)
      // Leader chỉ xoá được sale thuộc phòng ban của mình
      if (laLeader && (target.role !== 'sale' || target.phong_ban !== me!.phong_ban)) return reply({ error: 'Bạn chỉ xoá được tài khoản sale trong team của mình.' }, 403)
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

    // 5. Đặt lại mật khẩu (leader: chỉ sale cùng phòng ban)
    if (body.action === 'reset_password') {
      const id = body.id
      const mk = String(body.password || '')
      if (!id) return reply({ error: 'Thiếu tài khoản cần đặt lại mật khẩu.' }, 400)
      if (mk.length < 6) return reply({ error: 'Mật khẩu cần ít nhất 6 ký tự.' }, 400)
      const { data: target } = await admin.from('profiles').select('role, phong_ban').eq('id', id).single()
      if (!target) return reply({ error: 'Không tìm thấy tài khoản.' }, 404)
      if (laLeader && (target.role !== 'sale' || target.phong_ban !== me!.phong_ban)) {
        return reply({ error: 'Bạn chỉ đặt lại mật khẩu được cho sale trong team của mình.' }, 403)
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password: mk })
      if (error) return reply({ error: error.message }, 500)
      return reply({ ok: true })
    }
    return reply({ error: 'Hành động không hợp lệ.' }, 400)
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500)
  }
})
