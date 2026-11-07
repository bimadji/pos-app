import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api'
import type { MenuCategory, Order } from '../../services/api'
import { useCart } from '../../hooks/useCart'
import { useSSE } from '../../hooks/useSSE'

type Phase = 'menu' | 'tracking'
type ItemType = 'DRINK' | 'FOOD' | 'SNACK'

const NOTE_CHIP_GROUPS: Record<ItemType, { label: string; chips: string[] }[]> = {
  DRINK: [
    { label: 'Level Es', chips: ['Normal Ice', 'Less Ice', 'No Ice', 'Extra Ice'] },
    { label: 'Level Gula', chips: ['Normal Sugar', 'Less Sugar (50%)', 'No Sugar'] },
  ],
  FOOD: [
    { label: 'Level Pedas', chips: ['Tidak Pedas', 'Pedas Sedang', 'Extra Pedas'] },
    { label: 'Tambahan', chips: ['Tanpa Bawang', 'Pisah Saus', 'Tanpa Sayur'] },
  ],
  SNACK: [
    { label: 'Penyajian', chips: ['Pisah Saus', 'Tanpa Saus', 'Hangat Sekali'] },
  ],
}

const STATUS_STEPS = ['PENDING', 'COOKING', 'SERVED', 'COMPLETED'] as const
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu Dapur',
  COOKING: 'Sedang Dimasak',
  SERVED: 'Siap Disajikan',
  COMPLETED: 'Lunas',
}

