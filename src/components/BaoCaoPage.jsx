// Trang Báo cáo: bộ lọc + hiển thị. Toàn bộ số liệu tính trong lib/baoCao.js (tinhBaoCao, duLieuExcel).
import { layHet } from '../lib/layHet'
import { useEffect, useMemo, useState } from 'react'
import { Download, Users, Trophy, PhoneCall, Hourglass, MessageCircle, UserPlus, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { layNhanSu } from '../lib/nhanSu'
import { Select, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { homNayLocal } from '../lib/ngay'
import { SO_NGAY_GOI_LAI } from '../lib/nhacViec'
import { hienPt2 } from '../lib/dashboardXlsx'
import { xuatBangXlsx } from '../lib/baoCaoXlsx'
import { laAdmin, laQuanLy, laSale } from '../lib/quyen'
import { tinhBaoCao, duLieuExcel, tiLeChot, tb1, mauChu } from '../lib/baoCao'
import { Thanh, Vong, TheKpi, BangChiTietPhong, BangMucTieuPhong } from './baoCao/PhanTuBaoCao'

const TABS = [
  { key: 'tong_quan', label: 'Tổng quan' },
  { key: 'muc_tieu', label: 'Báo cáo mục tiêu' },
]

const MAU_HEX = {
  slate: '#94a3b8', orange: '#fb923c', amber: '#f59e0b', emerald: '#10b981', teal: '#14b8a6',
  violet: '#8b5cf6', rose: '#f43f5e', coral: '#ff7a00', sky: '#0ea5e9', navy: '#0a2463',
}

export default function BaoCaoPage({ currentProfile }) {
  const quanLy = laQuanLy(currentProfile)   // admin hoặc leader: có ô lọc Sale (leader chỉ thấy team mình)
  const { options: TRANG_THAI, statuses } = useTrangThai()
  const [tab, setTab] = useState('tong_quan')
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState(homNayLocal())
  const [den, setDen] = useState(homNayLocal())
  const [locSale, setLocSale] = useState('')
  const [locPhong, setLocPhong] = useState('')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [cs, setCs] = useState([])          // lượt chăm sóc
  const [logs, setLogs] = useState([])      // nhật ký đổi trạng thái
  const [soMt, setSoMt] = useState([])      // mục tiêu số
  const [chonMt, setChonMt] = useState([])  // khách chọn gọi lại

  async function load() {
    setLoading(true)
    const chiCuaMinh = laSale(currentProfile)
    const truyVanProfiles = layNhanSu()
    // Sale không xem trực tiếp được khách/nhật ký của đồng nghiệp: dùng hàm team_* (chỉ trả số liệu, không có tên/SĐT khách)
    const [a, b, c, d, e, f] = chiCuaMinh ? await Promise.all([
      layHet(() => supabase.rpc('team_khach')),
      truyVanProfiles,
      layHet(() => supabase.rpc('team_interactions')),
      layHet(() => supabase.rpc('team_logs')),
      layHet(() => supabase.rpc('team_muc_tieu_so')),
      layHet(() => supabase.rpc('team_muc_tieu_ngay')),
    ]) : await Promise.all([
      layHet(() => supabase.from('customers').select('id, ten_khach, sale_id, trang_thai_cham_soc, khu_vuc, created_at, ngay_lien_he_gan_nhat').order('id')),
      truyVanProfiles,
      layHet(() => supabase.from('customer_interactions').select('customer_id, sale_id, ngay_thuc_hien, created_at').order('id')),
      layHet(() => supabase.from('customer_logs').select('customer_id, user_id, hanh_dong, chi_tiet, created_at')
        .eq('hanh_dong', 'Đổi trạng thái').order('created_at', { ascending: false }).order('id')),
      layHet(() => supabase.from('muc_tieu_so').select('user_id, ngay, loai, muc_tieu').order('user_id').order('ngay').order('loai')),
      layHet(() => supabase.from('muc_tieu_ngay').select('user_id, ngay, customer_id').order('user_id').order('ngay').order('customer_id')),
    ])
    setCustomers(a.data || []); setProfiles(b.data || []); setCs(c.data || [])
    setLogs(d.data || []); setSoMt(e.data || []); setChonMt(f.data || [])
    setLoading(false)
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps, react/set-state-in-effect -- chỉ tải 1 lần khi mở trang
  useEffect(() => { load() }, [])

  // Toàn bộ số liệu tính lại mỗi khi dữ liệu hoặc bộ lọc đổi
  const bc = useMemo(() => tinhBaoCao({
    customers, profiles, cs, logs, soMt, chonMt, statuses, trangThai: TRANG_THAI,
    currentProfile, ky, tu, den, locSale, locPhong,
  }), [customers, profiles, cs, logs, soMt, chonMt, statuses, TRANG_THAI, currentProfile, ky, tu, den, locSale, locPhong])
  const { xemChuaChia, dsPhong, thanhVienLoc, maChua, khachKy, demTT, bangPhong, chiTiet, nhomPhong, tatCa, tenKy } = bc
  const laAdminHan = laAdmin(currentProfile)

  // ===== Excel =====
  function taiExcel() {
    return xuatBangXlsx(duLieuExcel(tab, bc, TRANG_THAI))
  }

  const thD = 'border border-navy-800 px-4 py-2.5'
  const td = 'border border-slate-200 px-4 py-2.5'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-8 pt-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'muc_tieu' && ky === 'tat_ca') setKy('thang_nay') }}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
              tab === t.key ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600 hover:text-navy-900'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <Select label="Kỳ báo cáo" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
            {tab === 'tong_quan' && <option value="tat_ca">Tất cả thời gian</option>}
            <option value="hom_nay">Hôm nay</option>
            <option value="hom_qua">Hôm qua</option>
            <option value="7">7 ngày qua</option>
            <option value="thang_nay">Tháng này</option>
            <option value="tuy_chon">Chọn ngày...</option>
          </Select>
          {ky === 'tuy_chon' && (
            <>
              <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
              <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
            </>
          )}
          {laAdminHan && (
            <Select label="Phòng" value={locPhong} onChange={(e) => { setLocPhong(e.target.value); setLocSale('') }} className="w-44">
              <option value="">Tất cả phòng</option>
              {dsPhong.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
          {quanLy && (
            <Select label="Sale" value={locSale} onChange={(e) => setLocSale(e.target.value)} className="w-64">
              <option value="">{locPhong ? `Tất cả sale phòng ${locPhong}` : 'Tất cả sale'}</option>
              {thanhVienLoc.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          )}
          <button type="button" onClick={taiExcel} disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink-600 hover:border-coral-500 hover:text-coral-500">
            <Download size={15} /> Tải Excel
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-ink-400">Đang tải...</p>
        ) : (
          <div className="space-y-5 p-8">
            {/* ===== 1. Tổng quan ===== */}
            {tab === 'tong_quan' && (() => {
              const tong = khachKy.length
              const maChot = TRANG_THAI.filter((b) => b.la_chot).map((b) => b.ma)
              const soChot = khachKy.filter((c) => maChot.includes(c.trang_thai_cham_soc)).length
              const soChua = khachKy.filter((c) => maChua.includes(c.trang_thai_cham_soc)).length
              const daLH = tong - soChua
              const pc = (x) => (tong ? x / tong : 0)
              const tiLeChotRow = (dem, tongRow) => tiLeChot(dem, tongRow, maChua, maChot)
              return (
                <>
                  {/* Chỉ số chính */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TheKpi lon tieuDe="Tổng khách hàng" so={tong.toLocaleString('vi-VN')} phu={tenKy} icon={Users} />
                    <TheKpi tieuDe="Tỷ lệ chốt" so={daLH > 0 ? hienPt2(soChot / daLH) : '—'} phu={`${soChot.toLocaleString('vi-VN')} chốt / ${daLH.toLocaleString('vi-VN')} khách liên hệ được`} tone="emerald" icon={Trophy} />
                    <TheKpi tieuDe="Đã liên hệ" so={daLH.toLocaleString('vi-VN')} phu={`${hienPt2(pc(daLH))} tổng số khách`} tone="sky" icon={PhoneCall} />
                    <TheKpi tieuDe="Chưa liên hệ" so={soChua.toLocaleString('vi-VN')} phu={soChua ? `${hienPt2(pc(soChua))} — cần gọi sớm` : 'Đã liên hệ hết'} tone="amber" icon={Hourglass} />
                  </div>

                  {/* Cơ cấu trạng thái */}
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display text-base font-semibold text-navy-900">Cơ cấu khách theo trạng thái</h2>
                      <p className="text-xs text-ink-400">Trạng thái hiện tại · khách thêm trong kỳ · Tỷ lệ chốt = khách chốt ÷ khách liên hệ được (không ở Chưa liên hệ)</p>
                    </div>
                    <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                      {demTT.filter((b) => b.so > 0).map((b) => (
                        <div key={b.ma} style={{ width: `${pc(b.so) * 100}%`, backgroundColor: MAU_HEX[b.mau] || MAU_HEX.slate }} title={`${b.ten}: ${b.so}`} />
                      ))}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {demTT.map((b) => {
                        const m = MAU_HEX[b.mau] || MAU_HEX.slate
                        return (
                          <div key={b.ma} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3" style={{ borderLeft: `4px solid ${m}` }}>
                            <p className="text-xs leading-snug text-ink-600">{b.ten}</p>
                            <p className="mt-1 flex items-baseline gap-2">
                              <span className="font-display text-2xl font-bold text-navy-900">{b.so.toLocaleString('vi-VN')}</span>
                              <span className="text-xs font-medium" style={{ color: m }}>{hienPt2(pc(b.so))}</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {laAdminHan && (
                    <section className="rounded-2xl bg-white p-5 shadow-sm">
                      <h2 className="mb-3 font-display text-base font-semibold text-navy-900">So sánh các phòng</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-navy-900 text-left font-semibold text-white">
                              <th className={thD}>Phòng</th>
                              <th className={`${thD} text-center`}>Số sale</th>
                              <th className={`${thD} text-center`}>Tổng khách</th>
                              {TRANG_THAI.map((b) => <th key={b.ma} className={`${thD} text-center`}>{b.ten}</th>)}
                              <th className={`${thD} text-center`}>Tỷ lệ chốt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bangPhong.length === 0 ? (
                              <tr><td colSpan={4 + TRANG_THAI.length} className={`${td} py-6 text-center text-ink-400`}>Chưa có dữ liệu.</td></tr>
                            ) : bangPhong.map((o) => (
                              <tr key={o.ten} className={o.chua ? 'bg-amber-50/70' : 'odd:bg-white even:bg-slate-50/50'}>
                                <td className={`${td} font-semibold text-navy-900`}>{o.ten}</td>
                                <td className={`${td} text-center`}>{o.chua ? '—' : o.soSale}</td>
                                <td className={`${td} bg-blue-50/60 text-center font-display text-base font-bold text-navy-900`}>{o.tong.toLocaleString('vi-VN')}</td>
                                {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center ${o.dem[b.ma] ? 'text-navy-900' : 'text-slate-300'}`}>{o.dem[b.ma] || 0}</td>)}
                                <td className={`${td} text-center font-semibold text-emerald-600`}>{tiLeChotRow(o.dem, o.tong)}</td>
                              </tr>
                            ))}
                            {bangPhong.length > 1 && (() => {
                              const dem = {}
                              for (const o of bangPhong) for (const [k, v] of Object.entries(o.dem)) dem[k] = (dem[k] || 0) + v
                              const t = bangPhong.reduce((a, o) => a + o.tong, 0)
                              return (
                                <tr className="bg-navy-900 font-semibold text-white">
                                  <td className={td}>TỔNG CỘNG</td>
                                  <td className={`${td} text-center`}>{bangPhong.reduce((a, o) => a + o.soSale, 0)}</td>
                                  <td className={`${td} text-center font-display text-base`}>{t.toLocaleString('vi-VN')}</td>
                                  {TRANG_THAI.map((b) => <td key={b.ma} className={`${td} text-center`}>{dem[b.ma] || 0}</td>)}
                                  <td className={`${td} text-center`}>{tiLeChotRow(dem, t)}</td>
                                </tr>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {!xemChuaChia && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Chi tiết từng phòng — từng sale</h2>
                    <p className="mb-3 text-sm text-ink-400">Tổng khách = data mới chia/tìm trong kỳ mà chưa gọi (cột Chưa liên hệ) + khách sale đã liên hệ được trong kỳ, theo trạng thái hiện tại. Mỗi khách tính 1 lần. Tỷ lệ chốt = KH chốt / KH đã liên hệ được.</p>
                    <BangChiTietPhong chiTiet={chiTiet} trangThai={TRANG_THAI} tiLeChotRow={tiLeChotRow} />
                  </section>
                  )}
                </>
              )
            })()}

            {/* ===== 2. Báo cáo mục tiêu ===== */}
            {tab === 'muc_tieu' && (
              <>
                {/* Chỉ số tổng */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="col-span-2 flex items-center gap-4 rounded-2xl bg-navy-900 px-5 py-4 text-white shadow-sm md:col-span-3 xl:col-span-2">
                    <Vong pt={tatCa.ptTong} size={84} sang />
                    <div>
                      <p className="text-sm text-white/70">Hoàn thành mục tiêu</p>
                      <p className="mt-0.5 font-display text-3xl font-bold">{tatCa.ptTong == null ? '—' : hienPt2(tatCa.ptTong)}</p>
                      <p className="mt-0.5 text-xs text-white/60">{tatCa.sum.ht.toLocaleString('vi-VN')} / {tatCa.sum.mt.toLocaleString('vi-VN')} việc · {tenKy}</p>
                    </div>
                  </div>
                  <TheKpi tieuDe="KH liên hệ được" so={tatCa.sum.nghe.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.nghe / tatCa.n : 0)} / sale`} tone="sky" icon={PhoneCall} nho />
                  <TheKpi tieuDe="Lượt chăm sóc" so={tatCa.sum.luot.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.luot / tatCa.n : 0)} / sale`} tone="emerald" icon={MessageCircle} nho />
                  <TheKpi tieuDe="Data sale tìm kiếm" so={tatCa.sum.moi.toLocaleString('vi-VN')} phu={`TB ${tb1(tatCa.n ? tatCa.sum.moi / tatCa.n : 0)} / sale`} tone="violet" icon={UserPlus} nho />
                  <TheKpi tieuDe={`Tồn quá ${SO_NGAY_GOI_LAI} ngày`} so={tatCa.sum.ton.toLocaleString('vi-VN')} phu="khách cần gọi lại" tone="rose" icon={AlertTriangle} nho />
                </div>

                {/* So sánh các phòng */}
                {nhomPhong.length > 0 && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h2 className="font-display text-base font-semibold text-navy-900">Hoàn thành mục tiêu theo phòng</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {[...nhomPhong].sort((x, y) => (y.ptTong ?? -1) - (x.ptTong ?? -1)).map((g) => (
                        <div key={g.ten} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-display font-semibold text-navy-900">Phòng {g.ten}</p>
                              <p className="text-xs text-ink-400">{g.n} sale · {g.sum.ht} / {g.sum.mt} việc</p>
                            </div>
                            <p className={`font-display text-2xl font-bold ${mauChu(g.ptTong)}`}>{g.ptTong == null ? '—' : hienPt2(g.ptTong)}</p>
                          </div>
                          <Thanh pt={g.ptTong} className="mt-3" />
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-ink-600">
                            <div><p className="font-display text-base font-bold text-navy-900">{tb1(g.sum.nghe / g.n)}</p>liên hệ được / sale</div>
                            <div><p className="font-display text-base font-bold text-navy-900">{tb1(g.sum.luot / g.n)}</p>chăm sóc / sale</div>
                            <div><p className={`font-display text-base font-bold ${g.sum.ton > 0 ? 'text-rose-500' : 'text-navy-900'}`}>{g.sum.ton}</p>khách tồn</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Bảng chi tiết */}
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="mb-1 font-display text-base font-semibold text-navy-900">Chi tiết từng phòng — từng sale</h2>
                  <p className="mb-3 text-xs text-ink-400">Mục tiêu = số KH liên hệ được sale tự đặt + số khách cần gọi lại sale đã chọn. KH liên hệ được = khách đổi từ Chưa liên hệ sang trạng thái khác. Lượt chăm sóc = số khách có cập nhật chăm sóc mới hoặc đổi trạng thái (trừ Chưa liên hệ → khác), mỗi khách tính 1 lần/ngày; ngày khách vừa đổi từ Chưa liên hệ thì chỉ tính KH liên hệ được.</p>
                  {nhomPhong.length === 0
                    ? <p className="py-6 text-center text-sm text-ink-400">{xemChuaChia ? 'Data chưa chia chưa thuộc sale nào nên chưa có mục tiêu.' : 'Chưa có sale nào.'}</p>
                    : <BangMucTieuPhong nhomPhong={nhomPhong} tatCa={tatCa} soNgay={SO_NGAY_GOI_LAI} tb1={tb1} />}
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
