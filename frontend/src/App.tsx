import { Route, Routes } from 'react-router-dom'
import CustomerMenu from './pages/customer/CustomerMenu'
import CashierDashboard from './pages/cashier/CashierDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import PrintQrPage from './pages/admin/PrintQrPage'

export default function App() {
  return (
    <Routes>
      {/* Customer: scan QR meja -> /t/:table_id?token=... */}
      <Route path="/t/:tableId" element={<CustomerMenu />} />
      {/* Kasir & Dapur: denah meja + live stream */}
      <Route path="/cashier" element={<CashierDashboard />} />
      {/* Admin/Owner: metrik & kelola menu */}
      <Route path="/admin" element={<AdminDashboard />} />
      {/* Cetak Stiker QR Meja A4 siap potong */}
      <Route path="/print-qr" element={<PrintQrPage />} />
    </Routes>
  )
}
