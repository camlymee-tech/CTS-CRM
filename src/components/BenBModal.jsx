import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Modal, Button, Input, Select } from './ui'
import { BEN_B_MAC_DINH, BEN_B_TRUONG } from '../lib/benB'
import { loiDeHieu } from '../lib/loi'

const LOAI_OPTIONS = [
  { value: 'xay_shop', label: 'Hợp đồng Seller (Xây shop / Tối ưu) — TUKIGROUP' },
  { value: 'ads', label: 'Hợp đồng Chạy quảng cáo — TUKI ADS' },
]

// Sửa thông tin Bên B (bên mình) hiện trong hợp đồng. Ô nào để trống thì hợp đồng không hiện dòng đó.
export default function BenBModal({ benB, loaiBanDau = 'xay_shop', onClose, onSaved }) {
  const [loai, setLoai] = useState(loaiBanDau)
  const [form, setForm] = useState({ ...benB[loaiBanDau] })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function doiLoai(l) {
    setLoai(l)
    setForm({ ...benB[l] })
    setMsg('')
  }

  async function luu(e) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const { error } = await supabase.from('ben_b_settings')
      .upsert({ loai, du_lieu: form, updated_at: new Date().toISOString() }, { onConflict: 'loai' })
    setSaving(false)
    if (error) {
      setMsg(/ben_b_settings/.test(error.message)
        ? 'Chưa tạo bảng lưu Bên B trong Supabase — chị chạy file migration_31 trước nhé.'
        : 'Không lưu được: ' + loiDeHieu(error))
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <Modal title="Thông tin Bên B (bên cung cấp dịch vụ)" onClose={onClose} wide>
      <form onSubmit={luu} className="space-y-4">
        <Select label="Áp dụng cho" value={loai} onChange={(e) => doiLoai(e.target.value)}>
          {LOAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <p className="text-xs text-ink-400">
          Đây là thông tin bên mình hiện trong mọi hợp đồng thuộc loại này. Ô nào để trống thì hợp đồng sẽ không hiện dòng đó.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {BEN_B_TRUONG.map((f) => (
            <div key={f.key} className={f.rong ? 'col-span-2' : ''}>
              <Input label={f.label} value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>

        {msg && <p className="text-sm text-rose-600">{msg}</p>}

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm({ ...BEN_B_MAC_DINH[loai] })}>
            Khôi phục mặc định
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
