import { useState } from 'react'
import OrdersPage from './OrdersPage'
import ReportsPage from './ReportsPage'
import AnalyticsPage from './AnalyticsPage'
import ChuyenDoiNguonPage from './ChuyenDoiNguonPage'

// Gộp 3 màn cũ (Đơn dịch vụ / Tổng kết doanh số / Báo cáo) + thêm tab mới
// Chuyển đổi nguồn khách, chọn bằng tab giống kiểu "Báo cáo khách hàng" tham khảo.
const TABS = [
  { key: 'don_hang', label: 'Đơn hàng' },
  { key: 'doanh_so', label: 'Doanh số dịch vụ' },
  { key: 'hieu_suat', label: 'Hiệu suất Sale' },
  { key: 'chuyen_doi', label: 'Chuyển đổi nguồn khách' },
]

export default function BaoCaoPage({ currentProfile }) {
  const [tab, setTab] = useState('don_hang')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-8 pt-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
              tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'don_hang' && <OrdersPage currentProfile={currentProfile} />}
        {tab === 'doanh_so' && <ReportsPage />}
        {tab === 'hieu_suat' && <AnalyticsPage />}
        {tab === 'chuyen_doi' && <ChuyenDoiNguonPage />}
      </div>
    </div>
  )
}
