# Repository Guidelines

Panduan kerja dan referensi komprehensif untuk pengembang serta agen AI yang bekerja di repositori ini.

---

## Project Overview

**Kafe Dine-in Web POS** adalah aplikasi web point-of-sale (*multi-tenant*) yang dirancang khusus untuk kafe dan *coffee shop* mandiri skala 10–25 meja dengan model pemesanan *dine-in*. 

Proyek ini merupakan **rebuild menyeluruh (greenfield)** dari proyek kuliah POS lama berbasis Flutter + Node.js/PHP menjadi produk komersial yang siap disebarluaskan (*pilot ready*), aman untuk data dan uang nyata, serta memiliki biaya hosting Rp 0.

### Tiga Aktor Utama
1. **Customer (Pelanggan Meja):** Memindai stiker QR meja di browser ponsel pintar (*zero install*, tanpa perlu mendaftar akun), melihat katalog menu visual, memesan makanan/minuman, memantau status dapur, dan mendapatkan struk digital.
2. **Cashier / Barista (Kasir & Dapur):** Mengontrol denah meja kafe (*table grid*), menerima notifikasi pesanan masuk realtime (*live stream*), menangani pesanan bertingkat (*multi-round*), memindahkan meja (*move table*), membatalkan pesanan (*void* dengan rollback stok otomatis), merekonsiliasi kas awal/akhir shift, dan memproses pembayaran (Tunai & QRIS Statis).
3. **Admin / Owner (Pemilik Kafe):** Mengawasi metrik penjualan harian (omzet, transaksi, menu terlaris), mengatur katalog menu, mengoperasikan saklar cepat "Menu Habis", mengaudit rekonsiliasi kas kasir, dan mengekspor pembukuan ke CSV.

### Tujuan Pemilik (Bima Adji)
1. Membangun produk perangkat lunak berkualitas tinggi yang layak dipercaya untuk operasional bisnis harian.
2. Mempelajari dan menerapkan konsep rekayasa backend secara serius (integritas data finansial, *concurrency*, *race conditions*, transaksi ACID, autentikasi berbasis kriptografi, dan *defensive programming*).

---

## Architecture & Data Flow

Sistem bertransisi dari arsitektur *legacy* menuju arsitektur *rebuild*:

### 1. Legacy Architecture (Arsip V1)
* **Frontend Mobile:** Flutter Multiplatform (`app/lib/`) menggunakan stateful widget mandiri; memanggil endpoint REST PHP lokal (`/pos_api/*.php` di XAMPP/Apache) yang tidak ada di dalam repositori.
* **Backend Socket:** Server Node.js polos (`server/index.js`) pada port `8080` via library `ws`, menyimpan state aktif di memori JavaScript (`transactions = {}`, `statusPerTable = {}`), dan menulis log mentah ke MySQL (`nama_db` / `pos_app`). Ketiadaan autentikasi dan ketiadaan transaksi database menyebabkan hilangnya state saat server restart serta race condition pada stok.

### 2. Planned Rebuild Architecture (Target Produksi)
* **Backend:** Python 3.11+ dengan **FastAPI**, **Pydantic v2**, **SQLAlchemy 2.0 (Async ORM)**, dan **Alembic** untuk migrasi skema.
* **Database:** **PostgreSQL** (Row-Level Multi-Tenancy dengan kolom `tenant_id` pada seluruh tabel bertenant).
* **Frontend:** **React 18+ (Vite) + TypeScript + Tailwind CSS** dalam bentuk Single Page Application (SPA) mandiri yang memuat 3 portal rute:
  * `/t/:table_token` untuk Customer Meja.
  * `/cashier` untuk Layar Kasir & Live Stream Dapur.
  * `/admin` untuk Portal Pemilik Kafe.
* **Protokol Komunikasi (Hybrid REST + SSE):**
  * **REST API:** Seluruh mutasi data transaksional (`POST /api/v1/orders`, `PATCH /api/v1/orders/{id}/pay`, dsb.) dengan status HTTP standar.
  * **Server-Sent Events (SSE):** Jalur satu arah persisten `GET /api/v1/orders/stream` untuk notifikasi realtime pesanan masuk ke kasir dan live status ke HP pelanggan meja dengan fitur *auto-reconnect* browser.

