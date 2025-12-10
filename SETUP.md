# 🚀 E-Contract Platform - Setup Guide

## 📋 Yêu cầu hệ thống

- **Node.js**: v18+ (khuyến nghị v20+)
- **Redis**: Vercel KV hoặc Redis instance
- **Chrome/Chromium**: Để generate PDF (chỉ local dev)

---

## 🔧 Cài đặt ban đầu

### 1. Clone và Install Dependencies

```bash
git clone <your-repo>
cd bien-lai
npm install
```

### 2. Cấu hình Environment Variables

Tạo file `.env.local`:

```env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔐 Authentication
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN_PASSWORD=your-password-here
JWT_SECRET=your-jwt-secret-minimum-32-chars

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 Redis Database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📧 Email (Gmail)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@example.com

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📱 Telegram (Optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🌐 Base URL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🖨️ PDF Generation - Chrome Path (LOCAL DEV ONLY)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Mac:
CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# Windows:
# CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Linux:
# CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### 3. Tìm đường dẫn Chrome trên máy bạn

**Mac:**
```bash
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**Windows:**
```powershell
# Run in PowerShell:
(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe').'(Default)'

# Hoặc thường là:
C:\Program Files\Google\Chrome\Application\chrome.exe
```

**Linux:**
```bash
which google-chrome
# hoặc
which chromium-browser
```

---

## 🏃 Chạy Development Server

```bash
npm run dev
```

Server sẽ chạy tại: **http://localhost:3000**

---

## 📝 Cách sử dụng

### Admin Flow:

1. **Login:** Truy cập `/` và đăng nhập với `ADMIN_PASSWORD`
2. **Tạo mới:** Click "Tạo mới" → Chọn mẫu hợp đồng
3. **Soạn thảo:** Chỉnh sửa nội dung, nhập thông tin các bên
4. **Ký trước (optional):** Click "Ký ngay" để ký cho admin
5. **Lưu:** Hợp đồng được tạo trong Redis
6. **Chia sẻ:** Copy link hoặc gửi email cho khách hàng

### Customer Flow:

1. Nhận email/link
2. Mở link → Hệ thống track "Đã xem"
3. Xem nội dung hợp đồng
4. Click "Ký xác nhận"
5. Vẽ hoặc gõ chữ ký
6. "Hoàn tất & Gửi"
7. Hệ thống tạo PDF và gửi email/Telegram

---

## 🚀 Deploy lên Vercel

### 1. Push code lên GitHub

```bash
git add .
git commit -m "feat: E-Contract Platform with Puppeteer PDF"
git push origin main
```

### 2. Deploy trên Vercel

```bash
npm i -g vercel
vercel --prod
```

### 3. Cấu hình Environment Variables trên Vercel

Vào **Vercel Dashboard** → **Settings** → **Environment Variables**, thêm:

- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `REDIS_URL`
- `EMAIL_USER`
- `EMAIL_PASS`
- `ADMIN_EMAIL`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)
- `NEXT_PUBLIC_BASE_URL`

**⚠️ QUAN TRỌNG:**
- **KHÔNG** set `CHROME_EXECUTABLE_PATH` trên Vercel!
- Production tự động dùng `@sparticuz/chromium-min`

---

## 🐛 Troubleshooting

### Lỗi: "Failed to launch browser"

**Local dev:**
```bash
# Kiểm tra Chrome path
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Nếu không tồn tại, tìm lại:
mdfind -name "Google Chrome"
```

**Vercel:**
- Đảm bảo đã cài `@sparticuz/chromium-min`
- Check function timeout (default 10s, có thể cần tăng lên)

### Lỗi: "Font not loaded"

- Đợi fonts load: `page.evaluateHandle('document.fonts.ready')`
- Hoặc dùng base64 embed fonts

### PDF bị chữ tiếng Việt vỡ

- Đảm bảo dùng font **Tinos** (Google Fonts)
- Hoặc embed font vào HTML

---

## 📦 Package Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           # JWT authentication
│   │   └── receipts/       # CRUD + Sign + Track
│   ├── dashboard/
│   │   ├── create/         # Template library
│   │   └── editor/         # Document editor
│   └── page.tsx            # Main routing logic
├── components/
│   ├── DashboardKV.tsx     # Admin dashboard
│   ├── DocumentEditorKV.tsx # Contract editor
│   ├── ContractViewKV.tsx  # Contract viewer (for signing)
│   └── SignatureModal.tsx  # Signature capture
├── lib/
│   ├── kv.ts               # Redis CRUD
│   ├── pdf-generator.ts    # Puppeteer PDF engine ⭐
│   ├── auth.ts             # JWT utilities
│   └── utils.ts            # Helpers
└── data/
    └── templates.ts        # Contract templates

```

---

## 🎯 Features

- ✅ Multiple contract templates (Vietnamese legal standards)
- ✅ Real-time live preview
- ✅ Digital signature (draw/type)
- ✅ Admin can sign before sending
- ✅ View tracking ("Đã xem" status)
- ✅ Server-side PDF generation (Puppeteer)
- ✅ Email notifications with PDF attachment
- ✅ Telegram notifications
- ✅ Responsive UI (mobile-friendly)
- ✅ Full admin control (create, edit, delete)

---

## 📞 Support

For issues or questions, check the code comments or contact the development team.

**Built with ❤️ using Next.js 16 + Puppeteer**

