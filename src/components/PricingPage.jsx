import { useEffect, useMemo, useState } from 'react'
import {
  Settings2, Plus, Trash2, Pencil, TriangleAlert, Tag, Search, X, Copy, Save, FileDown,
  FolderOpen, Target, Swords, Percent, ChevronDown, FilePlus2,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Badge, Modal } from './ui'
import { formatVnd } from '../lib/constants'
import { tinhSanPham, dongTien, CACH_TINH, so, timGiaBan } from '../lib/pricing'
import { gomDuLieu } from '../lib/pricing'
import { xuatBangGia } from '../lib/pricingXlsx'
import FeesImportModal from './FeesImportModal'

const nhap = (v) => (v === '' || v === null || v === undefined ? '' : Number(v).toLocaleString('vi-VN'))
const vnd = (n) => formatVnd(Math.round(Number(n) || 0))
const pt2 = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + '%'
const uid = () => Math.random().toString(36).slice(2, 9)
const boDau = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const F_MAC_DINH = {
  giaNiemYet: '', giamGiaPct: 0, voucherShop: '',
  giaVon: '', dongGoi: '', chiPhiKhac: '',
  phiCoDinhPct: '', quangCaoPct: 10, affiliatePct: 0, phiNguoiBanMoi: '',
  voucherXtra: false, maUuDai: '', freeshipXtra: false, piship: false,
  coThue: true, nguoiBanMoi: false,
  bienMongMuon: 20, loiTien: '', laiVonPct: 30,
}
const spMoi = (goc) => ({
  id: uid(), ten: '', nganh1: '', nganh2: '', khoangPhi: null,
  cheDo: goc?.cheDo || 'loi_nhuan', kieu: goc?.kieu || 'pct',
  f: { ...F_MAC_DINH, ...(goc ? { quangCaoPct: goc.f.quangCaoPct, coThue: goc.f.coThue, nguoiBanMoi: goc.f.nguoiBanMoi } : {}) },
})

const CACH = [
  { k: 'loi_nhuan', icon: Target, ten: 'Theo mục tiêu lợi nhuận', mt: 'Nhập lợi nhuận muốn có → ra giá bán' },
  { k: 'gia_ban', icon: Swords, ten: 'Theo giá bán cạnh tranh', mt: 'Nhập giá muốn bán → ra lợi nhuận' },
]

