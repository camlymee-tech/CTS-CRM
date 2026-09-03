import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pin, Pencil, Trash2, ExternalLink, ArrowLeft } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Textarea, Badge, Modal } from './ui'

export const DANH_MUC = [
  { value: 'tai_lieu_cong_viec', label: 'Tài liệu công việc', className: 'bg-slate-100 text-slate-600' },
  { value: 'dao_tao_sale', label: 'Đào tạo sale mới', className: 'bg-teal-50 text-teal-600' },
  { value: 'quy_dinh', label: 'Quy định công ty', className: 'bg-navy-900 text-white' },
  { value: 'chinh_sach', label: 'Chính sách', className: 'bg-coral-50 text-coral-600' },
  { value: 'kiem_tra', label: 'Kiểm tra', className: 'bg-amber-100 text-amber-700' },
]

const labelDM = (v) => DANH_MUC.find((d) => d.value === v)?.label ?? v
const classDM = (v) => DANH_MUC.find((d) => d.value === v)?.className ?? 'bg-slate-100 text-slate-600'

export default function DocumentsPage({ currentProfile }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDM, setFilterDM] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const isAdmin = currentProfile?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('documents').select('*')
      .order('ghim', { ascending: false }).order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  async function remove(doc) {
    if (!window.confirm(`Xoá tài liệu "${doc.tieu_de}"? Thao tác này không hoàn tác được.`)) return
    await supabase.from('documents').delete().eq('id', doc.id)
    load()
  }

  const filtered = useMemo(() => docs.filter((d) => {
    if (filterDM && d.danh_muc !== filterDM) return false
    if (search && !`${d.tieu_de} ${d.mo_ta || ''} ${d.noi_dung || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [docs, search, filterDM])

  // Gom theo danh mục, trong mỗi nhóm xếp theo số thứ tự trong tiêu đề
  const nhom = useMemo(() => {
    const sapXep = (a, b) => {
      if (!!b.ghim !== !!a.ghim) return b.ghim ? 1 : -1
      return a.tieu_de.localeCompare(b.tieu_de, 'vi', { numeric: true, sensitivity: 'base' })
    }
    return DANH_MUC
      .map((dm) => ({ ...dm, ds: filtered.filter((d) => d.danh_muc === dm.value).sort(sapXep) }))
      .filter((g) => g.ds.length > 0)
  }, [filtered])

  if (viewing) {
    return (
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <button onClick={() => setViewing(null)}
            className="mb-3 inline-flex items-center gap-1 text-sm text-ink-600 hover:text-coral-500">
            <ArrowLeft size={15} /> Quay lại danh sách
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Badge className={classDM(viewing.danh_muc)}>{labelDM(viewing.danh_muc)}</Badge>
              <h1 className="mt-2 font-display text-2xl font-bold text-navy-900">{viewing.tieu_de}</h1>
              {viewing.mo_ta && <p className="mt-1 text-sm text-ink-600">{viewing.mo_ta}</p>}
              <p className="mt-2 text-xs text-ink-400">
                Cập nhật {new Date(viewing.updated_at || viewing.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
            {isAdmin && (
              <Button variant="secondary" onClick={() => { setEditing(viewing); setShowForm(true) }}>
                <Pencil size={15} /> Sửa
              </Button>
            )}
          </div>
        </header>

        <div className="mx-8 my-6 rounded-2xl bg-white p-8 shadow-sm">
          {viewing.link_ngoai && (
            <a href={viewing.link_ngoai} target="_blank" rel="noreferrer"
              className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-navy-900 hover:border-coral-500 hover:text-coral-500">
              <ExternalLink size={15} /> Mở file đính kèm
            </a>
          )}
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-navy-900">
            {viewing.noi_dung || 'Tài liệu này chưa có nội dung chi tiết.'}
          </div>
        </div>

        {showForm && (
          <DocumentForm doc={editing} currentProfile={currentProfile}
            onClose={() => setShowForm(false)}
            onSaved={async () => {
              setShowForm(false)
              const { data } = await supabase.from('documents').select('*').eq('id', editing.id).single()
              setViewing(data)
              load()
            }} />
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Tài liệu</h1>
          <p className="text-sm text-ink-600">Quy định, chính sách, tài liệu đào tạo và hướng dẫn công việc</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus size={16} /> Thêm tài liệu
          </Button>
        )}
      </header>

      <div className="mx-8 mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm trong tiêu đề và nội dung..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDM} onChange={(e) => setFilterDM(e.target.value)} className="w-52">
          <option value="">Tất cả danh mục</option>
          {DANH_MUC.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
      </div>

      <div className="mx-8 my-6 space-y-6">
        {loading ? (
          <p className="py-8 text-center text-ink-400">Đang tải...</p>
        ) : nhom.length === 0 ? (
          <p className="py-8 text-center text-ink-400">
            {docs.length === 0 ? 'Chưa có tài liệu nào.' : 'Không tìm thấy tài liệu phù hợp.'}
          </p>
        ) : nhom.map((g) => (
          <section key={g.value}>
            <div className="mb-2 flex items-center gap-2">
              <Badge className={g.className}>{g.label}</Badge>
              <span className="text-xs text-ink-400">{g.ds.length} tài liệu</span>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {g.ds.map((d, idx) => (
                <div key={d.id}
                  onClick={() => setViewing(d)}
                  className={`flex cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50 ${
                    idx > 0 ? 'border-t border-slate-50' : ''
                  }`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {d.ghim && <Pin size={13} className="flex-none text-coral-500" />}
                      <p className="truncate font-medium text-navy-900">{d.tieu_de}</p>
                    </div>
                    {d.mo_ta && <p className="mt-0.5 truncate text-sm text-ink-600">{d.mo_ta}</p>}
                  </div>

                  {d.link_ngoai && (
                    <ExternalLink size={14} className="flex-none text-teal-500" />
                  )}

                  <span className="hidden flex-none text-xs text-ink-400 sm:block">
                    {new Date(d.updated_at || d.created_at).toLocaleDateString('vi-VN')}
                  </span>

                  {isAdmin && (
                    <div className="flex flex-none gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditing(d); setShowForm(true) }}
                        className="text-ink-400 hover:text-coral-500"><Pencil size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); remove(d) }}
                        className="text-ink-400 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {showForm && (
        <DocumentForm doc={editing} currentProfile={currentProfile}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function DocumentForm({ doc, currentProfile, onClose, onSaved }) {
  const isEdit = !!doc
  const [form, setForm] = useState({
    tieu_de: doc?.tieu_de || '',
    danh_muc: doc?.danh_muc || 'tai_lieu_cong_viec',
    mo_ta: doc?.mo_ta || '',
    noi_dung: doc?.noi_dung || '',
    link_ngoai: doc?.link_ngoai || '',
    ghim: doc?.ghim || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      mo_ta: form.mo_ta || null,
      noi_dung: form.noi_dung || null,
      link_ngoai: form.link_ngoai || null,
    }
    const { error } = isEdit
      ? await supabase.from('documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', doc.id)
      : await supabase.from('documents').insert({ ...payload, created_by: currentProfile.id })
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Sửa tài liệu' : 'Thêm tài liệu mới'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Tiêu đề *" required value={form.tieu_de}
          onChange={(e) => setForm({ ...form, tieu_de: e.target.value })}
          placeholder="VD: Quy trình chốt đơn dịch vụ vận hành" />

        <Select label="Danh mục" value={form.danh_muc}
          onChange={(e) => setForm({ ...form, danh_muc: e.target.value })}>
          {DANH_MUC.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>

        <Input label="Mô tả ngắn" value={form.mo_ta}
          onChange={(e) => setForm({ ...form, mo_ta: e.target.value })}
          placeholder="Một dòng tóm tắt, hiển thị ở danh sách và trong thông báo" />

        <Textarea label="Nội dung chi tiết" rows={10} value={form.noi_dung}
          onChange={(e) => setForm({ ...form, noi_dung: e.target.value })}
          placeholder="Gõ hoặc dán nội dung tài liệu vào đây..." />

        <Input label="Link file đính kèm" value={form.link_ngoai}
          onChange={(e) => setForm({ ...form, link_ngoai: e.target.value })}
          placeholder="Link Google Drive, Google Docs..." />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.ghim}
            onChange={(e) => setForm({ ...form, ghim: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300" />
          <span className="text-navy-900">Ghim lên đầu danh sách</span>
        </label>

        {!isEdit && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
            Khi lưu, toàn bộ nhân sự sẽ nhận được thông báo về tài liệu này.
          </p>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tài liệu'}</Button>
        </div>
      </form>
    </Modal>
  )
}
