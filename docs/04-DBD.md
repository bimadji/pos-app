# Design Brief Documentation (DBD)

Dokumen ini mendefinisikan panduan visual, prinsip desain antarmuka (UI), arsitektur pengalaman pengguna (UX), sistem token desain, perilaku responsif, serta standar aksesibilitas untuk Kafe Dine-in Web POS. Dokumen ini merupakan turunan langsung dari `docs/01-PRD.md` dan `docs/02-TRD.md`, serta mengacu secara visual pada purwarupa interaktif `docs/mockupv3.html`.

---

## 1. Filosofi & Arah Visual (Design Direction)

### 1.1 Visi Estetika: "Warm Coffee Craft & Operational Clarity"
Desain antarmuka Kafe POS dirancang untuk mencerminkan nuansa kafe fisik yang hangat, ramah, dan bersahaja (*warm parchment & roasted amber*), dipadukan dengan presisi operasional ala perangkat kasir profesional (*high functional density*).

* **Menolak Estetika AI Slop:** Menghindari *dark-mode generic neon* berlebihan, efek *glassmorphism* di semua komponen, sudut membulat pil (*pill radius*) seragam, bayangan melayang tebal (*overly soft floating shadows*), serta animasi lambat yang membuang waktu kasir di jam sibuk.
* **Tiga Spektrum Mode (Impeccable Surface Modes):**
  1. **Customer Surface (Kombinasi Persuade & Operate):** Menggugah selera pelanggan lewat tipografi hangat dan foto menu yang jelas, namun dengan alur pemesanan tanpa hambatan (*zero friction*) dan tanpa kejutan biaya.
  2. **Cashier Surface (Murni Operate):** Berorientasi pada kecepatan pemrosesan data, pemindaian visual seketika (*instant scannability*), denah meja kontras tinggi, dan target tombol sentuh yang nyaman dioperasikan di layar tablet/laptop.
  3. **Admin Surface (Operate & Read):** Menyajikan data penjualan harian, metrik keuangan tabular yang terstruktur rapi, serta saklar darurat stok yang mudah diakses.

### 1.2 Tiga Dial Liveliness (Antislop Dials)
* **ENERGY:** `Level 1 (Calm & Focused)` — Antarmuka tidak berteriak dengan gradien warna-warni; warna digunakan secara hemat dan fungsional untuk mengarahkan fokus mata pengguna.
* **RHYTHM:** `Level 2 (Balanced & Structured)` — Tata letak konsisten berbasis kisi (*grid layout*) dengan variasi fungsional antara denah meja dan rincian bon belanja.
* **MOTION:** `Level 1 (Subtle & Functional)` — Animasi hanya digunakan untuk umpan balik interaksi penting (transisi status pesanan, notifikasi toast, dan indikator koneksi berdenyut halus). Mendukung penuh `@media (prefers-reduced-motion: reduce)`.

---

## 2. Prinsip Desain & Aturan Kualitas (Craftsmanship Principles)

1. **Kejelasan Finansial (Financial Legibility):** Seluruh angka uang, kuantitas item, tarif pajak, dan timestamp wajib menggunakan font monospace dengan angka tabular (*tabular figures*). Posisi koma dan digit selalu sejajar secara vertikal agar kasir dan pemilik dapat mengaudit angka tanpa risiko salah baca.
2. **Kesiapan Sentuh Fisik (Touch-Target Accessibility):** Seluruh elemen interaktif (tombol meja, tombol tambah keranjang, saklar status, dan kontrol kuantitas) wajib memiliki area sentuh minimum **44 x 44 piksel** (standar WCAG AA) untuk menjamin kenyamanan penggunaan pada tablet kasir dan layar ponsel pelanggan.
3. **Kemandirian Status & Umpan Balik (Instant Feedback):** Tidak boleh ada tombol mati (*dead button*). Setiap klik pengguna wajib menghasilkan umpan balik visual instan (efek tombol aktif, perubahan status, atau notifikasi toast).
4. **Anti-Slop Copywriting:** Seluruh teks antarmuka ditulis menggunakan bahasa Indonesia operasional kafe yang baku, lugas, dan alami. Dilarang keras menggunakan karakter em dash (`—`) serta istilah pemasaran hampa (*AI buzzwords* seperti "Seamless", "Revolutionary", "Next-Gen").

