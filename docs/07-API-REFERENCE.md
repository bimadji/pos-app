# Referensi REST API & Event SSE (Backend v1)

Dokumentasi detail endpoint REST API dan event Server-Sent Events (SSE) yang tersedia pada Kafe Dine-in Web POS. Dokumentasi interaktif Swagger UI juga dapat diakses langsung pada rute `/docs` saat server backend aktif.

---

## 1. Autentikasi Staf & Sesi Meja

### `POST /api/v1/auth/login`
- **Akses:** Publik (Staf Kasir & Admin)
- **Fungsi:** Mengautentikasi username dan password staf, menghasilkan JWT Bearer Token.
- **Request Body:**
  ```json
  {
    "tenant_slug": "kafe-senja",
    "username": "kasir_bima",
    "password": "KasirPass123!"
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "access_token": "eyJhbGciOi...",
      "token_type": "bearer",
      "username": "kasir_bima",
      "role": "cashier"
    }
  }
  ```

### `GET /api/v1/session`
- **Akses:** Publik Meja (Membawa parameter `table_id` dan `token`)
- **Fungsi:** Memverifikasi tanda-tangan HMAC token meja pelanggan.
- **Query Params:** `table_id={uuid}&token={hmac_token}`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "table_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "table_number": 5
    }
  }
  ```

---

## 2. Katalog Menu Pelanggan

### `GET /api/v1/menu`
- **Akses:** Pelanggan Meja (Wajib parameter meja yang valid)
- **Fungsi:** Mengambil katalog menu yang dikelompokkan per kategori. Menu yang habis tetap ditampilkan dengan flag `is_available: false`.
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": [
      {
        "category_id": "b91fb6c4-dcf7-4ad7-a865-30d51e0eca76",
        "category_name": "Kopi Susu",
        "item_type": "DRINK",
        "items": [
          {
            "id": "e4b6354b-d12c-47ea-a801-44754d5885c4",
            "name": "Kopi Susu Senja",
            "description": "Espresso, susu segar, dan gula aren",
            "price": 22000.0,
            "stock": 45,
            "is_available": true,
            "image_url": null
          }
        ]
      }
    ]
  }
  ```

---

## 3. Pesanan Meja & Dapur

### `POST /api/v1/orders`
- **Akses:** Pelanggan Meja (Via parameter query `table_id` & `token`)
- **Fungsi:** Membuat pesanan awal atau menambahkan pesanan babak baru (*multi-round*). Memotong stok produk secara atomik berkondisi (*conditional atomic update*).
- **Request Body:**
  ```json
  {
    "customer_name": "Bima",
    "items": [
      {
        "product_id": "e4b6354b-d12c-47ea-a801-44754d5885c4",
        "quantity": 2,
        "notes": "Sedikit Es | Normal"
      }
    ]
  }
  ```
- **Response 201 Created:** Data bon meja beserta snapshot harga dan `round_number`.

### `PATCH /api/v1/orders/{order_id}/status`
- **Akses:** Staf (Kasir & Barista)
- **Query Params:**
  - `new_status`: `"COOKING"` atau `"SERVED"`
  - `round_number`: (Opsional, `int`) Jika diisi, memperbarui status babak tertentu di antrean masak.
- **Fungsi:** Mengubah status masak per babak pesanan atau keseluruhan meja.

### `PATCH /api/v1/orders/{order_id}/move-table`
- **Akses:** Staf Kasir
- **Request Body:**
  ```json
  {
    "new_table_number": 7
  }
  ```
- **Fungsi:** Memindahkan bon meja aktif ke meja kosong lain dan menyinkronkan HP pelanggan secara otomatis.

### `POST /api/v1/orders/{order_id}/cancel`
- **Akses:** Staf Kasir
- **Request Body:**
  ```json
  {
    "cancellation_reason": "Pelanggan salah memilih pesanan"
  }
  ```
