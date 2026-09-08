import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Repeat, User, Settings2, Check } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Textarea, Modal, Badge } from './ui'

export default function ChecklistTasks({ currentProfile }) {
  const [tasks, setTasks] = useState([])
  const [done, setDone] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [vietMoi, setVietMoi] = useState('')
  const [quanLy, setQuanLy] = useState(false)
  const [msg, setMsg] = useState('')
  const oNhap = useRef(null)

  const isAdmin = currentProfile?.role === 'admin'
  const homNay = new Date().toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ts }, { data: dn }] = await Promise.all([
      supabase.from('checklist_tasks').select('*').eq('active', true).order('thu_tu').order('created_at'),
      supabase.from('checklist_done').select('task_id').eq('user_id', currentProfile.id).eq('ngay', homNay),
    ])
    setTasks(ts || [])
    setDone(new Set((dn || []).map((d) => d.task_id)))
    setLoading(false)
  }

  const coDinh = useMemo(() => tasks.filter((t) => t.loai === 'co_dinh'), [tasks])
  const caNhan = useMemo(
    () => tasks.filter((t) => t.loai === 'ca_nhan' && t.user_id === currentProfile.id && t.ngay === homNay),
    [tasks, currentProfile.id, homNay]
  )

  const tatCa = [...coDinh, ...caNhan]
  const soXong = tatCa.filter((t) => done.has(t.id)).length

  async function tick(t) {
    const daXong = done.has(t.id)
    const moi = new Set(done)
    if (daXong) {
      moi.delete(t.id); setDone(moi)
      await supabase.from('checklist_done').delete()
        .eq('task_id', t.id).eq('user_id', currentProfile.id).eq('ngay', homNay)
    } else {
      moi.add(t.id); setDone(moi)
      const { error } = await supabase.from('checklist_done')
        .insert({ task_id: t.id, user_id: currentProfile.id, ngay: homNay })
      if (error) { moi.delete(t.id); setDone(new Set(moi)); setMsg('Lỗi: ' + error.message) }
    }
  }

  async function themViec(e) {
    e.preventDefault()
    const ten = vietMoi.trim()
    if (!ten) return
    const { error } = await supabase.from('checklist_tasks').insert({
      tieu_de: ten, loai: 'ca_nhan', user_id: currentProfile.id,
      ngay: homNay, created_by: currentProfile.id,
    })
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setVietMoi(''); setMsg(''); load()
    oNhap.current?.focus()
  }

  async function xoaViec(t) {
    await supabase.from('checklist_tasks').delete().eq('id', t.id)
    load()
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display font-semibold text-navy-900">Việc trong ngày</h2>
          {tatCa.length > 0 && (
            <span className="text-xs text-ink-400">{soXong}/{tatCa.length} đã xong</span>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => setQuanLy(true)}
            className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-coral-500">
            <Settings2 size={14} /> Việc cố định
          </button>
        )}
      </div>

      {tatCa.length > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(soXong / tatCa.length) * 100}%` }} />
        </div>
      )}

      {msg && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{msg}</p>}

      {loading ? (
        <p className="text-sm text-ink-400">Đang tải...</p>
      ) : (
        <div className="space-y-1.5">
          {tatCa.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-ink-400">
              Chưa có việc nào. Thêm việc của bạn ở ô bên dưới.
            </p>
          )}

          {tatCa.map((t) => {
            const xong = done.has(t.id)
            return (
              <div key={t.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                  xong ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200'
                }`}>
                <button onClick={() => tick(t)}
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border transition ${
                    xong ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-coral-500'
                  }`}>
                  {xong && <Check size={13} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${xong ? 'text-ink-400 line-through' : 'font-medium text-navy-900'}`}>
                      {t.tieu_de}
                    </p>
                    {t.loai === 'co_dinh'
                      ? <Badge className="bg-slate-100 text-slate-500"><Repeat size={10} className="mr-1" />Hàng ngày</Badge>
                      : <Badge className="bg-coral-50 text-coral-600"><User size={10} className="mr-1" />Của tôi</Badge>}
                  </div>
                  {t.mo_ta && !xong && <p className="mt-0.5 text-xs text-ink-600">{t.mo_ta}</p>}
                </div>

                {t.loai === 'ca_nhan' && (
                  <button onClick={() => xoaViec(t)} className="flex-none text-ink-400 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={themViec} className="mt-3 flex gap-2">
        <input ref={oNhap} value={vietMoi} onChange={(e) => setVietMoi(e.target.value)}
          placeholder="Thêm việc của bạn hôm nay..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
        <Button type="submit" variant="secondary" className="flex-none px-3 py-2 text-sm">
          <Plus size={15} /> Thêm
        </Button>
      </form>

      {quanLy && <QuanLyCoDinh currentProfile={currentProfile} onClose={() => { setQuanLy(false); load() }} />}
    </div>
  )
}

