// Phân quyền 3 cấp: Quản trị (admin) – Leader (trưởng team) – Sale.
// Team = Phòng ban: ai cùng phòng ban với leader thì thuộc team của leader đó.
export const laAdmin = (p) => p?.role === 'admin'
export const laLeader = (p) => p?.role === 'leader'
export const laSale = (p) => p?.role === 'sale'
export const laQuanLy = (p) => laAdmin(p) || laLeader(p)   // được xem dữ liệu của người khác
export const tenVaiTro = (r) => ({ admin: 'Quản trị', leader: 'Leader', sale: 'Sale' }[r] || 'Sale')

// Danh sách id nhân sự mà người dùng được xem dữ liệu. null = xem tất cả (admin).
export function nhanSuXemDuoc(me, profiles = []) {
  if (!me) return new Set()
  if (laAdmin(me)) return null
  if (laLeader(me) && me.phong_ban) {
    const ids = profiles.filter((p) => p.phong_ban === me.phong_ban).map((p) => p.id)
    return new Set([...ids, me.id])
  }
  return new Set([me.id])
}

// Danh sách nhân sự được hiển thị trong ô chọn sale / bảng báo cáo
export function locNhanSu(me, profiles = []) {
  const ids = nhanSuXemDuoc(me, profiles)
  return ids ? profiles.filter((p) => ids.has(p.id)) : profiles
}
