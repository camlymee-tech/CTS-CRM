// Hồ sơ khách (cửa sổ mở từ danh sách Khách hàng): cột trái tóm tắt khách, cột phải các tab.
// Nội dung từng tab nằm trong thư mục hoSoKhach/.
import { useEffect, useState } from 'react'
import { X, Phone, Plus, Link2, Store, HandHeart } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { layNhanSu } from '../lib/nhanSu'
import { loiDeHieu } from '../lib/loi'
import { laAdmin, laLeader } from '../lib/quyen'
import { Button, Select, Badge } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import OrderForm from './OrderForm'
import DanhSachBaoGia from './DanhSachBaoGia'
import { BaoGiaEditor } from './BaoGiaPage'
import { goiQuaCallio } from '../lib/callioExtension'
import { ngayLocal } from '../lib/ngay'
import { formatVnd } from '../lib/constants'
import TabThongTin, { Field } from './hoSoKhach/TabThongTin'
import { DanhSachChamSoc, AddInteraction } from './hoSoKhach/TabChamSoc'
import NhatKyCuocGoi, { XacNhanGoi } from './hoSoKhach/TabCuocGoi'
import { goiHamCallio } from '../lib/callio'
import TabNhatKy from './hoSoKhach/TabNhatKy'

export default function CustomerDetail({ customer: khachBanDau, currentProfile, onClose, onChanged }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung, maTaoDon } = useTrangThai()
  const [customer, setCustomer] = useState(khachBanDau)
  const [tab, setTab] = useState('thong_tin')
  const [baoGiaMo, setBaoGiaMo] = useState(null)   // null = đóng · {} = báo giá mới · {…} = mở báo giá đã lưu
  const [lamMoiBG, setLamMoiBG] = useState(0)
  const [demBG, setDemBG] = useState(0)
  useEffect(() => {
    supabase.from('bao_gia').select('id', { count: 'exact', head: true }).eq('customer_id', khachBanDau.id).then(({ count }) => setDemBG(count || 0))
  }, [khachBanDau.id, lamMoiBG])
  const [interactions, setInteractions] = useState([])
  const [logs, setLogs] = useState([])
  // Nhật ký cuộc gọi lấy thẳng từ Callio (qua hàm máy chủ "callio"), tải ngay khi mở hồ sơ để tab hiện số cuộc
  const [cuocGoi, setCuocGoi] = useState(null)   // null = chưa tải
  const [loiGoi, setLoiGoi] = useState(null)     // { text, code }
  const [dangTaiGoi, setDangTaiGoi] = useState(false)
  async function taiCuocGoi() {
    setDangTaiGoi(true); setLoiGoi(null)
    const { data, error } = await goiHamCallio({ action: 'list', customer_id: khachBanDau.id })
    setDangTaiGoi(false)
    if (error) { setLoiGoi(error); setCuocGoi([]); return }
    setCuocGoi(data.calls || [])
  }
  const [donHang, setDonHang] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [donMoi, setDonMoi] = useState(false)

  const cuaMinh = customer.sale_id === currentProfile?.id
  const chung = laKhachChung(customer)
  const isAdmin = laAdmin(currentProfile)
  const [hoiGoi, setHoiGoi] = useState(false)   // hộp xác nhận trước khi gọi qua Callio
  // Leader sửa được khách của sale cùng phòng ban
  const cuaTeam = laLeader(currentProfile) && !!currentProfile.phong_ban &&
    profiles.find((p) => p.id === customer.sale_id)?.phong_ban === currentProfile.phong_ban
  const suaDuoc = cuaMinh || cuaTeam || isAdmin || chung || !customer.sale_id

  // oxlint-disable-next-line react-hooks/exhaustive-deps, react/set-state-in-effect -- tải lại khi mở hồ sơ khác
  useEffect(() => { load() }, [customer.id])
  // Tải cuộc gọi luôn khi mở hồ sơ (không chờ bấm tab) để tab hiện ngay số cuộc; cuocGoi về null (đổi SĐT) thì tải lại
  useEffect(() => {
    if (cuocGoi !== null || dangTaiGoi) return
    // oxlint-disable-next-line react/set-state-in-effect -- khách không có SĐT: ghi nhận "0 cuộc" ngay
    if (!customer.sdt) { setCuocGoi([]); return }
    taiCuocGoi()
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi cuocGoi đổi
  }, [cuocGoi])

  async function load() {
    setLoading(true)
    const [{ data: it }, { data: lg }, { data: pf }, { data: od }] = await Promise.all([
      supabase.from('customer_interactions').select('*').eq('customer_id', customer.id)
        .order('ngay_thuc_hien', { ascending: false }),
      supabase.from('customer_logs').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }).limit(50),
      layNhanSu(),
      supabase.from('orders').select('*').eq('customer_id', customer.id).order('ngay_chot', { ascending: false }),
    ])
    setInteractions(it || []); setLogs(lg || []); setProfiles(pf || [])
    setDonHang(od || [])
    setLoading(false)
  }

  const tenNguoi = (id) => profiles.find((p) => p.id === id)?.full_name || 'Không rõ'

  async function nhanKhach() {
    if (!window.confirm(`Nhận ${customer.ten_khach} về phụ trách? Sale cũ sẽ không còn thấy khách này trong danh sách riêng.`)) return
    const { error } = await supabase.from('customers')
      .update({ sale_id: currentProfile.id }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + loiDeHieu(error)); return }
    setCustomer({ ...customer, sale_id: currentProfile.id })
    setMsg('')
    load(); onChanged?.()
  }

  async function xoaTuongTac(it) {
    if (!window.confirm('Xoá dòng lịch sử chăm sóc này?')) return
    const { error } = await supabase.from('customer_interactions').delete().eq('id', it.id)
    if (error) { setMsg('Không xoá được: ' + loiDeHieu(error)); return }
    setMsg(''); load(); onChanged?.()
  }

  async function doiTrangThai(tt) {
    const truoc = customer.trang_thai_cham_soc
    const { error } = await supabase.from('customers')
      .update({ trang_thai_cham_soc: tt }).eq('id', customer.id)
    if (error) { setMsg('Lỗi: ' + loiDeHieu(error)); return }
    const moi = { ...customer, trang_thai_cham_soc: tt }
    setCustomer(moi)
    load(); onChanged?.()

    // Vừa chuyển sang Chốt hợp đồng -> mở form tạo đơn dịch vụ ngay tại đây
    if (maTaoDon.includes(tt) && !maTaoDon.includes(truoc)) {
      setDonMoi(true)
    }
  }

  const tongGiaTriDon = donHang.reduce((s, o) => s + (Number(o.gia_tri) || 0), 0)

  // Form gộp toàn bộ thông tin khách hàng có thể sửa — 1 nút Lưu duy nhất, không cần mở form riêng
  const [formTT, setFormTT] = useState({
    ten_khach: customer.ten_khach || '',
    sdt: customer.sdt || '',
    link_fb: customer.link_fb || '',
    link_shop: customer.link_shop || '',
    nen_tang: customer.nen_tang || [],
    dich_vu: customer.dich_vu || [],
    nganh_hang: customer.nganh_hang || '',
    khu_vuc: customer.khu_vuc || '',
    nguon_khach: customer.nguon_khach || '',
    loai_khach: customer.loai_khach || '',
    sale_id: customer.sale_id || '',
    ngay_cham_soc_tiep_theo: customer.ngay_cham_soc_tiep_theo || '',
    ten_tieu_de_bena: customer.ten_tieu_de_bena || '',
    nguoi_dai_dien: customer.nguoi_dai_dien || '',
    chuc_vu: customer.chuc_vu || '',
    mst: customer.mst || '',
    dia_chi: customer.dia_chi || '',
    so_tai_khoan: customer.so_tai_khoan || '',
  })
  const [dangLuuTT, setDangLuuTT] = useState(false)
  const [luuXongTT, setLuuXongTT] = useState('')

  async function luuThongTin(e) {
    e.preventDefault()
    setDangLuuTT(true)
    const patch = { ...formTT }
    for (const k of Object.keys(patch)) {
      if (!Array.isArray(patch[k]) && patch[k] === '') patch[k] = null
    }
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
    setDangLuuTT(false)
    if (error) {
      setMsg(error.message.includes('SDT_TRUNG')
        ? 'Số điện thoại này đã thuộc về một khách hàng khác trong hệ thống.'
        : 'Không lưu được: ' + loiDeHieu(error))
      return
    }
    setMsg('')
    setCustomer((c) => ({ ...c, ...patch }))
    if ('sdt' in patch && patch.sdt !== customer.sdt) setCuocGoi(null)   // đổi số điện thoại → tải lại cuộc gọi
    setLuuXongTT('Đã lưu')
    setTimeout(() => setLuuXongTT(''), 1500)
    onChanged?.()
  }

  const TABS = [
    { key: 'thong_tin', label: 'Thông tin' },
    { key: 'cham_soc', label: `Chăm sóc (${interactions.length})` },
    { key: 'cuoc_goi', label: dangTaiGoi ? 'Cuộc gọi (…)' : cuocGoi && !loiGoi ? `Cuộc gọi (${cuocGoi.length})` : 'Cuộc gọi' },
    { key: 'bao_gia', label: `Báo giá (${demBG})` },
    { key: 'nhat_ky', label: 'Nhật ký' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/45 p-4">
      {hoiGoi && (
        <XacNhanGoi ten={customer.ten_khach} sdt={customer.sdt}
          onHuy={() => setHoiGoi(false)}
          onGoi={() => {
            setHoiGoi(false)
            if (!goiQuaCallio(customer.sdt)) window.location.href = `tel:${customer.sdt}`
          }} />
      )}
      <div className="relative grid h-full max-h-[920px] w-full max-w-6xl grid-cols-1 overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-2xl sm:grid-cols-[280px_1fr] sm:overflow-hidden">
        {/* Nút đóng: luôn ở góc phải trên của popup */}
        <button type="button" onClick={onClose} title="Đóng"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-600 transition hover:bg-rose-100 hover:text-rose-600">
          <X size={20} />
        </button>

        {/* CỘT TRÁI — tóm tắt khách hàng */}
        <div className="flex flex-col overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-coral-100 font-display text-lg font-bold text-coral-600">
              {(customer.ten_khach || '?').trim().charAt(0).toUpperCase()}
            </div>
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-400">{customer.ma_khach}</p>
          <h2 className="font-display text-lg font-bold leading-tight text-navy-900">{customer.ten_khach}</h2>

          <div className="mt-2 flex flex-col gap-1.5 text-sm">
            {customer.sdt && (
              <button type="button" title="Bấm để gọi cho khách"
                onClick={() => setHoiGoi(true)}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-teal-200 bg-teal-50 py-1 pl-1 pr-2.5 font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500 text-white">
                  <Phone size={13} />
                </span>
                {customer.sdt}
              </button>
            )}
            {customer.link_fb && (
              <a href={customer.link_fb} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-500 hover:underline">
                <Link2 size={13} /> Facebook
              </a>
            )}
            {customer.link_shop && (
              <a href={customer.link_shop} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-500 hover:underline">
                <Store size={13} /> Link shop
              </a>
            )}
          </div>

          <div className="mt-3">
            {suaDuoc ? (
              <Select value={customer.trang_thai_cham_soc} onChange={(e) => doiTrangThai(e.target.value)}
                className="w-full py-1.5 text-sm">
                {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
              </Select>
            ) : (
              <Badge className={classTrangThai(customer.trang_thai_cham_soc)}>
                {tenTrangThai(customer.trang_thai_cham_soc)}
              </Badge>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs text-ink-400">Sale phụ trách</p>
            <p className="text-sm font-medium text-navy-900">{tenNguoi(customer.sale_id)}</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <StatTile label="Liên hệ gần nhất" value={customer.ngay_lien_he_gan_nhat || '—'} />
            <StatTile label="Lượt chăm sóc" value={interactions.length} />
            <StatTile label="Giá trị đơn" value={formatVnd(tongGiaTriDon)} small />
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <Field label="Ngày tạo" value={ngayLocal(customer.created_at)} />
          </div>

          {chung && !cuaMinh && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-800">
                Data chung — hiện do <b>{tenNguoi(customer.sale_id)}</b> phụ trách
              </p>
              <Button onClick={nhanKhach} className="mt-2 w-full px-3 py-1.5 text-xs">
                <HandHeart size={14} /> Nhận khách
              </Button>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
        </div>

        {/* CỘT PHẢI — tab nội dung */}
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex gap-1 border-b border-slate-100 pl-6 pr-14 pt-4">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
            <>
              {tab === 'thong_tin' && (
                <TabThongTin customer={customer} suaDuoc={suaDuoc} formTT={formTT} setFormTT={setFormTT}
                  onLuu={luuThongTin} dangLuuTT={dangLuuTT} luuXongTT={luuXongTT}
                  currentProfile={currentProfile} profiles={profiles} />
              )}

              {tab === 'bao_gia' && (
                <div className="space-y-3">
                  {suaDuoc && (
                    <button type="button" onClick={() => setBaoGiaMo({})}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-coral-300 px-3 py-2 text-sm font-medium text-coral-600 hover:bg-coral-50">
                      <Plus size={15} /> Tạo báo giá mới
                    </button>
                  )}
                  <DanhSachBaoGia customerId={customer.id} currentProfile={currentProfile} lamMoi={lamMoiBG}
                    onDem={setDemBG} onMo={(b) => setBaoGiaMo(b)} />
                </div>
              )}

              {tab === 'cham_soc' && (
                <DanhSachChamSoc interactions={interactions} tenNguoi={tenNguoi} onXoa={xoaTuongTac}
                  xoaDuoc={(it) => it.sale_id === currentProfile?.id || isAdmin || cuaTeam} />
              )}

              {tab === 'cuoc_goi' && (
                <NhatKyCuocGoi ds={cuocGoi || []} dangTai={dangTaiGoi || cuocGoi === null} loi={loiGoi}
                  onTaiLai={taiCuocGoi} customerId={customer.id} tenNguoi={tenNguoi} />
              )}

              {tab === 'nhat_ky' && <TabNhatKy logs={logs} tenNguoi={tenNguoi} />}
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

      {baoGiaMo && (
        <div className="fixed inset-0 z-50 flex bg-navy-950/50 p-4">
          <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <BaoGiaEditor khachCo={customer} baoGiaMo={baoGiaMo.id ? baoGiaMo : null} currentProfile={currentProfile}
              onSaved={() => setLamMoiBG((n) => n + 1)} onClose={() => setBaoGiaMo(null)} />
          </div>
        </div>
      )}

      {donMoi && (
        <OrderForm
          customer={customer}
          profiles={profiles}
          currentProfile={currentProfile}
          onClose={() => setDonMoi(false)}
          onSaved={() => { setDonMoi(false); load(); onChanged?.() }}
        />
      )}
    </div>
  )
}

function StatTile({ label, value, small }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-1.5 py-2">
      <p className={`font-display font-bold text-navy-900 ${small ? 'text-xs' : 'text-sm'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink-400">{label}</p>
    </div>
  )
}
