# Product Roadmap & Go-To-Market Guide

Dokumen ini memetakan strategi komersial, kriteria prioritas fitur, mitigasi risiko teknis & bisnis, serta panduan onboarding pelanggan pertama untuk aplikasi Kafe Dine-in Web POS.

---

## 1. Target Pengguna Awal & Karakteristik Pasar

* **Segmen Utama:** Coffee Shop / Kafe Mandiri (*single-outlet*, 10–25 meja) dengan konsep Dine-in.
* **Persona Pemilik (Owner):**
  * Sering mengeluhkan antrean kasir yang menumpuk di jam sibuk (malam minggu / jam makan siang).
  * Kehilangan pesanan atau salah mencatat pesanan khusus (*"less sugar, es dipisah"*).
  * Terbebani biaya software POS komersial (seperti Moka / Majoo / ESB) yang mengenakan biaya langganan bulanan mahal ditambah keharusan membeli hardware proprietary (tablet khusus, printer khusus).
* **Persona Pelanggan (Customer):**
  * Ingin langsung duduk di meja tanpa harus berdiri mengantre di kasir.
  * Menolak repot mendownload aplikasi dari Play Store / App Store atau mendaftar akun email/password hanya untuk memesan makanan/minuman.
* **Persona Kasir / Barista:**
  * Butuh melihat antrean urutan masak (*FIFO*) secara jelas tanpa kertas bon hilang atau terciprat air.
  * Butuh kemudahan fleksibilitas: pelanggan pindah meja, menambah pesanan babak ke-2, atau membatalkan pesanan jika salah input.

---

## 2. Diferensiasi Produk (Unique Selling Proposition)

| Dimensi | POS Tradisional / Kompetitor Murah | Solusi Kita (Dine-in Web POS) |
| :--- | :--- | :--- |
| **Pemesanan Dine-In** | Kasir mengetik manual satu per satu / Pelayan mencatat di kertas. | **Customer Self-Ordering via QR Meja** (Langsung buka web di browser HP, zero install). |
| **Kebutuhan Perangkat** | Wajib tablet Android/iPad khusus dan lisensi per device. | **Zero Hardware Lock-in**: Berjalan 100% di browser laptop/tablet/smartphone apa pun. |
| **Biaya Langganan** | Rp 250.000 – Rp 500.000+ per bulan per outlet. | **Gratis untuk Kafe Pilot** / Model langganan sangat terjangkau bagi UMKM. |
| **Notifikasi Dapur** | Butuh printer thermal LAN khusus di dapur. | **Live Screen Feed (SSE)** di tablet/HP dapur + opsi cetak printer thermal browser (`window.print()`). |

---

## 3. Matriks Prioritas Fitur: MVP vs v1.0 vs Ditunda

```
NILAI BAGI KAFE (VALUE)
     ▲
     │  [MVP]                       [v1.0]
     │  • QR Menu + Self-Order      • Payment Gateway (QRIS Dinamis)
     │  • Transaksi Stok Atomik     • Kitchen Display System (KDS multi-station)
     │  • Live Order Stream (SSE)   • Varian & Modifiers Menu Bersarang
     │  • Multi-round Order         • Laporan Harian Otomatis via WA
Tinggi│  • Void Order & Rollback
     │  • Shift Laci Kas Ringkas
     │  • Catatan Per Item
     │
     │  [MVP Ringkas]               [DITUNDA]
     │  • Cetak Struk Browser       • Rating & Ulasan Menu
     │  • Ekspor CSV Sederhana      • Struk via Email SMTP
     │  • Switch Menu Habis         • Multi-outlet / Multi-cabang
Rendah│                             • Generator PDF Kompleks di Backend
     └────────────────────────────────────────────────────────►
                  Rendah                          Tinggi
                       BIAYA & RISIKO TEKNIS (EFFORT)
```

### Rincian Pembagian Fase:
1. **Fase MVP (Validasi Lapangan - 3 hingga 5 Kafe Pilot):**
   * QR Table Self-Ordering (Mobile Web).
   * Catatan per item (*Item Notes*).
   * Multi-round ordering (tambah pesanan di meja yang sama).
   * Live Order & Billing Dashboard Kasir (Table Grid + Stream Ticker via SSE).
   * Pengurangan stok atomik & pembatalan (Void) dengan rollback stok otomatis.
   * Pembayaran Tunai & QRIS Statis di kasir dengan *Idempotency Key*.
   * Buka/Tutup Shift Kasir ringkas (rekonsiliasi kas laci).
   * Cetak struk via browser kasir (`window.print()`) & E-receipt digital pelanggan.
   * Ringkasan penjualan harian admin & tombol Ekspor CSV.
2. **Fase v1.0 (Kesiapan Monetisasi & Skala Komersial):**
   * Integrasi Payment Gateway otomatis (QRIS Dinamis langsung dari layar HP via Midtrans/Xendit).
   * Sistem Varian & Modifier Menu bertingkat (Size, Sugar Level, Topping).
   * Multi-station routing (Pesanan kopi masuk ke tablet Barista, pesanan makanan masuk ke dapur terpisah).
   * Pengiriman ringkasan omzet harian otomatis ke WhatsApp Pemilik Kafe di jam tutup.
3. **Fitur yang Ditunda (Deferred):**
   * Rating produk & review (pelanggan lebih memilih Google Maps).
   * Pengiriman struk via Email SMTP (memperlambat antrean kasir).
   * Sistem Multi-cabang terpusat (terlalu berisiko untuk developer tunggal di fase awal).
   * Generator PDF kompleks di server (cukup digantikan tampilan web print dan CSV).