### Data Flow Transaksi Kritis
```
[Customer HP] --(Scan QR Signed Table Token)--> [Katalog Menu Web]
     │
     └──(POST /api/v1/orders)────────────────────────► [FastAPI Backend]
                                                              │
     ┌────────────────────────────────────────────────────────┘
     ▼
[PostgreSQL Database Transaction]
  ├── 1. Validasi Token Meja & Verifikasi tenant_id
  ├── 2. Ambil Harga Resmi Server (Abaikan harga manipulasi klien)
  ├── 3. Conditional Atomic Update: 
  │      UPDATE products SET stock = stock - :qty 
  │      WHERE id = :id AND tenant_id = :tid AND stock >= :qty AND is_available = true;
  │      (Jika 0 baris terpengaruh -> ROLLBACK & balas 409 Conflict)
  ├── 4. Simpan Record `orders` & Snapshot `order_items` (Harga, Nama, Catatan)
  └── 5. COMMIT Transaksi
     │
     └──(Push Event via SSE Stream)──────────────────► [Layar Kasir / Tablet]
                                                              │
     ┌────────────────────────────────────────────────────────┘
     ▼
[Kasir Terima Pembayaran]
  └──(PATCH /api/v1/orders/{id}/pay + Header Idempotency-Key)
         ├── Validasi UUID Idempotency-Key (Cegah bayar dobel)
         ├── Catat mutasi di tabel `payments`
         ├── Ubah status order menjadi COMPLETED
         └── Bebaskan status meja (Meja Kosong Kembali)
```

---

## Key Directories

```
posapp/
├── docs/                       # Dokumentasi arsitektur, roadmap, dan acuan visual UI/UX
│   ├── rebuild-plan.md         # Sumber kebenaran arsitektur, skema DB, auth, strategi testing
│   ├── product-roadmap.md      # Persona pasar, prioritas MVP/v1.0, analisis skala, checklist siap sebar
│   ├── mockupv3.html           # Acuan visual & alur UI baku (Customer, Kasir Table Grid + Stream, Admin)
│   ├── mockupV2.html           # Arsip desain iterasi sebelumnya (superseded by v3)
│   └── mockups.html            # Arsip komparasi 3 opsi awal
├── .archify/                   # Diagram arsitektur interaktif yang tervalidasi
│   └── architecture-database-schema-*/
│       ├── candidate.json      # Spesifikasi komponen, batasan multi-tenant, dan relasi database
│       └── database-schema.html# Render diagram interaktif mandiri bebas dependensi
├── app/                        # [Legacy] Kode aplikasi Flutter V1
│   ├── lib/
│   │   ├── main.dart           # Entry point Flutter (MaterialApp PosApp, SplashScreen)
│   │   ├── screens/            # Layar customer, cashier, admin, dan auth
│   │   ├── core/services/      # HTTP service pemanggil API PHP lokal & client WebSocket
│   │   └── models/             # Data class model (product, order, user, dsb.)
│   ├── pubspec.yaml            # Dependensi Flutter/Dart
│   └── analysis_options.yaml   # Konfigurasi linter Flutter
├── server/                     # [Legacy] Kode backend Node.js V1
│   ├── index.js                # WebSocket server port 8080 & MySQL pool
│   ├── db.js                   # Modul database sekunder (broken/unreferenced)
│   └── package.json            # Manifest npm server Node.js
└── AGENTS.md                   # Dokumen pedoman repositori ini (Repository Guidelines)
```

---

## Development Commands

### 1. Rebuild Stack (FastAPI + PostgreSQL + React)

#### Backend (Python & Docker)
```bash
# Menjalankan database PostgreSQL lokal & backend via Docker Compose
docker compose up -d

# Menjalankan migrasi database via Alembic
alembic upgrade head

# Menjalankan server development FastAPI (di luar container)
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Menjalankan seluruh test suite otomatis (Pytest)
pytest -v

# Menjalankan test anomali & keamanan secara spesifik
pytest tests/test_anomalies.py -v
pytest tests/test_security.py -v

# Linter dan type-checking Python
ruff check .
mypy src/
```

#### Frontend (React + Vite + TypeScript)
```bash
# Instalasi dependensi
npm install

# Menjalankan local development server
npm run dev

# Memeriksa tipe dan build produksi
npm run build

# Menjalankan linter
npm run lint
```

### 2. Legacy Stack (Flutter & Node.js V1)

```bash
# Menjalankan WebSocket relay Node.js lama
cd server && node index.js

# Menjalankan aplikasi Flutter
cd app && flutter run

# Menganalisis kode Flutter
cd app && flutter analyze
```

---

## Code Conventions & Common Patterns

* **Dokumentasi & Diskusi:** Bahasa Indonesia.
* **Skill Wajib Berdasarkan Aktivitas:**
  - **Menulis kode:** Gunakan skill `ponytail`.
  - **Menulis dokumen di `docs/`:** Gunakan skill `karpathy-guidelines` dan `antislop`.
  - **Menjelaskan kepada Bima dalam obrolan:** Gunakan skill `humanizer`.
