# Implementation Plan Documentation (IPD)

Dokumen ini mendefinisikan rencana implementasi bertahap, struktur direktori terpadu, manajemen dependensi, matriks pengujian otomatis, serta definisi selesai (*Definition of Done*) untuk pembangunan ulang Kafe Dine-in Web POS. Dokumen ini merupakan dokumen penutup dalam rantai spesifikasi (`01-PRD`, `02-TRD`, `03-AFD`, `04-DBD`, dan `05-BSD`).

---

## 1. Rencana Pengerjaan 5 Fase (Phased Implementation Roadmap)

Implementasi dibagi menjadi **5 Fase Berurutan**. Setiap fase dirancang untuk menghasilkan deliverable fungsional konkret yang dapat diuji, dijalankan, dan menjadi wahana pendalaman konsep backend.

```
+---------------------------------------------------------------------------------------+
| PETA JALAN IMPLEMENTASI 5 FASE                                                        |
+-------------------+-----------------------------------+-------------------------------+
| Fase              | Sasaran Utama                     | Fokus Konsep Backend          |
+-------------------+-----------------------------------+-------------------------------+
| Fase 1            | Pondasi Backend, DB & Auth        | Docker Compose, Asyncpg,      |
|                   | Multi-Tenant                      | Argon2id, JWT, FastAPI DI     |
+-------------------+-----------------------------------+-------------------------------+
| Fase 2            | Katalog Menu, Stok & Meja         | Relasi 1-N, Cryptographic     |
|                   | (Core Data & Tokens)              | HMAC Token, Data Seeding      |
+-------------------+-----------------------------------+-------------------------------+
| Fase 3            | Mesin Transaksi, Stok Atomik      | Transaksi ACID, Conditional   |
|                   | & Testing Kritis                  | Atomic Update, Idempotency    |
+-------------------+-----------------------------------+-------------------------------+
| Fase 4            | Realtime Live Order & Frontend    | Server-Sent Events (SSE),     |
|                   | React Web (3 Portal)              | EventSource, Optimistic UI    |
+-------------------+-----------------------------------+-------------------------------+
| Fase 5            | Operasional Kafe, Deployment      | Multi-stage Docker, Zero-Cost |
|                   | Rp 0 & Uji Lapangan               | Cloud, Web Print, CSV Stream  |
+-------------------+-----------------------------------+-------------------------------+
```

---

### FASE 1: Pondasi Backend, Database & Autentikasi Multi-Tenant

* **Tujuan:** Membangun fondasi infrastruktur lokal, koneksi database asynchronous PostgreSQL, manajemen migrasi skema Alembic, serta sistem autentikasi staf berbasis JWT dan hashing aman.
* **Deliverable Konkret:**
  1. Berkas `docker-compose.yml` yang menjalankan container PostgreSQL 15 lokal.
  2. Inisialisasi proyek FastAPI dengan struktur modular (*Clean Architecture*).
  3. Konfigurasi `app/core/config.py` berbasis Pydantic v2 Settings membaca berkas `.env`.
  4. Migrasi awal Alembic membuat tabel `tenants` dan `users`.
  5. Modul hashing password Argon2id / Bcrypt dan generator JWT Access Token (`app/core/security.py`).
  6. Endpoint `POST /api/v1/auth/login` dan middleware Dependency Injection: `get_current_user`, `enforce_tenant_id`, `require_admin`, dan `require_cashier`.
  7. Test suite dasar autentikasi pada `tests/test_auth.py`.
* **Konsep Backend yang Dipelajari:**
  * Asyncio event loop dan koneksi non-blocking ke PostgreSQL via `asyncpg`.
  * Dependency Injection di FastAPI untuk memisahkan logika otorisasi dari handler endpoint.
  * Hashing kriptografis satu arah (*salt & memory cost*) untuk mengamankan kredensial.
  * Isolasi multi-tenant di lapisan aplikasi (*row-level filtering* dari JWT).
* **Definisi Selesai (DoD Fase 1):**
  * `docker compose up` berhasil menjalankan database PostgreSQL lokal yang sehat (*healthy*).
  * `alembic upgrade head` berhasil mengeksekusi tabel `tenants` dan `users` tanpa error.
  * Kasir dan admin dapat login melalui endpoint `/auth/login` dan menerima token JWT yang valid.
  * Kasir yang mencoba mengakses rute admin ditolak dengan status HTTP `403 Forbidden`.