export default function CustomerMenu() {
  const { tableId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [menu, setMenu] = useState<MenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState(
    () => localStorage.getItem(`pos_customer_name_${tableId}`) ?? '',
  )
  const [phase, setPhase] = useState<Phase>('menu')
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteTarget, setNoteTarget] = useState<{ item: MenuCategory['items'][0]; itemType: ItemType } | null>(null)
  const [noteText, setNoteText] = useState('')

  const cart = useCart(tableId)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getPublicMenu(tableId, token),
      api.getTableSession(tableId, token).catch(() => null),
    ])
      .then(([data, sess]) => {
        if (cancelled) return
        setMenu(data)
        setActiveCategory(data[0]?.category_id ?? null)
        if (sess) setTableNumber(sess.table_number)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tableId, token])

  const refreshOrderStatus = useCallback(async () => {
    if (!order) return
    try {
      // Customer portal has no direct order-status GET; SSE events carry updates.
      // Status changes arrive via SSE; nothing to fetch here.
    } catch {
      /* noop */
    }
  }, [order])

  useSSE(api.sseUrl({ tableId, token }), (ev) => {
    if (!order) return
    const data = ev.data as { order_id?: string; new_status?: string; grand_total?: number } | null
    if (!data || data.order_id !== order.id) return
    if (ev.event === 'order.status_changed' && data.new_status) {
      setOrder((prev) => (prev ? { ...prev, status: data.new_status! } : prev))
    }
    if (ev.event === 'order.completed') {
      setOrder((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev))
    }
  })

  useEffect(() => {
    void refreshOrderStatus()
  }, [refreshOrderStatus])

  useEffect(() => {
    localStorage.setItem(`pos_customer_name_${tableId}`, customerName)
  }, [tableId, customerName])

  const visibleItems = useMemo(() => {
    const cat = menu.find((c) => c.category_id === activeCategory)
    return cat ? cat.items : []
  }, [menu, activeCategory])
  const [cartOpen, setCartOpen] = useState(false)
  const activeItemType: ItemType =
    (menu.find((c) => c.category_id === activeCategory)?.item_type as ItemType | undefined) ?? 'FOOD'

  const submitOrder = async () => {
    setError(null)
    try {
      const payload = {
        customer_name: customerName.trim() || 'Tamu',
        items: cart.lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          notes: l.notes || undefined,
        })),
      }
      const created = await api.submitOrder(tableId, token, payload)
      setOrder(created)
      cart.clear()
      setPhase('tracking')
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'INSUFFICIENT_STOCK') {
        setError('Stok menu baru saja habis dipesan meja lain. Hapus item tersebut lalu kirim ulang.')
      } else {
        setError(err.message)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Memuat menu...</p>
      </div>
    )
  }

  if (error && menu.length === 0) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-lg p-5 max-w-sm text-center">
          <p className="text-rose-700 font-semibold text-sm">{error}</p>
          <p className="text-stone-500 text-xs mt-2">Silakan pindai ulang QR meja resmi.</p>
        </div>
      </div>
    )
  }

  // ---------- TRACKING PHASE ----------
  if (phase === 'tracking' && order) {
    const stepIndex = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number])
    const paid = order.status === 'COMPLETED'
    return (
      <div className="min-h-screen bg-stone-100 pb-28">
        <header className="bg-stone-900 text-white px-4 py-3">
          <p className="text-[10px] bg-amber-700 inline-block px-2 py-0.5 rounded font-bold">
            MEJA {order.table_number_snapshot}
          </p>
          <h1 className="text-sm font-bold mt-1">Status Pesanan {order.customer_name}</h1>
        </header>

        <div className="p-4">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <ol className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => (
                <li key={s} className="flex-1 flex flex-col items-center relative">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      i <= stepIndex ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {i <= stepIndex ? '✓' : i + 1}
                  </span>
                  <span className="text-[10px] mt-1 text-stone-600 text-center">
                    {STATUS_LABEL[s]}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg p-4 mt-4">
            <h2 className="text-xs font-bold text-stone-900 mb-2">Rincian Pesanan</h2>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs py-1.5 border-b border-stone-100">
                <div>
                  <span className="font-semibold">{item.quantity}x</span> {item.product_name_snapshot}
                  {item.notes && <p className="text-[10px] text-amber-700 italic">{item.notes}</p>}
                  <p className="text-[10px] text-stone-400">Babak {item.round_number}</p>
                </div>
                <span className="font-mono-num">{item.subtotal.toLocaleString('id-ID')}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs mt-2 text-stone-600">
              <span>Service</span>
              <span className="font-mono-num">{order.service_amount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-xs text-stone-600">
              <span>Pajak PB1</span>
              <span className="font-mono-num">{order.tax_amount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-stone-200">
              <span>Total</span>
              <span className="font-mono-num text-amber-800">
                Rp {order.grand_total.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {paid && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 mt-4 text-center">
              <p className="text-emerald-800 font-bold text-sm">Terima kasih! Pesanan telah LUNAS.</p>
              <p className="text-emerald-700 text-xs mt-1">Struk digital ini sebagai bukti pembayaran.</p>
            </div>
          )}

          {!paid && (
            <button
              onClick={() => setPhase('menu')}
              className="w-full mt-4 py-3 bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold rounded touch-target"
            >
              Pesan Tambahan (Babak Berikutnya)
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---------- MENU PHASE ----------
  return (
    <div className="min-h-screen bg-stone-100 pb-28">
      <header className="bg-stone-900 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Meja Anda</p>
          <p className="text-3xl font-black font-mono-num leading-none">
            {tableNumber ?? '-'}
          </p>
          <h1 className="text-xs font-semibold text-stone-300 mt-1">Kafe Senja Kopi</h1>
        </div>
        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true"></span>
          Sesi Sah
        </span>
      </header>

      <nav aria-label="Kategori menu" className="bg-stone-100 border-b border-stone-200 px-3 py-2 flex gap-2 overflow-x-auto">
        {menu.map((cat) => (
          <button
            key={cat.category_id}
            onClick={() => setActiveCategory(cat.category_id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap touch-target ${
              cat.category_id === activeCategory
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-700 border border-stone-300'
            }`}
          >
            {cat.category_name}
          </button>
        ))}
      </nav>
      {/* Input Nama Pemesan Permanen di Atas Menu */}
      <div className="mx-3 mt-3 bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="cust-name" className="text-[11px] font-bold text-stone-700 uppercase">
            Nama Pemesan <span className="text-rose-600">*</span>
          </label>
          <span className="text-[10px] text-stone-400">Untuk panggilan antrean</span>
        </div>
        <input
          id="cust-name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Ketik nama Anda (misal: Bima)"
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm font-semibold text-stone-900 touch-target focus:border-amber-700 focus:outline-none"
        />
      </div>

      <div className="p-3 space-y-3">
        {visibleItems.length === 0 && (
          <p className="text-center text-stone-500 text-xs py-8">Belum ada menu di kategori ini.</p>
        )}
        {visibleItems.map((item) => (
          <div key={item.id} className="bg-white border border-stone-200 rounded-lg p-3 flex justify-between items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-stone-900">{item.name}</h3>
              {item.description && <p className="text-xs text-stone-600 mt-0.5">{item.description}</p>}
              <p className="text-sm font-bold font-mono-num text-amber-800 mt-1">
                Rp {item.price.toLocaleString('id-ID')}
              </p>
            </div>
            <button
              onClick={() => {
                setNoteTarget({ item, itemType: activeItemType })
                setNoteText('')
              }}
              className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded touch-target"
            >
              Tambah
            </button>
          </div>
        ))}
      </div>

      {/* Sticky cart bar: buka keranjang untuk ubah atau hapus item */}
      {cart.totalItems > 0 && (
        <div className="fixed bottom-3 left-3 right-3 bg-white border border-stone-200 shadow-xl rounded-lg p-3 flex justify-between items-center z-20">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="text-left touch-target"
            aria-label="Buka keranjang"
          >
            <p className="text-[10px] text-stone-500 font-bold">{cart.totalItems} ITEM TERPILIH (LIHAT)</p>
            <p className="text-sm font-black font-mono-num text-amber-900">Rp {cart.subtotal.toLocaleString('id-ID')}</p>
          </button>
          <button
            onClick={() => {
              if (!customerName.trim()) {
                setError('Mohon isi kolom Nama Pemesan di bagian atas sebelum mengirim ke dapur.')
                window.scrollTo({ top: 0, behavior: 'smooth' })
                return
              }
              void submitOrder()
            }}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded touch-target shadow"
          >
            Kirim ke Dapur ({tableNumber ? `Meja ${tableNumber}` : 'Meja Sah'})
          </button>
        </div>
      )}

      {/* Bottom sheet keranjang: ubah qty dan hapus item sebelum dikirim */}
      {cartOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-end justify-center z-40" role="dialog" aria-modal="true" aria-label="Keranjang">
          <div className="bg-white rounded-t-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-stone-900">Keranjang Anda</h3>
              <button onClick={() => setCartOpen(false)} className="text-xs font-bold text-stone-600 touch-target px-2" aria-label="Tutup keranjang">Tutup</button>
            </div>
            {cart.lines.length === 0 && <p className="text-xs text-stone-500 py-6 text-center">Keranjang kosong.</p>}
            <div className="divide-y divide-stone-100">
              {cart.lines.map((line, idx) => (
                <div key={`${line.product_id}-${idx}`} className="py-2.5 flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-stone-900">{line.name}</p>
                    {line.notes && <p className="text-[11px] italic text-stone-500">&quot;{line.notes}&quot;</p>}
                    <p className="text-xs font-mono-num text-amber-800 mt-0.5">Rp {(line.price * line.quantity).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cart.setQty(idx, line.quantity - 1)}
                      className="w-9 h-9 rounded bg-stone-100 border border-stone-300 font-bold touch-target"
                      aria-label={`Kurangi ${line.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold font-mono-num">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => cart.setQty(idx, line.quantity + 1)}
                      className="w-9 h-9 rounded bg-stone-100 border border-stone-300 font-bold touch-target"
                      aria-label={`Tambah ${line.name}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => cart.removeLine(idx)}
                      className="ml-1 px-2 h-9 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold touch-target"
                      aria-label={`Hapus ${line.name}`}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Item notes modal */}
      {/* Item notes modal with chips & custom input */}
      {noteTarget && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-end sm:items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-stone-900">Catatan Khusus: {noteTarget.item.name}</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">Pilih opsi cepat atau ketik sendiri di bawah:</p>

            {/* Preset sesuai jenis menu kategori item */}
            <div className="mt-3 space-y-2">
              {NOTE_CHIP_GROUPS[noteTarget.itemType].map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-1">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setNoteText((prev) => (prev ? `${prev}, ${chip}` : chip))}
                        className="px-2.5 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded border border-stone-200 font-medium"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom note text */}
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setNoteTarget(null)
                if (e.key === 'Enter') {
                  cart.addItem(noteTarget.item, noteText)
                  setNoteTarget(null)
                }
              }}
              placeholder="Catatan manual (misal: bungkus terpisah)"
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm mt-3 touch-target"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setNoteTarget(null)}
                className="flex-1 py-2 bg-stone-100 border border-stone-300 rounded text-xs font-semibold text-stone-700 touch-target"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  cart.addItem(noteTarget.item, noteText)
                  setNoteTarget(null)
                }}
                className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold touch-target shadow"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-16 left-3 right-3 bg-rose-700 text-white text-xs px-4 py-3 rounded shadow-lg" role="status">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold ml-2" aria-label="Tutup notifikasi">×</button>
        </div>
      )}
    </div>
  )
}
