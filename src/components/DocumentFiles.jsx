import { useEffect, useRef, useState } from 'react'
import {
  Upload, Trash2, Download, Eye, FileText, FileImage,
  FileSpreadsheet, Presentation, File as FileIcon, X,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { Button } from './ui'

const BUCKET = 'tai-lieu'
const GIOI_HAN_MB = 50

// Loại file -> icon + cách xem
export function kieuFile(ten = '') {
  const duoi = ten.split('.').pop()?.toLowerCase() || ''
  if (duoi === 'pdf') return { nhom: 'pdf', icon: FileText, mau: 'text-rose-500', xemTrucTiep: true }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(duoi))
    return { nhom: 'anh', icon: FileImage, mau: 'text-violet-500', xemTrucTiep: true }
  if (['ppt', 'pptx'].includes(duoi))
    return { nhom: 'slide', icon: Presentation, mau: 'text-orange-500', xemOffice: true }
  if (['doc', 'docx'].includes(duoi))
    return { nhom: 'word', icon: FileText, mau: 'text-sky-600', xemOffice: true }
  if (['xls', 'xlsx', 'csv'].includes(duoi))
    return { nhom: 'excel', icon: FileSpreadsheet, mau: 'text-emerald-600', xemOffice: true }
  return { nhom: 'khac', icon: FileIcon, mau: 'text-ink-400' }
}

function doLon(byte) {
  if (!byte) return ''
  if (byte >= 1048576) return (byte / 1048576).toFixed(1).replace('.', ',') + ' MB'
  return Math.round(byte / 1024) + ' KB'
}

async function layLink(duongDan, taiVe = false) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(duongDan, 60 * 60, taiVe ? { download: true } : undefined)
  if (error) throw error
  return data.signedUrl
}

