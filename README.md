# BesteVilla - Sistem Reservasi Villa

BesteVilla adalah sistem reservasi villa modern yang dibangun dengan teknologi web terdepan. Sistem ini menyediakan platform lengkap untuk mengelola reservasi villa, pembayaran online, dan administrasi backend yang komprehensif.

## 🌟 Fitur Utama

### Frontend (User)
- **Landing Page Responsive** - Desain modern dengan efek glassmorphism
- **Sistem Reservasi Villa** - Form reservasi lengkap dengan validasi real-time
- **Cek Ketersediaan** - Real-time availability checker untuk semua villa
- **Upload Bukti DP** - Sistem upload file untuk bukti down payment
- **Gallery Villa** - Showcase detail setiap villa dengan virtual tour
- **Contact & Feedback** - Form kontak dan kritik saran terintegrasi
- **Payment Gateway** - Integrasi Midtrans untuk pembayaran online

### Backend (Admin)
- **Admin Dashboard** - Panel administrasi dengan statistik real-time
- **Manajemen Reservasi** - CRUD operations dengan sistem approval
- **Status Management** - Pending, Accepted, Rejected workflow
- **File Management** - Preview bukti DP
- **User Feedback** - Manajemen kritik saran dan pesan kontak
- **Availability Control** - Kontrol ketersediaan villa berdasarkan status

## 🏗️ Teknologi Stack

### Frontend
- **HTML5/CSS3** - Struktur dan styling modern
- **JavaScript ES6+** - Interaktivity dan AJAX
- **Bootstrap 5** - Framework CSS responsive
- **Font Awesome** - Icon library

### Backend
- **Node.js** - Runtime JavaScript server-side
- **Oracle Database** - Database enterprise-grade
- **JWT Authentication** - Token-based security
- **Midtrans** - Payment gateway integration

## 🎮 Cara Penggunaan

### 1. Melakukan Reservasi
1. Klik tombol "Reservasi" di navbar
2. Isi form reservasi lengkap
3. Upload bukti DP (JPG, PNG, atau PDF)
4. Submit reservasi (status: pending)

### 2. Cek Ketersediaan Villa
1. Klik "Cek Ketersediaan"
2. Pilih tanggal check-in dan check-out
3. Lihat status real-time setiap villa

### 3. Admin Panel
1. Akses: `http://localhost:3000/admin/login.html`
2. Login dengan:
   - Username dan password
3. Kelola reservasi, approval, dan data lainnya

## 📊 Logika Sistem Status

### Status Reservasi
- **Pending** 🟡 - Reservasi baru, belum dikonfirmasi admin
- **Accepted** ✅ - Reservasi diterima, villa menjadi unavailable
- **Rejected** ❌ - Reservasi ditolak, villa tetap available

### Availability Logic
```
Villa Available = Tidak ada reservasi dengan status "ACCEPTED" 
                  pada range tanggal yang dipilih

Villa Unavailable = Ada reservasi dengan status "ACCEPTED" 
                    yang overlap dengan tanggal yang dipilih
```

**Penting**: Hanya reservasi dengan status `accepted` yang membuat villa unavailable. Reservasi `pending` dan `rejected` tidak mempengaruhi ketersediaan.

## 🌐 API Endpoints

### Public Endpoints
```
POST /reservasi              # Submit reservasi baru
POST /kritiksaran            # Submit kritik saran
POST /kontakkami             # Submit pesan kontak
GET  /check-availability     # Cek ketersediaan villa
GET  /unavailable-dates      # Ambil daftar tanggal unavailable
```

### Admin Endpoints (Requires JWT)
```
POST /admin/login            # Admin login
GET  /admin/verify           # Verify JWT token
GET  /admin/stats            # Dashboard statistics
GET  /admin/reservasi        # Ambil semua reservasi
PUT  /admin/reservasi/:id/status  # Update status reservasi
DELETE /admin/reservasi/:id  # Hapus reservasi
GET  /admin/kritik-saran     # Ambil kritik saran
DELETE /admin/kritik-saran/:id    # Hapus kritik saran
GET  /admin/kontak           # Ambil pesan kontak
DELETE /admin/kontak/:id     # Hapus kontak
```

### Payment Endpoints
```
GET  /pembayaran             # Halaman pembayaran
POST /api/payment            # Buat transaksi Midtrans
POST /api/midtrans-notification  # Webhook Midtrans
```

**Made with ❤️ **
