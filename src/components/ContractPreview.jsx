import { useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { Modal, Button } from './ui'

// Sau khi Vercel deploy bản mới, tab trình duyệt đang mở vẫn nhớ đường dẫn file JS
// của bản cũ — file đó không còn trên server nữa nên import động bị lỗi. Nhận diện
// đúng lỗi này để báo rõ + cho bấm tải lại trang, thay vì hiện lỗi kỹ thuật khó hiểu.
function laLoiBanCu(e) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
    .test(e?.message || '')
}

// Xem trước hợp đồng Word ngay trong app: dựng lại đúng file .docx (dùng chung
// hàm taoFileHopDong với lúc xuất file) rồi render thành HTML trong khung cuộn.
// `hd` có cùng cấu trúc với tham số truyền cho taoFileHopDong().
export default function ContractPreview({ hd, onClose }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banCu, setBanCu] = useState(false)

  useEffect(() => {
    let huy = false
    async function render() {
      setLoading(true); setError(''); setBanCu(false)
      try {
        const { taoFileHopDong } = await import('../lib/hopDong')
        const blob = await taoFileHopDong(hd)
        if (huy || !containerRef.current) return
        containerRef.current.innerHTML = ''
        await renderAsync(blob, containerRef.current, containerRef.current, {
          className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: true,
        })
      } catch (e) {
        if (huy) return
        if (laLoiBanCu(e)) {
          setBanCu(true)
          setError('Trang đang mở là bản cũ (do vừa có cập nhật mới) — tải lại trang rồi mở xem trước lại nhé.')
        } else {
          setError('Không tạo được bản xem trước: ' + e.message)
        }
      } finally {
        if (!huy) setLoading(false)
      }
    }
    render()
    return () => { huy = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(hd)])

  function inHopDong() {
    if (!containerRef.current) return
    const cuaSo = window.open('', '_blank')
    if (!cuaSo) return
    cuaSo.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>In hợp đồng</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #fff; display: flex; justify-content: center; }
  .docx-wrapper { background: #fff !important; padding: 0 !important; }
  .docx { width: 100% !important; max-width: 800px; margin: 0 auto !important; box-shadow: none !important; }
  @media print {
    body { padding: 0; }
    .docx-wrapper { padding: 0 !important; }
  }
</style>
</head>
<body>${containerRef.current.innerHTML}</body>
</html>`)
    cuaSo.document.close()
    cuaSo.focus()
    setTimeout(() => cuaSo.print(), 400)
  }

  return (
    <Modal title="Xem trước hợp đồng" onClose={onClose} wide>
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="secondary" onClick={inHopDong} disabled={loading || !!error}>
          <Printer size={15} /> In hợp đồng
        </Button>
      </div>
      {loading && <p className="mb-2 text-sm text-ink-400">Đang dựng bản xem trước...</p>}
      {error && (
        <div className="mb-2">
          <p className="text-sm text-rose-600">{error}</p>
          {banCu && (
            <Button type="button" onClick={() => window.location.reload()} className="mt-2">
              Tải lại trang
            </Button>
          )}
        </div>
      )}
      <div className="max-h-[75vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div ref={containerRef} />
      </div>
    </Modal>
  )
}
