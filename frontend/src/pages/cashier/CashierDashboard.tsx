import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authStorage } from '../../services/api'
import type { Order, TableInfo } from '../../services/api'
import { useSSE } from '../../hooks/useSSE'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Baru Masuk',
  COOKING: 'Dimasak',
  SERVED: 'Tersaji',
}

export default function CashierDashboard() {
  const navigate = useNavigate()
  const auth = authStorage.load()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [lastReceipt, setLastReceipt] = useState<Order | null>(null)

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

  useSSE(auth ? api.sseUrl({}) : null, (ev) => {
    // Any order/table event: simply re-pull active state (small data, 1 cafe)
    if (ev.event.startsWith('order.') || ev.event.startsWith('table.')) {
      void refreshOrders()
    }
  })

  const selected = orders.find((o) => o.id === selectedOrderId) ?? null

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await refreshOrders()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!auth) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Memuat denah meja...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-stone-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-bold">Kasir Kafe Senja - {auth.user.username}</h1>
          <p className="text-[10px] text-stone-400">Denah meja & live order stream</p>
        </div>
        <nav aria-label="Portal" className="flex gap-1 text-xs">
          <span className="px-2 py-1 rounded bg-amber-700 font-bold">Kasir</span>
          <button onClick={() => navigate('/admin')} className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 touch-target">
            Admin
          </button>
          <button
            onClick={() => {
              authStorage.clear()
              navigate('/admin')
            }}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 touch-target"
          >
            Keluar
          </button>
        </nav>
      </header>

      {error && (
        <div className="mx-4 mt-3 bg-rose-100 border border-rose-300 text-rose-800 text-xs px-3 py-2 rounded" role="status">
          {error}
        </div>
      )}

      <main className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: table grid */}
        <section className="lg:col-span-7 bg-white border border-stone-200 rounded-lg p-4" aria-label="Denah meja">
          <h2 className="text-xs font-bold text-stone-800 uppercase mb-3">
            Denah Meja ({tables.filter((t) => t.status === 'OCCUPIED').length} terisi / {tables.length})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {tables.map((t) => {
              const order = orders.find((o) => o.table_number_snapshot === t.table_number)
              const isNew = order?.status === 'PENDING'
              const cooking = order?.status === 'COOKING'
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedOrderId(order?.id ?? null)}
                  className={`p-3 h-24 rounded border text-left flex flex-col justify-between touch-target ${
                    selectedOrderId && order?.id === selectedOrderId
                      ? 'border-2 border-stone-900 bg-white'
                      : order
                        ? isNew
                          ? 'border-sky-400 bg-sky-50'
                          : cooking
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-emerald-400 bg-emerald-50'
                        : 'border-stone-200 bg-stone-50 opacity-60'
                  }`}
                >
                  <span className="text-xs font-bold text-stone-900">Meja {t.table_number}</span>
                  {order ? (
                    <>
                      <span className="text-[10px] text-stone-600">{order.items.length} item</span>
                      <span className="text-[10px] font-bold font-mono-num">
                        Rp {order.grand_total.toLocaleString('id-ID')}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-stone-400">Kosong</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* RIGHT: billing panel */}
        <section className="lg:col-span-5 bg-white border border-stone-200 rounded-lg p-4" aria-label="Panel tagihan">
          {!selected && (
            <p className="text-stone-500 text-xs text-center py-10">
              Pilih meja di kiri untuk melihat bon aktifnya.
            </p>
          )}
          {selected && (
            <>
              <div className="flex justify-between items-start border-b border-stone-200 pb-2">
                <div>
                  <h2 className="text-sm font-bold">Meja {selected.table_number_snapshot}</h2>
                  <p className="text-[11px] text-stone-500">
                    {selected.customer_name} - {STATUS_LABEL[selected.status] ?? selected.status}
                  </p>
                </div>
                <span className="text-[10px] bg-stone-100 border border-stone-300 px-2 py-0.5 rounded">
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>

              <div className="mt-2 max-h-48 overflow-y-auto">
                {selected.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs py-1.5 border-b border-stone-100">
                    <div>
                      <span className="font-bold">{item.quantity}x</span> {item.product_name_snapshot}
                      {item.notes && <p className="text-[10px] text-amber-700 italic">{item.notes}</p>}
                      <p className="text-[10px] text-stone-400">Babak {item.round_number}</p>
                    </div>
                    <span className="font-mono-num">{item.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs mt-2 space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-mono-num">{selected.subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Service</span>
                  <span className="font-mono-num">{selected.service_amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Pajak PB1</span>
                  <span className="font-mono-num">{selected.tax_amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-200">
                  <span>Total</span>
                  <span className="font-mono-num text-amber-800">
                    Rp {selected.grand_total.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                {selected.status === 'PENDING' && (
                  <button
                    onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(selected.id, 'COOKING'))}
                    className="py-2 bg-sky-100 border border-sky-300 text-sky-900 rounded font-bold touch-target"
                  >
                    Mulai Masak
                  </button>
                )}
                {selected.status === 'COOKING' && (
                  <button
                    onClick={() => void act(() => api.withAuth(auth.token).updateOrderStatus(selected.id, 'SERVED'))}
                    className="py-2 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-bold touch-target"
                  >
                    Siap Saji
                  </button>
                )}
                <button
                  onClick={() => {
                    const reason = window.prompt('Alasan pembatalan (void):')
                    if (reason && reason.length >= 3) {
                      void act(() => api.withAuth(auth.token).cancelOrder(selected.id, reason))
                    }
                  }}
                  className="py-2 bg-rose-50 border border-rose-300 text-rose-800 rounded font-bold touch-target"
                >
                  Batalkan
                </button>
              </div>

              {/* Payment (SERVED or later) */}
              {selected.status === 'SERVED' && (
                <div className="mt-3 pt-3 border-t border-stone-200">
                  <label htmlFor="pay-amount" className="text-[10px] font-bold text-stone-600 block mb-1">
                    UANG DITERIMA (TUNAI)
                  </label>
                  <input
                    id="pay-amount"
                    type="number"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(selected.grand_total)}
                    className="w-full border border-stone-300 rounded px-3 py-2 text-sm font-mono-num touch-target"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() =>
                        void act(async () => {
                          const amount = Number(payAmount) || selected.grand_total
                          const receipt = await api.withAuth(auth.token).payOrder(selected.id, {
                            payment_method: 'CASH',
                            amount_tendered: amount,
                          })
                          setLastReceipt(selected)
                          setPayAmount('')
                          window.print()
                          void receipt
                        })
                      }
                      className="py-2.5 bg-stone-100 border border-stone-300 rounded font-bold text-xs touch-target"
                    >
                      Tunai
                    </button>
                    <button
                      onClick={() =>
                        void act(async () => {
                          await api.withAuth(auth.token).payOrder(selected.id, {
                            payment_method: 'STATIC_QRIS',
                            amount_tendered: selected.grand_total,
                          })
                          setLastReceipt(selected)
                          window.print()
                        })
                      }
                      className="py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold text-xs touch-target"
                    >
                      QRIS Kasir
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Hidden receipt for window.print() */}
      {lastReceipt && (
        <div className="receipt-print-area hidden">
          <p className="text-center font-bold">KAFE SENJA KOPI</p>
          <p>--------------------------------</p>
          <p>Meja {lastReceipt.table_number_snapshot} - {lastReceipt.customer_name}</p>
          {lastReceipt.items.map((i) => (
            <p key={i.id}>
              {i.quantity}x {i.product_name_snapshot} {i.subtotal.toLocaleString('id-ID')}
            </p>
          ))}
          <p>--------------------------------</p>
          <p>Total: Rp {lastReceipt.grand_total.toLocaleString('id-ID')}</p>
          <p className="text-center">Terima kasih atas kunjungan Anda</p>
        </div>
      )}
    </div>
  )
}
