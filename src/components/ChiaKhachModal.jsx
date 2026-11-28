import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Modal } from './ui'
import { tenVaiTro } from '../lib/quyen'
import { loiDeHieu } from '../lib/loi'

// Chia khách cho sale. Hai cách dùng:
//  - mode 'chon': chia các khách đang tích chọn
//  - mode 'nghi': chuyển toàn bộ khách của 1 sale (sale nghỉ) cho admin hoặc chia lại cho các sale khác
export default function ChiaKhachModal({ mode, customers, daChon, profiles, onClose, onDone }) {
  const [saleNghi, setSaleNghi] = useState('')
  const [nhan, setNhan] = useState(new Set())
  const [dang, setDang] = useState(false)

  const dsKhach = useMemo(() => {
    if (mode === 'chon') return customers.filter((c) => daChon.has(c.id))
    return saleNghi ? customers.filter((c) => c.sale_id === saleNghi) : []
  }, [mode, customers, daChon, saleNghi])

  const nguoiNhan = profiles.filter((p) => p.id !== saleNghi)
  const dem = (id) => customers.filter((c) => c.sale_id === id).length
  const toggle = (id) => setNhan((s) => { const m = new Set(s); if (m.has(id)) m.delete(id); else m.add(id); return m })
  const ids = [...nhan].filter((id) => id !== saleNghi)
  const moiNguoi = ids.length ? Math.ceil(dsKhach.length / ids.length) : 0

  async function chia() {
    if (!dsKhach.length || !ids.length) return
    const ten = (id) => profiles.find((p) => p.id === id)?.full_name || ''
    const ok = window.confirm(
      `Chuyển ${dsKhach.length} khách cho ${ids.map(ten).join(', ')}${ids.length > 1 ? ' (chia đều)' : ''}?`
    )
    if (!ok) return
    setDang(true)
    // chia vòng tròn để các sale nhận gần bằng nhau
    const nhom = Object.fromEntries(ids.map((id) => [id, []]))
    dsKhach.forEach((c, i) => nhom[ids[i % ids.length]].push(c.id))
    for (const [saleId, list] of Object.entries(nhom)) {
      for (let i = 0; i < list.length; i += 100) {
        const { error } = await supabase.from('customers').update({ sale_id: saleId }).in('id', list.slice(i, i + 100))
        if (error) { setDang(false); alert('Không chuyển được: ' + loiDeHieu(error)); onDone(); return }
      }
    }
    setDang(false)
    onDone()
    onClose()
  }

  return (
    <Modal title={mode === 'chon' ? `Chia ${daChon.size} khách đã chọn` : 'Chuyển data khi sale nghỉ'} onClose={onClose}>
      <div className="space-y-4">
        {mode === 'nghi' && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy-900">Sale nghỉ việc</span>
            <select value={saleNghi} onChange={(e) => { setSaleNghi(e.target.value); setNhan(new Set()) }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-coral-500">
              <option value="">— Chọn sale —</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({dem(p.id)} khách)</option>)}
            </select>
          </label>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-navy-900">
            Chuyển cho ai? <span className="font-normal text-ink-400">(chọn 1 người, hoặc nhiều người để chia đều)</span>
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {nguoiNhan.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50">
                <input type="checkbox" checked={nhan.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-slate-300" />
                <span className="flex-1 text-navy-900">{p.full_name}</span>
                <span className="text-xs text-ink-400">{tenVaiTro(p.role)}{p.phong_ban ? ` · ${p.phong_ban}` : ''} · đang có {dem(p.id)} khách</span>
              </label>
            ))}
          </div>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-600">
          {mode === 'nghi' && !saleNghi
            ? 'Chọn sale nghỉ để xem số khách sẽ chuyển.'
            : <>Sẽ chuyển <b className="text-navy-900">{dsKhach.length}</b> khách{ids.length > 1 ? <>, mỗi người nhận khoảng <b className="text-navy-900">{moiNguoi}</b> khách</> : ''}.</>}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={chia} disabled={dang || !dsKhach.length || !ids.length}>{dang ? 'Đang chuyển...' : 'Chuyển khách'}</Button>
        </div>
      </div>
    </Modal>
  )
}
