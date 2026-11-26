import { useState } from 'react'
import { X } from 'lucide-react'

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium px-4 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-coral-500 text-white hover:bg-coral-600 shadow-sm shadow-coral-500/30',
    secondary: 'bg-white text-navy-900 border border-slate-200 hover:border-navy-700 hover:bg-slate-50',
    ghost: 'text-ink-600 hover:bg-slate-100',
    danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-navy-900">{label}</span>}
      <input
        className={`rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-500/15 ${className}`}
        {...props}
      />
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-navy-900">{label}</span>}
      <textarea
        className={`rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-500/15 ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({ label, className = '', children, ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-navy-900">{label}</span>}
      <select
        className={`rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-500/15 bg-white ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Badge({ className = '', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

// Phân trang dùng chung cho các bảng (Khách hàng, Đơn hàng, Hợp đồng...).
// tong = tổng số dòng, moiTrang = số dòng/trang (mặc định 20), trang = trang hiện tại (bắt đầu từ 1).
export function Phantrang({ trang, setTrang, tong, moiTrang = 20 }) {
  const soTrang = Math.max(1, Math.ceil(tong / moiTrang))
  const [oNhap, setONhap] = useState('')

  if (soTrang <= 1) return null

  // Danh sách số trang hiện ra: luôn có trang đầu/cuối, quanh trang hiện tại, còn lại là "..."
  const items = []
  for (let i = 1; i <= soTrang; i++) {
    if (i === 1 || i === soTrang || Math.abs(i - trang) <= 1) items.push(i)
    else if (items[items.length - 1] !== '...') items.push('...')
  }

  function toiTrang() {
    const n = parseInt(oNhap, 10)
    if (n >= 1 && n <= soTrang) { setTrang(n); setONhap('') }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4 text-sm">
      <button onClick={() => setTrang(Math.max(1, trang - 1))} disabled={trang === 1}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-navy-700 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent">
        ← Trước
      </button>
      {items.map((it, i) => it === '...' ? (
        <span key={`e${i}`} className="px-1 text-ink-400">…</span>
      ) : (
        <button key={it} onClick={() => setTrang(it)}
          className={`h-8 min-w-[2rem] rounded-lg px-2 font-medium transition ${
            it === trang ? 'bg-blue-600 text-white' : 'text-navy-700 hover:bg-slate-100'
          }`}>
          {it}
        </button>
      ))}
      <button onClick={() => setTrang(Math.min(soTrang, trang + 1))} disabled={trang === soTrang}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-blue-600 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent">
        Sau →
      </button>
      <span className="ml-2 text-ink-400">Tới trang</span>
      <input type="number" min={1} max={soTrang} value={oNhap} onChange={(e) => setONhap(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && toiTrang()}
        className="h-8 w-14 rounded-lg border border-slate-200 px-2 text-center outline-none focus:border-blue-500" />
      <button onClick={toiTrang} className="h-8 rounded-lg bg-blue-600 px-3 font-medium text-white hover:bg-blue-700">
        Đi
      </button>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-navy-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
