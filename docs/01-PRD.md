# Product Requirement Documentation (PRD)

Dokumen ini mendefinisikan kebutuhan produk untuk pembangunan ulang Kafe Dine-in Web POS, mencakup latar belakang masalah, persona pengguna, tujuan dan metrik keberhasilan, daftar kebutuhan fungsional (FR) dan non-fungsional (NFR), user story beserta kriteria penerimaan (*acceptance criteria*), serta batasan ruang lingkup yang sengaja tidak dikerjakan.

---

## 1. Latar Belakang & Masalah

### 1.1 Konteks Bisnis
Sebagian besar kafe dan coffee shop mandiri (*independent coffee shop*) dengan skala 10 sampai 25 meja beroperasi menggunakan sistem kasir konvensional (kasir mencatat pesanan satu per satu di meja kasir depan atau pelayan mencatat manual di kertas).

### 1.2 Masalah Utama yang Dihadapi Kafe
1. **Antrean Menumpuk di Meja Kasir pada Jam Sibuk:** Pelanggan yang baru datang harus berdiri mengantre di depan meja kasir hanya untuk memilih menu dan memesan, sementara barista di belakang bar kewalahan melayani transaksi pembayaran sekaligus meracik kopi.
2. **Keterbatasan Pelayan & Kesalahan Pesanan Khusus:** Pelanggan dine-in sering kali memiliki preferensi spesifik (*less ice*, *less sugar*, atau tanpa bahan tertentu). Pencatatan verbal di tengah keramaian kafe sering terlewat sehingga menimbulkan komplain dan pemborosan bahan baku (*food waste*).
3. **Biaya Perangkat Keras dan Langganan POS Komersial yang Mahal:** Perangkat lunak POS restoran yang ada di pasaran (seperti Moka, Majoo, atau ESB) membebankan biaya langganan bulanan yang signifikan bagi pemilik kafe pemula, serta mewajibkan pembelian perangkat keras proprietary (tablet Android/iPad khusus, printer khusus berlisensi).
4. **Friction Pelanggan pada Solusi Digital yang Ada:** Sebagian kafe mencoba menggunakan aplikasi pemesanan daring, tetapi pelanggan enggan menggunakannya karena diwajibkan mengunduh aplikasi berukuran puluhan megabyte dari toko aplikasi dan mendaftar akun dengan verifikasi email/nomor telepon hanya untuk memesan segelas kopi.

---

## 2. Visi Produk & Target Pengguna

### 2.1 Visi Produk
Menghadirkan sistem operasional POS dine-in modern berbasis web yang menghilangkan antrean meja kasir melalui pemesanan mandiri via QR meja tanpa hambatan (*zero friction*), memberikan kendali pesanan realtime bagi kasir dan dapur, serta dapat dijalankan 100% pada peramban peranti yang sudah dimiliki kafe dengan biaya infrastruktur awal Rp 0.

### 2.2 Persona Pengguna

#### Persona 1A: Rian — "The Solo Remote Worker / Student" (Penyendiri & Fokus Kerja)
* **Profil:** Mahasiswa atau pekerja remote berusia 20-30 tahun yang datang ke kafe sendirian untuk belajar atau bekerja santai (WFC) selama 2-4 jam.
* **Perilaku & Kebutuhan:** Memesan 1 minuman di awal, lalu 1.5 jam kemudian memesan minuman atau cemilan kedua tanpa mau terdistraksi dari layar laptopnya (*multi-round ordering via HP sangat krusial*). Sangat sensitif terhadap preferensi rasa kopi (*less ice, less sugar, oat milk*).
* **Titik Sakit:** Malas memanggil pelayan di tengah fokus kerja, dan enggan mengunduh aplikasi baru atau mengisi form registrasi panjang hanya untuk memesan segelas kopi.