---

### FASE 2: Katalog Menu, Stok & Meja (Core Data & Tokens)

* **Tujuan:** Mengelola data master kafe (kategori, produk, kuantitas stok riil, denah meja) serta menghasilkan token meja bertanda-tangan kriptografis untuk akses pelanggan tanpa login.
* **Deliverable Konkret:**
  1. Migrasi Alembic untuk tabel `tables`, `categories`, dan `products`.
  2. Endpoint CRUD Kategori: `GET, POST, PATCH, DELETE /api/v1/categories`.
  3. Endpoint CRUD Produk: `GET, POST, PATCH, DELETE /api/v1/products` lengkap dengan validasi harga $\ge 0$ dan stok $\ge 0$.
  4. Saklar cepat menu habis: `PATCH /api/v1/products/{id}/toggle` (mengubah `is_available`).
  5. Endpoint Kelola Meja: `POST /api/v1/tables` dan generator Signed Table QR Token berbobot HMAC-SHA256 (`app/core/tokens.py`).
  6. Endpoint verifikasi sesi meja pelanggan: `GET /api/v1/tables/my-session`.
  7. Endpoint publik katalog menu pelanggan: `GET /api/v1/menu`.
  8. Skrip seeding data awal (`scripts/seed_data.py`) untuk mengisi 1 tenant contoh ("Kafe Senja"), 2 user staf, 12 meja, dan 15 menu makanan/kopi.
* **Konsep Backend yang Dipelajari:**
  * Kriptografi simetris HMAC-SHA256 untuk membuat URL bertanda-tangan matematis (*tamper-proof*).
  * Relasi One-to-Many dan indeks pencarian komposit di SQLAlchemy 2.0.
  * Data transfer object (DTO) Pydantic v2 untuk sanitasi data masukan klien.
* **Definisi Selesai (DoD Fase 2):**
  * Admin dapat membuat kategori dan produk dengan foto, harga, dan kuantitas stok.
  * Admin dapat membuat meja dan mengunduh tautan/token QR meja.
  * Pengguna tanpa login dapat mengakses `GET /api/v1/menu` hanya jika menyertakan token meja yang valid; token meja palsu dibalas HTTP `401 Unauthorized`.

---

### FASE 3: Mesin Transaksi, Stok Atomik & Testing Kritis

* **Tujuan:** Membangun inti logika bisnis sistem POS: pemesanan meja, pengurangan stok atomik berkondisi, akumulasi bon meja bertingkat (*multi-round*), pembatalan (*void*), dan pelunasan kasir ber-idempotensi.
* **Deliverable Konkret:**
  1. Migrasi Alembic untuk tabel `orders`, `order_items`, `payments`, dan `cashier_shifts`.
  2. Mesin Transaksi Pemesanan (`POST /api/v1/orders`):
     * Kueri *Conditional Atomic Update* (`UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty`).
     * Snapshot harga (`price_snapshot`) dan nama (`product_name_snapshot`).
     * Logika akumulasi pesanan tambahan (*round_number $\ge 2$*) ke dalam satu bon aktif meja.
     * Perhitungan otomatis Biaya Layanan (*service charge*) dan Pajak Restoran PB1 (10%).
  3. Modul Pembatalan Pesanan (`POST /api/v1/orders/{id}/cancel`): pembatalan status dan rollback penambahan kuantitas stok secara atomik.
  4. Modul Pemindahan Meja (`PATCH /api/v1/orders/{id}/move-table`): memindahkan pesanan ke meja kosong.
  5. Modul Pelunasan Kasir (`POST /api/v1/orders/{id}/pay`): wajib menyertakan header `Idempotency-Key: <UUID>` dan penanganan uang kembalian tunai.
  6. Modul Shift Kasir: `POST /api/v1/shifts/open` dan `POST /api/v1/shifts/close` (rekonsiliasi fisik laci kas).
  7. Rangkaian pengujian otomatis Pytest komprehensif:
     * `tests/test_transactions.py`: alur hidup pesanan normal dan rollback void.
     * `tests/test_anomalies.py`: 6 skenario anomali (tampering harga, qty minus, sold-out race, idempotency collision, bon tertutup).
     * `tests/test_security.py`: 5 skenario keamanan (BOLA lintas tenant, privilege escalation kasir, brute-force rate limit 5x/menit, spoofing meja).