---

## 3. Sistem Desain & Token Visual (Design Tokens)

### 3.1 Palet Warna Fungsional (Color Palette)

Palet warna dibatasi pada 2 warna netral utama, 1 warna aksen hangat, dan 4 warna status semantik:

```
+---------------------------------------------------------------------------------------+
| PALET WARNA RESMI KAFE DINE-IN WEB POS                                                |
+-------------------+-------------------+-----------------------------------------------+
| Token             | Hex / Class       | Peran & Penggunaan Visual                     |
+-------------------+-------------------+-----------------------------------------------+
| Canvas Background | #f5f5f4 (Stone 100)| Latar belakang aplikasi utama (Parchment)     |
| Surface Card      | #ffffff (White)   | Latar kartu menu, kartu meja, dan modal box   |
| Primary Text      | #1c1917 (Stone 900)| Teks judul, label utama, dan nominal harga    |
| Secondary Text    | #57534e (Stone 600)| Teks deskripsi menu, timestamp, dan catatan   |
| Subtle Border     | #e7e5e4 (Stone 200)| Garis pembatas kartu, tabel, dan pemisah bon  |
| Brand Accent      | #b45309 (Amber 700)| Tombol utama (CTA), brand Kafe, checkout bar  |
| Header Dark       | #1c1917 (Stone 900)| Bilah navigasi atas (App Shell Header)        |
+-------------------+-------------------+-----------------------------------------------+
| Status: New Order | #0369a1 (Sky 700)  | Indikator pesanan baru masuk / sedang dimasak |
| Status: Served/OK | #047857 (Emerald 700)| Indikator pesanan tersaji / transaksi lunas |
| Status: Warning   | #b45309 (Amber 700)| Meja terisi / peringatan stok menipis         |
| Status: Void/Stop | #be123c (Rose 700) | Tombol batal (void) / label menu habis        |
+-------------------+-------------------+-----------------------------------------------+
```

*Semua pasangan warna teks dan latar belakang di atas telah diverifikasi memenuhi rasio kontras WCAG AA ($> 4.5:1$ untuk teks normal dan $> 3:1$ untuk teks tebal).*

---

### 3.2 Tipografi (Typography Hierarchy)

Menggunakan dua rumpun font (*font families*) yang saling melengkapi:

1. **Font Antarmuka (Interface Font):** `Plus Jakarta Sans` (atau fallback sistem `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`).
   * *Alasan:* Bentuk huruf modern dengan *x-height* proporsional, sudut tegas, dan tingkat keterbacaan tinggi pada layar ponsel beresolusi sedang.
2. **Font Finansial & Data (Monospace Data Font):** `JetBrains Mono` (dengan pengaturan CSS `font-feature-settings: "tnum"` untuk mengaktifkan *tabular figures*).
   * *Alasan:* Menjamin seluruh karakter angka memiliki lebar yang identik sehingga kolom harga pada struk dan bon kasir lurus sejajar.

```
+---------------------------------------------------------------------------------------+
| HIERARKI TIPOGRAFI                                                                    |
+-----------------------+-------------+-------------+---------------+-------------------+
| Tingkat Hirarki       | Ukuran (px) | Weight      | Font Family   | Contoh Penggunaan |
+-----------------------+-------------+-------------+---------------+-------------------+
| Display / Big Grand   | 24px (1.5rem)| Bold (700)  | JetBrains Mono| Grand Total Bon   |
| Heading 1 (Section)   | 18px (1.12rem)| Bold (700) | Jakarta Sans  | Judul Panel Meja  |
| Heading 2 (Card Title)| 14px (0.87rem)| Bold (700) | Jakarta Sans  | Nama Menu / Meja  |
| Body Text             | 13px (0.81rem)| Regular (400)| Jakarta Sans | Deskripsi Produk  |
| Monospace Data Line   | 13px (0.81rem)| Medium (500)| JetBrains Mono| Baris Subtotal Bon|
| Small Meta / Badges   | 11px (0.68rem)| Medium (600)| Jakarta Sans  | Status Sesi Meja  |
+-----------------------+-------------+-------------+---------------+-------------------+
```

---