#### Persona 1B: Dira & Geng Kampus — "The Social Hangout Group" (Rombongan Meja 4-6 Orang)
* **Profil:** Kelompok pertemanan 4-6 orang yang datang beramai-ramai untuk nongkrong, ngobrol santai, atau nugas kelompok.
* **Perilaku & Kebutuhan:** Satu orang (Dira) menjadi perwakilan pemindai QR untuk meja mereka, memesan banyak menu sekaligus (kombinasi 4 kopi berbeda rasa, cemilan bersama, dan makanan berat). Setiap teman memiliki catatan selera berbeda (*"kopi A less sugar, kopi B extra shot, saus kentang dipisah"*).
* **Titik Sakit:** Minuman sering tertukar jika tidak ada catatan per item yang jelas, bon meja tercecer jika teman memesan susulan secara terpisah, dan kerepotan saat pelunasan tagihan di meja kasir.

#### Persona 1C: Mas Dimas — "The In-a-Hurry Professional" (Makan Siang Cepat / Terburu Waktu)
* **Profil:** Pekerja kantoran yang datang saat jam istirahat makan siang (12:00-13:00) dengan alokasi waktu makan terbatas.
* **Perilaku & Kebutuhan:** Menolak membuang waktu 10 menit berdiri mengantre di kasir. Langsung duduk, memindai QR, memesan menu makanan berat cepat saji (*Nasi Sei Sapi / Rice Bowl*), dan sangat memantau *Live Status Pesanan di HP* untuk memastikan makanannya sedang dimasak agar tidak terlambat kembali ke kantor.
* **Titik Sakit:** Cemas jika tidak tahu apakah pesanan sudah diproses dapur atau belum, dan kesal jika proses pembayaran di kasir lambat saat jam makan siang padat.

#### Persona 2: Bima (Kasir & Barista Kafe)
* **Profil:** Staf operasional kafe yang bertugas menerima pesanan, meracik minuman, menyajikan makanan, dan mengelola penerimaan uang di meja kasir.
* **Kebutuhan:** Membutuhkan layar kerja yang memperlihatkan denah meja terisi secara visual, menerima notifikasi berbunyi saat ada pesanan baru masuk dari meja pelanggan, mengetahui rincian catatan pesanan dengan jelas, dapat menangani pemindahan meja jika pelanggan berpindah tempat duduk, serta proses pelunasan kasir yang cepat (Tunai dan QRIS).
* **Titik Sakit:** Panik jika pesanan kertas tercecer saat kafe ramai, pesanan ganda masuk tanpa sengaja karena pelanggan klik berulang, dan selisih uang kas laci saat pergantian shift akibat pencatatan manual yang tidak rapi.

#### Persona 3: Pak Seno (Pemilik Kafe / Admin Owner)
* **Profil:** Pemilik bisnis kafe mandiri yang mengawasi keberlangsungan usaha, keuntungan harian, dan ketersediaan stok bahan baku.
* **Kebutuhan:** Dapat melihat ringkasan omzet harian dari ponsel atau laptop pribadinya, mengetahui menu apa yang paling laku, mematikan menu secara cepat jika bahan baku mendadak habis, dan menerima laporan rekonsiliasi kas kasir tanpa perlu hadir fisik di kafe sepanjang hari.
* **Titik Sakit:** Sering mengalami kebobolan stok bahan tanpa tercatat, laporan keuangan tidak cocok antara catatan kasir dengan uang bank, serta biaya operasional software yang memberatkan arus kas bulanan.
---

## 3. Tujuan Produk & Metrik Keberhasilan (KPI)

### 3.1 Tujuan Produk
1. **Efisiensi Waktu Pemesanan:** Memangkas waktu tunggu dari saat pelanggan duduk hingga pesanan masuk ke dapur dari rata-rata 8-12 menit menjadi di bawah 2 menit.
2. **Nol Biaya Perangkat:** Sistem dapat diakses penuh melalui peramban web pada ponsel, tablet, atau laptop yang sudah dimiliki staf tanpa lisensi perangkat keras tambahan.
3. **Keandalan Finansial & Stok:** Mencegah terjadinya stok minus (*overselling*) dan mencegah pencatatan transaksi ganda pada sistem kasir.

