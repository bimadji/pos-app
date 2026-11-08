import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authStorage } from '../../services/api'
import type { Order, TableInfo } from '../../services/api'
import { useSSE } from '../../hooks/useSSE'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Baru Masuk',
  COOKING: 'Sedang Dimasak',
  SERVED: 'Siap Disajikan',
}

/** Selama modal struk terbuka, body diberi penanda untuk CSS @media print */
function usePrintReceiptMode(active: boolean) {
  useEffect(() => {
    if (active) document.body.classList.add('printing-receipt')
    else document.body.classList.remove('printing-receipt')
    return () => document.body.classList.remove('printing-receipt')
  }, [active])
}

export default function CashierDashboard() {
  const navigate = useNavigate()
  const [auth] = useState(() => authStorage.load())
  const [tables, setTables] = useState<TableInfo[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<'split' | 'stream'>('split')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<'CASH' | 'STATIC_QRIS'>('CASH')
  const [payAmount, setPayAmount] = useState('')
  const [lastReceipt, setLastReceipt] = useState<Order | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<{
    method: string
    amount_tendered: number
    change_due: number
    paid_at: string
  } | null>(null)

  // Modal Pindah Meja
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [targetTableNumber, setTargetTableNumber] = useState<number | null>(null)

  usePrintReceiptMode(lastReceipt !== null && paymentInfo !== null)

  const refreshOrders = useCallback(async () => {
    if (!auth) return
    try {
      const client = api.withAuth(auth.token)
      const [t, o] = await Promise.all([client.listTables(), client.listActiveOrders()])
      setTables(t)
      setOrders(o)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [auth])

  useEffect(() => {
    if (!auth) {
      navigate('/admin')
      return
    }
    const client = api.withAuth(auth.token)
    Promise.all([client.listTables(), client.listActiveOrders()])
      .then(([t, o]) => {
        setTables(t)
        setOrders(o)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [navigate, auth])

  useSSE(auth ? api.sseUrl({ staffToken: auth.token }) : null, (ev) => {
    if (ev.event === 'connected' || ev.event === 'ping') return
    if (ev.event.startsWith('order.') || ev.event.startsWith('table.')) {
      void refreshOrders()
    }
  })

  const selected = orders.find((o) => o.id === selectedOrderId) ?? null

  // Total kas hari ini (estimasi dari order completed / info kas)
  const totalCashEstimate = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.grand_total, 0)

  // Pesanan PENDING paling baru untuk live notification banner
  const latestPending = orders.find((o) => o.status === 'PENDING')

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await refreshOrders()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handlePay = async (methodOverride?: 'CASH' | 'STATIC_QRIS') => {
    if (!selected || !auth) return
    const method = methodOverride ?? payMethod
    const tendered = method === 'CASH' ? Number(payAmount) || selected.grand_total : selected.grand_total
    if (method === 'CASH' && tendered < selected.grand_total) {
      setError(`Uang tunai kurang. Total tagihan Rp ${selected.grand_total.toLocaleString('id-ID')}`)
      return
    }

    try {
      const res = await api.withAuth(auth.token).payOrder(selected.id, {
        payment_method: method,
        amount_tendered: tendered,
      })
      setLastReceipt(selected)
      setPaymentInfo({
        method: res.payment_method,
        amount_tendered: res.amount_tendered,
        change_due: res.change_due,
        paid_at: res.paid_at,
      })
      setSelectedOrderId(null)
      setPayAmount('')
      await refreshOrders()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleMoveTable = async () => {
    if (!selected || !targetTableNumber || !auth) return
    try {
      await api.withAuth(auth.token).moveTable(selected.id, targetTableNumber)
      setMoveModalOpen(false)
      setTargetTableNumber(null)
      await refreshOrders()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!auth) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Memuat denah meja & antrean...</p>
      </div>
    )
  }

  const emptyTables = tables.filter((t) => t.status === 'AVAILABLE')
  const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED')
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length
  const cookingOrdersCount = orders.filter((o) => o.status === 'COOKING').length

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* 1. Application Shell Header */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 no-print">
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

          {/* Navigation Mode Tabs */}
          <nav aria-label="Portal Peran" className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
            <button
              onClick={() => {
                if (tables[0]) {
                  window.open(`/t/${tables[0].id}`, '_blank')
                }
              }}
              className="px-3 py-1.5 rounded font-medium text-stone-300 hover:text-white transition touch-target"
            >
              Customer (HP)
            </button>
            <button
              className="px-3 py-1.5 rounded font-bold bg-amber-700 text-white shadow-sm transition touch-target"
            >
              Kasir &amp; Dapur
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="px-3 py-1.5 rounded font-medium text-stone-300 hover:text-white transition touch-target"
            >
              Admin Kafe
            </button>
          </nav>

          {/* Network & Shift Info */}
          <div className="flex items-center gap-4 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" aria-hidden="true"></span>
              <span className="text-stone-300">SSE Aktif</span>
            </div>
            <div className="text-stone-400 border-l border-stone-700 pl-3">
              Shift: <span className="text-stone-200 font-medium">{auth.user.username}</span>
            </div>
            <button
              onClick={() => {
                authStorage.clear()
                navigate('/admin')
              }}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-stone-300 text-xs transition"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Work Surface */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 flex-1 w-full space-y-4 no-print">
        {/* Error notification */}
        {error && (
          <div className="bg-rose-100 border border-rose-300 text-rose-800 text-xs px-4 py-2.5 rounded flex justify-between items-center" role="status">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-2 text-sm">×</button>
          </div>
        )}

        {/* 2. Sub-Header Toolbar Kasir */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 p-4 rounded-lg shadow-sm">
          <div>
            <h2 className="text-base font-bold text-stone-900">Kendali Meja &amp; Antrean Pesanan</h2>
            <p className="text-xs text-stone-600 mt-0.5">Denah meja restoran terhubung langsung ke notifikasi live stream dapur.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-stone-300 bg-stone-50 p-0.5 text-xs" role="group" aria-label="Format Tampilan Kasir">
              <button
                onClick={() => setDisplayMode('split')}
                className={`px-3 py-1.5 rounded transition ${
                  displayMode === 'split'
                    ? 'font-bold bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Denah Meja &amp; Bon
              </button>
              <button
                onClick={() => setDisplayMode('stream')}
                className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
                  displayMode === 'stream'
                    ? 'font-bold bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>Antrean Masak (Stream)</span>
                {orders.length > 0 && (
                  <span className="bg-amber-700 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {orders.length}
                  </span>
                )}
              </button>
             </div>
            <button
              onClick={() => void refreshOrders()}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded border border-stone-300 touch-target flex items-center gap-1.5"
              title="Perbarui data"
            >
              <span>Uang Laci: Rp {totalCashEstimate.toLocaleString('id-ID')}</span>
            </button>
           </div>
         </div>

        {/* 3. Live Stream Notification Banner (Pesanan Baru) */}
        {latestPending && (
          <div className="bg-amber-50 border-l-4 border-amber-700 p-3 rounded-r-md flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-amber-700 text-white font-bold px-2 py-0.5 rounded text-[11px] animate-pulse">PESANAN BARU</span>
              <span className="font-bold text-stone-900">Meja {String(latestPending.table_number_snapshot).padStart(2, '0')}:</span>
              <span className="text-stone-700">
                {latestPending.items.map((i) => `${i.quantity}x ${i.product_name_snapshot}${i.notes ? ` (${i.notes})` : ''}`).join(', ')}
              </span>
              <span className="text-stone-500 font-mono-num">• {latestPending.customer_name}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedOrderId(latestPending.id)
                  setDisplayMode('split')
                }}
                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded touch-target"
              >
                Lihat Bon Meja {String(latestPending.table_number_snapshot).padStart(2, '0')}
              </button>
            </div>
          </div>
        )}

        {/* 4. MODE 1: Denah Meja & Bon (Split Layout) */}
        {displayMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 7 cols: Table Grid */}
            <div className="lg:col-span-7 bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100 text-xs">
                <span className="font-bold text-stone-800">Denah {tables.length} Meja Kafe</span>
                <div className="flex items-center gap-3 text-stone-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-stone-200 border border-stone-300"></span> Kosong ({emptyTables.length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400"></span> Makan ({occupiedTables.length})
                  </span>
                  {pendingOrdersCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400"></span> Baru ({pendingOrdersCount})
                    </span>
                  )}
                  {cookingOrdersCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-sky-100 border border-sky-400"></span> Dimasak ({cookingOrdersCount})
                    </span>
                  )}
                </div>
              </div>

              {/* Table Tiles Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" role="region" aria-label="Daftar Meja">
                {tables.map((t) => {
                  const order = orders.find((o) => o.table_number_snapshot === t.table_number)
                  const isSelected = selected && selected.id === order?.id
                  const isNew = order?.status === 'PENDING'
                  const isCooking = order?.status === 'COOKING'

                  if (!order) {
                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded border border-stone-200 bg-stone-50 text-left flex flex-col justify-between h-24 opacity-60"
                      >
                        <span className="font-semibold text-stone-500 text-xs">
                          Meja {String(t.table_number).padStart(2, '0')}
                        </span>
                        <span className="text-xs text-stone-400 text-center">Kosong</span>
                        <span className="text-[10px] text-stone-400">-</span>
                      </div>
                    )
                  }

                  if (isSelected) {
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="p-3 rounded border-2 border-stone-900 bg-white text-left transition flex flex-col justify-between h-24 shadow-sm touch-target relative"
                      >
                        <div className="flex justify-between w-full">
                          <span className="font-bold text-stone-950 text-xs">
                            Meja {String(t.table_number).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] bg-stone-900 text-white font-bold px-1.5 py-0.2 rounded">
                            Dipilih
                          </span>
                        </div>
                        <div>
                          <div className="text-[11px] text-stone-600">{order.items.length} Menu</div>
                          <div className="text-xs font-bold text-stone-950 font-mono-num">
                            Rp {order.grand_total.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-800 font-semibold">
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`p-3 rounded text-left transition flex flex-col justify-between h-24 touch-target ${
                        isNew
                          ? 'border border-amber-300 bg-amber-50/70 hover:bg-amber-100'
                          : isCooking
                            ? 'border border-sky-300 bg-sky-50 hover:bg-sky-100'
                            : 'border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100'
                      }`}
                    >
                      <div className="flex justify-between w-full">
                        <span className="font-bold text-stone-900 text-xs">
                          Meja {String(t.table_number).padStart(2, '0')}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full mt-1 ${
                            isNew ? 'bg-amber-600' : isCooking ? 'bg-sky-600' : 'bg-emerald-600'
                          }`}
                          title={STATUS_LABEL[order.status] ?? order.status}
                        ></span>
                      </div>
                      <div>
                        <div className="text-[11px] text-stone-600">{order.items.length} Menu</div>
                        <div className="text-xs font-bold text-stone-900 font-mono-num">
                          Rp {order.grand_total.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-medium ${
                          isNew ? 'text-amber-900' : isCooking ? 'text-sky-800' : 'text-emerald-800'
                        }`}
                      >
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quick Action Buttons */}
              <div className="pt-3 border-t border-stone-200 grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!selected) {
                      setError('Pilih meja terisi terlebih dahulu untuk memindahkan meja.')
                      return
                    }
                    setMoveModalOpen(true)
                  }}
                  className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded border border-stone-300 touch-target"
                >
                  Pindah Meja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selected) {
                      setError('Pilih meja terlebih dahulu untuk membatalkan (void).')
                      return
                    }
                    const reason = window.prompt(`Alasan pembatalan (void) pesanan Meja ${selected.table_number_snapshot}:`)
                    if (reason && reason.trim().length >= 3) {
                      void act(() => api.withAuth(auth.token).cancelOrder(selected.id, reason.trim()))
                    }
                  }}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold rounded border border-rose-300 touch-target"
                >
                  Batalkan (Void)
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded border border-stone-300 touch-target"
                >
                  Menu Habis
                </button>
              </div>
            </div>

            {/* Right 5 cols: Active Bill Panel */}
            <div className="lg:col-span-5 bg-white border border-stone-200 rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-4">
              {!selected ? (
                <div className="py-16 text-center text-stone-400 space-y-2">
                  <p className="text-sm font-semibold text-stone-600">Pilih Meja di Sebelah Kiri</p>
                  <p className="text-xs">Klik salah satu meja yang memiliki pesanan untuk melihat bon dan memproses pembayaran.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-start pb-3 border-b border-stone-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-white font-bold text-xs px-2 py-0.5 rounded">
                          MEJA {String(selected.table_number_snapshot).padStart(2, '0')}
                        </span>
                        <h3 className="text-sm font-bold text-stone-900">Rincian Tagihan</h3>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Atas Nama: <span className="font-semibold text-stone-800">{selected.customer_name}</span> • Status:{' '}
                        <span className="font-medium text-amber-800">{STATUS_LABEL[selected.status] ?? selected.status}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLastReceipt(selected)
                        setPaymentInfo({
                          method: 'BELUM BAYAR (PREVIEW)',
                          amount_tendered: selected.grand_total,
                          change_due: 0,
                          paid_at: new Date().toISOString(),
                        })
                      }}
                      className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 px-2.5 py-1.5 rounded touch-target font-medium"
                      aria-label="Cetak Struk Sementara"
                    >
                      Cetak Bon
                    </button>
                  </div>

                  {/* Multi-round items breakdown */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 pr-1 text-xs">
                    {selected.items.map((item) => (
                      <div key={item.id} className="py-2 flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-stone-900">
                            {item.quantity}x {item.product_name_snapshot}
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-amber-800 italic mt-0.5">
                              &quot;{item.notes}&quot;
                            </div>
                          )}
                          <div className="text-[10px] text-stone-400 mt-0.5">Babak {item.round_number}</div>
                        </div>
                        <span className="font-mono-num font-semibold text-stone-900">
                          {item.subtotal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal, Tax, Total */}
                  <div className="border-t border-stone-200 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span className="font-mono-num">{selected.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Service (5%)</span>
                      <span className="font-mono-num">{selected.service_amount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Pajak PB1 (10%)</span>
                      <span className="font-mono-num">{selected.tax_amount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-dashed border-stone-300">
                      <span>TOTAL</span>
                      <span className="font-mono-num text-amber-900 text-base">
                        Rp {selected.grand_total.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Status Dapur Quick Step */}
                  <div className="flex gap-2 pt-1 text-xs">
                    {selected.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(selected.id, 'COOKING'))}
                        className="flex-1 py-2 bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 rounded font-bold touch-target"
                      >
                        Mulai Masak
                      </button>
                    )}
                    {selected.status === 'COOKING' && (
                      <button
                        type="button"
                        onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(selected.id, 'SERVED'))}
                        className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 rounded font-bold touch-target"
                      >
                        Siap Saji
                      </button>
                    )}
                  </div>

                  {/* Payment section */}
                  <div className="space-y-2 pt-2 border-t border-stone-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPayMethod('CASH')}
                        className={`py-2 rounded font-bold border touch-target ${
                          payMethod === 'CASH'
                            ? 'bg-amber-700 text-white border-amber-800'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                        }`}
                      >
                        Tunai
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMethod('STATIC_QRIS')}
                        className={`py-2 rounded font-bold border touch-target ${
                          payMethod === 'STATIC_QRIS'
                            ? 'bg-amber-700 text-white border-amber-800'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                        }`}
                      >
                        QRIS Kasir
                      </button>
                    </div>

                    {payMethod === 'CASH' && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase">Uang Diterima:</label>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder={`Min Rp ${selected.grand_total.toLocaleString('id-ID')}`}
                          className="w-full border border-stone-300 rounded px-3 py-1.5 text-xs font-mono-num"
                        />
                        <div className="flex gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setPayAmount(String(selected.grand_total))}
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300"
                          >
                            Uang Pas
                          </button>
                          {[50000, 100000, 200000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setPayAmount(String(amt))}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono-num"
                            >
                              {amt / 1000}k
                            </button>
                          ))}
                        </div>
                        {Number(payAmount) > selected.grand_total && (
                          <p className="text-xs font-bold text-emerald-700 pt-0.5">
                            Kembalian: Rp {(Number(payAmount) - selected.grand_total).toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void handlePay()}
                      className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded shadow-sm transition touch-target mt-2"
                    >
                      Selesaikan Transaksi &amp; Tutup Meja
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. MODE 2: Antrean Masak (Stream Layout) */}
        {displayMode === 'stream' && (
          <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-stone-200 gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Antrean Pesanan Masuk (Urutan Waktu Detik)</h3>
                <p className="text-xs text-stone-500">Gunakan layar ini di area barista/dapur untuk memproses tiket pesanan.</p>
              </div>
              <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                {orders.length} Pesanan Aktif
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="py-16 text-center text-stone-400 space-y-1">
                <p className="text-sm font-bold text-stone-600">Dapur Bersih! Tidak Ada Antrean Aktif</p>
                <p className="text-xs">Pesanan baru yang dikirim oleh pelanggan meja akan otomatis muncul di sini via SSE.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-700 uppercase border-b border-stone-200">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Jam</th>
                      <th scope="col" className="py-2.5 px-3">Meja</th>
                      <th scope="col" className="py-2.5 px-3">Pelanggan</th>
                      <th scope="col" className="py-2.5 px-3">Rincian Menu</th>
                      <th scope="col" className="py-2.5 px-3">Total</th>
                      <th scope="col" className="py-2.5 px-3">Status</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Aksi Dapur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-stone-900">
                    {orders.map((ord) => {
                      const timeStr = ord.created_at ? new Date(ord.created_at).toLocaleTimeString('id-ID') : '-'
                      const isPending = ord.status === 'PENDING'
                      const isCooking = ord.status === 'COOKING'

                      return (
                        <tr key={ord.id} className="hover:bg-stone-50 transition">
                          <td className="py-3 px-3 font-mono-num text-stone-600 whitespace-nowrap">
                            {timeStr}
                          </td>
                          <td className="py-3 px-3 font-bold text-stone-900 whitespace-nowrap">
                            Meja {String(ord.table_number_snapshot).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-3 font-medium text-stone-800 whitespace-nowrap">
                            {ord.customer_name}
                          </td>
                          <td className="py-3 px-3 min-w-[240px]">
                            {ord.items.map((item) => (
                              <div key={item.id} className="mb-1">
                                <span className="font-bold text-stone-900">{item.quantity}x</span>{' '}
                                <span className="text-stone-800">{item.product_name_snapshot}</span>
                                {item.notes && (
                                  <span className="ml-1 text-[11px] text-amber-800 italic bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Catatan: {item.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-3 font-mono-num font-semibold whitespace-nowrap">
                            Rp {ord.grand_total.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                                isPending
                                  ? 'bg-amber-100 text-amber-900'
                                  : isCooking
                                    ? 'bg-sky-100 text-sky-900'
                                    : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {STATUS_LABEL[ord.status] ?? ord.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(ord.id, 'COOKING'))}
                                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold touch-target shadow-sm"
                                >
                                  Mulai Masak
                                </button>
                              )}
                              {isCooking && (
                                <button
                                  type="button"
                                  onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(ord.id, 'SERVED'))}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold touch-target shadow-sm"
                                >
                                  Siap Saji
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderId(ord.id)
                                  setDisplayMode('split')
                                }}
                                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded text-xs font-semibold touch-target"
                              >
                                Bon
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 6. Modal Dialog Pindah Meja */}
      {moveModalOpen && selected && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50 no-print" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-stone-900">Pindah Meja Pesanan</h3>
            <p className="text-xs text-stone-600">
              Pindahkan bon aktif Meja {selected.table_number_snapshot} ({selected.customer_name}) ke meja yang kosong:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {emptyTables.length === 0 ? (
                <p className="text-xs text-rose-700">Tidak ada meja kosong yang tersedia saat ini.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {emptyTables.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetTableNumber(t.table_number)}
                      className={`py-2 px-3 text-xs font-bold rounded border touch-target ${
                        targetTableNumber === t.table_number
                          ? 'bg-amber-700 text-white border-amber-800'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                      }`}
                    >
                      Meja {t.table_number}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setMoveModalOpen(false)
                  setTargetTableNumber(null)
                }}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-semibold border border-stone-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!targetTableNumber}
                onClick={() => void handleMoveTable()}
                className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded text-xs font-bold"
              >
                Pindahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Preview & Print Struk Pembayaran */}
      {lastReceipt && paymentInfo && (
        <div
          className="receipt-backdrop fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Preview struk pembayaran"
        >
          <div className="receipt-modal-box bg-white rounded-lg shadow-xl w-full max-w-xs max-h-[90vh] overflow-y-auto">
            <div className="receipt-print-area p-4 text-[10.5px] font-mono-num text-stone-900 leading-tight">
              <p className="text-center font-bold text-sm tracking-tight">KAFE SENJA KOPI</p>
              <p className="text-center text-[10px] text-stone-500">Jl. Contoh No. 123, Kota</p>
              <p className="text-center text-stone-400 my-1">--------------------------------</p>
              <div className="space-y-0.5">
                <p>Meja      : {lastReceipt.table_number_snapshot}</p>
                <p>Pelanggan : {lastReceipt.customer_name}</p>
                <p>Waktu     : {new Date(paymentInfo.paid_at).toLocaleString('id-ID')}</p>
              </div>
              <p className="text-center text-stone-400 my-1">--------------------------------</p>
              <div className="space-y-1">
                {lastReceipt.items.map((i) => (
                  <div key={i.id}>
                    <p className="font-semibold">
                      {i.quantity}x {i.product_name_snapshot}
                    </p>
                    {i.notes && <p className="italic text-stone-600 pl-2">&quot;{i.notes}&quot;</p>}
                    <p className="text-right font-mono-num">{i.subtotal.toLocaleString('id-ID')}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-stone-400 my-1">--------------------------------</p>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{lastReceipt.subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service</span>
                  <span>{lastReceipt.service_amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak PB1</span>
                  <span>{lastReceipt.tax_amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-stone-400 mt-1 pt-1 text-xs">
                  <span>TOTAL</span>
                  <span>Rp {lastReceipt.grand_total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span>Metode</span>
                  <span>{paymentInfo.method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bayar</span>
                  <span>{paymentInfo.amount_tendered.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembali</span>
                  <span>{paymentInfo.change_due.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="mt-2 text-center">
                <span className="inline-block border-2 border-stone-900 font-bold px-3 py-0.5 text-xs">
                  LUNAS
                </span>
                <p className="text-[10px] text-stone-600 mt-1.5">Terima kasih atas kunjungan Anda</p>
              </div>
            </div>
            <div className="flex gap-2 p-3 border-t border-stone-200 no-print">
              <button
                type="button"
                onClick={() => {
                  setLastReceipt(null)
                  setPaymentInfo(null)
                }}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs font-semibold touch-target"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold touch-target shadow"
              >
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
