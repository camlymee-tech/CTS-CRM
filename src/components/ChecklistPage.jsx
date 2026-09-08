import { useEffect, useMemo, useState } from 'react'
import { Phone, CalendarCheck, CalendarClock, CircleAlert, CircleCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Select, Badge } from './ui'
import CustomerDetail from './CustomerDetail'
import ChecklistTasks from './ChecklistTasks'
import {
  TRANG_THAI_OPTIONS, DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, TT_DA_KY,
  classOf, labelOf,
} from '../lib/constants'

export default function ChecklistPage({ currentProfile }) {
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSale, setFilterSale] = useState('')
  const [xemKhach, setXemKhach] = useState(null)

  const isAdmin = currentProfile?.role === 'admin'
  const homNay = new Date().toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('*').order('ngay_cham_soc_tiep_theo'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
    ])
    setCustomers(c || []); setProfiles(p || [])
    setLoading(false)
  }

  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  // Khách đến hạn chăm sóc, bỏ qua khách đã chốt/đang triển khai/hoàn thành
  const canLam = useMemo(() => customers.filter((c) => {
    if (!c.ngay_cham_soc_tiep_theo) return false
    if (c.ngay_cham_soc_tiep_theo > homNay) return false
    if (TT_DA_KY.includes(c.trang_thai_cham_soc)) return false
    if (!isAdmin && c.sale_id !== currentProfile?.id) return false
    if (filterSale && c.sale_id !== filterSale) return false
    return true
  }), [customers, homNay, isAdmin, currentProfile?.id, filterSale])

  const quaHan = canLam.filter((c) => c.ngay_cham_soc_tiep_theo < homNay)
  const dungHomNay = canLam.filter((c) => c.ngay_cham_soc_tiep_theo === homNay)

  // Khách sắp tới hạn trong 3 ngày, để chuẩn bị trước
  const sapToi = useMemo(() => {
    const han = new Date(); han.setDate(han.getDate() + 3)
    const h = han.toISOString().slice(0, 10)
    return customers.filter((c) => {
      if (!c.ngay_cham_soc_tiep_theo) return false
      if (c.ngay_cham_soc_tiep_theo <= homNay || c.ngay_cham_soc_tiep_theo > h) return false
      if (TT_DA_KY.includes(c.trang_thai_cham_soc)) return false
      if (!isAdmin && c.sale_id !== currentProfile?.id) return false
      if (filterSale && c.sale_id !== filterSale) return false
      return true
    })
  }, [customers, homNay, isAdmin, currentProfile?.id, filterSale])

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Checklist hôm nay</h1>
          <p className="text-sm text-ink-600">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
            {' · '}{isAdmin ? 'toàn team' : 'khách của bạn'}
          </p>
        </div>
        {isAdmin && (
          <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-48">
            <option value="">Tất cả sale</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        )}
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-4 p-8">
          <ChecklistTasks currentProfile={currentProfile} />

          {canLam.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <CircleCheck size={40} className="mx-auto text-emerald-500" />
              <p className="mt-3 font-display text-lg font-semibold text-navy-900">Không có khách đến hạn</p>
              <p className="mt-1 text-sm text-ink-600">
                Nhớ đặt lịch hẹn khi ghi lịch sử chăm sóc để không bỏ sót khách.
              </p>
            </div>
          ) : (
            <>
              {quaHan.length > 0 && (
                <Nhom
                  icon={CircleAlert} mau="rose"
                  tieuDe={`Quá hạn (${quaHan.length})`}
                  moTa="Đã trễ so với lịch hẹn — nên gọi trước"
                  ds={quaHan} homNay={homNay} tenSale={tenSale} onOpen={setXemKhach}
                />
              )}
              {dungHomNay.length > 0 && (
                <Nhom
                  icon={CalendarCheck} mau="coral"
                  tieuDe={`Hôm nay (${dungHomNay.length})`}
                  moTa="Đúng lịch hẹn hôm nay"
                  ds={dungHomNay} homNay={homNay} tenSale={tenSale} onOpen={setXemKhach}
                />
              )}
            </>
          )}

          {sapToi.length > 0 && (
            <Nhom
              icon={CalendarClock} mau="slate"
              tieuDe={`Sắp tới trong 3 ngày (${sapToi.length})`}
              moTa="Chưa đến hạn, xem trước để chuẩn bị"
              ds={sapToi} homNay={homNay} tenSale={tenSale} onOpen={setXemKhach}
            />
          )}
        </div>
      )}

      {xemKhach && (
        <CustomerDetail
          customer={xemKhach}
          currentProfile={currentProfile}
          onClose={() => setXemKhach(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function Nhom({ icon: Icon, mau, tieuDe, moTa, ds, homNay, tenSale, onOpen }) {
  const mauSac = {
    rose: 'text-rose-500',
    coral: 'text-coral-500',
    slate: 'text-ink-400',
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} className={mauSac[mau]} />
        <h2 className="font-display font-semibold text-navy-900">{tieuDe}</h2>
        <span className="text-xs text-ink-400">· {moTa}</span>
      </div>

      <div className="space-y-2">
        {ds.map((c) => {
          const treNgay = Math.floor((new Date(homNay) - new Date(c.ngay_cham_soc_tiep_theo)) / 86400000)
          return (
            <div key={c.id}
              onClick={() => onOpen(c)}
              className="flex cursor-pointer items-center gap-4 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-coral-500/40 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-navy-900">{c.ten_khach}</p>
                  <span className="text-xs text-ink-400">{c.ma_khach}</span>
                  {treNgay > 0 && (
                    <Badge className="bg-rose-100 text-rose-600">Trễ {treNgay} ngày</Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <span>{c.sdt || 'Chưa có SĐT'}</span>
                  <span className="text-ink-400">·</span>
                  <span>{labelOf(NGUON_KHACH_OPTIONS, c.nguon_khach)}</span>
                  <span className="text-ink-400">·</span>
                  <span>{tenSale(c.sale_id)}</span>
                </div>
              </div>

              <div className="hidden flex-none gap-1 md:flex">
                {(c.dich_vu || []).map((dv) => (
                  <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
                ))}
              </div>

              <Badge className={classOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}>
                {labelOf(TRANG_THAI_OPTIONS, c.trang_thai_cham_soc)}
              </Badge>

              <span className="w-24 flex-none text-right text-xs text-ink-600">
                {c.ngay_cham_soc_tiep_theo}
              </span>

              <a href={c.sdt ? `tel:${c.sdt}` : undefined}
                onClick={(e) => e.stopPropagation()}
                className={`flex-none inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  c.sdt ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'text-ink-400'
                }`}>
                <Phone size={13} /> Gọi
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