### 3.2 Metrik Keberhasilan (Success Metrics)
* **Keberhasilan Operasional Pilot:** Berhasil diuji coba pada 3 sampai 5 kafe mitra pilot selama minimal 14 hari operasional berturut-turut tanpa kegagalan integritas transaksi.
* **Adopsi Pemesanan Meja:** Minimal 70% transaksi dine-in di kafe pilot dilakukan secara mandiri oleh pelanggan melalui pemindaian QR meja.
* **Akurasi Kas & Stok:** Selisih antara perhitungan kas sistem dengan uang fisik laci kasir berada pada angka 0% (toleransi pembulatan uang kembalian tunai di bawah Rp 1.000).
* **Kecepatan Muat Antarmuka Pelanggan:** Halaman katalog menu pelanggan selesai dimuat dalam waktu kurang dari 2 detik pada jaringan 4G standar.

---

## 4. Daftar Kebutuhan Fungsional (Functional Requirements)

### 4.1 Modul Pelanggan (Customer Web - QR Ordering)
* **FR-01 (Akses QR Meja Bertanda-tangan):** Pelanggan dapat mengakses katalog pemesanan dengan memindai QR code di meja tanpa proses login atau instalasi aplikasi. Tautan QR diverifikasi melalui token kriptografis HMAC untuk memastikan keabsahan nomor meja dan identitas tenant kafe.
* **FR-02 (Input Identitas Pesanan):** Pelanggan memasukkan nama pemesan (*customer_name*) pada awal sesi atau saat konfirmasi pesanan untuk memudahkan barista memanggil dan menyajikan pesanan.
* **FR-03 (Eksplorasi Katalog Menu):** Pelanggan dapat memfilter daftar produk berdasarkan kategori menu (Kopi Signature, Makanan Berat, Cemilan, dsb.), melihat foto, deskripsi, harga resmi, dan status ketersediaan.
* **FR-04 (Preferensi & Catatan Khusus Per Item):** Pelanggan dapat menambahkan catatan teks bebas untuk setiap item yang dipesan (contoh: *"less sugar, es dipisah"*).
* **FR-05 (Draft Keranjang Lokal):** Daftar pilihan menu disimpan sementara pada penyimpanan lokal peramban (*localStorage*) pelanggan agar tidak hilang jika peramban tidak sengaja tertutup atau memuat ulang.
* **FR-06 (Pengiriman Pesanan ke Dapur):** Pelanggan dapat mengirimkan pesanan ke dapur; sistem memvalidasi ketersediaan stok secara atomik dan menampilkan rincian subtotal, biaya layanan (*service charge*), pajak restoran PB1, serta grand total.
* **FR-07 (Pesanan Bertingkat / Multi-Round Ordering):** Pelanggan di meja yang sama dapat melakukan pemesanan tambahan (*babak 2 dan seterusnya*) yang otomatis terakumulasi ke dalam satu nomor bon aktif meja tersebut.
* **FR-08 (Pelacakan Status Pesanan Realtime):** Pelanggan dapat melihat perubahan status pesanannya secara langsung (*Menunggu Dapur -> Sedang Dimasak -> Siap Disajikan*) melalui pembaruan Server-Sent Events (SSE).
* **FR-09 (Struk Digital / E-Receipt):** Pelanggan dapat melihat dan menyimpan tanda terima pembayaran digital di peramban ponsel setelah pesanan dinyatakan lunas oleh kasir.

