import { useEffect, useMemo, useState } from 'react'
import { Calculator, ArrowLeftRight, Settings2, Plus, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Badge, Modal } from './ui'
import { formatVnd } from '../lib/constants'

const so = (v) => Number(String(v).replace(/[^\d.-]/g, '')) || 0
const nhap = (v) => (v === '' || v === null || v === undefined ? '' : Number(v).toLocaleString('vi-VN'))

export default function PricingPage({ currentProfile }) {
  const [fees, setFees] = useState([])
  const [loading, setLoading] = useState(true)
  const [quanLyPhi, setQuanLyPhi] = useState(false)

  // Chế độ: 'tu_gia_ban' = biết giá bán, tính lợi nhuận | 'tu_loi_nhuan' = muốn lãi bao nhiêu, tính giá bán
  const [cheDo, setCheDo] = useState('tu_gia_ban')

  const [nganh1, setNganh1] = useState('')
  const [nganh2, setNganh2] = useState('')
  const [f, setF] = useState({
    giaVon: '',
    dongGoi: '',
    chiPhiKhac: '',
    phiSan: '',          // % tự điền theo ngành, sửa được
    freeshipXtra: false,
    voucherXtra: false,
    phiFreeship: 6,
    phiVoucher: 3,
    quangCao: 10,        // % trên doanh thu
    giaBan: '',
    bienLoiNhuan: 20,    // % mong muốn
  })

  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('shopee_fees').select('*')
      .eq('active', true).order('nganh_1').order('nganh_2')
    setFees(data || [])
    setLoading(false)
  }

  const nganhCap1 = useMemo(() => [...new Set(fees.map((x) => x.nganh_1))], [fees])
  const nganhCap2 = useMemo(() => fees.filter((x) => x.nganh_1 === nganh1), [fees, nganh1])

  function chonNganh2(ten) {
    setNganh2(ten)
    const item = fees.find((x) => x.nganh_1 === nganh1 && x.nganh_2 === ten)
    if (item) setF((old) => ({ ...old, phiSan: String(item.phi_phan_tram) }))
  }

  // ===== Tính toán =====
  const kq = useMemo(() => {
    const giaVon = so(f.giaVon)
    const dongGoi = so(f.dongGoi)
    const khac = so(f.chiPhiKhac)
    const chiPhiCoDinh = giaVon + dongGoi + khac

    const pctSan = so(f.phiSan)
    const pctFs = f.freeshipXtra ? so(f.phiFreeship) : 0
    const pctVc = f.voucherXtra ? so(f.phiVoucher) : 0
    const pctAds = so(f.quangCao)
    const tongPct = pctSan + pctFs + pctVc + pctAds   // % tính trên giá bán

    let giaBan = so(f.giaBan)
    if (cheDo === 'tu_loi_nhuan') {
      const pctLai = so(f.bienLoiNhuan)
      const conLai = 100 - tongPct - pctLai
      giaBan = conLai > 0 ? (chiPhiCoDinh * 100) / conLai : 0
    }

    const tienSan = (giaBan * pctSan) / 100
    const tienFs = (giaBan * pctFs) / 100
    const tienVc = (giaBan * pctVc) / 100
    const tienAds = (giaBan * pctAds) / 100
    const tongPhi = tienSan + tienFs + tienVc + tienAds

    const loiNhuan = giaBan - chiPhiCoDinh - tongPhi
    const bien = giaBan > 0 ? (loiNhuan / giaBan) * 100 : 0
    const tyLeVon = giaVon > 0 ? (loiNhuan / giaVon) * 100 : 0
    // Giá hoà vốn: bán dưới mức này là lỗ
    const hoaVon = tongPct < 100 ? (chiPhiCoDinh * 100) / (100 - tongPct) : 0

    return {
      giaVon, dongGoi, khac, chiPhiCoDinh,
      pctSan, pctFs, pctVc, pctAds, tongPct,
      giaBan, tienSan, tienFs, tienVc, tienAds, tongPhi,
      loiNhuan, bien, tyLeVon, hoaVon,
    }
  }, [f, cheDo])

  const lo = kq.loiNhuan < 0
  const chuaDu = kq.giaBan <= 0 || kq.chiPhiCoDinh <= 0

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tính giá bán Shopee</h1>
          <p className="text-sm text-ink-600">
            Tính lợi nhuận thực nhận sau khi trừ phí sàn, quảng cáo và chi phí vận hành
          </p>
        </div>
        {isAdmin && (
          <Button variant="secondary" onClick={() => setQuanLyPhi(true)}>
            <Settings2 size={16} /> Bảng phí sàn
          </Button>
        )}
      </header>

      {loading ? (
        <p className="py-16 text-center text-ink-400">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-2">
          {/* ===== CỘT NHẬP LIỆU ===== */}
          <div className="space-y-4">
            <Panel title="Ngành hàng">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Ngành hàng cấp 1" value={nganh1}
                  onChange={(e) => { setNganh1(e.target.value); setNganh2('') }}>
                  <option value="">-- Chọn --</option>
                  {nganhCap1.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
                <Select label="Ngành hàng cấp 2" value={nganh2} disabled={!nganh1}
                  onChange={(e) => chonNganh2(e.target.value)}>
                  <option value="">{nganh1 ? '-- Chọn --' : 'Chọn cấp 1 trước'}</option>
                  {nganhCap2.map((n) => <option key={n.id} value={n.nganh_2}>{n.nganh_2} — {n.phi_phan_tram}%</option>)}
                </Select>
              </div>
            </Panel>

            <Panel title="Chi phí sản phẩm">
              <div className="space-y-3">
                <OTien label="Giá vốn / giá nhập" value={f.giaVon}
                  onChange={(v) => setF({ ...f, giaVon: v })} />
                <OTien label="Đóng gói, nhân công" value={f.dongGoi}
                  onChange={(v) => setF({ ...f, dongGoi: v })} />
                <OTien label="Chi phí khác" value={f.chiPhiKhac}
                  onChange={(v) => setF({ ...f, chiPhiKhac: v })}
                  goiY="Kho bãi, đổi trả, hàng hỏng..." />
              </div>
            </Panel>

            <Panel title="Phí trên doanh thu">
              <div className="space-y-3">
                <OPhanTram label="Phí cố định sàn" value={f.phiSan}
                  onChange={(v) => setF({ ...f, phiSan: v })}
                  goiY={nganh2 ? 'Tự điền theo ngành hàng, sửa được' : 'Chọn ngành hàng để tự điền'} />
                <OPhanTram label="Chi phí quảng cáo" value={f.quangCao}
                  onChange={(v) => setF({ ...f, quangCao: v })}
                  goiY="Ước tính ads chiếm bao nhiêu % doanh thu" />

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                  <input type="checkbox" checked={f.freeshipXtra} className="h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, freeshipXtra: e.target.checked })} />
                  <span className="flex-1 text-sm text-navy-900">Freeship Xtra</span>
                  <input type="number" step="0.1" value={f.phiFreeship} disabled={!f.freeshipXtra}
                    onChange={(e) => setF({ ...f, phiFreeship: e.target.value })}
                    className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm disabled:bg-slate-50" />
                  <span className="text-sm text-ink-400">%</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                  <input type="checkbox" checked={f.voucherXtra} className="h-4 w-4 rounded border-slate-300"
                    onChange={(e) => setF({ ...f, voucherXtra: e.target.checked })} />
                  <span className="flex-1 text-sm text-navy-900">Voucher Xtra</span>
                  <input type="number" step="0.1" value={f.phiVoucher} disabled={!f.voucherXtra}
                    onChange={(e) => setF({ ...f, phiVoucher: e.target.value })}
                    className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm disabled:bg-slate-50" />
                  <span className="text-sm text-ink-400">%</span>
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
                <OTien label="Giá bán trên sàn" value={f.giaBan}
                  onChange={(v) => setF({ ...f, giaBan: v })} />
              ) : (
                <OPhanTram label="Biên lợi nhuận mong muốn" value={f.bienLoiNhuan}
                  onChange={(v) => setF({ ...f, bienLoiNhuan: v })}
                  goiY="Lợi nhuận chiếm bao nhiêu % giá bán" />
              )}
            </Panel>
          </div>

          {/* ===== CỘT KẾT QUẢ ===== */}
          <div className="space-y-4">
            <div className={`rounded-2xl p-6 shadow-sm ${lo && !chuaDu ? 'bg-rose-50' : 'bg-navy-950'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${lo && !chuaDu ? 'text-rose-600' : 'text-white/50'}`}>
                {cheDo === 'tu_loi_nhuan' ? 'Giá bán cần đặt' : 'Lợi nhuận một đơn'}
              </p>
              <p className={`mt-1 font-display text-3xl font-bold ${
                chuaDu ? 'text-white/40' : lo ? 'text-rose-600' : 'text-white'
              }`}>
                {chuaDu ? '—' : formatVnd(cheDo === 'tu_loi_nhuan' ? kq.giaBan : kq.loiNhuan)}
              </p>

              {!chuaDu && (
                <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4"
                  style={{ borderColor: lo ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.12)' }}>
                  <div>
                    <p className={`text-xs ${lo ? 'text-rose-500' : 'text-white/50'}`}>
                      {cheDo === 'tu_loi_nhuan' ? 'Lợi nhuận' : 'Biên lợi nhuận'}
                    </p>
                    <p className={`font-display text-lg font-bold ${lo ? 'text-rose-600' : 'text-white'}`}>
                      {cheDo === 'tu_loi_nhuan' ? formatVnd(kq.loiNhuan) : kq.bien.toFixed(1).replace('.', ',') + '%'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${lo ? 'text-rose-500' : 'text-white/50'}`}>Lãi trên vốn</p>
                    <p className={`font-display text-lg font-bold ${lo ? 'text-rose-600' : 'text-white'}`}>
                      {kq.tyLeVon.toFixed(1).replace('.', ',')}%
                    </p>
                  </div>
                </div>
              )}

              {lo && !chuaDu && (
                <p className="mt-3 text-sm text-rose-700">
                  Đang lỗ. Giá bán tối thiểu để hoà vốn là <b>{formatVnd(kq.hoaVon)}</b>.
                </p>
              )}
            </div>

            <Panel title="Chi tiết dòng tiền">
              {chuaDu ? (
                <p className="py-6 text-center text-sm text-ink-400">
                  Nhập giá vốn và {cheDo === 'tu_gia_ban' ? 'giá bán' : 'biên lợi nhuận'} để xem chi tiết.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    <Dong nhan="Giá bán" tien={kq.giaBan} dam />
                    <Dong nhan="Giá vốn" tien={-kq.giaVon} />
                    {kq.dongGoi > 0 && <Dong nhan="Đóng gói, nhân công" tien={-kq.dongGoi} />}
                    {kq.khac > 0 && <Dong nhan="Chi phí khác" tien={-kq.khac} />}
                    <Dong nhan={`Phí cố định sàn (${kq.pctSan}%)`} tien={-kq.tienSan} />
                    {kq.pctFs > 0 && <Dong nhan={`Freeship Xtra (${kq.pctFs}%)`} tien={-kq.tienFs} />}
                    {kq.pctVc > 0 && <Dong nhan={`Voucher Xtra (${kq.pctVc}%)`} tien={-kq.tienVc} />}
                    {kq.pctAds > 0 && <Dong nhan={`Quảng cáo (${kq.pctAds}%)`} tien={-kq.tienAds} />}
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
              <Panel title="Mốc giá tham khảo">
                <div className="space-y-2 text-sm">
                  <MocGia nhan="Hoà vốn (không lãi không lỗ)" tien={kq.hoaVon} />
                  {[10, 20, 30].map((p) => {
                    const g = 100 - kq.tongPct - p > 0 ? (kq.chiPhiCoDinh * 100) / (100 - kq.tongPct - p) : 0
                    return <MocGia key={p} nhan={`Lãi ${p}% giá bán`} tien={g} />
                  })}
                </div>
                <p className="mt-3 text-xs text-ink-400">
                  Tổng phí đang tính: {kq.tongPct.toFixed(2).replace('.', ',')}% doanh thu.
                  Phần trăm phí càng cao thì giá bán cần đặt càng xa giá vốn.
                </p>
              </Panel>
            )}
          </div>
        </div>
      )}

      {quanLyPhi && <FeesModal onClose={() => { setQuanLyPhi(false); load() }} />}
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
      <td className={`py-2 text-right ${dam ? 'font-medium text-navy-900' : tien < 0 ? 'text-ink-600' : 'text-navy-900'}`}>
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
        <input type="text" inputMode="numeric" value={nhap(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder="0"
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
        <input type="number" step="0.01" value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-right text-sm outline-none focus:border-coral-500" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">%</span>
      </div>
      {goiY && <span className="text-xs text-ink-400">{goiY}</span>}
    </label>
  )
}

function FeesModal({ onClose }) {
  const [fees, setFees] = useState([])
  const [loading, setLoading] = useState(true)
  const [tim, setTim] = useState('')
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')

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

  const loc = fees.filter((x) =>
    !tim || `${x.nganh_1} ${x.nganh_2}`.toLowerCase().includes(tim.toLowerCase()))

  return (
    <Modal title="Bảng phí cố định theo ngành hàng" onClose={onClose} wide>
      <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        Shopee thay đổi biểu phí theo từng đợt. Khi có bảng phí mới, chị sửa trực tiếp ở đây.
      </p>

      {msg && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</p>}

      <div className="mb-3 flex gap-2">
        <Input placeholder="Tìm ngành hàng..." value={tim} onChange={(e) => setTim(e.target.value)} className="flex-1" />
        <Button type="button" variant="secondary" className="flex-none"
          onClick={() => setEditing({ nganh_1: '', nganh_2: '', phi_phan_tram: '' })}>
          <Plus size={15} /> Thêm
        </Button>
      </div>

      {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
        <div className="max-h-[45vh] space-y-1 overflow-y-auto">
          {loc.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-navy-900">{x.nganh_2}</p>
                <p className="text-xs text-ink-400">{x.nganh_1}</p>
              </div>
              <Badge className="bg-coral-50 text-coral-600">{x.phi_phan_tram}%</Badge>
              <button onClick={() => setEditing(x)} className="text-ink-400 hover:text-coral-500">
                <Pencil size={14} />
              </button>
              <button onClick={() => xoa(x)} className="text-ink-400 hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {loc.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Không tìm thấy ngành hàng.</p>}
        </div>
      )}

      {editing && (
        <FeeForm phi={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }} />
      )}
    </Modal>
  )
}

function FeeForm({ phi, onClose, onSaved }) {
  const isEdit = !!phi.id
  const [form, setForm] = useState({
    nganh_1: phi.nganh_1 || '',
    nganh_2: phi.nganh_2 || '',
    phi_phan_tram: phi.phi_phan_tram ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      nganh_1: form.nganh_1.trim(),
      nganh_2: form.nganh_2.trim(),
      phi_phan_tram: Number(form.phi_phan_tram) || 0,
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

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        </div>
      </form>
    </Modal>
  )
}