* **Nama Variabel, Fungsi, Kelas, Kolom DB, dan Endpoint:** Bahasa Inggris baku.
* **REST Endpoints:** Huruf kecil jamak (*plural kebab-case*), contoh: `/api/v1/orders`, `/api/v1/cashier-shifts`.
* **Database Tables & Columns:** Snake_case (`order_items`, `tenant_id`, `price_snapshot`).
* **Python Classes:** PascalCase (`OrderItem`, `TenantRepository`).
* **Pydantic Schemas:** Berakhiran `Create`, `Update`, `Response` (`OrderCreate`, `OrderResponse`).

### 2. Multi-Tenancy & Row-Level Isolation (Wajib)
* Setiap tabel yang terikat dengan kafe **wajib** memiliki kolom `tenant_id: UUID`.
* **DILARANG KERAS** mempercayai `tenant_id` dari body JSON atau query string klien publik. `tenant_id` wajib diekstrak dari klaim token JWT staf yang terotentikasi atau hasil dekripsi token meja bertanda-tangan kriptografis HMAC.
* Kueri data yang tidak memiliki filter `tenant_id` dianggap sebagai cacat keamanan tingkat tinggi (*Broken Object Level Authorization / BOLA*).

### 3. Integritas Transaksi Stok (Conditional Atomic Update)
* Stok produk tidak boleh dikurangi dengan logika *read-then-write* yang terpisah.
* Gunakan kueri atomik berkondisi:
  ```sql
  UPDATE products 
  SET stock = stock - :qty 
  WHERE id = :product_id 
    AND tenant_id = :tenant_id 
    AND is_available = true 
    AND stock >= :qty;
  ```
* Jika kueri mengembalikan $0\text{ baris terpengaruh}$, batalkan transaksi database (*rollback*) dan kembalikan kode status HTTP `409 Conflict`.
* Pembatalan pesanan (*void*) wajib mengembalikan stok produk via transaksi penambahan (`stock = stock + :qty`).

### 4. Idempotency pada Pembayaran
* Endpoint pelunasan kasir `POST /api/v1/orders/{id}/pay` mewajibkan header `Idempotency-Key: <UUID>`.
* Kunci ini disimpan unik di tabel `payments`. Jika request identik terulang dalam interval singkat akibat gangguan koneksi, server mengembalikan data transaksi awal tanpa memproses ulang kas ganda.

### 5. Dependency Injection & Error Handling di FastAPI
* Gunakan FastAPI `Depends()` untuk resolusi sesi database (`get_db`), ekstraksi user aktif (`get_current_user`), dan penjaga role admin (`require_admin`).
* Format respons error standar:
  ```json
  {
    "success": false,
    "error": {
      "code": "OUT_OF_STOCK",
      "message": "Croissant tersisa 0 porsi."
    }
  }
  ```

---

## Important Files

* `docs/rebuild-plan.md`: Sumber kebenaran teknis (spesifikasi REST + SSE, 9 entitas database relasional, skenario kasir, roadmap 5 fase).
* `docs/product-roadmap.md`: Panduan strategis (analisis skala operasional, matriks prioritas fitur, mitigasi risiko, checklist siap sebar).
* `docs/mockupv3.html`: Sumber kebenaran antarmuka visual (telah diaudit antislop: palet netral hangat, angka mono finansial, touch target $\ge 44\text{px}$, bebas em dash).
* `.archify/architecture-database-schema-20261106-080442/database-schema.html`: Visualisasi arsitektur skema database PostgreSQL resmi.
* `server/index.js`: Entry point WebSocket legacy (referensi logika lama).
* `app/lib/main.dart`: Entry point Flutter legacy.

---

## Runtime/Tooling Preferences

* **Python Runtime:** Python 3.11 atau lebih baru (manajemen dependensi via `pip` / `poetry` / `uv`).
* **Node/JS Runtime:** Node.js 18+ LTS atau Bun untuk ekosistem frontend React/Vite.
* **Database Server:** PostgreSQL 15+ (lokal via Docker container, staging/produksi via Supabase atau Neon).
* **Kontainerisasi:** Docker & Docker Compose untuk orkestrasi development lokal satu perintah.
* **Secrets Management:** Kunci rahasia (JWT secret, DB connection string, token meja HMAC secret) dilarang keras di-*hardcode*. Seluruh konfigurasi dibaca via file `.env` yang terdaftar di `.gitignore`.

---

## Testing & QA

