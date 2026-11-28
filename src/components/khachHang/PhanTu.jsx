// Tiêu đề cột kéo giãn / sắp xếp được và thẻ đếm khách theo trạng thái — dùng ở trang Khách hàng.
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

export function ThResize({ colKey, doRong, onResize, children, sapXep, dangSapXep, onSapXep, tieuDeNho }) {
  const rong = doRong[colKey]
  function batDauKeo(e) {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.closest('th')
    const xDau = e.clientX
    const rongDau = th.offsetWidth
    function keo(ev) {
      const moi = Math.max(60, rongDau + (ev.clientX - xDau))
      th.style.width = moi + 'px'
      th.style.maxWidth = moi + 'px'
    }
    function thoi() {
      document.removeEventListener('mousemove', keo)
      document.removeEventListener('mouseup', thoi)
      onResize(colKey, th.offsetWidth)
    }
    document.addEventListener('mousemove', keo)
    document.addEventListener('mouseup', thoi)
  }
  const Mui = dangSapXep === 'asc' ? ArrowUp : dangSapXep === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th className="border border-slate-200 relative select-none px-2.5 py-3"
      style={rong ? { width: rong, maxWidth: rong } : undefined}
      title={tieuDeNho}>
      {sapXep ? (
        <button type="button" onClick={onSapXep} className="inline-flex items-center gap-1.5 pr-2 hover:text-coral-600">
          <span className="truncate">{children}</span>
          <Mui size={14} className={dangSapXep ? 'text-coral-500' : 'text-ink-400'} />
        </button>
      ) : (
        <span className="block truncate pr-2">{children}</span>
      )}
      <span onMouseDown={batDauKeo}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-coral-500/40"
        title="Kéo để chỉnh độ rộng" />
    </th>
  )
}

export function StatCard({ label, value, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-left shadow-sm transition ${
        active ? 'bg-navy-900 ring-2 ring-coral-500' : 'bg-white hover:shadow-md'
      }`}
    >
      <p className={`text-[11px] font-medium leading-tight ${active ? 'text-white/60' : 'text-ink-400'}`}>{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${active ? 'text-white' : 'text-navy-900'}`}>{value}</p>
    </button>
  )
}
