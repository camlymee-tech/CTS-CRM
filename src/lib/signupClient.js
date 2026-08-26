import { createClient } from '@supabase/supabase-js'

// Client phụ: dùng riêng để admin tạo tài khoản cho nhân sự mới.
// persistSession: false + storageKey riêng -> không đụng vào phiên đăng nhập của admin.
export const supabaseSignUp = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'tuki-crm-signup-only',
    },
  }
)
