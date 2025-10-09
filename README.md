# 🧭 Hóa đơn điện bậc thang

Hiển thị hóa đơn tiền điện của bạn một cách trực quan

![preview](preview.png)

## 🔧 Tính năng chính

Chỉ cần 1 con số input vào bất kỳ mà bạn đưa vào sẽ tính giá điện theo bậc thang của EVN
Giá điện được quy định theo bậc tại file evn.json

## ⚙️ Cài đặt

VÀO HACS trên Home assistant -> Thêm kho lưu trữ tùy chỉnh 
```yaml
https://github.com/tongtbgl/dien-bac-thang-evn
```
Kiểu là bảng điều khiển -> bấm thêm
Sau khi thêm tìm kiếm "Điện Bậc Thang EVN" để tải về

## Code mẫu
```yaml
type: custom:dien-bac-thang-remote-card
entity: sensor.tong_tieu_thu_thang_ct2
name: Tiền điện tháng này
short: false
detail: true
mode: 2

```
# Ủng hộ tôi để có thêm động lực phát triển:
https://bachtran.net/donate/
Cảm ơn các bạn
