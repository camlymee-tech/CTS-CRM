// Khung bộ lọc trang Khách hàng: tìm kiếm, trạng thái, dịch vụ, phòng ban, sale, ngày tạo.
import { Search } from 'lucide-react'
import { Input, Select } from '../ui'
import { useTrangThai } from '../../lib/StatusContext'
import { DICH_VU_OPTIONS } from '../../lib/constants'

export default function BoLocKhach({ boLoc, datLoc, xoaLoc, dsPhongBan, dsSaleLoc }) {
  const { options: TRANG_THAI } = useTrangThai()
  return (
    <div className="mx-8 mt-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Tìm theo tên, mã KH, SĐT, ngành hàng..." value={boLoc.search}
            onChange={(e) => datLoc('search', e.target.value)} className="pl-9" />
        </div>
        <Select value={boLoc.trangThai} onChange={(e) => datLoc('trangThai', e.target.value)} className="w-48">
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI.map((o) => <option key={o.ma} value={o.ma}>{o.ten}</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={boLoc.dichVu} onChange={(e) => datLoc('dichVu', e.target.value)} className="w-48">
          <option value="">Tất cả dịch vụ</option>
          {DICH_VU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={boLoc.phong} onChange={(e) => datLoc('phong', e.target.value)} className="w-48">
          <option value="">Tất cả phòng ban</option>
          {dsPhongBan.map((pb) => <option key={pb} value={pb}>{pb}</option>)}
        </Select>
        <Select value={boLoc.sale} onChange={(e) => datLoc('sale', e.target.value)} className="w-44">
          <option value="">Tất cả sale</option>
          {dsSaleLoc.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <span className="font-medium text-navy-900">Ngày tạo</span>
          <span>từ</span>
          <Input type="date" value={boLoc.tuNgay} onChange={(e) => datLoc('tuNgay', e.target.value)} className="w-40" />
          <span>đến</span>
          <Input type="date" value={boLoc.denNgay} onChange={(e) => datLoc('denNgay', e.target.value)} className="w-40" />
        </div>
        {Object.values(boLoc).some(Boolean) && (
          <button
            onClick={xoaLoc}
            className="text-sm text-ink-600 hover:text-coral-500">
            Xoá bộ lọc
          </button>
        )}
      </div>
    </div>
  )
}
