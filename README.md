# 🎮 AKNet Order System

Hệ thống quản lý order cho quán net AKNet.

## 📥 Tải file cài đặt

**→ Vào tab [Releases](../../releases/latest) để tải file `.exe` mới nhất**

| File | Cài lên máy |
|------|-------------|
| `AKNet Cashier Setup.exe` | Máy tính tiền |
| `AKNet Order Setup.exe` | Từng máy trạm |

---

## 🛠 Tự build (dành cho developer)

Repository này dùng **GitHub Actions** để tự động build file `.exe` trên máy Windows của GitHub.

### Cách build thủ công:
1. Vào tab **Actions** trên GitHub
2. Chọn workflow **"Build AKNet Installers"**
3. Bấm **"Run workflow"** → **"Run workflow"**
4. Chờ ~5 phút → vào tab **Releases** tải file `.exe`

---

## 🌐 Hướng dẫn sử dụng

### Máy tính tiền
1. Cài `AKNet Cashier Setup.exe` → Next Next Finish
2. Mở app **AKNet Cashier**
3. Ghi lại địa chỉ IP hiển thị (ví dụ: `192.168.1.5:3456`)
4. App chạy ngầm dưới khay hệ thống (system tray)

> ✅ Firewall port 3456 được mở **tự động** khi cài đặt

### Máy trạm
1. Cài `AKNet Order Setup.exe` → Next Next Finish
2. Mở **AKNet Order**
3. Nhập IP máy tính tiền → Đặt số máy (01, 02...) → **KẾT NỐI**

---

## 📋 Yêu cầu
- Windows 10/11 x64
- Cùng mạng LAN/WiFi
