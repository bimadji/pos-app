import { Route, Routes } from 'react-router-dom'
import CustomerMenu from './pages/customer/CustomerMenu'
import CashierDashboard from './pages/cashier/CashierDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  return (
    <Routes>
      {/* Customer: scan QR meja -> /t/:table_id?token=... */}
      <Route path="/t/:tableId" element={<CustomerMenu />} />
      {/* Kasir & Dapur: denah meja + live stream */}
      <Route path="/cashier" element={<CashierDashboard />} />
      {/* Admin/Owner: metrik & kelola menu */}
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
