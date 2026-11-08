import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSSE } from '../../hooks/useSSE'
import { api, authStorage } from '../../services/api'
import type { Category, Product, StaffAuth, TableInfo, ShiftHistoryItem } from '../../services/api'
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState<StaffAuth | null>(() => authStorage.load())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
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
    monthly_sales: Array<{ month: string; total: number; orders_count: number }>
  } | null>(null)
  const [filterPreset, setFilterPreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [newTableNumber, setNewTableNumber] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: '', stock: '', category_id: '' })
  const [shiftsHistory, setShiftsHistory] = useState<ShiftHistoryItem[]>([])

  const loadCatalog = useCallback(async (authData: StaffAuth, filterParams?: { start_date?: string; end_date?: string }) => {
    const client = api.withAuth(authData.token)
    try {
      const [p, c, t, m, s] = await Promise.all([
        client.listProducts(),
        client.listCategories(),
        client.listTables(),
        client.getDailyMetrics(filterParams),
        client.getShiftsHistory(30),
      ])
      setProducts(p)
      setCategories(c)
      setTables(t)
      setMetrics(m)
      setShiftsHistory(s)
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

  // Realtime updates dari SSE (order update, shift opened, shift closed)
  const sseUrl = auth?.token ? api.sseUrl({ staffToken: auth.token }) : null
  useSSE(
    sseUrl,
    useCallback(
      (ev) => {
        if (
          ev.event === 'shift.closed' ||
          ev.event === 'shift.opened' ||
          ev.event === 'order.completed' ||
          ev.event === 'order.created'
        ) {
          if (auth) void loadCatalog(auth)
        }
      },
      [auth, loadCatalog],
    ),
  )

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
      setShowAddProductModal(false)
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

  const downloadCSVReport = () => {
    if (!metrics) return
    const rows = [
      ['Laporan Penjualan Kafe Senja Kopi'],
      ['Tanggal Unduh', new Date().toLocaleString('id-ID')],
      ['Rentang', filterPreset === 'all' ? 'Semua Waktu' : filterPreset],
      ['Total Omzet', metrics.total_sales],
      ['Transaksi Selesai', metrics.completed_orders],
      ['Kas Tunai', metrics.cash_total],
      ['QRIS Kasir', metrics.qris_total],
      [],
      ['Top Produk Terlaris'],
      ['Nama Menu', 'Jumlah Terjual', 'Pendapatan'],
      ...metrics.top_products.map((p) => [p.name, p.qty_sold, p.revenue]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `laporan_penjualan_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ---------- LOGIN VIEW ----------
  if (!auth) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white border border-stone-200 rounded-lg p-6 w-full max-w-sm shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-amber-700 text-stone-100 font-bold rounded flex items-center justify-center text-sm">
              KS
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Kafe Senja Kopi</h1>
              <p className="text-xs text-stone-500">Portal Masuk Staf &amp; Pemilik</p>
            </div>
          </div>

          <label htmlFor="username" className="text-[10px] font-bold text-stone-600 block mt-2 mb-1">
            USERNAME
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm touch-target"
            placeholder="Username staf"
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
            placeholder="Kata sandi"
          />

          {loginError && <p className="text-rose-700 text-xs mt-2 bg-rose-50 p-2 rounded border border-rose-200">{loginError}</p>}

          <button type="submit" className="w-full mt-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-sm font-bold touch-target shadow-sm transition">
            Masuk ke Sistem
          </button>
          <p className="text-[10px] text-stone-400 mt-3 text-center">
            Akun admin: admin_senja / AdminPass123!
          </p>
        </form>
      </div>
    )
  }

  const lowStockProducts = products.filter((p) => p.is_available && p.stock <= 5)

  // ---------- DASHBOARD VIEW (100% Mockup V3 Alignment) ----------
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* 1. Application Shell Header */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-700 text-stone-100 font-bold rounded flex items-center justify-center text-sm">
              KS
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Kafe Senja Kopi</h1>
              <p className="text-xs text-stone-400">Sistem Operasional Dine-In Meja</p>
            </div>
          </div>

          {/* Navigation & Mode Tabs */}
          <nav aria-label="Portal Peran" className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
            <button
              onClick={() => navigate('/cashier')}
              className="px-3 py-1.5 rounded font-medium text-stone-300 hover:text-white transition touch-target"
            >
              Kasir &amp; Dapur
            </button>
            <button
              className="px-3 py-1.5 rounded font-bold bg-amber-700 text-white shadow-sm transition touch-target"
            >
              Admin Kafe
            </button>
          </nav>

          {/* User & Shift Info */}
          <div className="flex items-center gap-3 text-xs text-stone-300">
            <span className="text-stone-400">
              Admin: <span className="text-stone-200 font-medium">{auth.user.username}</span>
            </span>
            <button
              onClick={() => {
                authStorage.clear()
                setAuth(null)
              }}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-stone-300 text-xs transition"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Work Surface */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 flex-1 w-full space-y-4">
        {/* Error notification */}
        {error && (
          <div className="bg-rose-100 border border-rose-300 text-rose-800 text-xs px-4 py-2.5 rounded flex justify-between items-center" role="status">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-2 text-sm">×</button>
          </div>
        )}

        {/* 2. Sub-Header Toolbar Admin (Sesuai Mockup V3 baris 485-498) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-stone-200 p-4 rounded-lg shadow-sm">
          <div>
            <h2 className="text-base font-bold text-stone-900">Portal Pemilik &amp; Pengelolaan Menu</h2>
            <p className="text-xs text-stone-600 mt-0.5">Pantau ringkasan omzet kasir harian dan kendali stok bahan baku.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCSVReport}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded border border-stone-300 touch-target"
            >
              Unduh CSV
            </button>
            <button
              type="button"
              onClick={() => navigate('/print-qr')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded border border-stone-300 touch-target"
            >
              Cetak QR Meja
            </button>
            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded touch-target shadow-sm transition"
            >
              + Tambah Menu
            </button>
          </div>
        </div>

        {/* 3. Filter Rentang Waktu */}
        <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm flex flex-wrap gap-2 items-center justify-between text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-stone-700 uppercase mr-1">Filter Waktu:</span>
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari Terakhir' },
              { id: '30days', label: '30 Hari Terakhir' },
              { id: 'custom', label: 'Kustom Tanggal' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  const preset = f.id as typeof filterPreset
                  setFilterPreset(preset)
                  if (!auth) return
                  const todayStr = new Date().toISOString().slice(0, 10)
                  if (preset === 'all') {
                    setStartDate('')
                    setEndDate('')
                    void loadCatalog(auth)
                  } else if (preset === 'today') {
                    setStartDate(todayStr)
                    setEndDate(todayStr)
                    void loadCatalog(auth, { start_date: todayStr, end_date: todayStr })
                  } else if (preset === '7days') {
                    const d = new Date()
                    d.setDate(d.getDate() - 7)
                    const s = d.toISOString().slice(0, 10)
                    setStartDate(s)
                    setEndDate(todayStr)
                    void loadCatalog(auth, { start_date: s, end_date: todayStr })
                  } else if (preset === '30days') {
                    const d = new Date()
                    d.setDate(d.getDate() - 30)
                    const s = d.toISOString().slice(0, 10)
                    setStartDate(s)
                    setEndDate(todayStr)
                    void loadCatalog(auth, { start_date: s, end_date: todayStr })
                  }
                }}
                className={`px-3 py-1 rounded font-semibold transition ${
                  filterPreset === f.id
                    ? 'bg-amber-800 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filterPreset === 'custom' && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-xs text-stone-800"
                aria-label="Tanggal mulai"
              />
              <span className="text-stone-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-xs text-stone-800"
                aria-label="Tanggal akhir"
              />
              <button
                type="button"
                onClick={() => {
                  if (auth && startDate && endDate) {
                    void loadCatalog(auth, { start_date: startDate, end_date: endDate })
                  }
                }}
                className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded"
              >
                Terapkan
              </button>
            </div>
          )}
        </div>

        {/* 4. Financial Metric Cards (Sesuai Mockup V3 baris 500-522) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-stone-200 p-3.5 rounded-lg shadow-sm">
            <div className="text-xs text-stone-600 font-medium">Omzet Penjualan</div>
            <div className="text-lg font-bold font-mono-num text-stone-900 mt-1">
              Rp {(metrics?.total_sales ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              {metrics?.completed_orders ?? 0} Transaksi selesai
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-3.5 rounded-lg shadow-sm">
            <div className="text-xs text-stone-600 font-medium">Pembayaran Tunai</div>
            <div className="text-lg font-bold font-mono-num text-stone-900 mt-1">
              Rp {(metrics?.cash_total ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">Uang fisik di kasir</div>
          </div>

          <div className="bg-white border border-stone-200 p-3.5 rounded-lg shadow-sm">
            <div className="text-xs text-stone-600 font-medium">Pembayaran QRIS Kasir</div>
            <div className="text-lg font-bold font-mono-num text-stone-900 mt-1">
              Rp {(metrics?.qris_total ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">Rekening penampungan</div>
          </div>

          <div className="bg-white border border-amber-300 bg-amber-50/40 p-3.5 rounded-lg shadow-sm">
            <div className="text-xs text-amber-900 font-medium">Peringatan Stok Menipis</div>
            <div className="text-lg font-bold font-mono-num text-amber-900 mt-1">
              {lowStockProducts.length} Menu
            </div>
            <div className="text-[11px] text-amber-800 mt-0.5 truncate" title={lowStockProducts.map((p) => `${p.name} (${p.stock})`).join(', ')}>
              {lowStockProducts.length === 0
                ? 'Semua stok aman'
                : lowStockProducts.map((p) => `${p.name} (${p.stock})`).slice(0, 2).join(', ')}
            </div>
          </div>
        </div>
        {/* 6. Top Produk & Tren Penjualan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tren 7 Hari */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
              Tren Penjualan 7 Hari Terakhir
            </h3>
            {(!metrics?.weekly_sales || metrics.weekly_sales.length === 0) ? (
              <p className="text-xs text-stone-400 py-6 text-center">Belum ada transaksi completed minggu ini.</p>
            ) : (
              <div className="space-y-2">
                {metrics.weekly_sales.map((w) => (
                  <div key={w.date} className="flex justify-between items-center text-xs py-1 border-b border-stone-100">
                    <span className="font-mono-num text-stone-700">{w.date} ({w.orders_count} bon)</span>
                    <span className="font-mono-num font-bold text-amber-900">
                      Rp {w.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menu Terlaris */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
              Menu Paling Sering Dipesan
            </h3>
            {(!metrics?.top_products || metrics.top_products.length === 0) ? (
              <p className="text-xs text-stone-400 py-6 text-center">Belum ada data penjualan menu.</p>
            ) : (
              <div className="space-y-2">
                {metrics.top_products.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-xs py-1 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-stone-800">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-stone-700">{item.qty_sold} terjual</span>
                      <span className="font-mono-num text-stone-500 ml-2">Rp {item.revenue.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7. Rekapitulasi Bulanan */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
            Rekapitulasi Penjualan Bulanan (12 Bulan Terakhir)
          </h3>
          {(!metrics?.monthly_sales || metrics.monthly_sales.length === 0) ? (
            <p className="text-xs text-stone-400 py-4 text-center">Belum ada rekap bulanan.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {metrics.monthly_sales.map((m) => (
                <div key={m.month} className="border border-stone-200 rounded p-2.5 bg-stone-50 text-center">
                  <p className="text-[11px] font-bold text-stone-700 font-mono-num">{m.month}</p>
                  <p className="text-xs font-black font-mono-num text-amber-900 mt-1">
                    Rp {m.total.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-0.5">{m.orders_count} transaksi</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. Audit & Riwayat Shift Kasir */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-stone-200 gap-1">
            <div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Audit &amp; Riwayat Shift Kasir
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Pantau omzet tiap kasir, metode pembayaran, dan akuntabilitas uang fisik laci
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (auth) void loadCatalog(auth)
              }}
              className="text-xs text-amber-800 hover:text-amber-900 font-semibold self-start sm:self-auto touch-target"
            >
              ↻ Refresh Riwayat
            </button>
          </div>

          {shiftsHistory.length === 0 ? (
            <p className="text-xs text-stone-400 py-6 text-center">Belum ada riwayat shift kasir tercatat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Waktu Buka / Tutup</th>
                    <th className="py-2.5 px-3">Kasir</th>
                    <th className="py-2.5 px-3 text-right">Modal Awal</th>
                    <th className="py-2.5 px-3 text-right">Penjualan Tunai</th>
                    <th className="py-2.5 px-3 text-right">Penjualan QRIS</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet</th>
                    <th className="py-2.5 px-3 text-right">Fisik Laci</th>
                    <th className="py-2.5 px-3 text-right">Selisih Kas</th>
                    <th className="py-2.5 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {shiftsHistory.map((s) => {
                    const openTimeStr = new Date(s.opened_at).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const closeTimeStr = s.closed_at
                      ? new Date(s.closed_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Sedang Berjalan'

                    return (
                      <tr key={s.id} className="hover:bg-stone-50 transition">
                        <td className="py-3 px-3 whitespace-nowrap">
                          {s.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                              Selesai
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-stone-700 font-mono-num">
                          <div>{openTimeStr}</div>
                          <div className="text-[10px] text-stone-400">s.d. {closeTimeStr}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-stone-900 whitespace-nowrap">
                          {s.cashier_name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num text-stone-700 whitespace-nowrap">
                          Rp {s.starting_cash.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num text-emerald-800 font-semibold whitespace-nowrap">
                          Rp {s.cash_sales.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num text-sky-800 font-semibold whitespace-nowrap">
                          Rp {s.qris_sales.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-bold text-stone-900 whitespace-nowrap">
                          Rp {s.total_sales.toLocaleString('id-ID')}
                          <div className="text-[10px] font-normal text-stone-400">
                            {s.total_transactions} transaksi
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-semibold text-stone-800 whitespace-nowrap">
                          {s.actual_cash !== null ? `Rp ${s.actual_cash.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num whitespace-nowrap">
                          {s.cash_difference === null ? (
                            <span className="text-stone-400">-</span>
                          ) : s.cash_difference === 0 ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Cocok (Rp 0)
                            </span>
                          ) : s.cash_difference > 0 ? (
                            <span className="text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              +Rp {s.cash_difference.toLocaleString('id-ID')}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              -Rp {Math.abs(s.cash_difference).toLocaleString('id-ID')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-stone-600 max-w-[200px] truncate" title={s.notes ?? ''}>
                          {s.notes || <span className="text-stone-300">-</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* 5. Inventaris & Saklar Ketersediaan Menu (Sesuai Mockup V3 baris 525-578) */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-stone-200 gap-1">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Inventaris &amp; Saklar Ketersediaan Menu
            </h3>
            <span className="text-xs text-stone-500">Perubahan langsung berlaku di web pemesanan meja</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase border-b border-stone-200">
                <tr>
                  <th scope="col" className="py-2.5 px-3">Nama Produk</th>
                  <th scope="col" className="py-2.5 px-3">Kategori</th>
                  <th scope="col" className="py-2.5 px-3">Harga</th>
                  <th scope="col" className="py-2.5 px-3">Sisa Stok</th>
                  <th scope="col" className="py-2.5 px-3">Status Jual</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-900">
                {products.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id)?.name ?? '-'
                  const isLow = p.is_available && p.stock > 0 && p.stock <= 5
                  const isSoldOut = !p.is_available || p.stock === 0

                  if (editingId === p.id) {
                    return (
                      <tr key={p.id} className="bg-amber-50">
                        <td className="py-2.5 px-3">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full border border-stone-300 rounded px-2 py-1 text-xs"
                            aria-label="Nama menu"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={editForm.category_id}
                            onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                            className="border border-stone-300 rounded px-2 py-1 text-xs"
                            aria-label="Kategori"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                            type="number"
                            inputMode="numeric"
                            className="w-24 border border-stone-300 rounded px-2 py-1 text-xs font-mono-num"
                            aria-label="Harga"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            value={editForm.stock}
                            onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                            type="number"
                            inputMode="numeric"
                            className="w-16 border border-stone-300 rounded px-2 py-1 text-xs font-mono-num"
                            aria-label="Stok"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-stone-400 italic">Mengedit...</td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void saveEdit(p.id)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 bg-stone-100 border border-stone-300 rounded font-semibold text-stone-700"
                          >
                            Batal
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={p.id} className={isSoldOut ? 'opacity-60 bg-stone-50' : 'hover:bg-stone-50'}>
                      <td className="py-2.5 px-3 font-semibold text-stone-900">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600">
                        {cat}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num">
                        {p.price.toLocaleString('id-ID')}
                      </td>
                      <td className={`py-2.5 px-3 font-mono-num ${isLow ? 'text-amber-800 font-bold' : ''}`}>
                        {p.stock}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.is_available && p.stock > 5 ? (
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-medium text-[11px]">
                            Aktif
                          </span>
                        ) : isLow ? (
                          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-medium text-[11px]">
                            Menipis
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-medium text-[11px]">
                            Habis
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void toggleProduct(p.id)}
                          className={`px-2.5 py-1 rounded font-medium text-stone-800 touch-target border ${
                            p.is_available
                              ? 'bg-stone-100 hover:bg-stone-200 border-stone-300'
                              : 'bg-stone-200 hover:bg-stone-300 border-stone-300'
                          }`}
                        >
                          {p.is_available ? 'Tandai Habis' : 'Aktifkan Kembali'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded font-semibold text-stone-800 touch-target"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeProduct(p.id, p.name)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded font-semibold touch-target"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. Kelola Meja Kafe */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-stone-200">
            <div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Kelola Meja Kafe ({tables.length} Meja)
              </h3>
              <p className="text-xs text-stone-500">Tambah nomor meja baru atau hapus meja yang tidak digunakan.</p>
            </div>
            <button
              onClick={() => navigate('/print-qr')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded text-xs font-semibold touch-target"
            >
              Lihat Lembar Cetak QR
            </button>
          </div>

          <form onSubmit={addTable} className="flex gap-2 max-w-sm">
            <input
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              placeholder="Nomor meja (misal: 13)"
              type="number"
              inputMode="numeric"
              min="1"
              className="flex-1 border border-stone-300 rounded px-3 py-1.5 text-xs font-mono-num touch-target"
              aria-label="Nomor meja baru"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold touch-target"
            >
              + Tambah Meja
            </button>
          </form>

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

      {/* Modal Tambah Menu Baru */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">Tambah Menu Baru</h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-stone-400 hover:text-stone-600 font-bold text-sm">✕</button>
            </div>

            <form onSubmit={createProduct} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Nama Menu</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Misal: Kopi Susu Aren"
                  className="w-full border border-stone-300 rounded px-3 py-2 text-xs touch-target"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Harga (Rp)</label>
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="22000"
                    type="number"
                    inputMode="numeric"
                    className="w-full border border-stone-300 rounded px-3 py-2 text-xs font-mono-num touch-target"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Stok Awal</label>
                  <input
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="50"
                    type="number"
                    inputMode="numeric"
                    className="w-full border border-stone-300 rounded px-3 py-2 text-xs font-mono-num touch-target"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Kategori</label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full border border-stone-300 rounded px-3 py-2 text-xs touch-target"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs font-semibold text-stone-700 touch-target"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold touch-target shadow"
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
