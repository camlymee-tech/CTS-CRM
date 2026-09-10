import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Settings2, Plus, Trash2, Pencil, TriangleAlert, Tag, Search, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Modal } from './ui'
import { formatVnd } from '../lib/constants'
import { tinhToan, timGiaBan, timGiaHoaVon, so } from '../lib/pricing'
import FeesImportModal from './FeesImportModal'

const nhap = (v) => (v === '' || v === null || v === undefined ? '' : Number(v).toLocaleString('vi-VN'))

export default function PricingPage({ currentProfile }) {
  const [fees, setFees] = useState([])
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [moBangPhi, setMoBangPhi] = useState(false)
  const [cheDo, setCheDo] = useState('tu_gia_ban')

  const [nganh1, setNganh1] = useState('')
  const [nganh2, setNganh2] = useState('')
  const [khoangPhi, setKhoangPhi] = useState(null)
  const [timNganh, setTimNganh] = useState('')
  const [moGoiY, setMoGoiY] = useState(false)
  const [f, setF] = useState({
    giaNiemYet: '', giamGiaPct: 0, voucherShop: '',
    giaVon: '', dongGoi: '', chiPhiKhac: '',
    phiCoDinhPct: '', quangCaoPct: 10, affiliatePct: 0,
    phiNguoiBanMoi: '',
    voucherXtra: false, maUuDai: '', freeshipXtra: false, piship: false,
    coThue: true, nguoiBanMoi: false,
    bienMongMuon: 20,
  })

  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: fs }, { data: st }] = await Promise.all([
      supabase.from('shopee_fees').select('*').eq('active', true).order('nganh_1').order('nganh_2'),
      supabase.from('shopee_settings').select('*').eq('id', 1).single(),
    ])
    setFees(fs || [])
    setCfg(st || null)
    setLoading(false)
  }

  const nganhCap1 = useMemo(() => [...new Set(fees.map((x) => x.nganh_1))], [fees])
  const nganhCap2 = useMemo(() => fees.filter((x) => x.nganh_1 === nganh1), [fees, nganh1])

  // Bỏ dấu để tìm kiếm dễ hơn: "sac dep" vẫn ra "Sắc Đẹp"
  const boDau = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

  const ketQuaTim = useMemo(() => {
    const tu = boDau(timNganh).trim().split(/\s+/).filter(Boolean)
    if (!tu.length) return []
    return fees.filter((x) => {
      const chuoi = boDau(`${x.nganh_1} ${x.nganh_2}`)
      return tu.every((t) => chuoi.includes(t))
    }).slice(0, 40)
  }, [fees, timNganh])

  function chonTuKetQua(item) {
    setNganh1(item.nganh_1)
    setNganh2(item.nganh_2)
    setF((o) => ({
      ...o,
      phiCoDinhPct: String(item.phi_phan_tram),
      phiNguoiBanMoi: item.phi_nguoi_ban_moi != null ? String(item.phi_nguoi_ban_moi) : '',
    }))
    const coKhoang = item.phi_min != null && item.phi_max != null && item.phi_min !== item.phi_max
    setKhoangPhi(coKhoang ? { min: item.phi_min, max: item.phi_max } : null)
    setTimNganh('')
    setMoGoiY(false)
  }

  function chonNganh2(ten) {
    setNganh2(ten)
    const item = fees.find((x) => x.nganh_1 === nganh1 && x.nganh_2 === ten)
    if (item) {
      setF((o) => ({
        ...o,
        phiCoDinhPct: String(item.phi_phan_tram),
        phiNguoiBanMoi: item.phi_nguoi_ban_moi != null ? String(item.phi_nguoi_ban_moi) : '',
      }))
      const coKhoang = item.phi_min != null && item.phi_max != null && item.phi_min !== item.phi_max
      setKhoangPhi(coKhoang ? { min: item.phi_min, max: item.phi_max } : null)
    }
  }

  // Gom dữ liệu cho hàm tính
  const duLieu = useMemo(() => ({
    ...f,
    phiXuLyPct: cfg?.phi_xu_ly ?? 6,
    phiHaTang: cfg?.phi_ha_tang ?? 3000,
    vxPct: cfg?.voucher_xtra_pct ?? 4,
    vxCap: cfg?.voucher_xtra_cap ?? 50000,
    fsPct: cfg?.freeship_xtra_pct ?? 6,
    dtdPct: cfg?.dong_tai_tro_pct ?? 30,
    dtdCap: cfg?.dong_tai_tro_cap ?? 50000,
    thuePct: cfg?.thue_pct ?? 1.5,
    pishipPhi: cfg?.piship_phi ?? 2700,
  }), [f, cfg])

  const giaDeXuat = useMemo(
    () => (cheDo === 'tu_loi_nhuan' ? timGiaBan(duLieu, so(f.bienMongMuon)) : 0),
    [duLieu, cheDo, f.bienMongMuon]
  )

  const kq = useMemo(
    () => tinhToan(cheDo === 'tu_loi_nhuan' ? { ...duLieu, giaNiemYet: giaDeXuat } : duLieu),
    [duLieu, cheDo, giaDeXuat]
  )

  const hoaVon = useMemo(() => timGiaHoaVon(duLieu), [duLieu])

  // So sánh với trường hợp không khuyến mãi
  const khongSale = useMemo(
    () => tinhToan({ ...duLieu, giaNiemYet: kq.giaNiemYet, giamGiaPct: 0, voucherShop: 0 }),
    [duLieu, kq.giaNiemYet]
  )
  const coSale = so(f.giamGiaPct) > 0 || so(f.voucherShop) > 0

  const chuaDu = kq.giaSauGiam <= 0 || kq.chiPhiThat <= 0
  const lo = kq.loiNhuan < 0

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tính giá bán Shopee</h1>
          <p className="text-sm text-ink-600">
            Tính lợi nhuận thực nhận sau phí sàn, khuyến mãi, quảng cáo và thuế
          </p>
        </div>
        {isAdmin && (
          <Button variant="secondary" onClick={() => setMoBangPhi(true)}>
            <Settings2 size={16} /> Bảng phí sàn
          </Button>
        )}
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-2">
          {/* ===== NHẬP LIỆU ===== */}
          <div className="space-y-4">
            <Panel title="Ngành hàng">
              <div className="relative mb-3">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={timNganh}
                  onChange={(e) => { setTimNganh(e.target.value); setMoGoiY(true) }}
                  onFocus={() => setMoGoiY(true)}
                  placeholder="Gõ tên ngành hàng, VD: sua rua mat, ao thun, tai nghe..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none focus:border-coral-500"
                />
                {timNganh && (
                  <button type="button" onClick={() => { setTimNganh(''); setMoGoiY(false) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-navy-900">
                    <X size={14} />
                  </button>
                )}

                {moGoiY && timNganh.trim() && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {ketQuaTim.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-ink-400">
                        Không tìm thấy ngành hàng nào. Thử từ khoá ngắn hơn.
                      </p>
                    ) : ketQuaTim.map((x) => (
                      <button type="button" key={x.id} onClick={() => chonTuKetQua(x)}
                        className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-navy-900">{x.nganh_2}</p>
                          <p className="truncate text-xs text-ink-400">{x.nganh_1}</p>
                        </div>
                        <span className="flex-none rounded-md bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-600">
                          {x.phi_phan_tram}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {nganh2 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900">{nganh2}</p>
                    <p className="truncate text-xs text-emerald-700">{nganh1} · phí {f.phiCoDinhPct}%</p>
                  </div>
                </div>
              )}

              <p className="mb-2 text-xs text-ink-400">Hoặc chọn theo cấp:</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Cấp 1" value={nganh1}
                  onChange={(e) => { setNganh1(e.target.value); setNganh2('') }}>
                  <option value="">-- Chọn --</option>
                  {nganhCap1.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
                <Select label="Cấp 2" value={nganh2} disabled={!nganh1}
                  onChange={(e) => chonNganh2(e.target.value)}>
                  <option value="">{nganh1 ? `-- Chọn (${nganhCap2.length}) --` : 'Chọn cấp 1 trước'}</option>
                  {nganhCap2.map((n) => (
                    <option key={n.id} value={n.nganh_2}>{n.nganh_2} — {n.phi_phan_tram}%</option>
                  ))}
                </Select>
              </div>
            </Panel>

            <Panel title="Chi phí thật của sản phẩm">
              <div className="space-y-3">
                <OTien label="Giá vốn / giá nhập" value={f.giaVon} onChange={(v) => setF({ ...f, giaVon: v })} />
                <OTien label="Đóng gói, nhân công" value={f.dongGoi} onChange={(v) => setF({ ...f, dongGoi: v })} />
                <OTien label="Chi phí khác" value={f.chiPhiKhac} onChange={(v) => setF({ ...f, chiPhiKhac: v })}
                  goiY="Kho bãi, hàng hỏng, dự phòng đổi trả..." />
              </div>
            </Panel>

            <Panel title={
              <span className="inline-flex items-center gap-2">
                <Tag size={15} className="text-coral-500" /> Khuyến mãi đang chạy
              </span>
            }>
              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-navy-900">Giảm giá chương trình</span>
                    <span className="font-display font-bold text-coral-500">{so(f.giamGiaPct)}%</span>
                  </div>
                  <input type="range" min="0" max="70" step="1" value={f.giamGiaPct}
                    onChange={(e) => setF({ ...f, giamGiaPct: e.target.value })}
                    className="w-full accent-coral-500" />
                  <div className="mt-1 flex gap-1.5">
                    {[0, 10, 20, 30, 50].map((p) => (
                      <button key={p} type="button" onClick={() => setF({ ...f, giamGiaPct: p })}
                        className={`rounded-md px-2 py-0.5 text-xs transition ${
                          so(f.giamGiaPct) === p ? 'bg-coral-500 text-white' : 'bg-slate-100 text-ink-600 hover:bg-slate-200'
                        }`}>
                        {p === 0 ? 'Ngày thường' : `-${p}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <OTien label="Mã giảm giá của shop" value={f.voucherShop}
                  onChange={(v) => setF({ ...f, voucherShop: v })}
                  goiY="Số tiền shop tự giảm thêm cho khách" />
              </div>
            </Panel>

            <Panel title="Phí sàn & dịch vụ">
              <div className="space-y-3">
                <OPhanTram label="Phí cố định ngành hàng" value={f.phiCoDinhPct}
                  onChange={(v) => setF({ ...f, phiCoDinhPct: v })}
                  goiY={khoangPhi
                    ? `Shopee công bố khoảng ${khoangPhi.min}% – ${khoangPhi.max}%. Đang lấy mức cao nhất cho an toàn, sửa được.`
                    : nganh2 ? 'Tự điền theo ngành hàng, sửa được' : 'Chọn ngành hàng để tự điền'} />

                <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={f.nguoiBanMoi} className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, nguoiBanMoi: e.target.checked })} />
                  <span className="flex-1">
                    <b className="text-navy-900">Ưu đãi người bán mới</b>
                    <span className="block text-xs text-emerald-800">
                      Đăng sản phẩm đầu 01/01–31/05/2026 · áp dụng 01/06–31/08/2026.
                      Áp mức Shopee công bố riêng cho từng ngành hàng.
                      {kq.phiCoDinhPct !== kq.phiCoDinhGoc &&
                        ` Đang tính ${kq.phiCoDinhPct}% thay vì ${kq.phiCoDinhGoc}%.`}
                    </span>
                  </span>
                </label>

                <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
                  Phí xử lý giao dịch <b className="text-navy-900">{duLieu.phiXuLyPct}%</b> và
                  phí hạ tầng <b className="text-navy-900">{formatVnd(duLieu.phiHaTang)}/đơn</b> luôn được tính tự động.
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={f.voucherXtra} className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, voucherXtra: e.target.checked })} />
                  <span className="flex-1">
                    <b className="text-navy-900">Gói Voucher Xtra</b>
                    <span className="block text-xs text-ink-600">
                      {duLieu.vxPct}% giá trị sản phẩm, tối đa {formatVnd(duLieu.vxCap)}
                    </span>
                  </span>
                </label>

                {!f.voucherXtra && (
                  <OTien label="Mã ưu đãi Shopee áp lên sản phẩm" value={f.maUuDai}
                    onChange={(v) => setF({ ...f, maUuDai: v })}
                    goiY={`Không tham gia Voucher Xtra thì shop đồng tài trợ ${duLieu.dtdPct}% giá trị mã, tối đa ${formatVnd(duLieu.dtdCap)}`} />
                )}

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={f.freeshipXtra} className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, freeshipXtra: e.target.checked })} />
                  <span className="flex-1">
                    <b className="text-navy-900">Freeship Xtra</b>
                    <span className="block text-xs text-ink-600">{duLieu.fsPct}% giá trị sản phẩm</span>
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={f.piship} className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, piship: e.target.checked })} />
                  <span className="flex-1">
                    <b className="text-navy-900">Gói PiShip</b>
                    <span className="block text-xs text-ink-600">
                      Tiết kiệm vận chuyển · {formatVnd(duLieu.pishipPhi)}/đơn
                    </span>
                  </span>
                </label>

                <OPhanTram label="Hoa hồng tiếp thị liên kết" value={f.affiliatePct}
                  onChange={(v) => setF({ ...f, affiliatePct: v })} goiY="Affiliate / KOC, để 0 nếu không chạy" />
                <OPhanTram label="Ngân sách quảng cáo" value={f.quangCaoPct}
                  onChange={(v) => setF({ ...f, quangCaoPct: v })} goiY="Ads chiếm bao nhiêu % doanh thu" />

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={f.coThue} className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, coThue: e.target.checked })} />
                  <span className="flex-1">
                    <b className="text-navy-900">Trừ thuế</b>
                    <span className="block text-xs text-ink-600">
                      {duLieu.thuePct}% doanh thu (hộ kinh doanh: 1% GTGT + 0,5% TNCN)
                    </span>
                  </span>
                </label>
              </div>
            </Panel>

            <Panel title={
              <button type="button" onClick={() => setCheDo(cheDo === 'tu_gia_ban' ? 'tu_loi_nhuan' : 'tu_gia_ban')}
                className="inline-flex items-center gap-2 text-sm text-coral-500 hover:text-coral-600">
                <ArrowLeftRight size={14} />
                {cheDo === 'tu_gia_ban' ? 'Đang nhập giá bán — đổi sang nhập lợi nhuận' : 'Đang nhập lợi nhuận — đổi sang nhập giá bán'}
              </button>
            }>
              {cheDo === 'tu_gia_ban' ? (
                <OTien label="Giá niêm yết trên sàn" value={f.giaNiemYet}
                  onChange={(v) => setF({ ...f, giaNiemYet: v })}
                  goiY="Giá gốc trước khi áp khuyến mãi" />
              ) : (
                <OPhanTram label="Biên lợi nhuận mong muốn" value={f.bienMongMuon}
                  onChange={(v) => setF({ ...f, bienMongMuon: v })}
                  goiY="Tính trên số tiền khách thực trả" />
              )}
            </Panel>
          </div>

          {/* ===== KẾT QUẢ ===== */}
          <div className="space-y-4">
            <div className={`rounded-2xl p-6 shadow-sm ${lo && !chuaDu ? 'bg-rose-50' : 'bg-navy-950'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${lo && !chuaDu ? 'text-rose-600' : 'text-white/50'}`}>
                {cheDo === 'tu_loi_nhuan' ? 'Giá niêm yết cần đặt' : 'Lợi nhuận một đơn'}
              </p>
              <p className={`mt-1 font-display text-3xl font-bold ${
                chuaDu ? 'text-white/40' : lo ? 'text-rose-600' : 'text-white'
              }`}>
                {chuaDu ? '—' : formatVnd(cheDo === 'tu_loi_nhuan' ? kq.giaNiemYet : kq.loiNhuan)}
              </p>

              {!chuaDu && (
                <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4"
                  style={{ borderColor: lo ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.12)' }}>
                  <O nhan="Khách trả" gtri={formatVnd(kq.giaSauGiam)} lo={lo} />
                  <O nhan={cheDo === 'tu_loi_nhuan' ? 'Lợi nhuận' : 'Biên lợi nhuận'}
                    gtri={cheDo === 'tu_loi_nhuan' ? formatVnd(kq.loiNhuan) : kq.bien.toFixed(1).replace('.', ',') + '%'} lo={lo} />
                  <O nhan="Lãi trên vốn" gtri={kq.tyLeVon.toFixed(1).replace('.', ',') + '%'} lo={lo} />
                </div>
              )}

              {lo && !chuaDu && (
                <p className="mt-3 text-sm text-rose-700">
                  Đang lỗ. Giá niêm yết tối thiểu để hoà vốn với mức khuyến mãi này là <b>{formatVnd(hoaVon)}</b>.
                </p>
              )}
            </div>

            {coSale && !chuaDu && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-2 flex items-center gap-2 text-amber-900">
                  <TriangleAlert size={16} />
                  <p className="font-display font-semibold">Ngày sale so với ngày thường</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-amber-700">Ngày thường (không giảm)</p>
                    <p className="font-display text-lg font-bold text-navy-900">{formatVnd(khongSale.loiNhuan)}</p>
                    <p className="text-xs text-amber-700">biên {khongSale.bien.toFixed(1).replace('.', ',')}%</p>
                  </div>
                  <div>
                    <p className="text-amber-700">Ngày sale hiện tại</p>
                    <p className={`font-display text-lg font-bold ${lo ? 'text-rose-600' : 'text-navy-900'}`}>
                      {formatVnd(kq.loiNhuan)}
                    </p>
                    <p className="text-xs text-amber-700">biên {kq.bien.toFixed(1).replace('.', ',')}%</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-amber-800">
                  Chạy khuyến mãi làm lợi nhuận giảm <b>{formatVnd(khongSale.loiNhuan - kq.loiNhuan)}</b> mỗi đơn.
                  Cần bán thêm bao nhiêu đơn để bù thì lấy tổng lợi nhuận mục tiêu chia cho con số ngày sale.
                </p>
              </div>
            )}

            <Panel title="Chi tiết dòng tiền">
              {chuaDu ? (
                <p className="py-6 text-center text-sm text-ink-400">
                  Nhập giá vốn và {cheDo === 'tu_gia_ban' ? 'giá niêm yết' : 'biên lợi nhuận'} để xem chi tiết.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    <Dong nhan="Giá niêm yết" tien={kq.giaNiemYet} dam />
                    {kq.giamGia > 0 && <Dong nhan={`Giảm giá chương trình (${so(f.giamGiaPct)}%)`} tien={-kq.giamGia} />}
                    {kq.voucherShop > 0 && <Dong nhan="Mã giảm của shop" tien={-kq.voucherShop} />}
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td className="py-2 pl-2 font-medium text-navy-900">Khách thực trả</td>
                      <td className="py-2 pr-2 text-right font-medium text-navy-900">{formatVnd(kq.giaSauGiam)}</td>
                    </tr>
                    <Dong nhan="Giá vốn" tien={-kq.giaVon} />
                    {kq.dongGoi > 0 && <Dong nhan="Đóng gói, nhân công" tien={-kq.dongGoi} />}
                    {kq.chiPhiKhac > 0 && <Dong nhan="Chi phí khác" tien={-kq.chiPhiKhac} />}
                    <Dong nhan={`Phí cố định (${kq.phiCoDinhPct}%${
                      kq.phiCoDinhPct !== kq.phiCoDinhGoc ? ` — ưu đãi từ ${kq.phiCoDinhGoc}%` : ''
                    })`} tien={-kq.phiCoDinh} />
                    <Dong nhan={`Phí xử lý giao dịch (${duLieu.phiXuLyPct}%)`} tien={-kq.phiXuLy} />
                    <Dong nhan="Phí hạ tầng" tien={-kq.phiHaTang} />
                    {kq.phiVoucherXtra > 0 && <Dong nhan="Voucher Xtra" tien={-kq.phiVoucherXtra} />}
                    {kq.phiDongTaiTro > 0 && <Dong nhan="Đồng tài trợ mã ưu đãi" tien={-kq.phiDongTaiTro} />}
                    {kq.phiFreeship > 0 && <Dong nhan="Freeship Xtra" tien={-kq.phiFreeship} />}
                    {kq.phiPiShip > 0 && <Dong nhan="Gói PiShip" tien={-kq.phiPiShip} />}
                    {kq.phiAffiliate > 0 && <Dong nhan={`Tiếp thị liên kết (${so(f.affiliatePct)}%)`} tien={-kq.phiAffiliate} />}
                    {kq.phiQuangCao > 0 && <Dong nhan={`Quảng cáo (${so(f.quangCaoPct)}%)`} tien={-kq.phiQuangCao} />}
                    {kq.thue > 0 && <Dong nhan={`Thuế (${duLieu.thuePct}%)`} tien={-kq.thue} />}
                    <tr className="border-t-2 border-slate-200">
                      <td className="py-2.5 font-semibold text-navy-900">Còn lại</td>
                      <td className={`py-2.5 text-right font-display font-bold ${lo ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatVnd(kq.loiNhuan)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </Panel>

            {!chuaDu && (
              <Panel title="Giá niêm yết theo mức lãi mong muốn">
                <p className="mb-2 text-xs text-ink-400">
                  Đã tính sẵn mức khuyến mãi {so(f.giamGiaPct)}% đang chọn.
                </p>
                <div className="space-y-2 text-sm">
                  <MocGia nhan="Hoà vốn" tien={hoaVon} />
                  {[10, 20, 30].map((p) => (
                    <MocGia key={p} nhan={`Lãi ${p}%`} tien={timGiaBan(duLieu, p)} />
                  ))}
                </div>
              </Panel>
            )}

            {cfg?.ghi_chu && (
              <p className="px-1 text-xs text-ink-400">{cfg.ghi_chu}</p>
            )}
          </div>
        </div>
      )}

      {moBangPhi && <FeesModal cfg={cfg} onClose={() => { setMoBangPhi(false); load() }} />}
    </div>
  )
}

function O({ nhan, gtri, lo }) {
  return (
    <div>
      <p className={`text-xs ${lo ? 'text-rose-500' : 'text-white/50'}`}>{nhan}</p>
      <p className={`font-display text-base font-bold ${lo ? 'text-rose-600' : 'text-white'}`}>{gtri}</p>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 font-display font-semibold text-navy-900">{title}</div>
      {children}
    </div>
  )
}

function Dong({ nhan, tien, dam }) {
  return (
    <tr className="border-t border-slate-50">
      <td className={`py-2 ${dam ? 'font-medium text-navy-900' : 'text-ink-600'}`}>{nhan}</td>
      <td className={`py-2 text-right ${dam ? 'font-medium text-navy-900' : 'text-ink-600'}`}>
        {tien < 0 ? '− ' : ''}{formatVnd(Math.abs(tien))}
      </td>
    </tr>
  )
}

function MocGia({ nhan, tien }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-ink-600">{nhan}</span>
      <span className="font-display font-semibold text-navy-900">{formatVnd(tien)}</span>
    </div>
  )
}

function OTien({ label, value, onChange, goiY }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-navy-900">{label}</span>
      <div className="relative">
        <input type="text" inputMode="numeric" value={nhap(value)} placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-right text-sm outline-none focus:border-coral-500" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">đ</span>
      </div>
      {goiY && <span className="text-xs text-ink-400">{goiY}</span>}
    </label>
  )
}

function OPhanTram({ label, value, onChange, goiY }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-navy-900">{label}</span>
      <div className="relative">
        <input type="number" step="0.01" value={value} placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-right text-sm outline-none focus:border-coral-500" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">%</span>
      </div>
      {goiY && <span className="text-xs text-ink-400">{goiY}</span>}
    </label>
  )
}

// ===================== QUẢN LÝ BẢNG PHÍ =====================
function FeesModal({ cfg, onClose }) {
  const [tab, setTab] = useState('chung')
  const [fees, setFees] = useState([])
  const [loading, setLoading] = useState(true)
  const [tim, setTim] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('shopee_fees').select('*').order('nganh_1').order('nganh_2')
    setFees(data || [])
    setLoading(false)
  }

  async function xoa(x) {
    if (!window.confirm(`Xoá "${x.nganh_1} / ${x.nganh_2}"?`)) return
    await supabase.from('shopee_fees').delete().eq('id', x.id)
    load()
  }

  const loc = fees.filter((x) => !tim || `${x.nganh_1} ${x.nganh_2}`.toLowerCase().includes(tim.toLowerCase()))

  return (
    <Modal title="Bảng phí sàn Shopee" onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-slate-100">
        {[['chung', 'Phí chung'], ['nganh', `Phí theo ngành hàng (${fees.length})`], ['nhap', 'Nhập từ file']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === k ? 'border-coral-500 font-medium text-navy-900' : 'border-transparent text-ink-600'
            }`}>{l}</button>
        ))}
      </div>

      {tab === 'chung' ? (
        <SettingsForm cfg={cfg} onSaved={onClose} />
      ) : tab === 'nhap' ? (
        <FeesImportModal onXong={onClose} />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <Input placeholder="Tìm ngành hàng..." value={tim} onChange={(e) => setTim(e.target.value)} className="flex-1" />
            <Button type="button" variant="secondary" className="flex-none"
              onClick={() => setEditing({ nganh_1: '', nganh_2: '', phi_phan_tram: '', ap_dung_tu: '' })}>
              <Plus size={15} /> Thêm
            </Button>
          </div>

          {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
            <div className="max-h-[45vh] space-y-1 overflow-y-auto">
              {loc.map((x) => (
                <div key={x.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-navy-900">{x.nganh_2}</p>
                    <p className="text-xs text-ink-400">
                      {x.nganh_1}{x.ap_dung_tu ? ` · áp dụng từ ${x.ap_dung_tu}` : ''}
                    </p>
                  </div>
                  <Badge className="bg-coral-50 text-coral-600">{x.phi_phan_tram}%</Badge>
                  <button onClick={() => setEditing(x)} className="text-ink-400 hover:text-coral-500"><Pencil size={14} /></button>
                  <button onClick={() => xoa(x)} className="text-ink-400 hover:text-rose-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {loc.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Không tìm thấy ngành hàng.</p>}
            </div>
          )}

          {editing && (
            <FeeForm phi={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
          )}
        </>
      )}
    </Modal>
  )
}

function SettingsForm({ cfg, onSaved }) {
  const [form, setForm] = useState({
    phi_xu_ly: cfg?.phi_xu_ly ?? 6,
    phi_ha_tang: cfg?.phi_ha_tang ?? 3000,
    voucher_xtra_pct: cfg?.voucher_xtra_pct ?? 4,
    voucher_xtra_cap: cfg?.voucher_xtra_cap ?? 50000,
    freeship_xtra_pct: cfg?.freeship_xtra_pct ?? 6,
    dong_tai_tro_pct: cfg?.dong_tai_tro_pct ?? 30,
    dong_tai_tro_cap: cfg?.dong_tai_tro_cap ?? 50000,
    thue_pct: cfg?.thue_pct ?? 1.5,
    piship_phi: cfg?.piship_phi ?? 2700,
    ghi_chu: cfg?.ghi_chu ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error } = await supabase.from('shopee_settings')
      .update({ ...form, cap_nhat_luc: new Date().toISOString() }).eq('id', 1)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  const O = ({ nhan, khoa, don = '%', step = '0.01' }) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-navy-900">{nhan}</span>
      <div className="relative">
        <input type="number" step={step} value={form[khoa]}
          onChange={(e) => setForm({ ...form, [khoa]: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-9 text-right text-sm outline-none focus:border-coral-500" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">{don}</span>
      </div>
    </label>
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        Shopee đổi biểu phí theo từng đợt. Khi có thông báo mới, chị cập nhật ở đây là toàn bộ bảng tính chạy theo.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <O nhan="Phí xử lý giao dịch" khoa="phi_xu_ly" />
        <O nhan="Phí hạ tầng mỗi đơn" khoa="phi_ha_tang" don="đ" step="500" />
        <O nhan="Voucher Xtra" khoa="voucher_xtra_pct" />
        <O nhan="Voucher Xtra tối đa" khoa="voucher_xtra_cap" don="đ" step="1000" />
        <O nhan="Freeship Xtra" khoa="freeship_xtra_pct" />
        <O nhan="Shop đồng tài trợ mã" khoa="dong_tai_tro_pct" />
        <O nhan="Đồng tài trợ tối đa" khoa="dong_tai_tro_cap" don="đ" step="1000" />
        <O nhan="Thuế trên doanh thu" khoa="thue_pct" />
        <O nhan="Gói PiShip mỗi đơn" khoa="piship_phi" don="đ" step="100" />
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-navy-900">Ghi chú hiệu lực</span>
        <textarea rows={3} value={form.ghi_chu}
          onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      </label>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tham số phí'}</Button>
      </div>
    </form>
  )
}

function FeeForm({ phi, onClose, onSaved }) {
  const isEdit = !!phi.id
  const [form, setForm] = useState({
    nganh_1: phi.nganh_1 || '', nganh_2: phi.nganh_2 || '',
    phi_phan_tram: phi.phi_phan_tram ?? '', ap_dung_tu: phi.ap_dung_tu || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      nganh_1: form.nganh_1.trim(), nganh_2: form.nganh_2.trim(),
      phi_phan_tram: Number(form.phi_phan_tram) || 0,
      ap_dung_tu: form.ap_dung_tu.trim() || null,
    }
    const { error } = isEdit
      ? await supabase.from('shopee_fees').update(payload).eq('id', phi.id)
      : await supabase.from('shopee_fees').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'Ngành hàng này đã có trong bảng phí.' : error.message)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Sửa mức phí' : 'Thêm ngành hàng'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input label="Ngành hàng cấp 1 *" required value={form.nganh_1}
          onChange={(e) => setForm({ ...form, nganh_1: e.target.value })} placeholder="VD: Thời Trang Nữ" />
        <Input label="Ngành hàng cấp 2 *" required value={form.nganh_2}
          onChange={(e) => setForm({ ...form, nganh_2: e.target.value })} placeholder="VD: Áo thun" />
        <Input label="Phí cố định (%) *" type="number" step="0.01" required value={form.phi_phan_tram}
          onChange={(e) => setForm({ ...form, phi_phan_tram: e.target.value })} placeholder="VD: 11.78" />
        <Input label="Áp dụng từ" value={form.ap_dung_tu}
          onChange={(e) => setForm({ ...form, ap_dung_tu: e.target.value })} placeholder="VD: 23/05/2026" />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        </div>
      </form>
    </Modal>
  )
}