* **Konsep Backend yang Dipelajari:**
  * Transaksi database ACID (Atomicity, Consistency, Isolation, Durability) dan pencegahan *race conditions* tanpa deadlock.
  * Konsep idempotensi sistem finansial menggunakan constraint basis data unik.
  * Rekonsiliasi akuntansi kasir sederhana (modal awal + mutasi tunai sistem vs hitungan fisik).
  * Defensive programming dan penulisan integration test end-to-end.
* **Definisi Selesai (DoD Fase 3):**
  * Seluruh rangkaian pengujian Pytest lulus 100% hijau (`pytest` menghasilkan zero failure).
  * Dua order serentak pada sisa stok 1 terbukti menghasilkan 1 sukses dan 1 gagal (`409 Conflict`), stok tidak pernah negatif.
  * Penekanan berulang pada endpoint bayar terbukti hanya menghasilkan 1 transaksi mutasi kas.

---

### FASE 4: Realtime Live Order & Frontend React Web (3 Portal)

* **Tujuan:** Membangun jalur penyiaran event realtime Server-Sent Events (SSE) di backend dan mengimplementasikan antarmuka web modern (Single Page Application) untuk ketiga aktor pengguna.
* **Deliverable Konkret:**
  1. Backend SSE Broadcaster (`GET /api/v1/orders/stream`): antrean event asynchronous in-memory memancarkan event `order.created`, `order.status_changed`, `order.round_added`, dan sinyal `ping` (heartbeat 20 detik).
  2. Setup frontend React 18+ (Vite) + TypeScript + Tailwind CSS pada direktori `frontend/`.
  3. **Portal Customer (`/t/:table_token`):**
     * Mobile-first responsive catalog (acuan `docs/mockupv3.html`).
     * Modal catatan preferensi rasa per item (*"less sugar"*).
     * Draft keranjang lokal (`localStorage`).
     * Live order status tracker (pembaruan otomatis via SSE).
     * Struk digital (*E-Receipt*).
  4. **Portal Kasir & Dapur (`/cashier`):**
     * Denah meja interaktif (*Table Floor Grid*) dengan kode warna dinamis (Kosong, Terisi/Makan, Pesanan Baru).
     * Live order notification banner dengan audio denting lonceng saat order tiba.
     * Panel tagihan bon meja multi-babak, tombol pindah meja, tombol void, dan tombol bayar tunai/QRIS.
     * Pengalih tampilan ke *Antrean Masak Stream Table* untuk dapur.
     * Modal buka & tutup shift kasir.
  5. **Portal Admin / Owner (`/admin`):**
     * 4 kartu metrik pendapatan dan transaksi harian.
     * Tabel inventaris menu dengan saklar satu klik "Tandai Habis".
     * Laporan riwayat shift kasir dan rekonsiliasi kas.
     * Tombol ekspor laporan CSV.
* **Konsep Backend & Frontend yang Dipelajari:**
  * Protokol streaming HTTP/SSE (`text/event-stream`) dan pengelolaan koneksi asynchronous banyak klien.
  * Penggunaan browser native API `EventSource` dengan kemampuan auto-reconnect.
  * Optimistic UI rendering di React untuk performa antarmuka 0 milidetik.
* **Definisi Selesai (DoD Fase 4):**
  * Pesanan yang dikirim dari ponsel pelanggan seketika muncul di layar kasir/tablet dapur tanpa kasir perlu me-refresh halaman peramban.
  * Perubahan status pesanan oleh barista seketika mengubah warna pelacak status di ponsel pelanggan.
  * Keranjang belanja ponsel pelanggan tetap utuh saat peramban dimuat ulang (*reload*).

---

### FASE 5: Operasional Kafe, Deployment Rp 0 & Uji Pilot

* **Tujuan:** Memastikan kesiapan operasional lapangan, pengemasan kontainer Docker produksi, peluncuran cloud publik berbiaya Rp 0, serta uji coba operasional pada kafe pilot pertama.
* **Deliverable Konkret:**
  1. Fitur cetak struk kasir berbasis CSS `@media print` yang presisi untuk kertas printer thermal 58mm/80mm (`window.print()`).
  2. Endpoint streaming ekspor data pembukuan ke format CSV (`GET /api/v1/reports/export-csv`).
  3. Berkas `Dockerfile` multi-stage build berkeamanan tinggi (non-root user `appuser`).
  4. Deployment backend FastAPI ke Render / Fly.io (terhubung ke managed PostgreSQL Supabase / Neon).
  5. Deployment frontend React Vite ke Vercel / Cloudflare Pages dengan domain HTTPS resmi.
  6. Konfigurasi CORS produksi yang ketat mengunci domain frontend yang sah.
  7. Penyusunan 1 lembar dokumen PDF/kertas stiker QR Meja 01 s.d. Meja 20 siap cetak untuk kafe mitra.
  8. Pelaksanaan uji coba operasional (pilot test) pada jam buka kafe nyata selama minimal 14 hari.
