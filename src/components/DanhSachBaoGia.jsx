import { useEffect, useState } from 'react'
import { Trash2, FileText } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { laAdmin } from '../lib/quyen'
import { TEN_DV } from '../lib/baoGia'
import { loiDeHieu } from '../lib/loi'

const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN')
const TH = 'border border-slate-300 bg-navy-900 px-3 py-2 text-center text-xs font-semibold text-white'
const TD = 'border border-slate-300 px-3 py-2 text-sm'
const ngay = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

// Bảng báo giá đã lưu. Có customerId = chỉ báo giá của khách đó (trong hồ sơ khách hàng).
export default function DanhSachBaoGia({ customerId, currentProfile, lamMoi = 0, onMo, onDem }) {
  const [ds, setDs] = useState([])
  const [dang, setDang] = useState(true)
  const [tim, setTim] = useState('')

  async function tai() {
    setDang(true)
    let q = supabase.from('bao_gia')
      .select('id, customer_id, loai, ten, tong_kg, tong_m3, created_by, created_at, updated_at, khach:customers(ten_khach, ma_khach), nguoi:profiles!bao_gia_created_by_fkey(full_name)')
      .order('updated_at', { ascending: false }).limit(500)
    if (customerId) q = q.eq('customer_id', customerId)
    const { data, error } = await q
    if (error) alert('Không tải được báo giá: ' + loiDeHieu(error))
    setDs(data || []); setDang(false); onDem?.((data || []).length)
  }
  useEffect(() => { tai() }, [customerId, lamMoi]) // eslint-disable-line

  async function xoa(b) {
    if (!window.confirm(`Xoá báo giá "${b.ten || TEN_DV[b.loai]}"? Không khôi phục được.`)) return
    const { error } = await supabase.from('bao_gia').delete().eq('id', b.id)
    if (error) { alert('Không xoá được: ' + loiDeHieu(error)); return }
    tai()
  }

  const loc = ds.filter((b) => !tim || `${b.ten} ${b.khach?.ten_khach} ${b.khach?.ma_khach}`.toLowerCase().includes(tim.toLowerCase()))
  return (
    <div className="space-y-3">
      {!customerId && (
        <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm theo tên khách hoặc mã báo giá..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-coral-500" />
      )}
      {dang ? <p className="text-sm text-ink-400">Đang tải...</p> : loc.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-ink-400">Chưa có báo giá nào</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              {['Báo giá', ...(customerId ? [] : ['Khách hàng']), 'Dịch vụ', 'Tổng theo KG', 'Tổng theo M3', 'Người tạo', 'Cập nhật', ''].map((h, i) => <th key={i} className={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loc.map((b) => (
                <tr key={b.id} className="hover:bg-orange-50/50">
                  <td className={TD}>
                    <button type="button" onClick={() => onMo(b)} className="inline-flex items-center gap-1.5 font-medium text-navy-900 hover:text-coral-600">
                      <FileText size={14} /> {b.ten || 'Báo giá'}
                    </button>
                  </td>
                  {!customerId && <td className={TD}>{b.khach?.ten_khach}</td>}
                  <td className={`${TD} text-center`}>{TEN_DV[b.loai]}</td>
                  <td className={`${TD} text-right`}>{vnd(b.tong_kg)}</td>
                  <td className={`${TD} text-right`}>{vnd(b.tong_m3)}</td>
                  <td className={TD}>{b.nguoi?.full_name}</td>
                  <td className={`${TD} text-center`}>{ngay(b.updated_at)}</td>
                  <td className={`${TD} w-10 text-center`}>
                    {(laAdmin(currentProfile) || b.created_by === currentProfile?.id) && (
                      <button type="button" onClick={() => xoa(b)} className="text-ink-400 hover:text-rose-500"><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
