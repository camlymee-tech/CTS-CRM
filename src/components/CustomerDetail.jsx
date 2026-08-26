import { useEffect, useState } from 'react'
import { X, Phone, MessageCircle, Users as UsersIcon, MoreHorizontal, Plus, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Textarea, Select, Badge } from './ui'
import { LOAI_TUONG_TAC_OPTIONS, TRANG_THAI_OPTIONS, NEN_TANG_OPTIONS, classOf, labelOf } from '../lib/constants'

const ICONS = { goi_dien: Phone, nhan_tin: MessageCircle, gap_mat: UsersIcon, khac: MoreHorizontal }

export default function CustomerDetail({ customer, currentProfile, onClose, onChanged, onEdit }) {
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [noiDung, setNoiDung] = useState('')
  const [loai, setLoai] = useState('goi_dien')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [customer.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('customer_interactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('ngay_thuc_hien', { ascending: false })
    setInteractions(data || [])
    setLoading(false)
  }

  async function addInteraction(e) {
    e.preventDefault()
    if (!noiDung.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customer.id,
      sale_id: currentProfile?.id,
      loai,
      noi_dung: noiDung.trim(),
    })
    setSaving(false)
    if (!error) {
      setNoiDung('')
      await supabase.from('customers').update({ ngay_lien_he_gan_nhat: new Date().toISOString().slice(0, 10) }).eq('id', customer.id)
      load()
      onChanged?.()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-navy-950/30 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{customer.ma_khach}</p>
            <h2 className="font-display text-lg font-bold text-navy-900">{customer.ten_khach}</h2>
            {customer.ten_shop && <p className="text-sm text-ink-600">{customer.ten_shop}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(customer.nen_tang || []).map((nt) => (
                <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
              ))}
              <Badge className={classOf(TRANG_THAI_OPTIONS, customer.trang_thai_cham_soc)}>
                {labelOf(TRANG_THAI_OPTIONS, customer.trang_thai_cham_soc)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit?.(customer)}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900"
              title="Sửa thông tin"
            >
              <Pencil size={17} />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-6 py-4 text-sm">
          <div>
            <p className="text-ink-400">Số điện thoại</p>
            <p className="font-medium text-navy-900">{customer.sdt || '—'}</p>
          </div>
          <div>
            <p className="text-ink-400">Ngành hàng</p>
            <p className="font-medium text-navy-900">{customer.nganh_hang || '—'}</p>
          </div>
          <div>
            <p className="text-ink-400">Liên hệ gần nhất</p>
            <p className="font-medium text-navy-900">{customer.ngay_lien_he_gan_nhat || '—'}</p>
          </div>
          <div>
            <p className="text-ink-400">Chăm sóc tiếp theo</p>
            <p className="font-medium text-navy-900">{customer.ngay_cham_soc_tiep_theo || '—'}</p>
          </div>
          {customer.ghi_chu && (
            <div className="col-span-2">
              <p className="text-ink-400">Ghi chú</p>
              <p className="text-navy-900">{customer.ghi_chu}</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-sm font-semibold text-navy-900">Lịch sử chăm sóc</p>
          {loading ? (
            <p className="text-sm text-ink-400">Đang tải...</p>
          ) : interactions.length === 0 ? (
            <p className="text-sm text-ink-400">Chưa có lịch sử chăm sóc nào.</p>
          ) : (
            <ul className="space-y-3">
              {interactions.map((it) => {
                const Icon = ICONS[it.loai] || MoreHorizontal
                return (
                  <li key={it.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-500">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-navy-900">{it.noi_dung}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {new Date(it.ngay_thuc_hien).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <form onSubmit={addInteraction} className="border-t border-slate-100 px-6 py-4">
          <div className="mb-2 flex gap-2">
            <Select value={loai} onChange={(e) => setLoai(e.target.value)} className="flex-none">
              {LOAI_TUONG_TAC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <Textarea
            rows={2}
            placeholder="Ghi lại nội dung đã trao đổi với khách..."
            value={noiDung}
            onChange={(e) => setNoiDung(e.target.value)}
          />
          <Button type="submit" disabled={saving} className="mt-2 w-full">
            <Plus size={15} /> Thêm vào lịch sử
          </Button>
        </form>
      </div>
    </div>
  )
}