### 4.2 Modul Kasir & Barista (Cashier & Kitchen Operations)
* **FR-10 (Autentikasi Staf Kasir):** Staf kasir dapat masuk ke sistem menggunakan nama pengguna dan kata sandi yang aman berbasis JWT.
* **FR-11 (Buka Shift & Modal Kas Laci):** Kasir wajib memasukkan nominal uang modal awal laci (*starting_cash*) saat membuka shift operasional harian.
* **FR-12 (Tampilan Denah Meja Interaktif):** Kasir dapat memantau status seluruh meja kafe dalam bentuk kisi denah visual dengan indikator warna status (*Kosong, Terisi/Makan, Pesanan Baru*).
* **FR-13 (Live Order Feed & Notifikasi Dapur):** Kasir dan barista menerima notifikasi visual dan audio seketika saat ada pesanan baru masuk dari meja pelanggan via jalur SSE.
* **FR-14 (Rincian Bon Terbuka & Akumulasi Babak):** Kasir dapat melihat rincian seluruh item pesanan per meja, terpisah rapi berdasarkan babak pemesanan (*Round 1, Round 2*).
* **FR-15 (Pemindahan Meja / Move Table):** Kasir dapat memindahkan seluruh pesanan aktif dari satu meja ke meja lain yang sedang kosong jika pelanggan berpindah tempat duduk.
* **FR-16 (Pembatalan Pesanan / Void Order):** Kasir dapat membatalkan pesanan yang belum dimasak dengan menyertakan alasan pembatalan; sistem secara otomatis mengembalikan jumlah stok produk ke database.
* **FR-17 (Pemrosesan Pembayaran Kasir):** Kasir dapat menyelesaikan pembayaran tagihan meja menggunakan metode Tunai (sistem menghitung uang kembalian otomatis) atau QRIS Statis kasir.
* **FR-18 (Idempotensi Pembayaran):** Setiap transaksi pembayaran dilindungi oleh *Idempotency-Key* unik untuk mencegah pencatatan pembayaran ganda akibat penekanan tombol berulang oleh kasir.
* **FR-19 (Cetak Struk Fisik Kasir):** Kasir dapat mencetak struk fisik sementara maupun struk lunas ke printer thermal standar melalui fungsi peramban `window.print()`.
* **FR-20 (Saklar Cepat Menu Habis):** Kasir dapat menonaktifkan ketersediaan menu tertentu (*Sold Out toggle*) secara instan dari layar operasional jika bahan baku di dapur habis.
* **FR-21 (Tutup Shift & Rekonsiliasi Kas):** Kasir memasukkan jumlah fisik uang tunai di laci (*actual_cash*) pada akhir jam kerja; sistem menghitung selisih kas terhadap rekaman mutasi penjualan sistem.

### 4.3 Modul Pemilik Kafe (Admin / Owner Portal)
* **FR-22 (Dashboard Metrik Bisnis Harian):** Pemilik dapat melihat kartu metrik omzet penjualan harian, jumlah transaksi selesai, rata-rata nilai transaksi per meja, dan produk terlaris.
* **FR-23 (Peringatan Stok Menipis):** Pemilik menerima daftar peringatan produk yang jumlah stoknya berada di bawah ambang batas minimum.
* **FR-24 (Manajemen Katalog Menu & Harga):** Pemilik dapat menambah, mengubah, dan menghapus kategori serta produk (nama, deskripsi, harga dasar, foto, stok).
* **FR-25 (Pengaturan Meja & Pembuatan Stiker QR):** Pemilik dapat menambah atau mengubah nomor meja dan mengunduh stiker QR siap cetak yang telah dibubuhi token kriptografis.
* **FR-26 (Pengaturan Tarif Pajak & Layanan):** Pemilik dapat mengatur persentase pajak restoran (PB1, default 10%) dan biaya layanan (*service charge*, contoh 5%) per tenant kafe.
* **FR-27 (Laporan Riwayat Shift & Audit Kas):** Pemilik dapat melihat riwayat pembukaan dan penutupan shift seluruh kasir lengkap dengan catatan selisih kas.
* **FR-28 (Ekspor Pembukuan CSV):** Pemilik dapat mengunduh rekapan data penjualan harian atau bulanan dalam format berkas CSV.

---

## 5. Daftar Kebutuhan Non-Fungsional (Non-Functional Requirements)

