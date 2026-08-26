import { Users, FileText, ShoppingBag, BarChart3, LogOut, UserCog, KeyRound, BookOpen, Bell, PieChart } from 'lucide-react'
import { supabase } from '../supabaseClient'

const NAV = [
  { key: 'customers', label: 'Khách hàng', icon: Users, ready: true },
  { key: 'orders', label: 'Đơn dịch vụ', icon: ShoppingBag, ready: true },
  { key: 'contracts', label: 'Hợp đồng', icon: FileText, ready: true },
  { key: 'reports', label: 'Tổng kết doanh số', icon: BarChart3, ready: true },
  { key: 'analytics', label: 'Báo cáo', icon: PieChart, ready: true },
  { key: 'documents', label: 'Tài liệu', icon: BookOpen, ready: true },
  { key: 'notifications', label: 'Thông báo', icon: Bell, ready: true },
  { key: 'team', label: 'Nhân sự', icon: UserCog, ready: true, adminOnly: true },
]

export default function Sidebar({ current, onNavigate, profile, onChangePassword, unreadCount = 0 }) {
  return (
    <aside className="flex h-screen w-60 flex-col bg-navy-950 text-white">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-coral-500 font-display text-sm font-bold">T</div>
        <div>
          <p className="font-display text-sm font-bold leading-tight">TUKI CRM</p>
          <p className="text-xs text-white/50">TUKI Agency</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter((item) => !item.adminOnly || profile?.role === 'admin').map((item) => {
          const Icon = item.icon
          const active = current === item.key
          const showBadge = item.key === 'notifications' && unreadCount > 0
          return (
            <button
              key={item.key}
              disabled={!item.ready}
              onClick={() => item.ready && onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              } ${!item.ready ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <Icon size={17} />
              {item.label}
              {showBadge && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {!item.ready && <span className="ml-auto text-[10px] uppercase tracking-wide text-white/40">Sắp có</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium">{profile?.full_name || 'Nhân viên'}</p>
        <p className="truncate text-xs text-white/40">{profile?.role === 'admin' ? 'Quản trị' : 'Sale'}</p>
        <button
          onClick={onChangePassword}
          className="mt-3 flex items-center gap-2 text-xs text-white/60 hover:text-white"
        >
          <KeyRound size={14} /> Đổi mật khẩu
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-2 flex items-center gap-2 text-xs text-white/60 hover:text-white"
        >
          <LogOut size={14} /> Đăng xuất
        </button>
      </div>
    </aside>
  )
}
