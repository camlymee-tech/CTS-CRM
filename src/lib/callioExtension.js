// Đưa số điện thoại sang khung gọi của extension Callio (nếu trình duyệt có cài).
// Khung gọi là iframe của client.callio.vn nên web không gõ thẳng vào ô số được;
// thay vào đó làm y như nút "Gọi từ callio" của extension: nạp lại iframe với ?phone=<số> rồi mở khung.
// LƯU Ý: Callio nhận ?phone= là tự bấm Gọi sau ~1 giây (không có chế độ chỉ điền số) → nơi gọi hàm phải hỏi xác nhận trước.
// Trả về true nếu đã chuyển sang Callio, false nếu không thấy extension.
export function goiQuaCallio(sdt) {
  const so = String(sdt || '').replace(/\D/g, '')
  if (!so) return false
  const iframe = document.getElementById('callio-extension')
  const khung = document.getElementById('callio-widget-call')
  if (!iframe || !khung) return false
  iframe.src = `https://client.callio.vn/widget.html?phone=${so}`
  khung.classList.add('active')
  return true
}