export default function DocumentFiles({ documentId, isAdmin, onChanged, bang = 'document_files', cotKhoa = 'document_id', thuMuc = '', nhungPdf = false }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dangTai, setDangTai] = useState(false)
  const [msg, setMsg] = useState('')
  const [xemFile, setXemFile] = useState(null)
  const [pdfNhung, setPdfNhung] = useState([])   // PDF hiện thẳng trong trang (nếu bật nhungPdf)
  const inputRef = useRef(null)

  useEffect(() => { load() }, [documentId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from(bang).select('*')
      .eq(cotKhoa, documentId).order('created_at')
    setFiles(data || [])
    if (nhungPdf) {
      const ds = (data || []).filter((f) => kieuFile(f.ten_file).nhom === 'pdf')
      const kq = []
      for (const f of ds) { try { kq.push({ ...f, url: await layLink(f.duong_dan) }) } catch { /* bỏ qua */ } }
      setPdfNhung(kq)
    }
    setLoading(false)
  }

  async function taiLen(e) {
    const ds = [...(e.target.files || [])]
    if (!ds.length) return
    setDangTai(true)
    setMsg('')

    for (const f of ds) {
      if (f.size > GIOI_HAN_MB * 1048576) {
        setMsg(`"${f.name}" nặng hơn ${GIOI_HAN_MB}MB nên bị bỏ qua.`)
        continue
      }
      // Tên file trên kho đặt bằng ký tự an toàn, tên gốc lưu riêng trong database
      const duoi = (f.name.split('.').pop() || 'dat').toLowerCase()
      const key = `${thuMuc}${documentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${duoi}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, f, {
        cacheControl: '3600', upsert: false,
      })
      if (upErr) { setMsg('Lỗi tải lên: ' + upErr.message); continue }

      const { error: dbErr } = await supabase.from(bang).insert({
        [cotKhoa]: documentId,
        ten_file: f.name,
        duong_dan: key,
        loai: f.type || null,
        kich_thuoc: f.size,
      })
      if (dbErr) setMsg('Lỗi lưu thông tin file: ' + dbErr.message)
    }

    setDangTai(false)
    if (inputRef.current) inputRef.current.value = ''
    load()
    onChanged?.()
  }

  async function xoa(f) {
    if (!window.confirm(`Xoá file "${f.ten_file}"?`)) return
    await supabase.storage.from(BUCKET).remove([f.duong_dan])
    await supabase.from(bang).delete().eq('id', f.id)
    load()
    onChanged?.()
  }

  async function taiVe(f) {
    try {
      const url = await layLink(f.duong_dan, true)
      window.open(url, '_blank')
    } catch (err) { setMsg('Không tải được: ' + err.message) }
  }

  async function moXem(f) {
    try {
      const url = await layLink(f.duong_dan)
      setXemFile({ ...f, url })
    } catch (err) { setMsg('Không mở được: ' + err.message) }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-navy-900">
          File đính kèm {files.length > 0 && <span className="text-ink-400">({files.length})</span>}
        </p>
        {isAdmin && (
          <>
            <input ref={inputRef} type="file" multiple hidden onChange={taiLen} />
            <Button type="button" variant="secondary" disabled={dangTai}
              onClick={() => inputRef.current?.click()} className="px-3 py-1.5 text-xs">
              <Upload size={14} /> {dangTai ? 'Đang tải lên...' : 'Tải file lên'}
            </Button>
          </>
        )}
      </div>

      {msg && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{msg}</p>}

      {loading ? (
        <p className="text-sm text-ink-400">Đang tải...</p>
      ) : files.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-ink-400">
          Chưa có file nào{isAdmin ? '. Tải lên PDF, slide, Word, Excel hoặc ảnh.' : '.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => {
            const k = kieuFile(f.ten_file)
            const Icon = k.icon
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <Icon size={18} className={`flex-none ${k.mau}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900">{f.ten_file}</p>
                  <p className="text-xs text-ink-400">{doLon(f.kich_thuoc)}</p>
                </div>

                {(k.xemTrucTiep || k.xemOffice) && (
                  <button type="button" onClick={() => moXem(f)}
                    className="flex-none inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-100">
                    <Eye size={13} /> Xem
                  </button>
                )}
                <button type="button" onClick={() => taiVe(f)}
                  className="flex-none inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-ink-600 hover:bg-slate-100">
                  <Download size={13} /> Tải
                </button>
                {isAdmin && (
                  <button type="button" onClick={() => xoa(f)}
                    className="flex-none text-ink-400 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {nhungPdf && pdfNhung.map((f) => (
        <div key={f.id} className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <p className="bg-slate-50 px-3 py-1.5 text-xs text-ink-600">{f.ten_file}</p>
          <iframe src={f.url} title={f.ten_file} className="h-[560px] w-full" />
        </div>
      ))}

      {xemFile && <KhungXem file={xemFile} onClose={() => setXemFile(null)} onTaiVe={() => taiVe(xemFile)} />}
    </div>
  )
}

function KhungXem({ file, onClose, onTaiVe }) {
  const k = kieuFile(file.ten_file)
  const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-navy-950/80 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-none items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="truncate font-medium text-navy-900">{file.ten_file}</p>
          <div className="flex flex-none items-center gap-2">
            <Button type="button" variant="secondary" onClick={onTaiVe} className="px-3 py-1.5 text-xs">
              <Download size={14} /> Tải về
            </Button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-navy-900">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100">
          {k.nhom === 'anh' ? (
            <img src={file.url} alt={file.ten_file} className="mx-auto max-h-full" />
          ) : k.nhom === 'pdf' ? (
            <iframe src={file.url} title={file.ten_file} className="h-full w-full" />
          ) : (
            <div className="flex h-full flex-col">
              <p className="flex-none bg-amber-50 px-4 py-2 text-xs text-amber-800">
                File slide/Word xem qua trình xem của Microsoft, đôi khi không hiển thị được.
                Nếu trang dưới trống, chị bấm "Tải về" để mở bằng phần mềm trên máy.
              </p>
              <iframe src={officeSrc} title={file.ten_file} className="w-full flex-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