* **NFR-01 (Integritas Pengurangan Stok Atomik):** Pengurangan stok wajib dilakukan dalam satu blok transaksi database ACID menggunakan pembaruan berkondisi (`UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty`). Tidak boleh terjadi stok minus dalam kondisi lonjakan pesanan bersamaan (*concurrency*).
* **NFR-02 (Isolasi Data Multi-Tenant / Zero Data Leak):** Seluruh kueri data ke basis data wajib menyertakan filter `tenant_id` yang divalidasi dari token JWT pengguna atau token sesi meja. Data Kafe A dilarang keras dapat diakses oleh Kafe B dalam kondisi apa pun (*anti-BOLA*).
* **NFR-03 (Performa Waktu Respons API):** Waktu respons rata-rata untuk pembuatan pesanan (`POST /orders`) dan mutasi status berada di bawah 250 milidetik pada beban normal kafe (10-25 meja).
* **NFR-04 (Ketahanan Koneksi Realtime):** Koneksi Server-Sent Events (SSE) wajib mendukung penyambungan ulang otomatis (*auto-reconnect*) oleh peramban jika terjadi gangguan jaringan nirkabel (WiFi) sesaat.
* **NFR-05 (Keamanan Kredensial & Secrets):** Kata sandi staf wajib dienkripsi searah menggunakan algoritma hashing standar industri (Argon2id atau Bcrypt). Kunci rahasia (JWT secret, kunci HMAC, kredensial basis data) dilarang disimpan di kode sumber atau repositori Git.
* **NFR-06 (Perlindungan Serangan Brute-Force):** Percobaan masuk akun staf dibatasi maksimal 5 kali gagal per menit per alamat IP; percobaan berikutnya ditolak dengan status HTTP 429 Too Many Requests.
* **NFR-07 (Aksesibilitas Antarmuka Operasional):** Antarmuka operasional kasir dan pelanggan wajib memenuhi standar aksesibilitas WCAG AA (kontras teks minimal 4.5:1, target sentuh tombol minimal 44x44 piksel pada peranti layar sentuh).
* **NFR-08 (Biaya Operasional Nol Rupiah):** Seluruh arsitektur MVP harus dapat di-deploy pada layanan gratis (*free-tier cloud*) seperti Render/Fly.io untuk backend FastAPI, Supabase/Neon untuk PostgreSQL terkelola, dan Vercel/Cloudflare Pages untuk frontend React.

---

## 6. User Stories & Acceptance Criteria

### US-01: Pemesanan Mandiri di Meja oleh Pelanggan
* **Sebagai:** Pelanggan kafe (Rian).
* **Saya ingin:** Memindai QR di meja, memilih menu kopi dan makanan, menyertakan catatan selera saya, lalu mengirimkan pesanan ke dapur.
* **Agar:** Saya tidak perlu berdiri mengantre di kasir dan pesanan saya diracik sesuai preferensi pribadi.
* **Kriteria Penerimaan (Acceptance Criteria):**
  1. Saat QR dipindai, web terbuka langsung menampilkan nama kafe, nomor meja yang sah, dan input nama pemesan tanpa meminta login akun.
  2. Pelanggan dapat memilih menu dan mengetik catatan khusus pada kolom catatan per item.
  3. Saat tombol "Kirim ke Dapur" ditekan, pesanan tersimpan di database dengan status `PENDING` dan stok produk terkait otomatis berkurang sesuai jumlah yang dipesan.
  4. Jika stok produk ternyata sisa 0 saat tombol ditekan, sistem menolak pesanan dengan pemberitahuan jelas dan keranjang belanja pelanggan tidak terhapus.
  5. Setelah pesanan sukses, antarmuka pelanggan berpindah ke tampilan status pesanan aktif.

