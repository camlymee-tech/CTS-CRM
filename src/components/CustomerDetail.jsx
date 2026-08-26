import { useEffect, useState } from 'react'
import {
  X, Phone, MessageCircle, Users as UsersIcon, MoreHorizontal, Plus, Pencil,
  Link2, Store, HandHeart, CircleAlert, CircleCheck, History, Check,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Textarea, Select, Badge, Input } from './ui'
import {
  LOAI_TUONG_TAC_OPTIONS, TRANG_THAI_OPTIONS, NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, LOAI_KHACH_OPTIONS,
  classOf, labelOf,
} from '../lib/constants'

const ICONS = { goi_dien: Phone, nhan_tin: MessageCircle, gap_mat: UsersIcon, khac: MoreHorizontal }

function laKhachChung(c) {
  const moc = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
  const soNgay = moc ? Math.floor((Date.now() - new Date(moc).getTime()) / 86400000) : 999
  if (c.trang_thai_cham_soc === 'chua_lien_he') return true
  if (c.trang_thai_cham_soc === 'tu_choi') return true
  if (c.trang_thai_cham_soc === 'khong_nghe_may') return soNgay >= 5
  if (c.trang_thai_cham_soc === 'dang_tu_van') return soNgay >= 30
  return false
}

export default function CustomerDetail({ customer: khachBanDau, currentProfile, onClose, onChanged, onEdit }) {
  const [customer, setCustomer] = useState(khachBanDau)
  const [tab, setTab] = useState('thong_tin')
  const [interactions, setInteractions] = useState([])
  const [issues, setIssues] = useState([])
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const cuaMinh = customer.sale_id === currentProfile?.id
  const chung = laKhachChung(customer)
  const isAdmin = currentProfile?.role === 'admin'
  const suaDuoc = cuaMinh || isAdmin || chung || !customer.sale_id

  useEffect(() => { load() }, [customer.id])

  async function load() {
    setLoading(true)
    const [{ data: it }, { data: iss }, { data: lg }, { data: pf }] = await Promise.all([
      supabase.from('customer_interactions').select('*').eq('customer_id', customer.id)
        .order('ngay_thuc_hien', { ascending: false }),
      supabase.from('customer_issues').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }),
      supabase.from('customer_logs').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, full_name'),
    ])
    setInteractions(it || []); setIssues(iss || []); setLogs(lg || []); setProfiles(pf || [])
    setLoading(false)
  }

  const tenNguoi = (id) => profiles.find((p) => p.id === id)?.full_name || 'Không rõ'

  async function nhanKhach() {
    if (!window.confirm(`Nhận ${customer.ten_khach} về phụ trách? Sale cũ sẽ không còn thấy khách này trong danh sách riêng.`)) return
    const { error } = await supabase.from('customers')
      .update({ sale_id: currentProfile.id }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setCustomer({ ...customer, sale_id: currentProfile.id })
    setMsg('')
    load(); onChanged?.()
  }

  async function doiTrangThai(tt) {
    const { error } = await supabase.from('customers')
      .update({ trang_thai_cham_soc: tt }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setCustomer({ ...customer, trang_thai_cham_soc: tt })
    load(); onChanged?.()
  }

  const TABS = [
    { key: 'thong_tin', label: 'Thông tin' },
    { key: 'van_de', label: `Vấn đề (${issues.length})` },
    { key: 'cham_soc', label: `Chăm sóc (${interactions.length})` },
    { key: 'nhat_ky', label: 'Nhật ký' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-navy-950/30 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{customer.ma_khach}</p>
              <h2 className="font-display text-xl font-bold text-navy-900">{customer.ten_khach}</h2>
              <div className="mt-1 flex gap-3 text-sm">
                {customer.link_fb && (
                  <a href={customer.link_fb} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-500 hover:underline">
                    <Link2 size={12} /> Facebook
                  </a>
                )}
                {customer.link_shop && (
                  <a href={customer.link_shop} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-500 hover:underline">
                    <Store size={12} /> Link shop
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-none items-center gap-1">
              {suaDuoc && (
                <button onClick={() => onEdit?.(customer)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900" title="Sửa thông tin">
                  <Pencil size={17} />
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(customer.nen_tang || []).map((nt) => (
              <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
            ))}
            {(customer.dich_vu || []).map((dv) => (
              <Badge key={dv} className={classOf(DICH_VU_OPTIONS, dv)}>{labelOf(DICH_VU_OPTIONS, dv)}</Badge>
            ))}
            {suaDuoc ? (
              <Select value={customer.trang_thai_cham_soc} onChange={(e) => doiTrangThai(e.target.value)}
                className="h-8 w-44 py-1 text-xs">
                {TRANG_THAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : (
              <Badge className={classOf(TRANG_THAI_OPTIONS, customer.trang_thai_cham_soc)}>
                {labelOf(TRANG_THAI_OPTIONS, customer.trang_thai_cham_soc)}
              </Badge>
            )}
          </div>

          {chung && !cuaMinh && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5">
              <p className="text-sm text-amber-800">
                Data chung — hiện do <b>{tenNguoi(customer.sale_id)}</b> phụ trách
              </p>
              <Button onClick={nhanKhach} className="px-3 py-1.5 text-xs">
                <HandHeart size={14} /> Nhận khách
              </Button>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}

          <div className="mt-4 flex gap-1 border-b border-slate-100">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
            <>
              {tab === 'thong_tin' && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Field label="Số điện thoại" value={customer.sdt} />
                  <Field label="Ngành hàng" value={customer.nganh_hang} />
                  <Field label="Nguồn khách" value={labelOf(NGUON_KHACH_OPTIONS, customer.nguon_khach)} />
                  <Field label="Loại khách" value={labelOf(LOAI_KHACH_OPTIONS, customer.loai_khach)} />
                  <Field label="Sale phụ trách" value={tenNguoi(customer.sale_id)} />
                  <Field label="Ngày tạo" value={(customer.created_at || '').slice(0, 10)} />
                  <Field label="Liên hệ gần nhất" value={customer.ngay_lien_he_gan_nhat} />
                  <Field label="Chăm sóc tiếp theo" value={customer.ngay_cham_soc_tiep_theo} />
                  {customer.ghi_chu && (
                    <div className="col-span-2">
                      <p className="text-ink-400">Ghi chú</p>
                      <p className="whitespace-pre-wrap text-navy-900">{customer.ghi_chu}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'van_de' && (
                <IssuesTab customerId={customer.id} issues={issues} suaDuoc={suaDuoc}
                  currentProfile={currentProfile} tenNguoi={tenNguoi} onChanged={load} />
              )}

              {tab === 'cham_soc' && (
                interactions.length === 0
                  ? <p className="text-sm text-ink-400">Chưa có lịch sử chăm sóc nào.</p>
                  : (
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
                                {tenNguoi(it.sale_id)} · {new Date(it.ngay_thuc_hien).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )
              )}

              {tab === 'nhat_ky' && (
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
              )}
            </>
          )}
        </div>

        {tab === 'cham_soc' && suaDuoc && (
          <AddInteraction customerId={customer.id} currentProfile={currentProfile}
            onAdded={() => { load(); onChanged?.() }} />
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-ink-400">{label}</p>
      <p className="font-medium text-navy-900">{value || '—'}</p>
    </div>
  )
}

function IssuesTab({ customerId, issues, suaDuoc, currentProfile, tenNguoi, onChanged }) {
  const [vanDe, setVanDe] = useState('')
  const [giaiPhap, setGiaiPhap] = useState('')
  const [saving, setSaving] = useState(false)

  async function them(e) {
    e.preventDefault()
    if (!vanDe.trim()) return
    setSaving(true)
    await supabase.from('customer_issues').insert({
      customer_id: customerId,
      van_de: vanDe.trim(),
      giai_phap: giaiPhap.trim() || null,
      created_by: currentProfile.id,
    })
    setSaving(false); setVanDe(''); setGiaiPhap(''); onChanged()
  }

  async function capNhat(id, patch) {
    await supabase.from('customer_issues')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    onChanged()
  }

  return (
    <div className="space-y-4">
      {issues.length === 0 && <p className="text-sm text-ink-400">Chưa ghi nhận vấn đề nào của khách.</p>}

      {issues.map((i) => (
        <div key={i.id} className="rounded-xl border border-slate-100 p-4">
          <div className="flex items-start gap-2">
            <CircleAlert size={16} className="mt-0.5 flex-none text-orange-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Vấn đề</p>
              <p className="text-sm text-navy-900">{i.van_de}</p>
            </div>
            {suaDuoc && (
              <button onClick={() => capNhat(i.id, { trang_thai: i.trang_thai === 'da_giai_quyet' ? 'dang_xu_ly' : 'da_giai_quyet' })}
                className={`flex-none rounded-lg px-2 py-1 text-xs ${
                  i.trang_thai === 'da_giai_quyet' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                {i.trang_thai === 'da_giai_quyet' ? <><Check size={11} className="mr-0.5 inline" />Đã xử lý</> : 'Đang xử lý'}
              </button>
            )}
          </div>

          <div className="mt-3 flex items-start gap-2 border-t border-slate-50 pt-3">
            <CircleCheck size={16} className="mt-0.5 flex-none text-teal-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Giải pháp</p>
              {suaDuoc ? (
                <textarea
                  defaultValue={i.giai_phap || ''}
                  placeholder="Nhập giải pháp tư vấn cho khách..."
                  rows={2}
                  onBlur={(e) => { if (e.target.value !== (i.giai_phap || '')) capNhat(i.id, { giai_phap: e.target.value || null }) }}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-coral-500"
                />
              ) : (
                <p className="text-sm text-navy-900">{i.giai_phap || 'Chưa có giải pháp'}</p>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs text-ink-400">
            {tenNguoi(i.created_by)} · {new Date(i.created_at).toLocaleDateString('vi-VN')}
          </p>
        </div>
      ))}

      {suaDuoc && (
        <form onSubmit={them} className="rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-sm font-medium text-navy-900">Thêm vấn đề mới</p>
          <Input placeholder="Vấn đề khách đang gặp..." value={vanDe}
            onChange={(e) => setVanDe(e.target.value)} className="mb-2 bg-white" />
          <Textarea placeholder="Giải pháp tư vấn (có thể bổ sung sau)..." rows={2} value={giaiPhap}
            onChange={(e) => setGiaiPhap(e.target.value)} className="bg-white" />
          <Button type="submit" disabled={saving} className="mt-2 w-full">
            <Plus size={15} /> {saving ? 'Đang lưu...' : 'Thêm vấn đề'}
          </Button>
        </form>
      )}
    </div>
  )
}

function AddInteraction({ customerId, currentProfile, onAdded }) {
  const [noiDung, setNoiDung] = useState('')
  const [loai, setLoai] = useState('goi_dien')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!noiDung.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customerId, sale_id: currentProfile?.id, loai, noi_dung: noiDung.trim(),
    })
    setSaving(false)
    if (!error) {
      setNoiDung('')
      await supabase.from('customers')
        .update({ ngay_lien_he_gan_nhat: new Date().toISOString().slice(0, 10) }).eq('id', customerId)
      onAdded()
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-100 px-6 py-4">
      <div className="mb-2">
        <Select value={loai} onChange={(e) => setLoai(e.target.value)} className="w-40">
          {LOAI_TUONG_TAC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <Textarea rows={2} placeholder="Ghi lại nội dung đã trao đổi với khách..."
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />
      <Button type="submit" disabled={saving} className="mt-2 w-full">
        <Plus size={15} /> Thêm vào lịch sử
      </Button>
    </form>
  )
}