### 3.3 Batasan Radius, Elevasi, & Garis (Borders & Shadows)
* **Border Radius:** 
  * Kontainer besar dan modal: `rounded-lg` (8px) atau `rounded-xl` (12px).
  * Tombol dan badge: `rounded-md` (6px) atau `rounded` (4px).
  * Kapsul kategori: `rounded-full` khusus untuk filter geser horizontal (*pill filter*).
* **Garis Pembatas vs Bayangan:** Mengutamakan garis tipis 1 piksel (`border border-stone-200`) daripada bayangan melayang tebal. Bayangan hanya digunakan pada kartu aktif yang sedang dipilih kasir (`shadow-sm` hingga `shadow-md`) untuk menandakan elevasi fisik.

---

## 4. Rincian Desain Antarmuka Berdasarkan Peran

### 4.1 Portal Pelanggan (Customer Mobile Web - `/t/:table_token`)
*Fokus: Mobile-first, navigasi vertikal ibu jari, keterbukaan rincian tagihan.*

1. **Header Meja Kompak:** Menampilkan inisial kafe, label nomor meja (contoh: *"MEJA 05"*), dan konfirmasi nama pemesan.
2. **Bilah Kategori Geser (Horizontal Category Pills):** Menampung kategori menu (Kopi Signature, Makanan Berat, Cemilan, Minuman Dingin) yang dapat digeser secara horizontal menggunakan sentuhan jari.
3. **Kartu Menu Responsif:**
   * Sisi kiri: Nama menu, deskripsi bahan ringkas, harga dengan format rupiah jelas, serta penanda stok menipis jika sisa di bawah 5 porsi.
   * Sisi kanan: Tombol aksi sentuh `[ Tambah ]` berukuran minimal 44 piksel.
   * Menu habis (*Sold Out*): Kartu ditampilkan dengan opasitas redup (60%), tombol dinonaktifkan, dan label *"Habis"*.
4. **Modal Catatan Preferensi Rasa (Item Notes Modal):**
   * Muncul saat pelanggan mengklik menu kopi atau makanan.
   * Menyediakan kolom input teks bebas: *"Contoh: Less ice, gula aren sedikit saja, es batu dipisah"*.
5. **Bilah Keranjang Melayang Bawah (Sticky Checkout Drawer):**
   * Mengambang di bagian bawah layar ponsel.
   * Menampilkan jumlah total item pesanan, perkiraan subtotal, dan tombol aksi tegas *"Kirim ke Dapur"*.
6. **Layar Status Pesanan Live (Order Tracker Screen):**
   * Menampilkan animasi denah progres horizontal sederhana: *Pesanan Diterima -> Sedang Dimasak -> Siap Disajikan*.
   * Menyediakan tombol *"Pesan Tambahan (Babak 2)"*.
7. **Struk Digital (E-Receipt):** Tampilan bon digital bergaya struk kasir yang memuat rincian item, nomor meja, nama kasir bertugas, waktu pembayaran, dan penanda cap *"LUNAS"*.

---

### 4.2 Portal Kasir & Dapur (Cashier & Kitchen Interface - `/cashier`)
*Fokus: Kepadatan informasi tinggi, minim klik, kejelasan denah meja, dan respons audio.*

1. **Header Navigasi Operasional:**
   * Indikator status jaringan SSE (*Hijau = SSE Aktif, Kuning = Reconnecting, Merah = Terputus*).
   * Identitas kasir dan shift yang bertugas (*Shift Pagi: Bima*).
   * Tombol cepat penampil saldo laci kas (*Uang Laci: Rp 1.450.000*).
   * Pengalih mode tampilan kasir (*Mode Denah Meja & Bon* vs *Mode Antrean Masak Stream*).
2. **Bilah Peringatan Pesanan Baru (Live Order Banner):**
   * Pita notifikasi di bagian atas layar kasir yang menyala dengan latar amber hangat dan memicu bunyi lonceng saat ada pesanan meja baru masuk via SSE.
   * Memuat ringkasan cepat: *"Meja 05: 2x Kopi Aren, 1x Croissant (22 detik lalu)"* dan tombol *"Lihat Bon Meja"*.
