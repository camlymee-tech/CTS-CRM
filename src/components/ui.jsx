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

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
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