export default function PricingPage({ currentProfile }) {
  const [fees, setFees] = useState([])
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [moBangPhi, setMoBangPhi] = useState(false)

  const [sps, setSps] = useState(() => [spMoi()])
  const [chon, setChon] = useState(null)
  const [timNganh, setTimNganh] = useState('')
  const [moGoiY, setMoGoiY] = useState(false)
  const [moPhi, setMoPhi] = useState(true)

  const [nhoms, setNhoms] = useState([])
  const [nhom, setNhom] = useState({ id: null, ten: '' })
  const [dirty, setDirty] = useState(false)
  const [tb, setTb] = useState(null)
  const [dangLuu, setDangLuu] = useState(false)

  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load(); taiNhoms() }, [])
  useEffect(() => { if (!chon && sps[0]) setChon(sps[0].id) }, [sps, chon])
  useEffect(() => { if (tb) { const t = setTimeout(() => setTb(null), 4000); return () => clearTimeout(t) } }, [tb])

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

  async function taiNhoms() {
    const { data } = await supabase.from('nhom_dinh_gia').select('id, ten, updated_at').order('updated_at', { ascending: false })
    setNhoms(data || [])
  }

  const kqs = useMemo(() => sps.map((sp) => tinhSanPham(sp, cfg)), [sps, cfg])
  const idx = Math.max(0, sps.findIndex((x) => x.id === chon))
  const sp = sps[idx]
  const tt = kqs[idx]

  const sua = (id, fn) => { setSps((a) => a.map((x) => (x.id === id ? fn(x) : x))); setDirty(true) }
  const suaSp = (patch) => sua(sp.id, (x) => ({ ...x, ...patch }))
  const suaF = (patch) => sua(sp.id, (x) => ({ ...x, f: { ...x.f, ...patch } }))

  const ketQuaTim = useMemo(() => {
    const tu = boDau(timNganh).trim().split(/\s+/).filter(Boolean)
    if (!tu.length) return []
    return fees.filter((x) => tu.every((t) => boDau(`${x.nganh_1} ${x.nganh_2}`).includes(t))).slice(0, 40)
  }, [fees, timNganh])

  function chonNganh(item) {
    const coKhoang = item.phi_min != null && item.phi_max != null && item.phi_min !== item.phi_max
    sua(sp.id, (x) => ({
      ...x, nganh1: item.nganh_1, nganh2: item.nganh_2,
      khoangPhi: coKhoang ? { min: item.phi_min, max: item.phi_max } : null,
      f: {
        ...x.f, phiCoDinhPct: String(item.phi_phan_tram),
        phiNguoiBanMoi: item.phi_nguoi_ban_moi != null ? String(item.phi_nguoi_ban_moi) : '',
      },
    }))
    setTimNganh(''); setMoGoiY(false)
  }

  function themSp(goc) {
    const m = spMoi(goc)
    if (goc) { m.ten = goc.ten ? goc.ten + ' (bản sao)' : ''; m.nganh1 = goc.nganh1; m.nganh2 = goc.nganh2; m.khoangPhi = goc.khoangPhi; m.f = { ...goc.f } }
    setSps((a) => [...a, m]); setChon(m.id); setDirty(true)
  }

  function xoaSp(id) {
    if (sps.length === 1) { setSps([spMoi()]); setChon(null); setDirty(true); return }
    const con = sps.filter((x) => x.id !== id)
    setSps(con); setDirty(true)
    if (chon === id) setChon(con[0].id)
  }

  function nhomMoi() {
    if (dirty && sps.some((x) => x.ten || so(x.f.giaVon)) && !window.confirm('Bỏ nhóm đang làm dở và bắt đầu nhóm mới?')) return
    const m = spMoi()
    setSps([m]); setChon(m.id); setNhom({ id: null, ten: '' }); setDirty(false)
  }

  async function moNhom(id) {
    if (!id) return
    if (dirty && sps.some((x) => x.ten || so(x.f.giaVon)) && !window.confirm('Nhóm đang làm chưa lưu sẽ mất. Vẫn mở nhóm khác?')) return
    const { data, error } = await supabase.from('nhom_dinh_gia').select('*').eq('id', id).single()
    if (error || !data) { setTb({ loi: true, text: 'Không mở được nhóm này.' }); return }
    const ds = (data.du_lieu || []).map((x) => ({ ...spMoi(), ...x, f: { ...F_MAC_DINH, ...(x.f || {}) } }))
    const dsOk = ds.length ? ds : [spMoi()]
    setSps(dsOk); setChon(dsOk[0].id); setNhom({ id: data.id, ten: data.ten }); setDirty(false)
  }

  async function luuNhom() {
    const ten = nhom.ten.trim()
    if (!ten) { setTb({ loi: true, text: 'Chị nhập tên nhóm trước khi lưu nhé.' }); return }
    setDangLuu(true)
    const payload = { ten, du_lieu: sps, updated_at: new Date().toISOString() }
    const res = nhom.id
      ? await supabase.from('nhom_dinh_gia').update(payload).eq('id', nhom.id).select('id').single()
      : await supabase.from('nhom_dinh_gia').insert({ ...payload, created_by: currentProfile?.id || null }).select('id').single()
    setDangLuu(false)
    if (res.error) { setTb({ loi: true, text: 'Lưu chưa được: ' + res.error.message }); return }
    setNhom({ id: res.data?.id || nhom.id, ten }); setDirty(false)
    setTb({ text: `Đã lưu nhóm "${ten}".` })
    taiNhoms()
  }

  async function xoaNhom() {
    if (!nhom.id || !window.confirm(`Xoá nhóm "${nhom.ten}"?`)) return
    await supabase.from('nhom_dinh_gia').delete().eq('id', nhom.id)
    setNhom({ id: null, ten: '' }); setDirty(false); taiNhoms()
    setTb({ text: 'Đã xoá nhóm.' })
  }

  async function xuat() {
    try { await xuatBangGia({ tenNhom: nhom.ten, sps, kqs, cfg }) }
    catch (e) { setTb({ loi: true, text: 'Xuất file chưa được: ' + e.message }) }
  }

  const tenSp = (x, i) => x.ten.trim() || `Sản phẩm ${i + 1}`
  const d = tt?.d
  const cachInfo = CACH.find((c) => c.k === sp?.cheDo)

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tính giá bán Shopee</h1>
          <p className="text-sm text-ink-600">Tính nhiều sản phẩm cùng lúc, lưu thành nhóm và xuất file Excel</p>
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
        <div className="space-y-5 p-8">
          {/* ===== THANH NHÓM ===== */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <FolderOpen size={18} className="text-coral-500" />
            <select value={nhom.id || ''} onChange={(e) => moNhom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500">
              <option value="">{nhoms.length ? `Mở nhóm đã lưu (${nhoms.length})` : 'Chưa có nhóm nào được lưu'}</option>
              {nhoms.map((n) => <option key={n.id} value={n.id}>{n.ten}</option>)}
            </select>
            <input value={nhom.ten} onChange={(e) => { setNhom({ ...nhom, ten: e.target.value }); setDirty(true) }}
              placeholder="Tên nhóm, VD: Bộ sưu tập hè 2026"
              className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
            {dirty && <span className="text-xs text-amber-600">● Chưa lưu</span>}
            <Button type="button" onClick={luuNhom} disabled={dangLuu}><Save size={15} /> {dangLuu ? 'Đang lưu...' : 'Lưu nhóm'}</Button>
            <Button type="button" variant="secondary" onClick={nhomMoi}><FilePlus2 size={15} /> Nhóm mới</Button>
            <Button type="button" variant="secondary" onClick={xuat}><FileDown size={15} /> Xuất Excel</Button>
            {nhom.id && (
              <button type="button" onClick={xoaNhom} title="Xoá nhóm" className="rounded p-2 text-ink-400 hover:text-rose-500">
                <Trash2 size={16} />
              </button>
            )}
            {tb && (
              <p className={`w-full text-sm ${tb.loi ? 'text-rose-600' : 'text-emerald-600'}`}>{tb.text}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[290px_1fr]">
            {/* ===== DANH SÁCH SẢN PHẨM ===== */}
            <aside className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="font-display font-semibold text-navy-900">Sản phẩm trong nhóm ({sps.length})</p>
              </div>
              {sps.map((x, i) => {
                const k = kqs[i]
                const dangChon = x.id === sp.id
                return (
                  <div key={x.id} onClick={() => { setChon(x.id); setTimNganh(''); setMoGoiY(false) }}
                    className={`cursor-pointer rounded-xl border-2 bg-white p-3 shadow-sm transition ${
                      dangChon ? 'border-coral-500' : 'border-transparent hover:border-slate-200'
                    }`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                        dangChon ? 'bg-coral-500 text-white' : 'bg-slate-100 text-ink-600'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy-900">{tenSp(x, i)}</p>
                        <p className="truncate text-xs text-ink-400">{CACH_TINH[x.cheDo]}</p>
                      </div>
                      <div className="flex flex-none gap-1">
                        <button type="button" title="Nhân đôi" onClick={(e) => { e.stopPropagation(); themSp(x) }}
                          className="rounded p-1 text-ink-400 hover:text-coral-500"><Copy size={14} /></button>
                        <button type="button" title="Xoá" onClick={(e) => { e.stopPropagation(); xoaSp(x.id) }}
                          className="rounded p-1 text-ink-400 hover:text-rose-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {k.chuaDu ? (
                      <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-ink-400">Nhập giá vốn để tính</p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                        <div>
                          <p className="text-ink-400">Giá niêm yết</p>
                          <p className="font-semibold text-navy-900">{vnd(k.kq.giaNiemYet)}</p>
                        </div>
                        <div>
                          <p className="text-ink-400">Lợi nhuận ({pt2(k.kq.bien)})</p>
                          <p className={`font-semibold ${k.lo ? 'text-rose-600' : 'text-emerald-600'}`}>{vnd(k.kq.loiNhuan)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <button type="button" onClick={() => themSp()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-ink-600 transition hover:border-coral-500 hover:text-coral-500">
                <Plus size={16} /> Thêm sản phẩm
              </button>
            </aside>

            {/* ===== CHỈNH SẢN PHẨM ĐANG CHỌN ===== */}
            <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[1fr_380px]">
              <div className="space-y-4">
                <div className={`rounded-2xl px-5 py-4 shadow-sm 2xl:hidden ${tt.lo ? 'bg-rose-50' : 'bg-navy-950'}`}>
                  {tt.chuaDu ? (
                    <p className="text-sm text-white/60">Nhập giá vốn và mục tiêu để xem kết quả ngay tại đây.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <O nhan="Giá niêm yết" gtri={vnd(tt.kq.giaNiemYet)} lo={tt.lo} />
                      <O nhan="Khách trả" gtri={vnd(tt.kq.giaSauGiam)} lo={tt.lo} />
                      <O nhan="Lợi nhuận / đơn" gtri={vnd(tt.kq.loiNhuan)} lo={tt.lo} />
                      <O nhan="Biên lợi nhuận" gtri={pt2(tt.kq.bien)} lo={tt.lo} />
                    </div>
                  )}
                </div>
                <Panel so={1} title="Thông tin sản phẩm">
                  <Input label="Tên sản phẩm" value={sp.ten} placeholder={`Sản phẩm ${idx + 1}`}
                    onChange={(e) => suaSp({ ten: e.target.value })} />
                  <div className="relative mt-3">
                    <span className="mb-1.5 block text-sm font-medium text-navy-900">Ngành hàng</span>
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      <input value={timNganh}
                        onChange={(e) => { setTimNganh(e.target.value); setMoGoiY(true) }}
                        onFocus={() => setMoGoiY(true)}
                        placeholder="Gõ tên ngành hàng, VD: sua rua mat, ao thun, tai nghe..."
                        className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none focus:border-coral-500" />
                      {timNganh && (
                        <button type="button" onClick={() => { setTimNganh(''); setMoGoiY(false) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-navy-900">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {moGoiY && timNganh.trim() && (
                      <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                        {ketQuaTim.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-ink-400">Không tìm thấy ngành hàng nào. Thử từ khoá ngắn hơn.</p>
                        ) : ketQuaTim.map((x) => (
                          <button type="button" key={x.id} onClick={() => chonNganh(x)}
                            className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-navy-900">{x.nganh_2}</p>
                              <p className="truncate text-xs text-ink-400">{x.nganh_1}</p>
                            </div>
                            <span className="flex-none rounded-md bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-600">{x.phi_phan_tram}%</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {sp.nganh2 && (
                      <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2">
                        <p className="truncate text-sm font-medium text-navy-900">{sp.nganh2}</p>
                        <p className="truncate text-xs text-emerald-700">{sp.nganh1} · phí cố định {sp.f.phiCoDinhPct}%</p>
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel so={2} title="Chi phí thật của sản phẩm">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <OTien label="Giá vốn / giá nhập" value={sp.f.giaVon} onChange={(v) => suaF({ giaVon: v })} />
                    <OTien label="Đóng gói, nhân công" value={sp.f.dongGoi} onChange={(v) => suaF({ dongGoi: v })} />
                    <OTien label="Chi phí khác" value={sp.f.chiPhiKhac} onChange={(v) => suaF({ chiPhiKhac: v })}
                      goiY="Kho bãi, dự phòng đổi trả..." />
                  </div>
                </Panel>

                <Panel so={3} title="Chọn cách định giá">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {CACH.map((c) => {
                      const Ic = c.icon
                      const on = sp.cheDo === c.k
                      return (
                        <button key={c.k} type="button" onClick={() => suaSp({ cheDo: c.k })}
                          className={`rounded-xl border-2 p-3 text-left transition ${
                            on ? 'border-coral-500 bg-coral-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <Ic size={18} className={on ? 'text-coral-500' : 'text-ink-400'} />
                          <p className="mt-1.5 text-sm font-semibold text-navy-900">{c.ten}</p>
                          <p className="mt-0.5 text-xs text-ink-600">{c.mt}</p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    {sp.cheDo === 'loi_nhuan' && (
                      <>
                        <div className="mb-3 inline-flex rounded-lg bg-white p-1 text-sm shadow-sm">
                          {[['pct', 'Theo % biên lợi nhuận'], ['tien', 'Theo số tiền / đơn']].map(([k, l]) => (
                            <button key={k} type="button" onClick={() => suaSp({ kieu: k })}
                              className={`rounded-md px-3 py-1.5 transition ${
                                sp.kieu === k ? 'bg-navy-900 text-white' : 'text-ink-600 hover:text-navy-900'}`}>{l}</button>
                          ))}
                        </div>
                        {sp.kieu === 'pct' ? (
                          <OPhanTram label="Biên lợi nhuận mong muốn" value={sp.f.bienMongMuon}
                            onChange={(v) => suaF({ bienMongMuon: v })} goiY="Tính trên số tiền khách thực trả" />
                        ) : (
                          <OTien label="Lợi nhuận mong muốn mỗi đơn" value={sp.f.loiTien}
                            onChange={(v) => suaF({ loiTien: v })} goiY="Số tiền thực nhận sau khi trừ mọi chi phí và phí sàn" />
                        )}
                      </>
                    )}
                    {sp.cheDo === 'gia_ban' && (
                      <OTien label="Giá niêm yết muốn bán trên sàn" value={sp.f.giaNiemYet}
                        onChange={(v) => suaF({ giaNiemYet: v })} goiY="Giá gốc trước khi áp khuyến mãi, theo mặt bằng giá của đối thủ" />
                    )}
                  </div>
                </Panel>

                <Panel so={4} title={<span className="inline-flex items-center gap-2"><Tag size={15} className="text-coral-500" /> Khuyến mãi đang chạy</span>}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-navy-900">Giảm giá chương trình</span>
                        <span className="font-display font-bold text-coral-500">{so(sp.f.giamGiaPct)}%</span>
                      </div>
                      <input type="range" min="0" max="70" step="1" value={sp.f.giamGiaPct}
                        onChange={(e) => suaF({ giamGiaPct: e.target.value })} className="w-full accent-coral-500" />
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {[0, 10, 20, 30, 50].map((p) => (
                          <button key={p} type="button" onClick={() => suaF({ giamGiaPct: p })}
                            className={`rounded-md px-2 py-0.5 text-xs transition ${
                              so(sp.f.giamGiaPct) === p ? 'bg-coral-500 text-white' : 'bg-slate-100 text-ink-600 hover:bg-slate-200'}`}>
                            {p === 0 ? 'Ngày thường' : `-${p}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <OTien label="Mã giảm giá của shop" value={sp.f.voucherShop}
                      onChange={(v) => suaF({ voucherShop: v })} goiY="Số tiền shop tự giảm thêm cho khách" />
                  </div>
                </Panel>

                <div className="rounded-2xl bg-white shadow-sm">
                  <button type="button" onClick={() => setMoPhi(!moPhi)}
                    className="flex w-full items-center gap-3 p-5 text-left">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">5</span>
                    <span className="flex-1 font-display font-semibold text-navy-900">Phí sàn & dịch vụ</span>
                    <ChevronDown size={18} className={`text-ink-400 transition ${moPhi ? 'rotate-180' : ''}`} />
                  </button>
                  {moPhi && d && (
                    <div className="space-y-3 px-5 pb-5">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <OPhanTram label="Phí cố định ngành hàng" value={sp.f.phiCoDinhPct}
                          onChange={(v) => suaF({ phiCoDinhPct: v })}
                          goiY={sp.khoangPhi
                            ? `Shopee công bố khoảng ${sp.khoangPhi.min}% – ${sp.khoangPhi.max}%. Đang lấy mức cao nhất, sửa được.`
                            : sp.nganh2 ? 'Tự điền theo ngành hàng, sửa được' : 'Chọn ngành hàng để tự điền'} />
                        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
                          Phí xử lý giao dịch <b className="text-navy-900">{d.phiXuLyPct}%</b> và phí hạ tầng{' '}
                          <b className="text-navy-900">{vnd(d.phiHaTang)}/đơn</b> luôn được tính tự động.
                        </div>
                      </div>

                      <Bat tick={sp.f.nguoiBanMoi} on={(v) => suaF({ nguoiBanMoi: v })} xanh
                        tieuDe="Ưu đãi người bán mới"
                        phu={`Đăng sản phẩm đầu 01/01–31/05/2026 · áp dụng 01/06–31/08/2026.${
                          tt.kq.phiCoDinhPct !== tt.kq.phiCoDinhGoc ? ` Đang tính ${tt.kq.phiCoDinhPct}% thay vì ${tt.kq.phiCoDinhGoc}%.` : ''}`} />

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Bat tick={sp.f.voucherXtra} on={(v) => suaF({ voucherXtra: v })}
                          tieuDe="Gói Voucher Xtra" phu={`${d.vxPct}% giá trị sản phẩm, tối đa ${vnd(d.vxCap)}`} />
                        <Bat tick={sp.f.freeshipXtra} on={(v) => suaF({ freeshipXtra: v })}
                          tieuDe="Freeship Xtra" phu={`${d.fsPct}% giá trị sản phẩm`} />
                        <Bat tick={sp.f.piship} on={(v) => suaF({ piship: v })}
                          tieuDe="Gói PiShip" phu={`Tiết kiệm vận chuyển · ${vnd(d.pishipPhi)}/đơn`} />
                        <Bat tick={sp.f.coThue} on={(v) => suaF({ coThue: v })}
                          tieuDe="Trừ thuế" phu={`${d.thuePct}% doanh thu (hộ kinh doanh: 1% GTGT + 0,5% TNCN)`} />
                      </div>

                      {!sp.f.voucherXtra && (
                        <OTien label="Mã ưu đãi Shopee áp lên sản phẩm" value={sp.f.maUuDai}
                          onChange={(v) => suaF({ maUuDai: v })}
                          goiY={`Không tham gia Voucher Xtra thì shop đồng tài trợ ${d.dtdPct}% giá trị mã, tối đa ${vnd(d.dtdCap)}`} />
                      )}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <OPhanTram label="Hoa hồng tiếp thị liên kết" value={sp.f.affiliatePct}
                          onChange={(v) => suaF({ affiliatePct: v })} goiY="Affiliate / KOC, để 0 nếu không chạy" />
                        <OPhanTram label="Ngân sách quảng cáo" value={sp.f.quangCaoPct}
                          onChange={(v) => suaF({ quangCaoPct: v })} goiY="Ads chiếm bao nhiêu % doanh thu" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== KẾT QUẢ ===== */}
              <div className="2xl:sticky 2xl:top-4">
                <KetQuaSP sp={sp} tt={tt} cachTen={cachInfo?.ten} />
              </div>
            </div>
          </div>

          {/* ===== BẢNG TỔNG HỢP ===== */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-semibold text-navy-900">
                Bảng tổng hợp{nhom.ten ? ` — ${nhom.ten}` : ''}
              </p>
              <Button type="button" variant="secondary" onClick={xuat}><FileDown size={15} /> Xuất Excel</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['STT', 'Sản phẩm', 'Ngành hàng', 'Cách định giá', 'Chi phí thật', 'Giá niêm yết', 'Khách trả', 'Tổng phí sàn', 'Lợi nhuận / đơn', 'Biên LN', 'Lãi / vốn'].map((h, i) => (
                      <th key={h} className={`border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-semibold text-navy-900 ${i > 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sps.map((x, i) => {
                    const k = kqs[i]
                    const o = k.kq
                    return (
                      <tr key={x.id} onClick={() => setChon(x.id)}
                        className={`cursor-pointer ${x.id === sp.id ? 'bg-coral-50' : 'hover:bg-slate-50'}`}>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1.5 font-medium text-navy-900">{tenSp(x, i)}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-ink-600">{x.nganh2 || '—'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-ink-600">{CACH_TINH[x.cheDo]}</td>
                        {k.chuaDu ? (
                          <td colSpan={7} className="border border-slate-300 px-2 py-1.5 text-center text-ink-400">Chưa đủ dữ liệu (nhập giá vốn)</td>
                        ) : (
                          <>
                            <td className="border border-slate-300 px-2 py-1.5 text-right">{vnd(o.chiPhiThat)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-navy-900">{vnd(o.giaNiemYet)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right">{vnd(o.giaSauGiam)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right">{vnd(o.tongPhi)}</td>
                            <td className={`border border-slate-300 px-2 py-1.5 text-right font-semibold ${k.lo ? 'text-rose-600' : 'text-emerald-600'}`}>{vnd(o.loiNhuan)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right">{pt2(o.bien)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right">{pt2(o.tyLeVon)}</td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {cfg?.ghi_chu && <p className="mt-3 text-xs text-ink-400">{cfg.ghi_chu}</p>}
          </div>
        </div>
      )}

      {moBangPhi && <FeesModal cfg={cfg} onClose={() => { setMoBangPhi(false); load() }} />}
    </div>
  )
}

function KetQuaSP({ sp, tt, cachTen }) {
  const { kq, chuaDu, lo, hoaVon, khongSale, d } = tt
  const timGia = sp.cheDo !== 'gia_ban'
  const coSale = so(sp.f.giamGiaPct) > 0 || so(sp.f.voucherShop) > 0
  const dong = chuaDu ? [] : dongTien(kq, d)
  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-6 shadow-sm ${lo ? 'bg-rose-50' : 'bg-navy-950'}`}>
        <p className={`text-xs font-medium uppercase tracking-wide ${lo ? 'text-rose-600' : 'text-white/50'}`}>
          {timGia ? 'Giá niêm yết cần đặt' : 'Lợi nhuận một đơn'}
        </p>
        <p className={`mt-1 font-display text-3xl font-bold ${chuaDu ? 'text-white/40' : lo ? 'text-rose-600' : 'text-white'}`}>
          {chuaDu ? '—' : vnd(timGia ? kq.giaNiemYet : kq.loiNhuan)}
        </p>
        <p className={`mt-1 text-xs ${lo ? 'text-rose-500' : 'text-white/40'}`}>{cachTen}</p>
        {!chuaDu && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4"
            style={{ borderColor: lo ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.12)' }}>
            <O nhan="Khách trả" gtri={vnd(kq.giaSauGiam)} lo={lo} />
            <O nhan={timGia ? 'Lợi nhuận / đơn' : 'Biên lợi nhuận'} gtri={timGia ? vnd(kq.loiNhuan) : pt2(kq.bien)} lo={lo} />
            <O nhan={timGia ? 'Biên lợi nhuận' : 'Lãi trên vốn'} gtri={timGia ? pt2(kq.bien) : pt2(kq.tyLeVon)} lo={lo} />
            <O nhan="Tổng phí sàn" gtri={vnd(kq.tongPhi)} lo={lo} />
          </div>
        )}
        {lo && (
          <p className="mt-3 text-sm text-rose-700">
            Đang lỗ. Giá niêm yết tối thiểu để hoà vốn với mức khuyến mãi này là <b>{vnd(hoaVon)}</b>.
          </p>
        )}
      </div>

      {coSale && !chuaDu && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-900">
            <TriangleAlert size={16} />
            <p className="font-display text-sm font-semibold">Ngày sale so với ngày thường</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-amber-700">Ngày thường</p>
              <p className="font-display font-bold text-navy-900">{vnd(khongSale.loiNhuan)}</p>
              <p className="text-xs text-amber-700">biên {pt2(khongSale.bien)}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700">Ngày sale</p>
              <p className={`font-display font-bold ${lo ? 'text-rose-600' : 'text-navy-900'}`}>{vnd(kq.loiNhuan)}</p>
              <p className="text-xs text-amber-700">biên {pt2(kq.bien)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-amber-800">Khuyến mãi làm lợi nhuận giảm <b>{vnd(khongSale.loiNhuan - kq.loiNhuan)}</b> mỗi đơn.</p>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 font-display font-semibold text-navy-900">Chi tiết dòng tiền</p>
        {chuaDu ? (
          <p className="py-6 text-center text-sm text-ink-400">Nhập giá vốn và mục tiêu/giá bán để xem chi tiết.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody>
              {dong.map((r, i) => (
                <tr key={i} className={r.loai === 'tong' ? 'bg-slate-100' : r.loai === 'dam' ? 'bg-slate-50' : ''}>
                  <td className={`border border-slate-300 px-2 py-1.5 ${r.loai ? 'font-semibold text-navy-900' : 'text-ink-600'}`}>{r.nhan}</td>
                  <td className={`border border-slate-300 px-2 py-1.5 text-right ${r.loai ? 'font-semibold' : ''} ${
                    r.loai === 'tong' ? (lo ? 'text-rose-600' : 'text-emerald-600') : 'text-navy-900'}`}>
                    {r.tien < 0 ? '− ' : ''}{vnd(Math.abs(r.tien))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!chuaDu && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-1 font-display font-semibold text-navy-900">Giá niêm yết theo mức lãi</p>
          <p className="mb-3 text-xs text-ink-400">Đã tính sẵn khuyến mãi {so(sp.f.giamGiaPct)}% đang chọn.</p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <MocGia nhan="Hoà vốn" tien={hoaVon} />
              {[10, 20, 30].map((p) => <MocGia key={p} nhan={`Lãi ${p}%`} tien={timGiaBan(d, p)} />)}
            </tbody>
          </table>
        </div>
      )}
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

function Panel({ so: buoc, title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3 font-display font-semibold text-navy-900">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{buoc}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

function Bat({ tick, on, tieuDe, phu, xanh }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
      xanh ? 'border-emerald-200 bg-emerald-50' : tick ? 'border-coral-500 bg-coral-50' : 'border-slate-200'}`}>
      <input type="checkbox" checked={tick} className="mt-0.5 h-4 w-4 rounded border-slate-300"
        onChange={(e) => on(e.target.checked)} />
      <span className="flex-1">
        <b className="text-navy-900">{tieuDe}</b>
        <span className={`block text-xs ${xanh ? 'text-emerald-800' : 'text-ink-600'}`}>{phu}</span>
      </span>
    </label>
  )
}

function MocGia({ nhan, tien }) {
  return (
    <tr>
      <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-ink-600">{nhan}</td>
      <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-navy-900">{vnd(tien)}</td>
    </tr>
  )
}

function OTien({ label, value, onChange, goiY }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-navy-900">{label}</span>
      <div className="relative">
        <input type="text" inputMode="numeric" value={nhap(value)} placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-right text-sm outline-none focus:border-coral-500" />
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
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-right text-sm outline-none focus:border-coral-500" />
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