3. **Panel Kiri: Denah Meja Interaktif (Table Floor Grid):**
   * Kisi kotak-kotak berukuran besar yang mewakili 12 sampai 25 meja kafe.
   * Kode warna dinamis:
     * *Abu-abu pudar:* Meja Kosong (*Available*).
     * *Kuning muda:* Meja Terisi / Tamu sedang makan belum bayar (*Occupied / Unpaid*).
     * *Biru muda:* Ada pesanan baru yang sedang dimasak dapur (*Cooking*).
     * *Garis hitam tebal:* Meja yang sedang dipilih dan aktif di panel tagihan kanan.
   * Baris tombol cepat di bawah denah: *Pindah Meja*, *Batalkan (Void)*, dan *Menu Habis*.
4. **Panel Kanan: Panel Bon & Tagihan Meja (Active Bill Panel):**
   * Rincian bon terbuka yang membedakan item per babak pemesanan (*Babak 1 Tersaji* vs *Babak 2 Sedang Dimasak*).
   * Kolom kalkulasi matematika presisi: Subtotal Menu, Pajak Restoran PB1 (10%), Biaya Layanan (Service Charge), dan Grand Total.
   * Tombol pilihan pembayaran: *Bayar Tunai* (membuka modal kalkulator uang diterima dan kembalian) dan *QRIS Kasir*.
   * Tombol utama *Selesaikan Transaksi & Tutup Meja* yang dilindungi *Idempotency-Key*.
   * Tombol cetak struk kasir langsung ke printer thermal browser (`window.print()`).
5. **Mode Tampilan Alternatif (Antrean Masak Stream Table):**
   * Tampilan tabel baris padat terurut detik waktu masuk (*FIFO stream*).
   * Menampilkan kolom Jam, Meja, Rincian Menu & Catatan Rasa, Total, Status, dan Tombol Aksi Langsung (*Mulai Masak*, *Siap Saji*). Sangat ideal untuk tablet yang diletakkan di meja racik barista.

---

### 4.3 Portal Pemilik Kafe (Admin / Owner Dashboard - `/admin`)
*Fokus: Keterbacaan eksekutif, pengawasan kas, dan kendali menu.*

1. **Kartu Metrik Finansial Harian (4 Metric Summary Cards):**
   * *Omzet Penjualan Hari Ini:* Nominal rupiah total transaksi lunas hari berjalan.
   * *Pembayaran Tunai:* Total uang fisik tunai yang seharusnya terkumpul di laci.
   * *Pembayaran QRIS Kasir:* Total dana non-tunai yang masuk ke rekening penampungan bank.
   * *Peringatan Stok Menipis:* Menyoroti produk-produk dengan sisa porsi kritis.
2. **Tabel Inventaris Menu & Saklar Cepat Ketersediaan:**
   * Daftar seluruh produk dilengkapi kolom Nama, Kategori, Harga Dasar, Sisa Stok, dan Status Penjualan.
   * Saklar satu klik: Tombol *"Tandai Habis"* yang seketika menonaktifkan menu di HP pelanggan meja tanpa memuat ulang halaman.
3. **Laporan Shift Kasir & Rekonsiliasi:**
   * Tabel riwayat shift kasir (Shift Pagi Bima vs Shift Sore Sarah).
   * Menampilkan perbandingan matematis: Modal Awal Laci + Penjualan Tunai Sistem vs Uang Fisik Aktual di Laci Kas, serta kolom selisih kas.
4. **Tombol Ekspor CSV:** Menghasilkan berkas `laporan_transaksi_harian.csv` siap olah di Microsoft Excel atau Google Sheets.

---

## 5. Tata Kelola State Antarmuka (UI States & Edge Cases)

Setiap komponen yang menampilkan data wajib memiliki minimal 3 kondisi visual:

