// Một dòng trong bảng Khách hàng. Bấm dòng = mở hồ sơ; ô tích, nút Trùng SĐT, nút xoá không mở hồ sơ.
import { User, Users2, Link2, Store, Trash2 } from 'lucide-react'
import { Badge } from '../ui'
import { useTrangThai } from '../../lib/StatusContext'
import { ngayLocal, gioNgay, dinhDangNgay } from '../../lib/ngay'
import { NEN_TANG_OPTIONS, LOAI_KHACH_OPTIONS, LOAI_TUONG_TAC_OPTIONS, classOf, labelOf } from '../../lib/constants'

// Màu vạch dọc bên trái mỗi dòng theo trạng thái chăm sóc (giống vạch xanh ở mẫu)
const VIEN_TRANG_THAI = {
  slate: 'border-slate-300', orange: 'border-orange-400', amber: 'border-amber-400', emerald: 'border-emerald-500',
  teal: 'border-teal-500', violet: 'border-violet-500', rose: 'border-rose-500', coral: 'border-coral-500',
  sky: 'border-sky-500', navy: 'border-navy-900',
}

export default function DongKhach({ c, idx, hien, doRong, dongChon, cuaMinh, td, soCS, soTrung, nhatKy, profileName, phongBan, coTheXoa, onMo, onChon, onLocSdt, onXoa }) {
  const { options: TRANG_THAI, tenTrangThai, classTrangThai, laKhachChung } = useTrangThai()
  const chung = laKhachChung(c)
  const mauTT = TRANG_THAI.find((o) => o.ma === c.trang_thai_cham_soc)?.mau
  const hen = c.ngay_cham_soc_tiep_theo
  const homNay = ngayLocal(new Date())
  return (
    <tr
      className={`cursor-pointer border-b border-slate-200 last:border-0 hover:bg-sky-50/60 ${
        dongChon ? 'bg-sky-50' : idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
      }`}
      onClick={onMo}>
      <td className={`relative w-10 border-l-4 px-2.5 py-3 ${VIEN_TRANG_THAI[mauTT] || 'border-slate-300'}`}
        style={{ borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}
        onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={dongChon} onChange={onChon}
          className="h-4 w-4 rounded border-slate-300" />
      </td>
      {hien('stt') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{idx + 1}</td>}
      <td className="border border-slate-200 px-2.5 py-3" style={{ maxWidth: doRong.ten || 170 }}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-100 text-indigo-300">
            <User size={20} fill="currentColor" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-medium text-indigo-800">{c.ten_khach}</p>
              {soCS > 0 && (
                <span title={`${soCS} lượt chăm sóc đã ghi`}
                  className="inline-flex h-5 min-w-[1.25rem] flex-none items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-semibold text-white">
                  {soCS}
                </span>
              )}
              {chung && !cuaMinh && (
                <span title="Khách chung — cả team đều xem được">
                  <Users2 size={13} className="text-amber-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span>{c.ma_khach}</span>
              {c.link_fb && (
                <a href={c.link_fb} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                  <Link2 size={10} /> FB
                </a>
              )}
              {c.link_shop && (
                <a href={c.link_shop} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-teal-500 hover:underline">
                  <Store size={10} /> Shop
                </a>
              )}
            </div>
          </div>
        </div>
      </td>
      {hien('sdt') && (
        <td className="border border-slate-200 px-2.5 py-3 font-medium text-indigo-800">
          {c.sdt || <span className="text-ink-400">—</span>}
          {soTrung > 1 && (
            <button type="button" title="Lọc các hồ sơ cùng số này"
              onClick={(e) => { e.stopPropagation(); onLocSdt() }}
              className="mt-1 block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200">
              Trùng SĐT · {soTrung} hồ sơ
            </button>
          )}
        </td>
      )}
      {hien('sale') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{profileName(c.sale_id)}</td>}
      {hien('phong_ban') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{phongBan || '—'}</td>}
      {hien('trao_doi') && (
        <td className="border border-slate-200 px-2.5 py-3" style={{ minWidth: 260, maxWidth: doRong.trao_doi || 420 }}>
          {!td ? <span className="text-ink-400">—</span> : (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-indigo-800">{profileName(td.nguoi)}</span>
                <span className="flex-none whitespace-nowrap text-xs text-ink-600">{gioNgay(td.thoiGian)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-navy-900">
                <span className="mr-1 text-xs font-medium text-teal-600">
                  [{labelOf(LOAI_TUONG_TAC_OPTIONS, td.loai)}]
                </span>
                {td.noiDung}
              </p>
            </div>
          )}
        </td>
      )}
      {hien('cham_soc') && (
        <td className="border border-slate-200 px-2.5 py-3" style={{ minWidth: 130 }}>
          <Badge className={`${classTrangThai(c.trang_thai_cham_soc)}`}>{tenTrangThai(c.trang_thai_cham_soc)}</Badge>
          <p className="mt-1 whitespace-nowrap text-xs text-ink-600">
            {hen
              ? <span className={hen < homNay ? 'font-medium text-rose-600' : hen === homNay ? 'font-medium text-coral-600' : ''}>
                  Hẹn {dinhDangNgay(hen)}{hen < homNay ? ' · trễ' : hen === homNay ? ' · hôm nay' : ''}
                </span>
              : <span className="text-ink-400">Chưa đặt lịch hẹn</span>}
          </p>
        </td>
      )}
      {hien('khu_vuc') && <td className="border border-slate-200 px-2.5 py-3 text-navy-900">{c.khu_vuc || '—'}</td>}
      {hien('nen_tang') && (
      <td className="border border-slate-200 px-2.5 py-3">
        <div className="flex flex-wrap gap-1">
          {(c.nen_tang || []).map((nt) => (
            <Badge key={nt} className={classOf(NEN_TANG_OPTIONS, nt)}>{labelOf(NEN_TANG_OPTIONS, nt)}</Badge>
          ))}
        </div>
      </td>)}
      {hien('loai') && (
      <td className="border border-slate-200 px-2.5 py-3">
        <Badge className={c.loai_khach === 'moi' ? 'bg-coral-50 text-coral-600' : 'bg-slate-100 text-slate-600'}>
          {labelOf(LOAI_KHACH_OPTIONS, c.loai_khach)}
        </Badge>
      </td>)}
      {hien('ngay_tao') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{ngayLocal(c.created_at) || '—'}</td>}
      {hien('lien_he') && <td className="border border-slate-200 px-2.5 py-3 text-ink-600">{c.ngay_lien_he_gan_nhat || '—'}</td>}
      {hien('giai_phap') && (
        <td className="border border-slate-200 px-2.5 py-3 text-ink-600" style={{ maxWidth: doRong.giai_phap || 220 }}>
          <p className="line-clamp-2 whitespace-pre-wrap">{c.giai_phap || '—'}</p>
        </td>
      )}
      {hien('nhat_ky') && (
        <td className="border border-slate-200 px-2.5 py-3 text-ink-600">
          {(() => {
            const l = nhatKy
            if (!l) return <span className="text-ink-400">—</span>
            return (
              <div style={{ maxWidth: doRong.nhat_ky || 200 }}>
                <p className="truncate text-navy-900">{l.hanh_dong}</p>
                <p className="text-xs text-ink-400">
                  {profileName(l.user_id)} · {new Date(l.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            )
          })()}
        </td>
      )}
      <td className="border border-slate-200 whitespace-nowrap px-2.5 py-3 text-right">
        {coTheXoa && (
          <button onClick={(e) => { e.stopPropagation(); onXoa() }}
            className="text-ink-400 hover:text-rose-500" title="Xoá khách hàng">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}