* **Konsep Backend yang Dipelajari:**
  * Multi-stage containerization untuk meminimalkan ukuran image (< 150 MB).
  * CORS (Cross-Origin Resource Sharing) security policy di lingkungan produksi.
  * Database connection pooling (PgBouncer) pada cloud berkuota gratis.
  * Mitigasi cold-start cloud free-tier menggunakan cron ping ringan.
* **Definisi Selesai (DoD Fase 5):**
  * Aplikasi web kasir dan pemesanan meja dapat diakses secara publik via internet HTTPS tanpa kendala sertifikat SSL.
  * Kasir dapat mencetak struk thermal langsung dari browser tablet/laptop.
  * Seluruh kriteria pada **Checklist Siap Sebar** (`docs/product-roadmap.md` §6) tercentang hijau.

---

## 2. Struktur Direktori Proyek Terpadu (Monorepo Layout)

Repositori dikelola dengan struktur monorepo terpisah antara backend dan frontend untuk mempermudah orkestrasi lokal sekaligus deployment cloud mandiri:

```
posapp/
├── backend/                        # Backend API (FastAPI, Python 3.11+)
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py     # Login staf, token refresh
│   │   │       │   ├── categories.py
│   │   │       │   ├── products.py # CRUD menu & saklar habis
│   │   │       │   ├── tables.py   # Denah meja & generate QR token
│   │   │       │   ├── orders.py   # Pemesanan, void, move table, pelunasan
│   │   │       │   ├── shifts.py   # Buka/tutup shift kasir
│   │   │       │   └── reports.py  # Metrik omzet & streaming CSV
│   │   │       └── router.py       # Penggabung seluruh rute v1
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic BaseSettings (.env reader)
│   │   │   ├── database.py         # SQLAlchemy Async Engine & Session
│   │   │   ├── security.py         # Hashing Argon2/Bcrypt & JWT
│   │   │   ├── tokens.py           # HMAC-SHA256 Signed QR Token generator
│   │   │   └── exceptions.py       # Custom exception handlers & JSON format
│   │   ├── deps/
│   │   │   ├── auth.py             # Injeksi get_current_user & RBAC
│   │   │   ├── tenant.py           # Injeksi wajib filter tenant_id
│   │   │   └── db.py               # Injeksi sesi database async
│   │   ├── models/                 # Deklarasi tabel SQLAlchemy ORM
│   │   │   ├── tenant.py
│   │   │   ├── user.py
│   │   │   ├── table.py
│   │   │   ├── category.py
│   │   │   ├── product.py
│   │   │   ├── order.py
│   │   │   ├── order_item.py
│   │   │   ├── payment.py
│   │   │   └── cashier_shift.py
│   │   ├── schemas/                # Skema DTO Pydantic v2
│   │   │   ├── auth.py
│   │   │   ├── product.py
│   │   │   ├── order.py
│   │   │   └── shift.py
│   │   ├── services/               # Logika bisnis transaksional
│   │   │   ├── order_service.py    # Mesin stok atomik & kalkulasi tagihan
│   │   │   ├── payment_service.py  # Penanganan Idempotency-Key
│   │   │   ├── shift_service.py    # Rekonsiliasi modal & fisik laci kas
│   │   │   └── sse_service.py      # Pengelola antrean penyiaran SSE
│   │   └── main.py                 # Titik masuk aplikasi FastAPI & CORS
│   ├── alembic/                    # Skrip migrasi skema basis data
│   │   ├── versions/
│   │   └── env.py
│   ├── tests/                      # Automated test suite (Pytest)
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_transactions.py
│   │   ├── test_anomalies.py
│   │   └── test_security.py
│   ├── scripts/
│   │   └── seed_data.py            # Seeder data awal kafe pilot
│   ├── requirements.txt            # Dependensi Python
│   ├── Dockerfile                  # Multi-stage Dockerfile produksi
│   └── alembic.ini
│
├── frontend/                       # Frontend SPA (React, Vite, TypeScript)
│   ├── src/
│   │   ├── assets/                 # Ikon, audio lonceng notifikasi
│   │   ├── components/             # Komponen UI bersama
│   │   │   ├── ui/                 # Tombol, badge, modal, input
│   │   │   ├── TableGrid.tsx       # Komponen denah visual meja kasir
│   │   │   ├── OrderCard.tsx       # Kartu pesanan antrean
│   │   │   ├── ReceiptPrint.tsx    # Komponen struk cetak thermal
│   │   │   └── Toast.tsx           # Notifikasi umpan balik
│   │   ├── hooks/
│   │   │   ├── useSSE.ts           # Hook custom peramban EventSource auto-reconnect
│   │   │   ├── useCart.ts          # Hook keranjang belanja sync localStorage
│   │   │   └── useAuth.ts          # Hook manajemen token JWT staf
│   │   ├── pages/
│   │   │   ├── customer/
│   │   │   │   ├── MenuCatalog.tsx # Katalog menu visual HP
│   │   │   │   └── OrderStatus.tsx # Pelacak live status dapur & E-receipt
│   │   │   ├── cashier/
│   │   │   │   ├── CashierDashboard.tsx # Denah meja & live billing kasir
│   │   │   │   └── KitchenStream.tsx    # Tampilan tabel antrean barista
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.tsx   # Metrik omzet & performa menu
│   │   │   │   ├── MenuManager.tsx      # Kelola produk & saklar habis
│   │   │   │   └── ShiftReports.tsx     # Laporan audit kas kasir
│   │   │   └── auth/
│   │   │       └── LoginPage.tsx        # Form login staf kasir/admin
│   │   ├── services/               # Panggilan HTTP Fetch / Axios ke backend
│   │   │   └── api.ts
│   │   ├── types/                  # Definisi antarmuka TypeScript
│   │   │   └── index.ts
│   │   ├── App.tsx                 # Routing utama (/t/:token, /cashier, /admin)
│   │   └── main.tsx
│   ├── public/
│   ├── tailwind.config.js          # Konfigurasi token warna Stone & Amber
│   ├── tsconfig.json
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                           # Dokumentasi spesifikasi & acuan visual
│   ├── 01-PRD.md
│   ├── 02-TRD.md
│   ├── 03-AFD.md
│   ├── 04-DBD.md
│   ├── 05-BSD.md
│   ├── 06-IPD.md                   # Dokumen ini
│   ├── rebuild-plan.md
│   ├── product-roadmap.md
│   └── mockupv3.html               # Acuan visual resmi
├── .archify/                       # Artefak diagram interaktif tervalidasi
├── docker-compose.yml              # Orkestrasi backend & PostgreSQL lokal
├── .gitignore
├── README.md
└── AGENTS.md                       # Pedoman repositori resmi
```

