# Panduan Deployment Cloud Biaya Rp 0 (Zero-Cost Production Setup)

Panduan praktis langkah demi langkah untuk meluncurkan Kafe Dine-in Web POS ke internet publik secara gratis dengan sertifikat SSL/HTTPS resmi.

---

## 1. Arsitektur Tiga Pilar Cloud Gratis

```
[Customer HP & Kasir Tablet]
            │ (HTTPS)
            ├───► 1. Frontend SPA ──────► Vercel / Cloudflare Pages (Free)
            │
            └───► 2. Backend FastAPI ───► Render.com Free Web Service (Docker)
                        │
                        └───► 3. Database ──► Neon.tech / Supabase (PostgreSQL 15+ Free)
```

---

## 2. Langkah 1: Siapkan Database Cloud (Neon.tech atau Supabase)

Pilih salah satu (keduanya 100% gratis):

### Opsi A: Neon.tech (Paling Direkomendasikan untuk Serverless)
1. Daftar akun di [neon.tech](https://neon.tech) (login via GitHub).
2. Klik **Create Project**, beri nama `pos-cafe-db`, pilih region terdekat (misal: `Singapore / ap-southeast-1`).
3. Salin connection string yang diberikan, contoh:
   ```
   postgresql://alex:AbC123xyz@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Ubah driver awalan menjadi asyncpg:
   Ganti `postgresql://` menjadi `postgresql+asyncpg://`.

### Opsi B: Supabase
1. Buat project baru di [supabase.com](https://supabase.com).
2. Pergi ke **Project Settings** ➔ **Database** ➔ **Connection string** (pilih tab *URI* dan mode *Transaction Pooler* port 6543).
3. Salin URI-nya dan tambahkan `+asyncpg` pada driver.

---

## 3. Langkah 2: Deploy Backend FastAPI (Render.com)

1. Daftar akun di [render.com](https://render.com) (login via GitHub).
2. Klik tombol **New +** ➔ pilih **Web Service**.
3. Hubungkan ke repositori GitHub `pos-app` milikmu.
4. Isi konfigurasi deployment:
   * **Name:** `pos-cafe-api`
   * **Region:** `Singapore`
   * **Root Directory:** `backend`
   * **Environment:** `Docker`
   * **Instance Type:** `Free`
5. Gulir ke bawah ke bagian **Environment Variables**, klik **Add Environment Variable** dan isi 4 variabel wajib:
   * `ENVIRONMENT`: `production`
   * `SECRET_KEY`: Buat 32 karakter acak yang kuat (contoh: `kunci_rahasia_produksi_kafe_senja_2026_super_aman`)
   * `DATABASE_URL`: Tempelkan connection string PostgreSQL dari Langkah 1
   * `CORS_ORIGINS`: `https://namaproyek-kamu.vercel.app` (domain Vercel frontend-mu di Langkah 3)
6. Klik **Create Web Service**. Render akan otomatis mem-build Dockerfile dan meluncurkan server di URL seperti:  
   `https://pos-cafe-api.onrender.com`.

### Menjalankan Migrasi Awal di Cloud:
Di dashboard Render, buka tab **Shell** (atau jalankan dari laptopmu sekali saja dengan mengarahkan `DATABASE_URL` di `.env` ke URL cloud):
```bash
alembic upgrade head
python -m scripts.seed_data
```

---

## 4. Langkah 3: Deploy Frontend React (Vercel)

1. Daftar akun di [vercel.com](https://vercel.com) (login via GitHub).
2. Klik **Add New...** ➔ **Project**.
3. Impor repositori `pos-app`.
4. Isi konfigurasi:
   * **Framework Preset:** `Vite`
   * **Root Directory:** klik *Edit* ➔ pilih folder `frontend`.
5. Buka bagian **Environment Variables**:
   * Nama: `VITE_API_BASE`
   * Nilai: URL backend Render milikmu (misal: `https://pos-cafe-api.onrender.com` tanpa garis miring di akhir).
6. Klik **Deploy**. Dalam 1 menit, web kasir dan pemesanan meja live di domain resmi:  
   `https://pos-cafe.vercel.app`.

---

## 5. Tips Operasional Free-Tier Kafe Nyata

1. **Mencegah Cold Start Render (Mesin Tidur setelah 15 Menit):**
   * Layanan gratis Render akan tidur jika tidak ada request selama 15 menit. Saat bangun butuh waktu ~30 detik.
   * *Solusi Gratis:* Buka [uptimerobot.com](https://uptimerobot.com) (gratis), daftarkan URL healthcheck backend:  
     `https://pos-cafe-api.onrender.com/health` dengan interval ping setiap 10 menit pada jam buka kafe (08:00 - 22:00). Server tidak akan pernah tidur saat jam operasional.
2. **Cetak Stiker Meja:**
   * Buka `https://pos-cafe.vercel.app/print-qr` dari laptop kasir.
   * Cetak 12 kotak stiker QR code ke kertas stiker A4 menggunakan printer biasa.
   * Gunting dan tempel di atas meja fisik kafe.
