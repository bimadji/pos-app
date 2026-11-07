import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authStorage } from '../../services/api'
import type { TableInfo } from '../../services/api'

export default function PrintQrPage() {
  const navigate = useNavigate()
  const auth = authStorage.load()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) {
      navigate('/admin')
      return
    }
    api
      .withAuth(auth.token)
      .listTables()
      .then((t) => setTables(t))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [auth, navigate])

  if (!auth) return null

  return (
    <div className="min-h-screen bg-stone-100 p-4 print:p-0 print:bg-white">
      {/* Control header - hidden on print */}
      <header className="max-w-4xl mx-auto bg-stone-900 text-white p-4 rounded-lg flex justify-between items-center no-print mb-6">
        <div>
          <h1 className="text-sm font-bold">Stiker QR Meja Siap Cetak (A4)</h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Total {tables.length} meja. Langsung cetak via peramban ke kertas A4.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin')}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 touch-target"
          >
            Kembali
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded bg-amber-700 hover:bg-amber-800 text-xs font-bold text-white touch-target shadow"
          >
            Cetak Sekarang
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-4xl mx-auto bg-rose-100 text-rose-800 p-3 rounded text-xs mb-4 no-print">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-center text-xs text-stone-500 py-10 no-print animate-pulse">
          Memuat daftar meja...
        </p>
      )}

      {/* A4 Sheet Grid of Cut-out Table Stickers */}
      <div className="max-w-4xl mx-auto bg-white border border-stone-200 print:border-none p-6 print:p-0 rounded-lg shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-4">
          {tables.map((t) => {
            const customerUrl = `${window.location.origin}/t/${t.id}?token=${t.qr_token}`
            // QR visual via Google Charts QR generator (zero dependency, native web image)
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
              customerUrl,
            )}`

            return (
              <div
                key={t.id}
                className="border-2 border-dashed border-stone-400 p-4 rounded-xl flex flex-col items-center justify-between text-center bg-white min-h-[260px] page-break-inside-avoid"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Kafe Senja Kopi
                  </span>
                  <h2 className="text-2xl font-black text-stone-900 mt-1">
                    MEJA {t.table_number}
                  </h2>
                </div>

                <div className="my-2 p-1.5 bg-white border border-stone-300 rounded-lg shadow-inner">
                  <img
                    src={qrImageUrl}
                    alt={`QR Code Meja ${t.table_number}`}
                    width={140}
                    height={140}
                    className="block"
                    loading="eager"
                  />
                </div>

                <div className="text-[10px] text-stone-600 leading-tight">
                  <p className="font-bold text-stone-900">Pindai untuk Pesan Menu</p>
                  <p className="text-stone-500 mt-0.5">Tanpa unduh aplikasi</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
