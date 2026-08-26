import { useEffect, useState } from 'react'
import { Megaphone, FileText, UserPlus2, ShoppingBag, Cake, CheckCheck, Trash2, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Textarea, Select, Badge, Modal } from './ui'

const LOAI = {
  chung: { label: 'Thông báo chung', icon: Megaphone, className: 'bg-slate-100 text-slate-600' },
  tai_lieu: { label: 'Tài liệu', icon: FileText, className: 'bg-teal-50 text-teal-600' },
  chia_khach: { label: 'Chia khách', icon: UserPlus2, className: 'bg-coral-50 text-coral-600' },
  don_hang: { label: 'Chốt đơn', icon: ShoppingBag, className: 'bg-emerald-100 text-emerald-700' },
  sinh_nhat: { label: 'Sinh nhật', icon: Cake, className: 'bg-amber-100 text-amber-700' },
}

// Tính sinh nhật hôm nay từ danh sách hồ sơ (không lưu vào DB)
export function sinhNhatHomNay(profiles) {
  const now = new Date()
  const d = now.getDate()
  const m = now.getMonth() + 1
  return (profiles || []).filter((p) => {
    if (!p.ngay_sinh || p.active === false) return false
    const [, mm, dd] = p.ngay_sinh.split('-').map(Number)
    return mm === m && dd === d
  })
}

export default function NotificationsPage({ currentProfile, onRead }) {
  const [items, setItems] = useState([])
  const [reads, setReads] = useState(new Set())
  const [birthdays, setBirthdays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)

  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: notis }, { data: readRows }, { data: profs }] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('notification_reads').select('notification_id').eq('user_id', currentProfile.id),
      supabase.from('profiles').select('id, full_name, ngay_sinh, active'),
    ])
    setItems(notis || [])
    setReads(new Set((readRows || []).map((r) => r.notification_id)))
    setBirthdays(sinhNhatHomNay(profs))
    setLoading(false)
  }

  async function markRead(id) {
    if (reads.has(id)) return
    await supabase.from('notification_reads').insert({ notification_id: id, user_id: currentProfile.id })
    setReads(new Set([...reads, id]))
    onRead?.()
  }

  async function markAllRead() {
    const chuaDoc = items.filter((i) => !reads.has(i.id))
    if (chuaDoc.length === 0) return
    await supabase.from('notification_reads').insert(
      chuaDoc.map((i) => ({ notification_id: i.id, user_id: currentProfile.id }))
    )
    setReads(new Set(items.map((i) => i.id)))
    onRead?.()
  }

  async function remove(id) {
    if (!window.confirm('Xoá thông báo này?')) return
    await supabase.from('notifications').delete().eq('id', id)
    load()
  }

  const soChuaDoc = items.filter((i) => !reads.has(i.id)).length

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Thông báo</h1>
          <p className="text-sm text-ink-600">
            {soChuaDoc > 0 ? `${soChuaDoc} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
          </p>
        </div>
        <div className="flex gap-2">
          {soChuaDoc > 0 && (
            <Button variant="secondary" onClick={markAllRead}>
              <CheckCheck size={15} /> Đánh dấu đã đọc hết
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowCompose(true)}>
              <Send size={15} /> Gửi thông báo
            </Button>
          )}
        </div>
      </header>

      {birthdays.length > 0 && (
        <div className="mx-8 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <Cake size={18} />
            <p className="font-display font-semibold">Sinh nhật hôm nay</p>
          </div>
          <p className="mt-1 text-sm text-amber-800">
            Chúc mừng sinh nhật {birthdays.map((b) => b.full_name).join(', ')}!
          </p>
        </div>
      )}

      <div className="mx-8 my-6 space-y-3">
        {loading ? (
          <p className="py-8 text-center text-ink-400">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-ink-400">Chưa có thông báo nào.</p>
        ) : items.map((n) => {
          const meta = LOAI[n.loai] || LOAI.chung
          const Icon = meta.icon
          const daDoc = reads.has(n.id)
          return (
            <div key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex cursor-pointer gap-4 rounded-2xl p-5 shadow-sm transition ${
                daDoc ? 'bg-white' : 'border-l-4 border-coral-500 bg-white'
              }`}>
              <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${meta.className}`}>
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={`${daDoc ? 'font-medium' : 'font-semibold'} text-navy-900`}>{n.tieu_de}</p>
                  <div className="flex flex-none items-center gap-2">
                    {!daDoc && <Badge className="bg-coral-50 text-coral-600">Mới</Badge>}
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); remove(n.id) }}
                        className="text-ink-400 hover:text-rose-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {n.noi_dung && <p className="mt-1 text-sm text-ink-600">{n.noi_dung}</p>}
                <p className="mt-2 text-xs text-ink-400">
                  {new Date(n.created_at).toLocaleString('vi-VN')}
                  {n.target_user_id && ' · Gửi riêng cho bạn'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {showCompose && (
        <ComposeForm currentProfile={currentProfile}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); load() }} />
      )}
    </div>
  )
}

function ComposeForm({ currentProfile, onClose, onSent }) {
  const [form, setForm] = useState({ tieu_de: '', noi_dung: '', target_user_id: '' })
  const [profiles, setProfiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name')
      .then(({ data }) => setProfiles(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('notifications').insert({
      loai: 'chung',
      tieu_de: form.tieu_de,
      noi_dung: form.noi_dung || null,
      target_user_id: form.target_user_id || null,
      created_by: currentProfile.id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSent()
  }

  return (
    <Modal title="Gửi thông báo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input label="Tiêu đề *" required value={form.tieu_de}
          onChange={(e) => setForm({ ...form, tieu_de: e.target.value })}
          placeholder="VD: Họp team sáng thứ 2" />
        <Textarea label="Nội dung" rows={4} value={form.noi_dung}
          onChange={(e) => setForm({ ...form, noi_dung: e.target.value })} />
        <Select label="Gửi cho" value={form.target_user_id}
          onChange={(e) => setForm({ ...form, target_user_id: e.target.value })}>
          <option value="">Toàn công ty</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang gửi...' : 'Gửi thông báo'}</Button>
        </div>
      </form>
    </Modal>
  )
}