---

## 3. Matriks Manajemen Dependensi

### 3.1 Backend Dependencies (`backend/requirements.txt`)

```ini
# Web Core & ASGI Server
fastapi>=0.110.0,<0.111.0
uvicorn[standard]>=0.28.0,<0.29.0
pydantic>=2.6.4,<3.0.0
pydantic-settings>=2.2.1,<3.0.0

# Database & ORM
sqlalchemy>=2.0.28,<2.1.0
asyncpg>=0.29.0,<0.30.0
alembic>=1.13.1,<1.14.0
psycopg2-binary>=2.9.9,<3.0.0 # Dibutuhkan untuk helper sinkron Alembic

# Keamanan & Kriptografi
passlib[argon2,bcrypt]>=1.7.4
python-jose[cryptography]>=3.3.0
cryptography>=42.0.5

# Utilitas & Streaming
slowapi>=0.1.9                # Rate limiting login staf
sse-starlette>=2.0.0          # Streaming Server-Sent Events

# Testing & QA
pytest>=8.1.1,<9.0.0
pytest-asyncio>=0.23.5,<0.24.0
httpx>=0.27.0,<0.28.0         # Async HTTP client untuk testing endpoint
ruff>=0.3.3                   # Linter & Formatter Python super cepat
```

---

### 3.2 Frontend Dependencies (`frontend/package.json`)

