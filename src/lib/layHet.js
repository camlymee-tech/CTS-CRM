// Supabase chỉ trả tối đa 1.000 dòng mỗi lần gọi. Hàm này gọi nhiều lần, mỗi lần 1.000 dòng,
// rồi ghép lại để lấy đủ dữ liệu (hàng chục nghìn khách vẫn đầy đủ).
// Dùng: const { data } = await layHet(() => supabase.from('customers').select('*').order('id'))
export async function layHet(taoQuery, toiDa = 200000) {
  const BUOC = 1000
  let tat = []
  for (let tu = 0; tu < toiDa; tu += BUOC) {
    const { data, error } = await taoQuery().range(tu, tu + BUOC - 1)
    if (error) return { data: tat.length ? tat : null, error }
    tat = tat.concat(data || [])
    if (!data || data.length < BUOC) break
  }
  return { data: tat, error: null }
}
