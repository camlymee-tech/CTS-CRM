// Tab "Nhật ký" trong hồ sơ khách: các thay đổi đã ghi nhận trên khách (bảng customer_logs).
import { History } from 'lucide-react'

export default function TabNhatKy({ logs, tenNguoi }) {
  return (
    logs.length === 0
      ? <p className="text-sm text-ink-400">Chưa có thay đổi nào được ghi nhận.</p>
      : (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
              <History size={14} className="mt-0.5 flex-none text-ink-400" />
              <div className="min-w-0">
                <p className="text-sm text-navy-900">
                  <b>{l.hanh_dong}</b>
                  {l.chi_tiet && <span className="text-ink-600"> — {l.chi_tiet}</span>}
                </p>
                <p className="text-xs text-ink-400">
                  {tenNguoi(l.user_id)} · {new Date(l.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )
  )
}
