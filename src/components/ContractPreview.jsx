import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import { Modal } from './ui'

// Xem trước hợp đồng Word ngay trong app: dựng lại đúng file .docx (dùng chung
// hàm taoFileHopDong với lúc xuất file) rồi render thành HTML trong khung cuộn.
// `hd` có cùng cấu trúc với tham số truyền cho taoFileHopDong().
export default function ContractPreview({ hd, onClose }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let huy = false
    async function render() {
      setLoading(true); setError('')
      try {
        const { taoFileHopDong } = await import('../lib/hopDong')
        const blob = await taoFileHopDong(hd)
        if (huy || !containerRef.current) return
        containerRef.current.innerHTML = ''
        await renderAsync(blob, containerRef.current, containerRef.current, {
          className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: true,
        })
      } catch (e) {
        if (!huy) setError('Không tạo được bản xem trước: ' + e.message)
      } finally {
        if (!huy) setLoading(false)
      }
    }
    render()
    return () => { huy = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(hd)])

  return (
    <Modal title="Xem trước hợp đồng" onClose={onClose} wide>
      {loading && <p className="mb-2 text-sm text-ink-400">Đang dựng bản xem trước...</p>}
      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
      <div className="max-h-[75vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div ref={containerRef} />
      </div>
    </Modal>
  )
}