Integritas sistem finansial diuji otomatis menggunakan **Pytest**:

### 1. Cakupan Pengujian Wajib
* **Critical Transaction Tests:**
  * Alur hidup bon: *Create Order ➔ Deduct Stock ➔ Multi-round Order ➔ Pay ➔ Close Table*.
  * Uji Konkurensi: Menyerbu order pada produk yang tersisa 1 porsi; memastikan stok akhir tepat 0 dan tidak pernah negatif.
  * Uji Pembatalan: Void pesanan mengembalikan kuantitas stok produk ke nilai semula.
* **Anomaly Test Suite (`tests/test_anomalies.py`):**
  * *Price Tampering:* Upaya memanipulasi nilai harga menu diabaikan; server selalu memakai harga resmi di DB.
  * *Negative/Zero Quantity:* Pengiriman `qty <= 0` ditolak dengan status `422 Unprocessable Entity`.
  * *Sold-out Race:* Pesanan ke menu yang dinonaktifkan ditolak dengan `409 Conflict`.
  * *Double Payment:* Klik ganda kasir pada pelunasan dicegah oleh `Idempotency-Key`.
  * *Closed Order:* Mencegah pembayaran pada bon meja yang sudah selesai atau dibatalkan.
* **Security Test Suite (`tests/test_security.py`):**
  * *BOLA / Cross-Tenant Leak:* Akun Kafe A dilarang membaca data Kafe B (`404 Not Found` atau `403 Forbidden`).
  * *Privilege Escalation:* Akun kasir ditolak saat mengakses endpoint laporan/hapus menu milik admin (`403 Forbidden`).
  * *Brute-Force Rate Limiting:* Lebih dari 5 percobaan login gagal per menit diblokir dengan status `429 Too Many Requests`.
  * *Table Token Spoofing:* Pemalsuan tanda-tangan sesi meja dibalas `401 Unauthorized`.

### 2. Standar Kelulusan (Quality Gate)
Seluruh pengujian otomatis di atas wajib berstatus hijau ($100\%\text{ PASS}$) sebelum branch fitur dapat digabungkan (*merge*) ke branch utama `main`.

---

## Aturan Git & Alur Kerja Migrasi

### Invarian Operasional
* **Identitas Git:** Seluruh operasi git menggunakan kredensial `bimadji`. Periksa `git config user.name`, `git config user.email`, dan `gh auth status` sebelum melakukan *push*.
* **Branch Protection:** Dilarang melakukan *push* langsung atau *force push* ke branch `main`. Selalu gunakan branch kerja bertopik (`feat/...`, `fix/...`, `docs/...`, `chore/...`), lakukan *push*, dan ajukan Pull Request (PR).
* **Branch V1:** Menjadi arsip abadi untuk kode Flutter + Node.js asli. Dilarang menghapus atau mengubah histori branch `V1`.
* **Larangan Penghapusan Branch:** Jangan menghapus branch lokal maupun remote setelah PR selesai dimerge.

### Langkah Migrasi Awal (Dilakukan Sekali)
1. Pastikan status git bersih.
2. Buat branch arsip `V1` dari commit `main` saat ini, lalu *push* ke remote untuk mengabadikan codebase lama:
   ```bash
   git branch V1
   git push origin V1
   ```
3. Buat branch baru `chore/rebuild-init` dari `main`:
   ```bash
   git checkout -b chore/rebuild-init
   ```
4. Bersihkan file Flutter/Node.js lama dari working directory, commit kerangka panduan baru (`AGENTS.md`, `docs/`, `.archify/`), lakukan *push*, dan buka PR ke `main`.

---

## Alur Dokumentasi Dokumen Bertahap (Wajib Berurutan)

Sebelum menulis kode aplikasi, dokumen spesifikasi turunan disusun satu per satu secara berurutan dengan jeda persetujuan Bima:
1. `docs/01-PRD.md` — Product Requirement Documentation
2. `docs/02-TRD.md` — Technical Requirement Documentation
3. `docs/03-AFD.md` — App Flow Documentation (Alur peran & diagram Mermaid)
4. `docs/04-DBD.md` — Design Brief Documentation (Prinsip UX & antarmuka, acuan `docs/mockupv3.html`)
5. `docs/05-BSD.md` — Backend Schema Documentation (Skema DDL, relasi, indeks, dan kontrak endpoint REST + SSE)
6. `docs/06-IPD.md` — Implementation Plan Documentation (Fase rincian file, dependensi, dan kriteria selesai)

*Execution plan* implementasi baru boleh diturunkan setelah keenam dokumen tersebut disetujui penuh oleh pemilik repositori.