### US-02: Pemesanan Tambahan pada Meja yang Sama (Multi-Round)
* **Sebagai:** Pelanggan kafe yang sedang nongkrong (Rian).
* **Saya ingin:** Menambah pesanan minuman kedua 45 menit kemudian melalui ponsel saya.
* **Agar:** Saya tidak perlu meminta bon terpisah atau berjalan ke kasir di tengah obrolan.
* **Kriteria Penerimaan (Acceptance Criteria):**
  1. Membuka kembali tautan meja menampilkan pesanan babak pertama yang sedang berjalan dan tombol "Tambah Menu".
  2. Pesanan baru yang dikirim tercatat dengan label `round_number: 2` di database dan terikat pada `order_id` yang sama.
  3. Total tagihan bon meja otomatis terakumulasi mencakup subtotal babak 1 dan babak 2, beserta perhitungan pajak dan biaya layanan yang diperbarui.
  4. Layar kasir menerima notifikasi pembaruan instan bahwa Meja X menambah pesanan.

### US-03: Penerimaan & Pemrosesan Pesanan oleh Barista
* **Sebagai:** Kasir atau Barista (Bima).
* **Saya ingin:** Melihat pesanan baru muncul di layar tablet secara langsung dengan pemberitahuan bunyi.
* **Agar:** Saya bisa segera mulai meracik minuman tanpa harus menekan tombol refresh.
* **Kriteria Penerimaan (Acceptance Criteria):**
  1. Kartu pesanan baru muncul di kolom pesanan masuk kurang dari 1 detik setelah pelanggan menekan tombol kirim.
  2. Suara denting notifikasi berbunyi di peramban kasir saat tiket pesanan baru tiba.
  3. Kasir dapat mengubah status pesanan menjadi `COOKING` saat mulai membuat dan menjadi `SERVED` saat mengantar ke meja.
  4. Perubahan status di layar kasir langsung tercermin di layar ponsel pelanggan tanpa perlu reload halaman.

### US-04: Pelunasan Tagihan Kasir & Tutup Meja
* **Sebagai:** Kasir kafe (Bima).
* **Saya ingin:** Memilih meja yang ingin membayar, melihat rincian seluruh tagihan, menerima uang, dan menutup meja.
* **Agar:** Pembayaran tercatat akurat di pembukuan dan meja siap digunakan tamu berikutnya.
* **Kriteria Penerimaan (Acceptance Criteria):**
  1. Kasir mengklik Meja X pada denah meja, panel samping menampilkan rincian seluruh menu dari semua babak pesanan.
  2. Nilai subtotal, tarif pajak restoran PB1, biaya layanan, dan grand total dihitung otomatis oleh sistem.
  3. Kasir memilih metode "Tunai", memasukkan nominal uang yang diterima, dan sistem menampilkan nominal kembalian dengan benar.
  4. Permintaan pelunasan menyertakan header `Idempotency-Key`; penekanan tombol berulang tidak menghasilkan data pembayaran ganda.
  5. Setelah pembayaran sukses, status pesanan berubah menjadi `COMPLETED`, status meja kembali `AVAILABLE` (warna abu-abu kosong), dan dialog cetak struk siap dijalankan.

### US-05: Penutupan Shift & Rekonsiliasi Kasir
* **Sebagai:** Pemilik kafe (Pak Seno).
* **Saya ingin:** Kasir menginput uang fisik di laci saat shift berakhir untuk dicocokkan dengan catatan sistem.
* **Agar:** Saya dapat mendeteksi adanya selisih uang kas laci secara transparan.
* **Kriteria Penerimaan (Acceptance Criteria):**
  1. Kasir menekan tombol "Tutup Kasir" dan menginput jumlah uang fisik hasil hitungan tangan di laci.
  2. Sistem menghitung ekspektasi uang kas: `modal_awal + total_penjualan_tunai_shift_ini`.
  3. Sistem menghitung selisih kas (`actual_cash - expected_cash`) dan mencatatnya ke tabel riwayat shift.
  4. Laporan ringkasan shift dapat dilihat oleh admin di portal pemilik kafe.

---

## 7. Matriks Prioritas Fitur