```json
{
  "name": "pos-cafe-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "lucide-react": "^0.358.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@typescript-eslint/eslint-plugin": "^7.2.0",
    "@typescript-eslint/parser": "^7.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.6"
  }
}
```

---

## 4. Matriks Keterlacakan Kebutuhan & Verifikasi (Verification Matrix)

Setiap kebutuhan fungsional (FR) dan non-fungsional (NFR) dari dokumen `01-PRD.md` dipetakan ke fase pengerjaan dan mekanisme pengujian spesifiknya:

| ID Kebutuhan | Deskripsi Fitur / Perilaku | Fase Pengerjaan | Mekanisme & Berkas Pengujian |
| :--- | :--- | :--- | :--- |
| **FR-01, FR-02** | Akses QR Meja Sah & Input Nama | Fase 2 | `tests/test_auth.py::test_table_token_verification` |
| **FR-03, FR-04** | Katalog Menu & Catatan Preferensi | Fase 2 | `tests/test_products.py::test_menu_catalog_with_notes` |
| **FR-06, NFR-01**| Potong Stok Atomik Berkondisi | Fase 3 | `tests/test_transactions.py::test_atomic_stock_decrement` |
| **FR-07** | Multi-Round Ordering (Append Bon) | Fase 3 | `tests/test_transactions.py::test_multi_round_order_accumulation` |
| **FR-08, FR-13** | Realtime Live Status & Notifikasi Dapur | Fase 4 | `tests/test_sse.py::test_order_event_broadcasting` |
| **FR-11, FR-21** | Buka/Tutup Shift Kasir & Rekonsiliasi | Fase 3 | `tests/test_shifts.py::test_cashier_shift_reconciliation` |
| **FR-15** | Pindah Meja (Move Table) | Fase 3 | `tests/test_transactions.py::test_move_table_success_and_occupied` |
| **FR-16** | Pembatalan Pesanan (Void + Rollback) | Fase 3 | `tests/test_transactions.py::test_void_order_stock_rollback` |
| **FR-17, FR-18** | Pembayaran Kasir & Idempotensi | Fase 3 | `tests/test_anomalies.py::test_payment_idempotency_collision` |
| **FR-19** | Cetak Struk Thermal Kasir | Fase 5 | Manual QA browser print preview (kertas 58mm/80mm) |
| **FR-20** | Saklar Cepat Menu Habis | Fase 2 | `tests/test_anomalies.py::test_sold_out_race_condition` |
| **FR-22, FR-28** | Dashboard Metrik & Ekspor CSV | Fase 5 | `tests/test_reports.py::test_export_csv_streaming` |
| **NFR-02** | Isolasi Multi-Tenant Mutlak | Fase 1 & 3 | `tests/test_security.py::test_cross_tenant_bola_protection` |
| **NFR-05, NFR-06**| Hashing Argon2 & Rate Limiting | Fase 1 | `tests/test_security.py::test_login_rate_limiting_brute_force` |
| **NFR-08** | Biaya Hosting Rp 0 | Fase 5 | Verifikasi URL publik Render, Supabase, dan Vercel |

---

## 5. Konfigurasi CI/CD & Branch Protection (GitHub Actions)

Untuk menjaga agar branch `main` selalu stabil dan bebas dari regresi logika keuangan, disiapkan alur integrasi berkelanjutan (*Continuous Integration*) melalui GitHub Actions pada berkas `.github/workflows/ci.yml`:

```yaml
name: Backend CI & Quality Gate

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_cafe_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt

      - name: Run Ruff Linter
        run: |
          ruff check backend/

      - name: Run Database Migrations
        env:
          DATABASE_URL: postgresql+asyncpg://test_user:test_password@localhost:5432/test_cafe_db
        run: |
          cd backend && alembic upgrade head

      - name: Run Pytest Suite (Transactions, Anomalies & Security)
        env:
          DATABASE_URL: postgresql+asyncpg://test_user:test_password@localhost:5432/test_cafe_db
          SECRET_KEY: test_secret_key_ci_environment_only
        run: |
          cd backend && pytest -v --maxfail=1
```

* **Aturan Branch Protection di GitHub `main`:**
  1. Wajib melalui Pull Request (dilarang *push* langsung ke `main`).
  2. Wajib menunggu check job `test` (GitHub Actions CI) berstatus hijau sebelum di-merge.
  3. Dilarang melakukan *force push* atau menghapus history commit.