---

## 4. Analisis Skala & Titik Jebol Sistem (Bottleneck Analysis)

| Beban Operasional | Karakteristik Beban | Potensi Titik Jebol | Solusi & Strategi Penanganan |
| :--- | :--- | :--- | :--- |
| **1 Kafe (10–25 Meja)** | ~100–300 transaksi per hari. ~5–10 request bersamaan di jam sibuk. | **Hampir Nol.** Database PostgreSQL free-tier (Supabase/Neon) dan FastAPI mampu menangani ini dengan utilisasi CPU < 2%. | Tidak butuh optimasi ekstrem. Cukup pastikan koneksi SSE tidak bocor (*connection leak*). |
| **10 Kafe (Pilot Skala Menengah)** | ~1.000–3.000 transaksi per hari. ~50 koneksi SSE aktif bersamaan. | **Batas Koneksi Database (DB Pool Limit):** Free-tier managed DB biasanya membatasi 20–60 koneksi bersamaan. | Gunakan SQLAlchemy connection pooling yang efisien (misal `pool_size=10, max_overflow=20`) atau PgBouncer bawaan Supabase/Neon. |
| **100 Kafe (SaaS Komersial Penuh)** | ~25.000+ transaksi per hari. ~500–1.000 koneksi SSE terus tersambung. | **Memory FastAPI & Broadcaster Worker:** Mengelola 1.000 koneksi SSE dalam 1 instance FastAPI free-tier akan membuat memori server penuh dan cold-start lambat. | Pindahkan broker realtime ke **Redis Pub/Sub** mandiri. Upgrade backend ke VPS terdedikasi ($10–$20/bln) dan gunakan database berbayar dengan auto-scaling storage. |

---

## 5. Rencana Go-to-Market Ringan (Onboarding 3–5 Kafe Pilot)

1. **Strategi Akuisisi Tanpa Biaya:**
   * **Target:** Kafe teman satu kampus, kantin fakultas, atau coffee shop langganan yang pemiliknya sering berinteraksi langsung dengan Anda.
   * **Pitch Tawaran:** *"Saya sedang mengembangkan sistem self-ordering QR meja gratis untuk membantu kafe Mas/Mbak agar barista tidak repot mencatat pesanan saat ramai. Mas/Mbak bebas pakai 100% gratis selamanya, saya yang bantu pasang dan cetak stiker QR-nya. Sebagai gantinya, saya minta feedback jujur jika ada yang kurang."*
2. **Kebutuhan Hardware Kafe (Nol Rupiah):**
   * Kasir: Laptop, tablet, atau smartphone yang sudah dimiliki kafe.
   * Meja: Cetak 1 lembar kertas A4 berisi 12-25 kotak stiker QR code, lalu tempel di atas meja kafe.
3. **Dukungan Hari Pertama (Day-1 Handholding):**
   * Hadir secara langsung saat kafe pertama kali menggunakan sistem di jam buka.
   * Pantau layar kasir dan amati bagaimana staf kasir serta pelanggan berinteraksi dengan antarmuka web.

---

## 6. Checklist Kriteria "Siap Sebar" (Ready for Pilot)

Centang seluruh kriteria berikut sebelum sistem dijalankan di kafe nyata pertama kali:

- [ ] **Validasi Integritas Transaksi:**
  - [ ] Pesanan dengan kuantitas melebihi stok ditolak server dengan `409 Conflict`.
  - [ ] Pembatalan pesanan (Void) oleh kasir mengembalikan angka stok produk secara utuh.
  - [ ] Penekanan tombol "Bayar" berkali-kali oleh kasir menghasilkan tepat 1 mutasi kas (*Idempotency Key lolos uji*).
  - [ ] Perhitungan total subtotal, pajak PB1 10%, dan grand total akurat hingga digit rupiah terakhir.
- [ ] **Ketahanan Jaringan (Resilience):**
  - [ ] Jika WiFi kafe terputus dan tersambung kembali, koneksi SSE otomatis *reconnect* tanpa kasir perlu reload halaman.
  - [ ] Keranjang belanja di HP pelanggan tetap utuh saat halaman browser di-refresh (*LocalStorage draft bekerja*).
  - [ ] Indikator status jaringan di pojok layar kasir secara akurat menampilkan status Hijau (Online) atau Merah (Offline).
- [ ] **Keamanan & Isolasi Data:**
  - [ ] Akun Kasir diblokir saat mencoba membuka URL admin laporan keuangan (`403 Forbidden`).
  - [ ] Seluruh kueri database memfilter `tenant_id` (uji BOLA lolos: Kafe A tidak bisa melihat transaksi Kafe B).
  - [ ] Password tersimpan dalam bentuk hash kriptografis Argon2/Bcrypt di database.
  - [ ] Seluruh kredensial rahasia (JWT secret, DB URL) disimpan di `.env` dan masuk ke `.gitignore`.
- [ ] **Kemudahan Operasional Kasir:**
  - [ ] Tombol cetak struk memunculkan dialog print browser standar (`window.print()`) yang pas dengan lebar thermal 58mm/80mm.
  - [ ] Kasir dapat melakukan tutup shift dan melihat rekonsiliasi kas (modal awal vs penjualan tunai vs fisik laci).
  - [ ] Switch "Menu Habis" seketika menonaktifkan menu di HP pelanggan meja.
- [ ] **Pengujian Otomatis (Pytest):**
  - [ ] Seluruh unit test, anomaly test suite, dan security test suite lulus 100% hijau (`pytest`).
