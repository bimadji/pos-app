import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authStorage } from '../../services/api'
import type { Category, Product, StaffAuth } from '../../services/api'

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

  const loadCatalog = useCallback(async (authData: StaffAuth) => {
    const client = api.withAuth(authData.token)
    try {
      const [p, c] = await Promise.all([client.listProducts(), client.listCategories()])
      setProducts(p)
      setCategories(c)
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
        <nav aria-label="Portal" className="flex gap-1 text-xs">
          <button onClick={() => navigate('/cashier')} className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 touch-target">
            Kasir
          </button>
          <button
            onClick={() => {
              authStorage.clear()
              setAuth(null)
            }}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 touch-target"
          >
            Keluar
          </button>
        </nav>
      </header>

      <main className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Metric cards */}
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
                {products.map((p) => (
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
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => void toggleProduct(p.id)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded font-semibold touch-target"
                      >
                        {p.is_available ? 'Tandai Habis' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