- **Fungsi:** Membatalkan pesanan, mengembalikan stok produk yang terpotong (*rollback*), dan mengosongkan meja.

---

## 4. Pelunasan & Pembayaran Kasir

### `POST /api/v1/orders/{order_id}/pay`
- **Akses:** Staf Kasir
- **Wajib Header:** `Idempotency-Key: <UUID>`
- **Request Body:**
  ```json
  {
    "payment_method": "CASH",
    "amount_tendered": 50000.0
  }
  ```
  *(Metode yang didukung: `"CASH"` dan `"STATIC_QRIS"`)*
- **Fungsi:** Mencatat pembayaran kasir, menyelesaikan pesanan menjadi `COMPLETED`, dan membebaskan meja kembali `AVAILABLE`.

---

## 5. Manajemen Shift Kasir & Rekonsiliasi

### `POST /api/v1/shifts/open`
- **Akses:** Staf Kasir
- **Request Body:**
  ```json
  {
    "starting_cash": 200000.0
  }
  ```
- **Fungsi:** Membuka sesi kerja shift kasir dengan modal awal laci kasir.

### `GET /api/v1/shifts/current`
- **Akses:** Staf Kasir aktif
- **Fungsi:** Mengambil data shift berjalan beserta kalkulasi live:
  - `cash_sales`: Akumulasi penjualan tunai shift ini.
  - `qris_sales`: Akumulasi penjualan QRIS shift ini.
  - `total_sales`: Total omzet shift ini.
  - `expected_cash`: Target uang fisik di laci (`starting_cash + cash_sales`).

### `POST /api/v1/shifts/close`
- **Akses:** Staf Kasir
- **Request Body:**
  ```json
  {
    "actual_cash": 650000.0,
    "notes": "Uang pas saat serah terima shift"
  }
  ```
- **Fungsi:** Menutup shift kasir, mencocokkan uang fisik laci dengan pencatatan sistem, dan menghitung `cash_difference`.

### `GET /api/v1/shifts/history`
- **Akses:** Staf & Pemilik Kafe
- **Query Params:** `limit=30`
- **Fungsi:** Mengambil daftar riwayat seluruh shift kasir untuk keperluan audit pemilik kafe.

---

## 6. Laporan Keuangan & Ekspor CSV

### `GET /api/v1/reports/daily`
- **Akses:** Staf Staf & Pemilik Kafe
- **Query Params:** `start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` (opsional)
- **Fungsi:** Menyajikan 4 ringkasan omzet, tren 7 hari terakhir, ranking produk terlaris, dan rekapitulasi 12 bulan terakhir.

### `GET /api/v1/reports/export-csv`
- **Akses:** Staf & Pemilik Kafe
- **Fungsi:** Menghasilkan file pembukuan transaksi dalam format CSV via HTTP streaming response.

---

## 7. Event Server-Sent Events (SSE)

### `GET /api/v1/orders/stream`
- **Akses:** Terbuka untuk pelanggan meja (`?table_id={id}&token={jwt}`) dan staf (`?staff_token={jwt}`).
- **Format:** `text/event-stream` satu arah persisten dengan fitur browser auto-reconnect.
- **Daftar Event:**
  1. `order.created`: Pesanan baru masuk ke dapur.
  2. `order.round_added`: Pesanan tambahan ronde berikutnya ditambahkan meja.
  3. `order.status_changed`: Perubahan status masak dapur (dimasak / siap saji).
  4. `order.completed`: Pesanan telah dibayar lunas oleh kasir.
  5. `order.cancelled`: Pesanan dibatalkan/void oleh kasir.
  6. `order.table_moved`: Meja pesanan dipindahkan kasir.
  7. `table.status_changed`: Perubahan status denah meja kafe.
  8. `shift.opened`: Kasir membuka modal awal shift.
  9. `shift.closed`: Kasir menutup shift dan menyelesaikan rekonsiliasi kas.