function QuanLyCoDinh({ currentProfile, onClose }) {
  const [ds, setDs] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ tieu_de: '', mo_ta: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('checklist_tasks').select('*')
      .eq('loai', 'co_dinh').order('thu_tu').order('created_at')
    setDs(data || [])
    setLoading(false)
  }

  async function them(e) {
    e.preventDefault()
    if (!form.tieu_de.trim()) return
    setSaving(true); setMsg('')
    const { error } = await supabase.from('checklist_tasks').insert({
      tieu_de: form.tieu_de.trim(),
      mo_ta: form.mo_ta.trim() || null,
      loai: 'co_dinh',
      thu_tu: ds.length + 1,
      created_by: currentProfile.id,
    })
    setSaving(false)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setForm({ tieu_de: '', mo_ta: '' }); load()
  }

  async function batTat(t) {
    await supabase.from('checklist_tasks').update({ active: !t.active }).eq('id', t.id)
    load()
  }

  async function xoa(t) {
    if (!window.confirm(`Xoá việc "${t.tieu_de}" khỏi checklist hàng ngày của cả team?`)) return
    const { error } = await supabase.from('checklist_tasks').delete().eq('id', t.id)
    if (error) { setMsg('Không xoá được: ' + error.message); return }
    load()
  }

  return (
    <Modal title="Việc cố định hàng ngày" onClose={onClose} wide>
      <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
        Những việc này hiện trong checklist của <b>mọi nhân sự</b>, mỗi ngày tự làm mới để tick lại từ đầu.
      </p>

      {msg && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</p>}

      {loading ? <p className="text-sm text-ink-400">Đang tải...</p> : (
        <div className="mb-5 space-y-1.5">
          {ds.length === 0 && <p className="text-sm text-ink-400">Chưa có việc cố định nào.</p>}
          {ds.map((t) => (
            <div key={t.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                t.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-navy-900">{t.tieu_de}</p>
                  {!t.active && <Badge className="bg-slate-200 text-slate-600">Đang tắt</Badge>}
                </div>
                {t.mo_ta && <p className="mt-0.5 text-xs text-ink-600">{t.mo_ta}</p>}
              </div>
              <button onClick={() => batTat(t)} className="flex-none text-xs text-ink-400 hover:text-navy-900">
                {t.active ? 'Tắt' : 'Bật'}
              </button>
              <button onClick={() => xoa(t)} className="flex-none text-ink-400 hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={them} className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <Input label="Tên việc *" value={form.tieu_de}
          onChange={(e) => setForm({ ...form, tieu_de: e.target.value })}
          placeholder="VD: Gọi lại khách đến hạn chăm sóc" />
        <Textarea label="Mô tả" rows={2} value={form.mo_ta}
          onChange={(e) => setForm({ ...form, mo_ta: e.target.value })}
          placeholder="Hướng dẫn ngắn để sale làm đúng" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Đóng</Button>
          <Button type="submit" disabled={saving}>
            <Plus size={15} /> {saving ? 'Đang thêm...' : 'Thêm việc cố định'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
