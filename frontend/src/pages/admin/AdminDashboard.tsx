import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authStorage } from '../../services/api'
import type { Category, Product, StaffAuth, TableInfo } from '../../services/api'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState<StaffAuth | null>(() => authStorage.load())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [tables, setTables] = useState<TableInfo[]>([])
  const [metrics, setMetrics] = useState<{
    total_sales: number
    completed_orders: number
    cash_total: number
    qris_total: number
    top_products: Array<{ name: string; qty_sold: number; revenue: number }>
    weekly_sales: Array<{ date: string; total: number; orders_count: number }>
  } | null>(null)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: '', stock: '', category_id: '' })

  const loadCatalog = useCallback(async (authData: StaffAuth) => {
    const client = api.withAuth(authData.token)
    try {
      const [p, c, t, m] = await Promise.all([
        client.listProducts(),
        client.listCategories(),
        client.listTables(),
        client.getDailyMetrics(),
      ])
      setProducts(p)
      setCategories(c)
      setTables(t)
      setMetrics(m)
      if (!newCategoryId && c.length > 0) setNewCategoryId(c[0].id)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [newCategoryId])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      const result = await api.login('kafe-senja', username, password)
      authStorage.save(result)
      setAuth(result)
      void loadCatalog(result)
    } catch (err) {
      setLoginError((err as Error).message)
    }
  }

  useEffect(() => {
    if (auth) void loadCatalog(auth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token])

  const toggleProduct = async (productId: string) => {
    if (!auth) return
    setError(null)
    try {
      await api.withAuth(auth.token).toggleProduct(productId)
      await loadCatalog(auth)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const startEdit = (p: Product) => {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      category_id: p.category_id,
    })
  }

  const saveEdit = async (productId: string) => {
    if (!auth) return
    setError(null)
    try {
      await api.withAuth(auth.token).updateProduct(productId, {
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        category_id: editForm.category_id,
      })
      setEditingId(null)
      await loadCatalog(auth)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const removeProduct = async (productId: string, name: string) => {
    if (!auth) return
    if (!window.confirm(`Hapus menu "${name}"? Menu yang pernah dipesan tidak dapat dihapus.`)) return
    setError(null)
    try {
      await api.withAuth(auth.token).deleteProduct(productId)
      await loadCatalog(auth)
    } catch (e) {
      // 409: produk ada di riwayat pesanan
      setError((e as Error).message)
    }
  }

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setError(null)
    try {
      await api.withAuth(auth.token).createProduct({
        category_id: newCategoryId,
        name: newName,
        price: Number(newPrice),
        stock: Number(newStock),
      })
      setNewName('')
      setNewPrice('')
      setNewStock('')
      await loadCatalog(auth)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const addTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    const num = Number(newTableNumber)
    if (!num || num < 1) {
      setError('Nomor meja minimal 1.')
      return
    }
    setError(null)
    try {
      await api.withAuth(auth.token).createTable(num)
      setNewTableNumber('')
      await loadCatalog(auth)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const removeTable = async (tableId: string, tableNumber: number) => {
    if (!auth) return
    if (!window.confirm(`Hapus Meja ${tableNumber}? Meja yang pernah dipakai transaksi tidak dapat dihapus.`)) return
    setError(null)
    try {
      await api.withAuth(auth.token).deleteTable(tableId)
      await loadCatalog(auth)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ---------- LOGIN VIEW ----------
  if (!auth) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white border border-stone-200 rounded-lg p-5 w-full max-w-sm">
          <h1 className="text-sm font-bold text-stone-900">Login Staf Kafe Senja</h1>
          <p className="text-xs text-stone-500 mt-0.5">Portal admin & kasir</p>
          <label htmlFor="username" className="text-[10px] font-bold text-stone-600 block mt-4 mb-1">
            USERNAME
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm touch-target"
          />
          <label htmlFor="password" className="text-[10px] font-bold text-stone-600 block mt-3 mb-1">
            PASSWORD
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm touch-target"
          />
          {loginError && <p className="text-rose-700 text-xs mt-2">{loginError}</p>}
          <button type="submit" className="w-full mt-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-sm font-bold touch-target">
            Masuk
          </button>
          <p className="text-[10px] text-stone-400 mt-3 text-center">
            Akun demo: kasir_bima / KasirPass123!
          </p>
        </form>
      </div>
    )
  }

  const soldOutCount = products.filter((p) => !p.is_available).length
  const lowStockCount = products.filter((p) => p.is_available && p.stock > 0 && p.stock <= 5).length

  // ---------- DASHBOARD VIEW ----------
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-stone-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-bold">Portal Admin - {auth.user.username}</h1>
          <p className="text-[10px] text-stone-400">Kelola menu, stok, dan saklar ketersediaan</p>
        </div>
        <nav aria-label="Portal" className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => void api.withAuth(auth.token).downloadCsv().catch((e: Error) => setError(e.message))}
            className="px-2.5 py-1.5 rounded bg-amber-700 hover:bg-amber-800 text-white font-bold touch-target"
          >
            Unduh CSV
          </button>
          <button
            onClick={() => navigate('/print-qr')}
            className="px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold touch-target"
          >
            Cetak QR Meja
          </button>
          <button onClick={() => navigate('/cashier')} className="px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 touch-target">
            Kasir
          </button>
          <button
            onClick={() => {
              authStorage.clear()
              setAuth(null)
            }}
            className="px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 touch-target"
          >
            Keluar
          </button>
        </nav>
      </header>

      <main className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* 1. Kartu Metrik Penjualan Harian (Dashboard Penjualan) */}
        <div>
          <h2 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Ringkasan Penjualan Hari Ini</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
              <p className="text-[10px] text-stone-500 font-bold uppercase">Total Omzet</p>
              <p className="text-lg font-black font-mono-num text-amber-800 mt-1">
                Rp {(metrics?.total_sales ?? 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
              <p className="text-[10px] text-stone-500 font-bold uppercase">Pesanan Selesai</p>
              <p className="text-lg font-black font-mono-num text-stone-900 mt-1">
                {metrics?.completed_orders ?? 0} Transaksi
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
              <p className="text-[10px] text-stone-500 font-bold uppercase">Kas Tunai Masuk</p>
              <p className="text-lg font-black font-mono-num text-emerald-700 mt-1">
                Rp {(metrics?.cash_total ?? 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
              <p className="text-[10px] text-stone-500 font-bold uppercase">QRIS Kasir</p>
              <p className="text-lg font-black font-mono-num text-sky-700 mt-1">
                Rp {(metrics?.qris_total ?? 0).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Top 5 Produk Terlaris & Chart Tren Penjualan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Chart Tren Penjualan 7 Hari Terakhir */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-sm">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
              Tren Penjualan 7 Hari Terakhir
            </h3>
            {(!metrics?.weekly_sales || metrics.weekly_sales.length === 0) ? (
              <p className="text-xs text-stone-400 py-6 text-center">Belum ada transaksi completed minggu ini.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const maxVal = Math.max(...metrics.weekly_sales.map((w) => w.total), 1)
                  return metrics.weekly_sales.map((item) => {
                    const pct = Math.round((item.total / maxVal) * 100)
                    return (
                      <div key={item.date} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-mono text-stone-600">{item.date} ({item.orders_count} bon)</span>
                          <span className="font-mono-num font-bold text-stone-900">
                            Rp {item.total.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>

          {/* Top 5 Produk Paling Sering Dipesan */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-sm">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
              Menu Paling Sering Dipesan
            </h3>
            {(!metrics?.top_products || metrics.top_products.length === 0) ? (
              <p className="text-xs text-stone-400 py-6 text-center">Belum ada data pesanan selesai.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {metrics.top_products.map((p, idx) => (
                  <div key={p.name} className="py-1.5 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-stone-100 text-[10px] font-bold text-stone-600 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-stone-900">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num font-bold text-emerald-700">{p.qty_sold} terjual</span>
                      <span className="text-[10px] text-stone-400 block font-mono-num">
                        Rp {p.revenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Kartu Status Inventaris */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <p className="text-[10px] text-stone-500 font-bold uppercase">Total Menu</p>
            <p className="text-lg font-black text-stone-900 mt-1">{products.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <p className="text-[10px] text-stone-500 font-bold uppercase">Menu Aktif</p>
            <p className="text-lg font-black text-emerald-700 mt-1">{products.length - soldOutCount}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <p className="text-[10px] text-stone-500 font-bold uppercase">Sold Out</p>
            <p className="text-lg font-black text-rose-700 mt-1">{soldOutCount}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <p className="text-[10px] text-stone-500 font-bold uppercase">Stok Menipis</p>
            <p className="text-lg font-black text-amber-700 mt-1">{lowStockCount}</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-100 border border-rose-300 text-rose-800 text-xs px-3 py-2 rounded" role="status">
            {error}
          </div>
        )}

        {/* Add product form */}
        <form onSubmit={createProduct} className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-xs font-bold text-stone-800 uppercase mb-3">Tambah Menu Baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama menu"
              className="sm:col-span-2 border border-stone-300 rounded px-3 py-2 text-sm touch-target"
              aria-label="Nama menu"
            />
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Harga"
              type="number"
              inputMode="numeric"
              className="border border-stone-300 rounded px-3 py-2 text-sm touch-target"
              aria-label="Harga"
            />
            <input
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="Stok"
              type="number"
              inputMode="numeric"
              className="border border-stone-300 rounded px-3 py-2 text-sm touch-target"
              aria-label="Stok"
            />
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              className="border border-stone-300 rounded px-3 py-2 text-sm touch-target"
              aria-label="Kategori"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold touch-target">
            Simpan Menu
          </button>
        </form>

        {/* Product table */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-xs font-bold text-stone-800 uppercase mb-3">Inventaris Menu</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-600 uppercase border-b border-stone-200">
                <tr>
                  <th className="py-2 px-2">Nama</th>
                  <th className="py-2 px-2">Harga</th>
                  <th className="py-2 px-2">Stok</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) =>
                  editingId === p.id ? (
                    <tr key={p.id} className="bg-amber-50">
                      <td className="py-2 px-2">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full border border-stone-300 rounded px-2 py-1 text-xs"
                          aria-label="Nama menu"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          type="number"
                          inputMode="numeric"
                          className="w-24 border border-stone-300 rounded px-2 py-1 text-xs font-mono-num"
                          aria-label="Harga"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={editForm.stock}
                          onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                          type="number"
                          inputMode="numeric"
                          className="w-16 border border-stone-300 rounded px-2 py-1 text-xs font-mono-num"
                          aria-label="Stok"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={editForm.category_id}
                          onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                          className="border border-stone-300 rounded px-1 py-1 text-xs"
                          aria-label="Kategori"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right space-x-1">
                        <button
                          onClick={() => void saveEdit(p.id)}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold touch-target"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 bg-stone-100 border border-stone-300 rounded font-semibold touch-target"
                        >
                          Batal
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="py-2 px-2 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-2 px-2 font-mono-num">Rp {p.price.toLocaleString('id-ID')}</td>
                      <td className={`py-2 px-2 font-mono-num ${p.stock <= 5 ? 'text-amber-700 font-bold' : ''}`}>
                        {p.stock}
                      </td>
                      <td className="py-2 px-2">
                        {p.is_available ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">Aktif</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold">Habis</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right space-x-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 rounded font-semibold touch-target"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void toggleProduct(p.id)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded font-semibold touch-target"
                        >
                          {p.is_available ? 'Tandai Habis' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => void removeProduct(p.id, p.name)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded font-semibold touch-target"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Kelola Meja Kafe (Tambah & Hapus Meja) */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-xs font-bold text-stone-800 uppercase">Kelola Meja Kafe ({tables.length} Meja)</h2>
              <p className="text-[11px] text-stone-500">Tambah nomor meja baru atau hapus meja yang tidak digunakan.</p>
            </div>
            <button
              onClick={() => navigate('/print-qr')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded text-xs font-bold touch-target"
            >
              Lihat Lembar Cetak QR
            </button>
          </div>

          {/* Form Tambah Meja */}
          <form onSubmit={addTable} className="flex gap-2 max-w-sm mb-4">
            <input
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              placeholder="Nomor meja (misal: 13)"
              type="number"
              inputMode="numeric"
              min="1"
              className="flex-1 border border-stone-300 rounded px-3 py-1.5 text-sm font-mono-num touch-target"
              aria-label="Nomor meja baru"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold touch-target"
            >
              + Tambah Meja
            </button>
          </form>

          {/* Daftar Meja & Tombol Hapus */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className="border border-stone-200 rounded p-2.5 flex flex-col justify-between items-center text-center bg-stone-50"
              >
                <span className="text-xs font-black text-stone-900">Meja {t.table_number}</span>
                <span className={`text-[10px] my-1 px-1.5 py-0.2 rounded font-semibold ${
                  t.status === 'OCCUPIED' ? 'bg-amber-100 text-amber-900' : 'text-stone-500'
                }`}>
                  {t.status === 'OCCUPIED' ? 'Terisi' : 'Kosong'}
                </span>
                <button
                  type="button"
                  onClick={() => void removeTable(t.id, t.table_number)}
                  disabled={t.status === 'OCCUPIED'}
                  className={`w-full mt-1 py-1 text-[10px] font-bold rounded ${
                    t.status === 'OCCUPIED'
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  Hapus Meja
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
