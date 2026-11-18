import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Phone, CalendarCheck, CalendarClock, CircleAlert, CircleCheck, RefreshCw, BarChart3 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { laQuanLy, nhanSuXemDuoc, locNhanSu } from '../lib/quyen'
import { Select, Badge } from './ui'
import CustomerDetail from './CustomerDetail'
import OrderForm from './OrderForm'
import BaoCaoAdsModal from './BaoCaoAdsModal'
import MucTieuNgay from './MucTieuNgay'
import { DICH_VU_OPTIONS, NGUON_KHACH_OPTIONS, classOf, labelOf } from '../lib/constants'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal, dinhDangNgay, moTaConLai, SO_NGAY_NHAC } from '../lib/taiKy'
import { moTaHanBaoCao, CHU_KY_BAO_CAO } from '../lib/baoCaoAds'
import { tinhNhacViec, tinhCanGoiLai, tinhFollowUpHomNay, SO_NGAY_GOI_LAI } from '../lib/nhacViec'

export default function ChecklistPage({ currentProfile, onDoiViec }) {
  const { tenTrangThai, classTrangThai, maDaChot, statuses } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSale, setFilterSale] = useState('')
  const [xemKhach, setXemKhach] = useState(null)
  const [hopDong, setHopDong] = useState([])
  const [don, setDon] = useState([])
  const [itemsDon, setItemsDon] = useState([])
  const [baoCao, setBaoCao] = useState([])
  const [logsDoiTT, setLogsDoiTT] = useState([])
  const [ghiBaoCao, setGhiBaoCao] = useState(null)   // dòng nhắc báo cáo ADS đang mở cửa sổ ghi nhận
  const [taiKy, setTaiKy] = useState(null)   // { khach, muc } đang mở form tái ký
  const [dangDong, setDangDong] = useState('')

  const isAdmin = laQuanLy(currentProfile)   // admin hoặc leader: xem được nhiều người
  const homNay = homNayLocal()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: p }, { data: hd }, { data: dn }, { data: it }, { data: bc }, { data: lg }] = await Promise.all([
      layHet(() => supabase.from('customers').select('*').order('ngay_cham_soc_tiep_theo').order('id')),
      supabase.from('profiles').select('id, full_name, role, phong_ban').order('full_name'),
      supabase.from('contracts').select('*').eq('trang_thai', 'hieu_luc'),
      supabase.from('orders').select('*').neq('trang_thai', 'huy'),
      layHet(() => supabase.from('order_items').select('order_id, ten_dich_vu').order('id')),
      supabase.from('ads_bao_cao').select('*'),   // chưa chạy SQL thì rỗng
      supabase.from('customer_logs').select('customer_id, hanh_dong, created_at').eq('hanh_dong', 'Đổi trạng thái').order('created_at', { ascending: false }).limit(5000),
    ])
    setCustomers(c || []); setProfiles(p || [])
    setHopDong(hd || []); setDon(dn || []); setItemsDon(it || []); setBaoCao(bc || []); setLogsDoiTT(lg || [])
    setLoading(false)
    onDoiViec?.()   // báo App cập nhật huy hiệu số việc cần nhắc
  }

  const uids = useMemo(() => nhanSuXemDuoc(currentProfile, profiles), [currentProfile, profiles])
  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'

  // Follow-up đến hạn: ngày dự kiến liên hệ lại là hôm nay, bỏ qua khách đã chốt/đang triển khai/hoàn thành
  const dungHomNay = useMemo(() => tinhFollowUpHomNay({
    khach: customers, maDaChot, isAdmin: uids === null, userId: currentProfile?.id, uids, homNay,
  }).filter((c) => !filterSale || c.sale_id === filterSale),
  [customers, homNay, uids, currentProfile?.id, filterSale, maDaChot])

  // Khách cần gọi lại: trạng thái đã gửi báo giá / hẹn đi đơn mà 7 ngày chưa liên hệ lại, chưa đổi trạng thái
  const canGoiLai = useMemo(() => tinhCanGoiLai({
    khach: customers, logs: logsDoiTT, statuses, isAdmin: uids === null, userId: currentProfile?.id, uids, homNay,
  }).filter((r) => !filterSale || r.saleId === filterSale),
  [customers, logsDoiTT, statuses, uids, currentProfile?.id, filterSale, homNay])

  // Việc cần nhắc: tái ký hợp đồng ADS + báo cáo chỉ số ADS (sale chỉ thấy của mình, admin thấy cả team)
  const { nhacBaoCao } = useMemo(() => {
    const r = tinhNhacViec({ khach: customers, hopDong, don, items: itemsDon, baoCao, isAdmin: uids === null, userId: currentProfile?.id, uids })
    const loc = (ds) => ds.filter((x) => !filterSale || x.saleId === filterSale)
    return { nhacBaoCao: loc(r.baoCaoAds) }
  }, [customers, hopDong, don, itemsDon, baoCao, uids, currentProfile?.id, filterSale])

  async function khongTaiKy(r) {
    if (!window.confirm(`Đánh dấu hợp đồng ${r.hd.so_hop_dong} của ${r.khach.ten_khach} là HẾT HẠN, khách không tái ký?\nNhắc tái ký sẽ biến mất.`)) return
    setDangDong(r.hd.id)
    const { error } = await supabase.from('contracts').update({ trang_thai: 'het_han' }).eq('id', r.hd.id)
    setDangDong('')
    if (error) { window.alert('Không cập nhật được: ' + error.message); return }
    load()
  }

  // Khách sắp tới hạn trong 3 ngày, để chuẩn bị trước
  const sapToi = useMemo(() => {
    const han = new Date(); han.setDate(han.getDate() + 3)
    const h = han.toISOString().slice(0, 10)
    return customers.filter((c) => {
      if (!c.ngay_cham_soc_tiep_theo) return false
      if (c.ngay_cham_soc_tiep_theo <= homNay || c.ngay_cham_soc_tiep_theo > h) return false
      if (maDaChot.includes(c.trang_thai_cham_soc)) return false
      if (uids ? !uids.has(c.sale_id) : false) return false
      if (filterSale && c.sale_id !== filterSale) return false
      return true
    })
  }, [customers, homNay, uids, currentProfile?.id, filterSale, maDaChot])

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Checklist hôm nay</h1>
          <p className="text-sm text-ink-600">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
            {' · '}{uids === null ? 'toàn công ty' : isAdmin ? `team ${currentProfile?.phong_ban || ''}` : 'khách của bạn'}
          </p>
        </div>
        {isAdmin && (
          <Select value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-48">
            <option value="">Tất cả sale</option>
            {locNhanSu(currentProfile, profiles).filter((p) => p.role !== 'admin').map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        )}
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-4 p-8">
          <MucTieuNgay currentProfile={currentProfile} customers={customers} onMoKhach={setXemKhach} />

          {nhacBaoCao.length > 0 && (
            <NhacBaoCaoAds ds={nhacBaoCao} tenSale={tenSale} onMoKhach={setXemKhach} onGhi={(r) => setGhiBaoCao(r)} />
          )}

          {dungHomNay.length > 0 ? (
            <Nhom
              icon={CalendarCheck} mau="coral"
              tieuDe={`Follow-up đến hạn (${dungHomNay.length})`}
              moTa="Đến ngày dự kiến liên hệ lại"
              ds={dungHomNay} homNay={homNay} tenSale={tenSale} onOpen={setXemKhach}
              tenTrangThai={tenTrangThai} classTrangThai={classTrangThai}
            />
          ) : (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <CircleCheck size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-display font-semibold text-navy-900">Không có khách đến hạn follow-up hôm nay</p>
              <p className="mt-1 text-sm text-ink-600">Nhớ đặt ngày chăm sóc tiếp theo khi ghi trao đổi để không bỏ sót khách.</p>
            </div>
          )}

          {canGoiLai.length > 0 && (
            <KhachCanGoiLai ds={canGoiLai} tenSale={tenSale} onOpen={setXemKhach}
              tenTrangThai={tenTrangThai} classTrangThai={classTrangThai} />
          )}

          {sapToi.length > 0 && (
            <Nhom
              icon={CalendarClock} mau="slate"
              tieuDe={`Sắp tới trong 3 ngày (${sapToi.length})`}
              moTa="Chưa đến hạn, xem trước để chuẩn bị"
              ds={sapToi} homNay={homNay} tenSale={tenSale} onOpen={setXemKhach}
              tenTrangThai={tenTrangThai} classTrangThai={classTrangThai}
            />
          )}
        </div>
      )}

      {ghiBaoCao && (
        <BaoCaoAdsModal
          hd={ghiBaoCao.hd}
          khach={ghiBaoCao.khach}
          lanThu={ghiBaoCao.lanThu}
          currentProfile={currentProfile}
          onClose={() => setGhiBaoCao(null)}
          onSaved={() => { setGhiBaoCao(null); load() }}
        />
      )}

      {taiKy && (
        <OrderForm
          customer={taiKy.khach}
          profiles={profiles}
          currentProfile={currentProfile}
          loaiBanDau="tai_ky"
          taiKyHopDongId={taiKy.hd.id}
          saoChepTuDonId={taiKy.donGanNhat?.id}
          onClose={() => setTaiKy(null)}
          onSaved={() => { setTaiKy(null); load() }}
        />
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

// Khách cần gọi lại: trạng thái báo giá / hẹn đi đơn, đã nhiều ngày chưa liên hệ lại
function KhachCanGoiLai({ ds, tenSale, onOpen, tenTrangThai, classTrangThai }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Phone size={18} className="text-rose-500" />
        <h2 className="font-display font-semibold text-navy-900">Khách cần gọi lại ({ds.length})</h2>
        <span className="text-xs text-ink-400">· đang ở trạng thái đã gửi báo giá / hẹn đi đơn mà {SO_NGAY_GOI_LAI} ngày chưa liên hệ lại hoặc đổi trạng thái</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-sm font-semibold text-navy-900">
              <th className="border border-slate-200 px-4 py-2.5">Khách hàng</th>
              <th className="border border-slate-200 px-4 py-2.5">Điện thoại</th>
              <th className="border border-slate-200 px-4 py-2.5">Trạng thái</th>
              <th className="border border-slate-200 px-4 py-2.5">Chưa liên hệ</th>
              <th className="border border-slate-200 px-4 py-2.5">Sale</th>
              <th className="border border-slate-200 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ds.map((r) => (
              <tr key={r.khach.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(r.khach)}>
                <td className="border border-slate-200 px-4 py-2.5">
                  <p className="font-medium text-navy-900">{r.khach.ten_khach}</p>
                  <p className="text-xs text-ink-400">{r.khach.ma_khach}</p>
                </td>
                <td className="border border-slate-200 px-4 py-2.5 text-ink-600">{r.khach.sdt || '—'}</td>
                <td className="border border-slate-200 px-4 py-2.5">
                  <Badge className={classTrangThai(r.khach.trang_thai_cham_soc)}>{tenTrangThai(r.khach.trang_thai_cham_soc)}</Badge>
                </td>
                <td className="border border-slate-200 px-4 py-2.5">
                  <Badge className="bg-rose-100 text-rose-600">{r.soNgay} ngày</Badge>
                  <p className="mt-0.5 text-xs text-ink-400">từ {dinhDangNgay(r.moc)}</p>
                </td>
                <td className="border border-slate-200 px-4 py-2.5 text-ink-600">{tenSale(r.saleId)}</td>
                <td className="whitespace-nowrap border border-slate-200 px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <a href={r.khach.sdt ? `tel:${r.khach.sdt}` : undefined}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      r.khach.sdt ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'text-ink-400'}`}>
                    <Phone size={13} /> Gọi
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-400">Khách sẽ biến mất khỏi danh sách khi bạn ghi trao đổi mới hoặc đổi trạng thái.</p>
    </div>
  )
}

// Nhắc báo cáo chỉ số ADS cho khách (cứ 2 tuần 1 lần sau khi ký hợp đồng)
function NhacBaoCaoAds({ ds, tenSale, onMoKhach, onGhi }) {
  const mau = {
    qua_han: 'bg-rose-100 text-rose-600',
    hom_nay: 'bg-coral-50 text-coral-600',
    sap_toi: 'bg-amber-100 text-amber-700',
  }
  const soTre = ds.filter((r) => r.muc === 'qua_han').length
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BarChart3 size={18} className={soTre > 0 ? 'text-rose-500' : 'text-violet-600'} />
        <h2 className="font-display font-semibold text-navy-900">Nhắc báo cáo chỉ số ADS ({ds.length})</h2>
        <span className="text-xs text-ink-400">· cứ {CHU_KY_BAO_CAO} ngày (2 tuần) báo cáo chỉ số cho khách 1 lần</span>
      </div>

      <div className="space-y-2">
        {ds.map((r) => (
          <div key={r.hd.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onMoKhach(r.khach)}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-navy-900">{r.khach.ten_khach}</p>
                <span className="text-xs text-ink-400">{r.khach.ma_khach}</span>
                <Badge className={mau[r.muc]}>{moTaHanBaoCao(r.conLai)}</Badge>
                <Badge className="bg-violet-100 text-violet-700">Báo cáo lần {r.lanThu}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                <span>{r.hd.so_hop_dong}</span>
                {r.hd.ten_goi && <><span className="text-ink-400">·</span><span>{r.hd.ten_goi}</span></>}
                <span className="text-ink-400">·</span>
                <span>Hạn báo cáo <b className="text-navy-900">{dinhDangNgay(r.ngayDenHan)}</b></span>
                <span className="text-ink-400">·</span>
                <span>{r.lanCuoi ? `Lần gần nhất ${dinhDangNgay(r.lanCuoi)}` : 'Chưa báo cáo lần nào'}</span>
                <span className="text-ink-400">·</span>
                <span>{tenSale(r.saleId)}</span>
              </div>
            </div>

            <div className="flex flex-none items-center gap-2">
              <a href={r.khach.sdt ? `tel:${r.khach.sdt}` : undefined}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  r.khach.sdt ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'text-ink-400'
                }`}>
                <Phone size={13} /> Gọi
              </a>
              <button type="button" onClick={() => onGhi(r)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700">
                <CircleCheck size={13} /> Đã báo cáo
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        Bấm "Đã báo cáo" sau khi gửi chỉ số cho khách — nhắc biến mất và tự hẹn lần kế tiếp sau 2 tuần. Chỉ nhắc trong thời gian hợp đồng còn hiệu lực.
      </p>
    </div>
  )
}

function Nhom({ icon: Icon, mau, tieuDe, moTa, ds, homNay, tenSale, onOpen, tenTrangThai, classTrangThai }) {
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
                  <span>{tenSale(c.sale_id)}</span>
                </div>
              </div>

              <Badge className={classTrangThai(c.trang_thai_cham_soc)}>
                {tenTrangThai(c.trang_thai_cham_soc)}
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
