import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Modal, Input, Textarea, Button } from './ui'
import { homNayLocal, dinhDangNgay } from '../lib/taiKy'

// Ghi nhận 1 lần đã báo cáo chỉ số ADS cho khách (mỗi 2 tuần 1 lần)
export default function BaoCaoAdsModal({ hd, khach, lanThu, currentProfile, onClose, onSaved }) {
  const homNay = homNayLocal()
  const [ngay, setNgay] = useState(homNay)
  const [ghiChu, setGhiChu] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function luu(e) {
    e.preventDefault()
    if (!ngay) { setError('Chọn ngày đã báo cáo'); return }
    if (ngay > homNay) { setError('Ngày báo cáo không được ở tương lai'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('ads_bao_cao').insert({
      contract_id: hd.id,
      customer_id: hd.customer_id,
      ngay_bao_cao: ngay,
      ghi_chu: ghiChu.trim() || null,
      created_by: currentProfile?.id || null,
    })
    setSaving(false)
    if (err) {
      setError(/ads_bao_cao/.test(err.message)
        ? 'Chưa tạo bảng lưu báo cáo ADS trong Supabase — chị chạy file migration_32 trước nhé.'
        : 'Không lưu được: ' + err.message)
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <Modal title="Ghi nhận đã báo cáo chỉ số ADS" onClose={onClose}>
      <form onSubmit={luu} className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-400">Khách hàng</p>
          <p className="font-display font-semibold text-navy-900">{khach?.ten_khach}</p>
          <p className="text-sm text-ink-600">
            {hd.so_hop_dong}{hd.ten_goi ? ` · ${hd.ten_goi}` : ''}{lanThu ? ` · báo cáo lần ${lanThu}` : ''}
          </p>
        </div>

        <Input label="Ngày đã báo cáo" type="date" max={homNay} value={ngay} onChange={(e) => setNgay(e.target.value)} />
        <p className="-mt-2 text-xs text-ink-400">
          Lần báo cáo kế tiếp sẽ nhắc sau 2 tuần kể từ ngày này{ngay ? ` (${dinhDangNgay(ngay)})` : ''}.
        </p>

        <Textarea label="Ghi chú chỉ số đã báo cáo (không bắt buộc)" rows={3} value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          placeholder="VD: chi phí 1.200k, 18 đơn, ROAS 4.2 — đề xuất tăng ngân sách..." />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Đã báo cáo'}</Button>
        </div>
      </form>
    </Modal>
  )
}