```
+---------------------------------------------------------------------------------------+
| PRIORITAS TINGGI (MVP - Validasi Kafe Pilot)                                          |
| - QR Table Self-Ordering (Mobile Web tanpa login)                                     |
| - Identitas Pesanan (Nomor Meja + Nama Pemesan)                                       |
| - Catatan Khusus Per Item (Special Notes)                                             |
| - Multi-Round Ordering (Akumulasi Bon Meja yang Sama)                                 |
| - Live Order Feed & Denah Meja Interaktif Kasir (SSE)                                 |
| - Transaksi Pengurangan Stok Atomik Berkondisi                                        |
| - Pembatalan Pesanan (Void) dengan Rollback Stok Otomatis                             |
| - Pembayaran Tunai & QRIS Statis di Kasir dengan Idempotency-Key                      |
| - Perhitungan Pajak Restoran PB1 (10%) & Biaya Layanan                                |
| - Saklar Cepat Menu Habis (Sold Out Toggle)                                           |
| - Buka & Tutup Shift Kasir Ringkas (Rekonsiliasi Kas Laci)                            |
| - Cetak Struk Browser Kasir (window.print()) & E-Receipt Digital                      |
| - Dashboard Ringkasan Omzet Pemilik & Ekspor CSV                                      |
+---------------------------------------------------------------------------------------+
| PRIORITAS SEDANG (Versi 1.0 - Kesiapan Komersial Berbayar)                            |
| - Pembayaran Digital Otomatis (QRIS Dinamis via Payment Gateway Midtrans/Xendit)      |
| - Sistem Varian & Modifier Menu Bertingkat (Ukuran, Level Gula, Topping)              |
| - Multi-Station Routing (Pemisahan Tiket Barista Minuman vs Dapur Makanan)            |
| - Notifikasi Ringkasan Penjualan Harian Otomatis ke WhatsApp Pemilik                  |
+---------------------------------------------------------------------------------------+
| PRIORITAS RENDAH / DITUNDA (Future Roadmap)                                           |
| - Fitur Rating dan Ulasan Produk (Pelanggan lebih memilih Google Maps / Instagram)   |
| - Pengiriman Struk Belanja via Email SMTP (Memperlambat antrean meja kasir)           |
| - Manajemen Multi-Cabang / Multi-Outlet Terpusat                                      |
| - Generator Laporan PDF Kompleks di Sisi Server                                       |
+---------------------------------------------------------------------------------------+
```

---

## 8. Ruang Lingkup yang Sengaja Tidak Dikerjakan (Out of Scope)

Untuk menjaga fokus dan mencegah pembengkakan ruang lingkup (*scope creep*) pada developer tunggal di fase MVP, hal-hal berikut **secara sadar tidak dikerjakan**:

1. **Aplikasi Native Android/iOS (Flutter/React Native):** Seluruh sistem berjalan pada peramban web modern (*PWA/responsive web*). Tidak ada aplikasi yang diunggah ke Google Play Store atau Apple App Store.
2. **Akun Login Khusus Pelanggan:** Tidak ada fitur registrasi, verifikasi OTP WhatsApp/SMS, atau simpan profil pelanggan di fase MVP. Akses pelanggan murni berbasis token meja sah.
3. **Penyimpanan Password Teks Terbuka:** Tidak ada sistem autentikasi sederhana tanpa hashing; semua akun staf wajib menggunakan hash standar industri.
4. **Sinkronisasi Offline Dua Arah Penuh (Full Offline-First DB):** Sistem mengandalkan koneksi internet/jaringan lokal aktif dengan lapisan ketahanan (*auto-reconnect* SSE dan *localStorage* keranjang). Sistem tidak mengimplementasikan resolusi konflik database offline dua arah yang rumit di peramban.
5. **Manajemen Resep Bertingkat & HPP Bahan Mentah:** Sistem melacak stok barang jadi (contoh: cup kopi, porsi makanan), bukan gramatur bahan mentah (contoh: pengurangan 18 gram biji kopi dan 120 ml susu cair per cup). Pelacakan HPP gramatur ditunda ke versi lanjutan.
