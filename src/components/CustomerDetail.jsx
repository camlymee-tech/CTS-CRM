import { useEffect, useState } from 'react'
import {
  X, Phone, MessageCircle, Users as UsersIcon, MoreHorizontal, Plus, Pencil,
  Link2, Store, HandHeart, CircleAlert, CircleCheck, History, Check, Trash2, CalendarClock, FileText, ShoppingBag,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Textarea, Select, Badge, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import {
  LOAI_TUONG_TAC_OPTIONS, NEN_TANG_OPTIONS,
  DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, LOAI_KHACH_OPTIONS,
  TRANG_THAI_HD_OPTIONS,
  classOf, labelOf, formatVnd,
} from '../lib/constants'

const ICONS = { goi_dien: Phone, nhan_tin: MessageCircle, gap_mat: UsersIcon, khac: MoreHorizontal }



export default function CustomerDetail({ customer: khachBanDau, currentProfile, onClose, onChanged, onEdit, onChotDon }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung, maTaoDon } = useTrangThai()
  const [customer, setCustomer] = useState(khachBanDau)
  const [tab, setTab] = useState('thong_tin')
  const [interactions, setInteractions] = useState([])
  const [logs, setLogs] = useState([])
  const [donHang, setDonHang] = useState([])
  const [hopDong, setHopDong] = useState([])
  const [dvTheoDon, setDvTheoDon] = useState({})
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
    const [{ data: it }, { data: lg }, { data: pf }, { data: od }, { data: ct }] = await Promise.all([
      supabase.from('customer_interactions').select('*').eq('customer_id', customer.id)
        .order('ngay_thuc_hien', { ascending: false }),
      supabase.from('customer_logs').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('orders').select('*').eq('customer_id', customer.id).order('ngay_chot', { ascending: false }),
      supabase.from('contracts').select('*').eq('customer_id', customer.id).order('ngay_ky', { ascending: false }),
    ])
    setInteractions(it || []); setLogs(lg || []); setProfiles(pf || [])
    setDonHang(od || []); setHopDong(ct || [])

    const ids = (od || []).map((o) => o.id)
    if (ids.length) {
      const { data: dv } = await supabase.from('order_items').select('*').in('order_id', ids)
      const g = {}
      for (const i of dv || []) g[i.order_id] = [...(g[i.order_id] || []), i]
      setDvTheoDon(g)
    } else setDvTheoDon({})
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

  async function xoaTuongTac(it) {
    if (!window.confirm('Xoá dòng lịch sử chăm sóc này?')) return
    const { error } = await supabase.from('customer_interactions').delete().eq('id', it.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    setMsg(''); load(); onChanged?.()
  }

  async function doiTrangThai(tt) {
    const truoc = customer.trang_thai_cham_soc
    const { error } = await supabase.from('customers')
      .update({ trang_thai_cham_soc: tt }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    const moi = { ...customer, trang_thai_cham_soc: tt }
    setCustomer(moi)
    load(); onChanged?.()

    // Vừa chuyển sang Chốt hợp đồng -> sang tạo đơn dịch vụ luôn
    if (maTaoDon.includes(tt) && !maTaoDon.includes(truoc)) {
      onChotDon?.(moi)
    }
  }

  const TABS = [
    { key: 'thong_tin', label: 'Thông tin' },
    { key: 'don_hd', label: `Đơn & HĐ (${donHang.length})` },
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
                {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
              </Select>
            ) : (
              <Badge className={classTrangThai(customer.trang_thai_cham_soc)}>
                {tenTrangThai(customer.trang_thai_cham_soc)}
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
                <div className="space-y-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Field label="Số điện thoại" value={customer.sdt} />
                  <Field label="Ngành hàng" value={customer.nganh_hang} />
                  <Field label="Nguồn khách" value={labelOf(NGUON_KHACH_OPTIONS, customer.nguon_khach)} />
                  <Field label="Loại khách" value={labelOf(LOAI_KHACH_OPTIONS, customer.loai_khach)} />
                  <Field label="Sale phụ trách" value={tenNguoi(customer.sale_id)} />
                  <Field label="Ngày tạo" value={(customer.created_at || '').slice(0, 10)} />
                  <Field label="Liên hệ gần nhất" value={customer.ngay_lien_he_gan_nhat} />
                  <Field label="Chăm sóc tiếp theo" value={customer.ngay_cham_soc_tiep_theo} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Thông tin pháp lý (dùng khi lên hợp đồng)
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Field label="Người đại diện" value={customer.nguoi_dai_dien} />
                    <Field label="Chức vụ" value={customer.chuc_vu} />
                    <Field label="Mã số thuế" value={customer.mst} />
                    <Field label="Email" value={customer.email} />
                    <div className="col-span-2"><Field label="Địa chỉ" value={customer.dia_chi} /></div>
                  </div>
                </div>

                <VanDeGiaiPhap customer={customer} suaDuoc={suaDuoc}
                  onSaved={(patch) => setCustomer({ ...customer, ...patch })} />
                </div>
              )}

              {tab === 'don_hd' && (
                donHang.length === 0
                  ? <p className="text-sm text-ink-400">
                      Khách chưa có đơn dịch vụ nào. Chuyển trạng thái sang "Chốt hợp đồng" để tạo đơn.
                    </p>
                  : (
                    <div className="space-y-3">
                      {donHang.map((o) => {
                        const hd = hopDong.find((h) => h.order_id === o.id)
                        return (
                          <div key={o.id} className="rounded-xl border border-slate-100 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <ShoppingBag size={14} className="text-coral-500" />
                                  <p className="font-medium text-navy-900">{o.ma_don}</p>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {(dvTheoDon[o.id] || []).map((i) => (
                                    <Badge key={i.id} className="bg-slate-100 text-slate-600">
                                      {i.ten_dich_vu}{i.ten_goi ? ` · ${i.ten_goi}` : ''} · {formatVnd(i.gia)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <p className="flex-none font-display font-bold text-coral-500">{formatVnd(o.gia_tri)}</p>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-50 pt-3 text-xs text-ink-600">
                              <span>Chốt: <b className="text-navy-900">{o.ngay_chot || '—'}</b></span>
                              {o.so_thang && <span>Thời hạn: <b className="text-navy-900">{o.so_thang} tháng</b></span>}
                              {hd && (
                                <>
                                  <span className="inline-flex items-center gap-1">
                                    <FileText size={12} className="text-teal-500" />
                                    <b className="text-navy-900">{hd.so_hop_dong}</b>
                                  </span>
                                  <Badge className={classOf(TRANG_THAI_HD_OPTIONS, hd.trang_thai)}>
                                    {labelOf(TRANG_THAI_HD_OPTIONS, hd.trang_thai)}
                                  </Badge>
                                  {hd.ngay_het_han && <span>Hết hạn: <b className="text-navy-900">{hd.ngay_het_han}</b></span>}
                                  {hd.file_url && (
                                    <a href={hd.file_url} target="_blank" rel="noreferrer"
                                      className="text-teal-500 hover:underline">Mở file</a>
                                  )}
                                </>
                              )}
                            </div>
                            {o.ghi_chu && <p className="mt-2 text-xs text-ink-600">{o.ghi_chu}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )
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
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-navy-900">{it.noi_dung}</p>
                              <p className="mt-0.5 text-xs text-ink-400">
                                {tenNguoi(it.sale_id)} · {new Date(it.ngay_thuc_hien).toLocaleString('vi-VN')}
                              </p>
                            </div>
                            {(it.sale_id === currentProfile?.id || isAdmin) && (
                              <button onClick={() => xoaTuongTac(it)}
                                className="flex-none text-ink-400 hover:text-rose-500" title="Xoá">
                                <Trash2 size={14} />
                              </button>
                            )}
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
            ngayHen={customer.ngay_cham_soc_tiep_theo}
            onAdded={(ngayMoi) => {
              if (ngayMoi !== undefined) setCustomer({ ...customer, ngay_cham_soc_tiep_theo: ngayMoi })
              load(); onChanged?.()
            }} />
        )}
      </div>
    </div>
  )
}

function VanDeGiaiPhap({ customer, suaDuoc, onSaved }) {
  const [vanDe, setVanDe] = useState(customer.van_de || '')
  const [giaiPhap, setGiaiPhap] = useState(customer.giai_phap || '')
  const [goiTuVan, setGoiTuVan] = useState(customer.goi_tu_van || '')
  const [luu, setLuu] = useState('')

  async function ghi(patch) {
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
    if (!error) {
      onSaved(patch)
      setLuu('Đã lưu')
      setTimeout(() => setLuu(''), 1500)
    }
  }

  if (!suaDuoc) {
    return (
      <div className="space-y-3">
        <O nhan="Vấn đề" giaTri={customer.van_de} />
        <O nhan="Giải pháp" giaTri={customer.giai_phap} />
        <O nhan="Gói tư vấn phù hợp" giaTri={customer.goi_tu_van} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold text-navy-900">Vấn đề &amp; giải pháp</p>
        {luu && <span className="text-xs text-emerald-600">{luu}</span>}
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">VẤN ĐỀ</span>
        <textarea rows={3} defaultValue={vanDe} placeholder="Vấn đề khách đang gặp..."
          onBlur={(e) => { if (e.target.value !== (customer.van_de || '')) ghi({ van_de: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">GIẢI PHÁP</span>
        <textarea rows={5} defaultValue={giaiPhap} placeholder="Giải pháp tư vấn cho khách..."
          onBlur={(e) => { if (e.target.value !== (customer.giai_phap || '')) ghi({ giai_phap: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-400">GÓI TƯ VẤN PHÙ HỢP</span>
        <textarea rows={2} defaultValue={goiTuVan} placeholder="VD: Gói Chạy quảng cáo Pro 3 tháng + Xây shop VIP 1..."
          onBlur={(e) => { if (e.target.value !== (customer.goi_tu_van || '')) ghi({ goi_tu_van: e.target.value || null }) }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      <p className="text-xs text-ink-400">Tự lưu khi bạn bấm ra ngoài ô.</p>
    </div>
  )
}

function O({ nhan, giaTri }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-400">{nhan}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-900">{giaTri || '—'}</p>
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

function AddInteraction({ customerId, currentProfile, ngayHen, onAdded }) {
  const [noiDung, setNoiDung] = useState('')
  const [loai, setLoai] = useState('goi_dien')
  const [ngayTiepTheo, setNgayTiepTheo] = useState('')
  const [saving, setSaving] = useState(false)

  function congNgay(n) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    setNgayTiepTheo(d.toISOString().slice(0, 10))
  }

  async function submit(e) {
    e.preventDefault()
    if (!noiDung.trim()) return
    setSaving(true)
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customerId, sale_id: currentProfile?.id, loai, noi_dung: noiDung.trim(),
    })
    if (error) { setSaving(false); return }

    const patch = { ngay_lien_he_gan_nhat: new Date().toISOString().slice(0, 10) }
    if (ngayTiepTheo) patch.ngay_cham_soc_tiep_theo = ngayTiepTheo
    await supabase.from('customers').update(patch).eq('id', customerId)

    setSaving(false)
    setNoiDung('')
    setNgayTiepTheo('')
    onAdded(ngayTiepTheo || undefined)
  }

  const NHANH = [
    { label: 'Mai', ngay: 1 },
    { label: '3 ngày', ngay: 3 },
    { label: '1 tuần', ngay: 7 },
    { label: '2 tuần', ngay: 14 },
  ]

  return (
    <form onSubmit={submit} className="border-t border-slate-100 px-6 py-4">
      <div className="mb-2">
        <Select value={loai} onChange={(e) => setLoai(e.target.value)} className="w-40">
          {LOAI_TUONG_TAC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <Textarea rows={2} placeholder="Ghi lại nội dung đã trao đổi với khách..."
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-navy-900">
          <CalendarClock size={15} className="text-coral-500" />
          Hẹn chăm sóc lại
          {ngayHen && !ngayTiepTheo && (
            <span className="font-normal text-ink-400">· đang hẹn {ngayHen}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {NHANH.map((n) => (
            <button type="button" key={n.ngay} onClick={() => congNgay(n.ngay)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-ink-600 hover:border-coral-500 hover:text-coral-500">
              {n.label}
            </button>
          ))}
          <input type="date" value={ngayTiepTheo} onChange={(e) => setNgayTiepTheo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-coral-500" />
          {ngayTiepTheo && (
            <button type="button" onClick={() => setNgayTiepTheo('')}
              className="text-xs text-ink-400 hover:text-rose-500">Bỏ chọn</button>
          )}
        </div>
      </div>

      <Button type="submit" disabled={saving} className="mt-3 w-full">
        <Plus size={15} /> {saving ? 'Đang lưu...' : 'Lưu chăm sóc' + (ngayTiepTheo ? ' & đặt lịch hẹn' : '')}
      </Button>
    </form>
  )
}