```
+---------------------------------------------------------------------------------------+
| TATA KELOLA KONDISI STATE KOMPONEN                                                    |
+-------------------+-----------------------------------+-------------------------------+
| Komponen          | Kondisi State                     | Representasi Visual           |
+-------------------+-----------------------------------+-------------------------------+
| Denah Meja        | Kosong (Empty State)              | Kotak abu-abu redup bersublabel|
|                   |                                   | "Kosong", tombol order pasif. |
|                   | Memuat Data (Loading State)       | Efek shimmer skeleton halus.  |
|                   | Terisi Pesanan (Normal State)     | Warna kuning/biru dengan total|
|                   |                                   | rupiah dan jumlah item aktif. |
+-------------------+-----------------------------------+-------------------------------+
| Keranjang Belanja | Kosong (Empty State)              | Ilustrasi piring kosong teks: |
|                   |                                   | "Keranjang Anda masih kosong".|
|                   | Ada Pesanan (Active State)        | Bilah melayang bawah dengan   |
|                   |                                   | total harga dan tombol bayar. |
+-------------------+-----------------------------------+-------------------------------+
| Jaringan Realtime | Terhubung (Online State)          | Titik hijau stabil "SSE Aktif"|
|                   | Terputus (Reconnecting State)     | Titik kuning berkedip lembut  |
|                   |                                   | "Menyambung Ulang Jaringan..."|
|                   | Gagal Total (Offline Error State) | Banner merah peringatan WiFi. |
+-------------------+-----------------------------------+-------------------------------+
```

---

## 6. Standar Aksesibilitas & Responsivitas (WCAG AA)

1. **Indikator Fokus Keyboard (Keyboard Navigable):**
   * Dilarang keras mematikan fokus peramban dengan `outline: none`.
   * Seluruh elemen interaktif wajib memiliki cincin fokus yang tegas:  
     `outline: 2px solid #b45309; outline-offset: 2px;`.
   * Seluruh modal dan drawer wajib dapat ditutup menggunakan tombol fisik keyboard `Escape`.
2. **Area Sentuh Minimal (Touch Target):**
   * Kelas utilitas baku `.touch-target` diterapkan pada seluruh tombol sentuh:  
     `min-height: 44px; min-width: 44px;`.
3. **Preferensi Gerak Pengguna (Motion Reduction):**
   * Mendukung penuh pengguna yang mengaktifkan opsi *reduce motion* di sistem operasi peranti mereka:
     ```css
     @media (prefers-reduced-motion: reduce) {
       *, ::before, ::after {
         animation-duration: 0.01ms !important;
         transition-duration: 0.01ms !important;
         scroll-behavior: auto !important;
       }
     }
     ```
4. **Semantik HTML5 Baku:**
   * Menggunakan tag semantik resmi: `<header>`, `<nav>`, `<main>`, `<section>`, `<table>`, dan `<button>`.
   * Dilarang menggunakan elemen non-interaktif `<div>` atau `<span>` yang dipaksa menjadi tombol (`onClick`) tanpa atribut `role="button"` dan penanganan aksesibilitas keyboard (`onKeyDown`).

---

## 7. Rincian Format Cetak Struk Kasir (Thermal Receipt Print Style)

Cetak struk fisik kasir dirancang menggunakan CSS Media Print `@media print` yang secara otomatis menyesuaikan ukuran kertas printer thermal kasir (58mm dan 80mm):

```css
@media print {
  /* Sembunyikan navigasi, denah meja, dan tombol aksi */
  header, nav, .lg\:col-span-7, .action-buttons, #toast {
    display: none !important;
  }
  
  /* Format struk kasir vertikal hitam-putih */
  body {
    background-color: white !important;
    color: black !important;
  }
  
  .receipt-print-area {
    width: 100% !important;
    max-width: 80mm !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 11px !important;
    line-height: 1.3 !important;
    margin: 0 auto !important;
  }
}
```

* **Struktur Struk Thermal:**
  1. *Header:* Nama Kafe, Alamat Kafe, Tanggal & Waktu Transaksi, Nomor Bon, Nomor Meja, Nama Kasir, Nama Pelanggan.
  2. *Garis Pemisah:* Karakter strip putus-putus (`--------------------------------`).
  3. *Daftar Item:* Baris kuantitas, nama menu snapshot, catatan preferensi, dan subtotal per baris.
  4. *Rincian Total:* Subtotal, Pajak Restoran PB1 (10%), Biaya Layanan, Grand Total.
  5. *Pembayaran:* Metode Bayar (Tunai / QRIS), Nominal Bayar, Uang Kembalian.
  6. *Footer:* Ucapan terima kasih ("Terima kasih atas kunjungan Anda di Kafe Senja Kopi").
