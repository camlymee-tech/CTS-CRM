import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, CircleCheck, Circle, Lock, ClipboardCheck, ExternalLink, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { laAdmin, laQuanLy, locNhanSu } from '../lib/quyen'
import { Button, Input, Select, Textarea, Modal } from './ui'

const TEN_NGAY = { 1: 'Hiểu công ty và dịch vụ', 2: 'Báo giá và chăm sóc', 3: 'Tình huống và ôn tập' }
const LOAI = { doc: 'Đọc', video: 'Video', thuc_hanh: 'Thực hành' }
const MAU_NGAY = ['bg-sky-50 text-sky-800', 'bg-amber-50 text-amber-800', 'bg-slate-100 text-slate-700']

export default function DaoTaoPage({ currentProfile }) {
  const admin = laAdmin(currentProfile)
  const quanLy = laQuanLy(currentProfile)
  const [bai, setBai] = useState([])
  const [tienDo, setTienDo] = useState([])        // của tất cả người mình được xem
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [mo, setMo] = useState(null)               // bài đang mở
  const [sua, setSua] = useState(null)             // bài đang sửa (admin) · {} = bài mới

  async function load() {
    const [b, t, p] = await Promise.all([
      supabase.from('dao_tao_bai').select('*').order('ngay').order('thu_tu'),
      supabase.from('dao_tao_tien_do').select('user_id, bai_id, xong_luc'),
      supabase.from('profiles').select('id, full_name, role, phong_ban'),
    ])
    setBai(b.data || []); setTienDo(t.data || []); setProfiles(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const xongCuaToi = useMemo(() => new Set(tienDo.filter((t) => t.user_id === currentProfile.id).map((t) => t.bai_id)), [tienDo, currentProfile.id])
  const cacNgay = useMemo(() => [...new Set(bai.map((b) => b.ngay))].sort((a, b) => a - b), [bai])
  const baiCuaNgay = (n) => bai.filter((b) => b.ngay === n)
  const xongNgay = (n) => baiCuaNgay(n).every((b) => xongCuaToi.has(b.id))
  const ngayMo = (n) => cacNgay.filter((x) => x < n).every(xongNgay)
  const tongXong = bai.filter((b) => xongCuaToi.has(b.id)).length
  const hocXongHet = bai.length > 0 && tongXong === bai.length

  async function danhDau(b, xong) {
    if (xong) await supabase.from('dao_tao_tien_do').upsert({ user_id: currentProfile.id, bai_id: b.id })
    else await supabase.from('dao_tao_tien_do').delete().eq('user_id', currentProfile.id).eq('bai_id', b.id)
    await load()
    setMo(null)
  }

  async function luuBai(f) {
    const payload = { ngay: Number(f.ngay), thu_tu: Number(f.thu_tu) || 1, tieu_de: f.tieu_de.trim(), loai: f.loai, phut: Number(f.phut) || 0, noi_dung: f.noi_dung || null, link: f.link || null }
    if (!payload.tieu_de) return 'Nhập tên bài học'
    const { error } = f.id ? await supabase.from('dao_tao_bai').update(payload).eq('id', f.id) : await supabase.from('dao_tao_bai').insert(payload)
    if (error) return error.message
    await load(); setSua(null); setMo(null)
    return ''
  }
  async function xoaBai(b) {
    if (!window.confirm(`Xoá bài "${b.tieu_de}"?`)) return
    await supabase.from('dao_tao_bai').delete().eq('id', b.id)
    await load(); setSua(null); setMo(null)
  }

  // Bảng tiến độ cho leader / admin
  const dsSale = useMemo(() => locNhanSu(currentProfile, profiles).filter((p) => p.role !== 'admin' || p.id === currentProfile.id).filter((p) => p.id !== currentProfile.id || !quanLy), [currentProfile, profiles, quanLy])
  const demXong = (uid, n) => {
    const ids = new Set(tienDo.filter((t) => t.user_id === uid).map((t) => t.bai_id))
    return baiCuaNgay(n).filter((b) => ids.has(b.id)).length
  }

  if (loading) return <div className="flex-1 p-8 text-sm text-ink-400">Đang tải...</div>

  const th = 'border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-ink-600'
  const td = 'border border-slate-200 px-3 py-2 text-sm'

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Đào tạo sale mới</h1>
          <p className="text-sm text-ink-600">Học xong từng ngày để mở ngày tiếp theo, sau đó làm bài test</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-navy-900">{tongXong}/{bai.length} <span className="text-xs font-normal text-ink-400">bài đã học</span></p>
          <div className="mt-1 h-1.5 w-44 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-coral-500" style={{ width: `${bai.length ? Math.round((tongXong / bai.length) * 100) : 0}%` }} />
          </div>
        </div>
      </header>

      <div className="space-y-6 px-8 py-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {cacNgay.map((n, i) => {
            const ds = baiCuaNgay(n)
            const khoa = !ngayMo(n)
            const xong = ds.filter((b) => xongCuaToi.has(b.id)).length
            return (
              <div key={n} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className={`px-4 py-3 ${khoa ? 'bg-slate-100 text-slate-600' : MAU_NGAY[i % 3]}`}>
                  <p className="font-medium">Ngày {n} · {TEN_NGAY[n] || 'Bài học'}</p>
                  <p className="text-xs">{xong}/{ds.length} bài · {khoa ? 'Chưa mở' : xong === ds.length ? 'Hoàn thành' : 'Đang học'}</p>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {ds.map((b) => (
                      <tr key={b.id} onClick={() => !khoa && setMo(b)} className={khoa ? 'text-ink-400' : 'cursor-pointer hover:bg-slate-50'}>
                        <td className="w-9 border border-slate-200 px-2 py-2.5 text-center">
                          {khoa ? <Lock size={15} className="mx-auto" /> : xongCuaToi.has(b.id) ? <CircleCheck size={16} className="mx-auto text-emerald-600" /> : <Circle size={16} className="mx-auto text-ink-400" />}
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-sm">
                          <p className={khoa ? '' : 'text-navy-900'}>{b.tieu_de}</p>
                          <p className="text-xs text-ink-400">{LOAI[b.loai]} · {b.phut} phút</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {admin && (
                  <button onClick={() => setSua({ ngay: n, thu_tu: ds.length + 1, loai: 'doc', phut: 20, tieu_de: '', noi_dung: '', link: '' })}
                    className="flex w-full items-center justify-center gap-1 border-t border-slate-200 py-2 text-xs text-ink-600 hover:bg-slate-50">
                    <Plus size={13} /> Thêm bài vào ngày {n}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck size={22} className="text-navy-900" />
            <div>
              <p className="font-medium text-navy-900">Bài test cuối khoá</p>
              <p className="text-sm text-ink-600">{hocXongHet ? 'Bạn đã học xong tất cả bài. Chờ lịch làm bài test chung cả team.' : `Làm tập trung cùng cả team, do quản lý tổ chức. Cần học xong ${bai.length}/${bai.length} bài để được tham gia.`}</p>
            </div>
          </div>
          <span className={`rounded-lg px-4 py-2 text-sm ${hocXongHet ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-ink-400'}`}>{hocXongHet ? 'Đủ điều kiện làm test' : 'Chưa đủ điều kiện'}</span>
        </div>

        {quanLy && (
          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-navy-900">Tiến độ của team</h2>
            <table className="w-full border-collapse overflow-hidden rounded-xl bg-white">
              <thead>
                <tr><th className={th}>Sale</th><th className={th}>Phòng</th>
                  {cacNgay.map((n) => <th key={n} className={th}>Ngày {n}</th>)}
                  <th className={th}>Tổng</th></tr>
              </thead>
              <tbody>
                {dsSale.length === 0 && <tr><td className={td} colSpan={cacNgay.length + 3}>Chưa có sale nào.</td></tr>}
                {dsSale.map((p) => {
                  const tong = cacNgay.reduce((s, n) => s + demXong(p.id, n), 0)
                  return (
                    <tr key={p.id}>
                      <td className={`${td} font-medium text-navy-900`}>{p.full_name}</td>
                      <td className={td}>{p.phong_ban || '—'}</td>
                      {cacNgay.map((n) => {
                        const x = demXong(p.id, n), t = baiCuaNgay(n).length
                        return <td key={n} className={`${td} ${x === t && t > 0 ? 'font-medium text-emerald-700' : ''}`}>{x}/{t}</td>
                      })}
                      <td className={`${td} font-medium`}>{tong}/{bai.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mo && (
        <Modal title={mo.tieu_de} onClose={() => setMo(null)} wide>
          <p className="mb-3 text-xs text-ink-400">Ngày {mo.ngay} · {LOAI[mo.loai]} · {mo.phut} phút</p>
          <SlideBai bai={mo} />
          {mo.noi_dung ? <div className="whitespace-pre-wrap text-sm text-navy-900">{mo.noi_dung}</div>
            : <p className="rounded-lg bg-slate-50 p-4 text-sm text-ink-400">Nội dung bài này sẽ được bổ sung.</p>}
          {mo.link && (
            <a href={mo.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-sky-700 hover:underline">
              <ExternalLink size={14} /> Mở tài liệu / video
            </a>
          )}
          <div className="mt-6 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {admin && <Button variant="secondary" onClick={() => setSua(mo)}><Pencil size={14} /> Sửa bài</Button>}
              {admin && <Button variant="danger" onClick={() => xoaBai(mo)}><Trash2 size={14} /> Xoá</Button>}
            </div>
            {xongCuaToi.has(mo.id)
              ? <Button variant="secondary" onClick={() => danhDau(mo, false)}>Bỏ đánh dấu</Button>
              : <Button onClick={() => danhDau(mo, true)}><CircleCheck size={15} /> Đã học xong</Button>}
          </div>
        </Modal>
      )}
      {sua && <SuaBai bai={sua} onClose={() => setSua(null)} onLuu={luuBai} />}
    </div>
  )
}

// Slide của từng bài (ảnh nằm trong public/dao-tao)
const SLIDE_BAI = {
  '1-1': ['b11-cts', 'b11-khach', 'b11-kenh'], '1-2': ['b12-dv', 'b12-ly'], '1-3': ['b13-qt', 'b13-nhan', 'b13-tra', 'b13-denbu'],
  '1-4': ['b14-a', 'b14-b'], '1-5': ['b15-crm'],
  '2-1': ['b21-3tt', 'b21-9', 'b21-kg', 'b21-m3', 'b21-ht', 'b21-tong'], '2-2': ['b22-ut', 'b22-rr'], '2-3': ['b23-mb'], '2-4': ['b24-or'],
  '2-5': ['b25-nk'], '2-6': ['b26-ck', 'b26-4b', 'b26-mau', 'b26-mau2', 'b26-sau'],
  '3-1': ['b31-ct', 'b31-th1', 'b31-th2', 'b31-th3', 'b31-5'], '3-2': ['b32-th', 'b32-xe', 'b32-gh'], '3-3': ['b33-sc', 'b33-bam'],
  '3-4': ['b34-dv', 'b34-bang'], '3-5': ['b35-7', 'b35-12-1', 'b35-12-2', 'b35-tuduy', 'b35-cc'],
}

function SlideBai({ bai }) {
  const ds = SLIDE_BAI[`${bai.ngay}-${bai.thu_tu}`] || []
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [bai.id])
  if (!ds.length) return null
  return (
    <div className="mb-4">
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <img src={`/dao-tao/${ds[i]}.jpg`} alt={`Slide ${i + 1}`} className="block w-full" />
        {ds.length > 1 && (
          <>
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Slide trước"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"><ChevronLeft size={18} /></button>
            <button type="button" disabled={i === ds.length - 1} onClick={() => setI(i + 1)} aria-label="Slide sau"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"><ChevronRight size={18} /></button>
          </>
        )}
      </div>
      {ds.length > 1 && <p className="mt-1.5 text-center text-xs text-ink-400">Slide {i + 1}/{ds.length}</p>}
    </div>
  )
}

function SuaBai({ bai, onClose, onLuu }) {
  const [f, setF] = useState({ link: '', noi_dung: '', ...bai })
  const [loi, setLoi] = useState('')
  const [dang, setDang] = useState(false)
  return (
    <Modal title={bai.id ? 'Sửa bài học' : 'Thêm bài học'} onClose={onClose} wide>
      <div className="space-y-3">
        <Input label="Tên bài học" value={f.tieu_de} onChange={(e) => setF({ ...f, tieu_de: e.target.value })} />
        <div className="grid grid-cols-4 gap-3">
          <Input label="Ngày" type="number" min="1" max="7" value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} />
          <Input label="Thứ tự" type="number" min="1" value={f.thu_tu} onChange={(e) => setF({ ...f, thu_tu: e.target.value })} />
          <Select label="Loại" value={f.loai} onChange={(e) => setF({ ...f, loai: e.target.value })}>
            <option value="doc">Đọc</option><option value="video">Video</option><option value="thuc_hanh">Thực hành</option>
          </Select>
          <Input label="Số phút" type="number" min="0" value={f.phut} onChange={(e) => setF({ ...f, phut: e.target.value })} />
        </div>
        <Input label="Link tài liệu / video (nếu có)" value={f.link || ''} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://..." />
        <Textarea label="Nội dung bài học" rows={8} value={f.noi_dung || ''} onChange={(e) => setF({ ...f, noi_dung: e.target.value })} />
        {loi && <p className="text-sm text-rose-600">{loi}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={dang} onClick={async () => { setDang(true); setLoi(await onLuu(f)); setDang(false) }}>Lưu bài học</Button>
        </div>
      </div>
    </Modal>
  )
}
