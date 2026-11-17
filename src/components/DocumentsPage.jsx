import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pin, Pencil, Trash2, ExternalLink, ArrowLeft, Paperclip } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Textarea, Badge, Modal } from './ui'
import DocumentFiles from './DocumentFiles'
import { laAdmin, laLeader, laQuanLy } from '../lib/quyen'

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
  const [soFile, setSoFile] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDM, setFilterDM] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const isAdmin = laAdmin(currentProfile)
  const quanLy = laQuanLy(currentProfile)   // admin / leader được thêm tài liệu
  const suaDuoc = (d) => isAdmin || (quanLy && d?.created_by === currentProfile.id)   // leader chỉ sửa tài liệu mình tạo

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: fl }] = await Promise.all([
      supabase.from('documents').select('*')
        .order('ghim', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('document_files').select('document_id'),
    ])
    setDocs(data || [])
    const dem = {}
    for (const f of fl || []) dem[f.document_id] = (dem[f.document_id] || 0) + 1
    setSoFile(dem)
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
            {suaDuoc(viewing) && (
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

          <div className="mt-6 border-t border-slate-100 pt-5">
            <DocumentFiles documentId={viewing.id} isAdmin={suaDuoc(viewing)} onChanged={load} />
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
        {quanLy && (
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
                      {d.phong_ban?.length > 0 && <Badge className="flex-none bg-amber-100 text-amber-700">{d.phong_ban.join(', ')}</Badge>}
                    </div>
                    {d.mo_ta && <p className="mt-0.5 truncate text-sm text-ink-600">{d.mo_ta}</p>}
                  </div>

                  {soFile[d.id] > 0 && (
                    <span className="flex-none inline-flex items-center gap-1 text-xs text-ink-500">
                      <Paperclip size={13} /> {soFile[d.id]}
                    </span>
                  )}
                  {d.link_ngoai && (
                    <ExternalLink size={14} className="flex-none text-teal-500" />
                  )}

                  <span className="hidden flex-none text-xs text-ink-400 sm:block">
                    {new Date(d.updated_at || d.created_at).toLocaleDateString('vi-VN')}
                  </span>

                  {suaDuoc(d) && (
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
  const leader = laLeader(currentProfile)
  const [pham, setPham] = useState(doc?.phong_ban?.length ? 'pb' : 'all')   // all = toàn công ty, pb = chỉ một số phòng ban
  const [chonPB, setChonPB] = useState(doc?.phong_ban || (leader && currentProfile.phong_ban ? [currentProfile.phong_ban] : []))
  const [dsPB, setDsPB] = useState([])
  useEffect(() => { supabase.from('phong_ban').select('ten').order('ten').then(({ data }) => setDsPB((data || []).map((x) => x.ten))) }, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (pham === 'pb' && chonPB.length === 0) { setSaving(false); setError('Hãy chọn ít nhất một phòng ban được xem tài liệu này.'); return }
    const payload = {
      ...form,
      phong_ban: pham === 'pb' ? chonPB : null,
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

        <Input label="Link ngoài (tuỳ chọn)" value={form.link_ngoai}
          onChange={(e) => setForm({ ...form, link_ngoai: e.target.value })}
          placeholder="Link Google Drive, Google Docs... nếu có" />

        {isEdit ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <DocumentFiles documentId={doc.id} isAdmin onChanged={() => {}} />
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-ink-600">
            Lưu tài liệu xong, mở lại để tải file PDF, slide, Word, Excel hoặc ảnh lên.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-medium text-navy-900">Ai được xem tài liệu này?</p>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" checked={pham === 'all'} onChange={() => setPham('all')} />
            <span className="text-navy-900">Toàn công ty</span>
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" checked={pham === 'pb'} onChange={() => setPham('pb')} />
            <span className="text-navy-900">{leader ? 'Chỉ team của tôi' : 'Chỉ một số phòng ban'}</span>
          </label>
          {pham === 'pb' && (
            <div className="mt-2 flex flex-wrap gap-2 pl-6">
              {(leader ? [currentProfile.phong_ban].filter(Boolean) : dsPB).map((t) => (
                <label key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input type="checkbox" checked={chonPB.includes(t)} disabled={leader}
                    onChange={(e) => setChonPB(e.target.checked ? [...chonPB, t] : chonPB.filter((x) => x !== t))} />
                  <span className="text-navy-900">{t}</span>
                </label>
              ))}
              {!leader && dsPB.length === 0 && <span className="text-xs text-ink-400">Chưa có phòng ban nào. Tạo ở Nhân sự → Phòng ban.</span>}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.ghim}
            onChange={(e) => setForm({ ...form, ghim: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300" />
          <span className="text-navy-900">Ghim lên đầu danh sách</span>
        </label>

        {!isEdit && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600">
            Khi lưu, những người được xem tài liệu sẽ nhận được thông báo.
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
