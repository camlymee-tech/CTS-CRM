import { createClient } from '@supabase/supabase-js'

// Client phụ: dùng riêng để tạo tài khoản mới.
// persistSession: false -> không ghi đè phiên đăng nhập của admin đang dùng app.
export const supabaseSignUp = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
