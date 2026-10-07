import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Select, Badge, Input } from './ui'
import { useTrangThai } from '../lib/StatusContext'
import { NGUON_KHACH_OPTIONS } from '../lib/constants'
import { khoangNgay } from '../lib/doanhSo'

const NGAY_BO_QUEN = 7

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Khoảng ngày [từ, đến] theo lựa chọn kỳ ('' = không giới hạn)
function khoangKy(ky, tu, den) {
  const d = new Date()
  if (ky === 'hom_nay') return [ymd(d), ymd(d)]
  if (ky === 'tuan_nay') {
    const thu = (d.getDay() + 6) % 7 // thứ 2 = 0
    d.setDate(d.getDate() - thu)
    return [ymd(d), '']
  }
  if (ky === '30' || ky === '90') { d.setDate(d.getDate() - Number(ky)); return [ymd(d), ''] }
  if (ky === 'all') return ['', '']
  return khoangNgay(ky, tu, den)   // tháng này/trước, quý này, năm nay, chọn ngày
}

export default function AnalyticsPage() {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai } = useTrangThai()
  const [customers, setCustomers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [ky, setKy] = useState('thang_nay')
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [filterSale, setFilterSale] = useState('')
  const [filterNguon, setFilterNguon] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setCustomers(c || []); setProfiles(p || [])
    setLoading(false)
  }

  const [tuNgay, denNgay] = useMemo(() => khoangKy(ky, tu, den), [ky, tu, den])
  const tenSale = (id) => profiles.find((p) => p.id === id)?.full_name || 'Chưa gán'
  const trongKy = (d) => {
    const x = (d || '').slice(0, 10)
    return !!x && (!tuNgay || x >= tuNgay) && (!denNgay || x <= denNgay)
  }

  // Áp bộ lọc sale cho toàn bộ báo cáo
  const khachLoc = useMemo(() => customers.filter((c) => (!filterSale || c.sale_id === filterSale) && (!filterNguon || c.nguon_khach === filterNguon)), [customers, filterSale, filterNguon])

  // Khách phát sinh trong kỳ
  const khachTrongKy = useMemo(
    () => khachLoc.filter((c) => trongKy(c.created_at)),
    [khachLoc, tuNgay, denNgay]
  )

  // ===== Phễu: mỗi khách chỉ nằm ở ĐÚNG MỘT bước theo trạng thái hiện tại =====
  const pheu = useMemo(() => {
    const tong = khachTrongKy.length
    const buoc = TRANG_THAI.map((b) => {
      const so = khachTrongKy.filter((c) => c.trang_thai_cham_soc === b.ma).length
      return { ma: b.ma, ten: b.ten, mau: b.mau, chot: !!b.la_chot, so, pt: tong ? (so / tong) * 100 : 0 }
    })
    const co = buoc.filter((b) => b.so > 0)
    const chot = buoc.filter((b) => b.chot).reduce((a, b) => a + b.so, 0)
    return { tong, buoc, co, trong: buoc.filter((b) => b.so === 0), chot, tyLeChot: tong ? (chot / tong) * 100 : 0 }
  }, [khachTrongKy, TRANG_THAI])

  // ===== Khách bị bỏ quên =====
  const boQuen = useMemo(() => {
    const g = new Date(); g.setDate(g.getDate() - NGAY_BO_QUEN)
    const gh = g.toISOString().slice(0, 10)
    return khachLoc
      .filter((c) => ['khong_nghe_may', 'dang_tu_van'].includes(c.trang_thai_cham_soc))
      .map((c) => {
        const lan = c.ngay_lien_he_gan_nhat || (c.created_at || '').slice(0, 10)
        return { ...c, lan, soNgay: Math.floor((Date.now() - new Date(lan).getTime()) / 86400000) }
      })
      .filter((c) => c.lan <= gh)
      .sort((a, b) => b.soNgay - a.soNgay)
      .slice(0, 12)
  }, [khachLoc])

  const so1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="font-display text-xl font-bold text-navy-900">Hiệu suất Sale</h1>
        <p className="text-sm text-ink-600">Khách đang nằm ở bước nào trong quy trình chăm sóc, và khách nào đang bị bỏ quên</p>
      </header>

      <div className="mx-8 mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Select label="Thời gian" value={ky} onChange={(e) => setKy(e.target.value)} className="w-44">
          <option value="hom_nay">Hôm nay</option>
          <option value="tuan_nay">Tuần này</option>
          <option value="thang_nay">Tháng này</option>
          <option value="thang_truoc">Tháng trước</option>
          <option value="quy_nay">Quý này</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
          <option value="nam_nay">Năm nay</option>
          <option value="all">Toàn bộ</option>
          <option value="tuy_chon">Chọn ngày...</option>
        </Select>
        {ky === 'tuy_chon' && (
          <>
            <Input label="Từ ngày" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
            <Input label="Đến ngày" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
          </>
        )}
        <Select label="Sale" value={filterSale} onChange={(e) => setFilterSale(e.target.value)} className="w-52">
          <option value="">Tất cả sale</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <Select label="Nguồn khách" value={filterNguon} onChange={(e) => setFilterNguon(e.target.value)} className="w-52">
          <option value="">Tất cả nguồn</option>
          {NGUON_KHACH_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
        </Select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-5 p-8">
          {/* Chỉ số nhanh */}
          <div className="grid grid-cols-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
            <div className="px-5 py-4">
              <p className="text-sm text-ink-600">Khách vào data</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-900">{pheu.tong}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-ink-600">Đã chốt</p>
              <p className="mt-1 font-display text-2xl font-bold text-teal-500">{pheu.chot}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-ink-600">Tỷ lệ chốt</p>
              <p className="mt-1 font-display text-2xl font-bold text-coral-500">{so1(pheu.tyLeChot)}%</p>
            </div>
          </div>

          {/* Phễu */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-navy-900">Khách đang ở bước nào</h2>
            <p className="mt-0.5 text-xs text-ink-400">Mỗi khách chỉ nằm ở một bước theo trạng thái hiện tại. Bước nào dày nhất là chỗ team đang ùn.</p>

            {pheu.tong === 0 ? (
              <p className="py-10 text-center text-sm text-ink-400">Chưa có khách nào vào data trong kỳ này.</p>
            ) : (
              <>
                {/* Thanh tổng: nhìn một lần thấy cơ cấu */}
                <div className="mt-4 flex h-3.5 overflow-hidden rounded-full bg-slate-100">
                  {pheu.co.map((b) => (
                    <div key={b.ma} style={{ width: `${b.pt}%`, backgroundColor: MAU_HEX[b.mau] || MAU_HEX.slate }}
                      title={`${b.ten}: ${b.so} khách`} />
                  ))}
                </div>

                <ul className="mt-5 divide-y divide-slate-100">
                  {pheu.co.map((b) => {
                    const mau = MAU_HEX[b.mau] || MAU_HEX.slate
                    return (
                      <li key={b.ma} className="grid grid-cols-[minmax(150px,220px)_1fr_auto] items-center gap-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: mau }} />
                          <span className="font-medium text-navy-900">{b.ten}</span>
                          {b.chot && <CheckCircle2 size={14} className="flex-none text-emerald-500" aria-label="Đã chốt" />}
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(b.pt, 2)}%`, backgroundColor: mau }} />
                        </div>
                        <div className="w-28 text-right">
                          <span className="font-display text-lg font-bold text-navy-900">{b.so}</span>
                          <span className="ml-2 text-sm text-ink-400">{so1(b.pt)}%</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {pheu.trong.length > 0 && (
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-ink-400">
                    Chưa có khách ở: {pheu.trong.map((b) => b.ten).join(' · ')}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-display text-base font-semibold text-navy-900">Khách bị bỏ quên <span className="text-sm font-normal text-ink-400">(quá {NGAY_BO_QUEN} ngày chưa liên hệ lại)</span></h2>
            {boQuen.length === 0 ? (
              <p className="py-6 text-center text-sm text-emerald-600">Không có khách nào bị bỏ quên. Team đang bám sát tốt.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  <AlertTriangle size={16} />
                  {boQuen.length} khách sắp hoặc đã rơi vào nhóm data chung, sale khác có thể nhận mất.
                </div>
                <table className="border-collapse w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-600">
                      <th className="border border-slate-200 px-3 py-2">Khách hàng</th>
                      <th className="border border-slate-200 px-3 py-2">Trạng thái</th>
                      <th className="border border-slate-200 px-3 py-2">Sale</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Số ngày im lặng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boQuen.map((c) => (
                      <tr key={c.id} className="border-t border-slate-50">
                        <td className="border border-slate-200 px-3 py-2.5">
                          <p className="font-medium text-navy-900">{c.ten_khach}</p>
                          <p className="text-xs text-ink-400">{c.ma_khach}</p>
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5">
                          <Badge className={classTrangThai(c.trang_thai_cham_soc)}>
                            {tenTrangThai(c.trang_thai_cham_soc)}
                          </Badge>
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-ink-600">{tenSale(c.sale_id)}</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-right font-medium text-rose-500">{c.soNgay} ngày</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// Màu hiển thị cho từng trạng thái (khớp với màu chọn trong phần Trạng thái)
const MAU_HEX = {
  slate: '#94a3b8', orange: '#fb923c', amber: '#f59e0b', emerald: '#10b981', teal: '#14b8a6',
  violet: '#8b5cf6', rose: '#f43f5e', coral: '#ff6b45', sky: '#0ea5e9', navy: '#0f2438',
}
