const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000'

export interface CategoryItem {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  image_url: string | null
}

export interface MenuCategory {
  category_id: string
  category_name: string
  item_type: 'DRINK' | 'FOOD' | 'SNACK'
  items: CategoryItem[]
}

export interface OrderItem {
  id: string
  product_id: string
  product_name_snapshot: string
  price_snapshot: number
  quantity: number
  subtotal: number
  notes: string | null
  round_number: number
  item_status: string
}

export interface Order {
  id: string
  table_number_snapshot: number
  customer_name: string
  status: string
  subtotal: number
  service_amount: number
  tax_amount: number
  grand_total: number
  cancellation_reason: string | null
  created_at: string
  items: OrderItem[]
}

export interface TableInfo {
  id: string
  table_number: number
  status: string
  qr_token: string
}

export interface CashierShift {
  id: string
  cashier_user_id: string
  starting_cash: number
  expected_cash: number | null
  actual_cash: number | null
  cash_difference: number | null
  notes: string | null
  opened_at: string
  closed_at: string | null
}

export interface StaffAuth {
  token: string
  user: { username: string; role: string }
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Product {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  stock: number
  image_url: string | null
  is_available: boolean
}

interface ApiErrorDetail {
  code?: string
  message?: string
}

interface ApiBody {
  detail?: string | ApiErrorDetail
  error?: ApiErrorDetail
  data?: unknown
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Merge order matters: caller headers override the JSON default, not vice versa
  const { headers: callerHeaders, ...rest } = options
  const headers = { 'Content-Type': 'application/json', ...callerHeaders }
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers })
  const body: ApiBody = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = body.detail ?? body.error ?? {}
    const message =
      typeof detail === 'string' ? detail : detail.message || `HTTP ${res.status}`
    throw Object.assign(new Error(message), {
      status: res.status,
      code: typeof detail === 'string' ? undefined : detail.code,
    })
  }
  return body.data as T
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

export const api = {
  // --- Customer ---
  getPublicMenu: (tableId: string, token: string) =>
    request<MenuCategory[]>(`/api/v1/menu?table_id=${tableId}&token=${token}`),
  getTableSession: (tableId: string, token: string) =>
    request<{ table_id: string; table_number: number }>(
      `/api/v1/session?table_id=${tableId}&token=${token}`,
    ),
  submitOrder: (
    tableId: string,
    token: string,
    payload: {
      customer_name: string
      items: { product_id: string; quantity: number; notes?: string }[]
    },
  ) =>
    request<Order>(`/api/v1/orders?table_id=${tableId}&token=${token}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Staff (Bearer JWT) ---
  login: async (tenantSlug: string, username: string, password: string) => {
    // Backend returns access_token; StaffAuth shape expects token
    const data = await request<{ access_token: string; user: { username: string; role: string } }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ tenant_slug: tenantSlug, username, password }) },
    )
    return { token: data.access_token, user: data.user } satisfies StaffAuth
  },
  withAuth: (token: string) => ({
    listTables: () => request<TableInfo[]>('/api/v1/tables', { headers: authHeaders(token) }),
    createTable: (tableNumber: number) =>
      request<TableInfo>(`/api/v1/tables?table_number=${tableNumber}`, {
        method: 'POST',
        headers: authHeaders(token),
      }),
    deleteTable: (tableId: string) =>
      request<null>(`/api/v1/tables/${tableId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }),
    listActiveOrders: () =>
      request<Order[]>('/api/v1/orders/active', { headers: authHeaders(token) }),
    listProducts: () => request<Product[]>('/api/v1/products', { headers: authHeaders(token) }),
    listCategories: () =>
      request<Category[]>('/api/v1/categories', { headers: authHeaders(token) }),
    toggleProduct: (productId: string) =>
      request<{ product_id: string; name: string; is_available: boolean }>(
        `/api/v1/products/${productId}/toggle`,
        { method: 'PATCH', headers: authHeaders(token) },
      ),
    createProduct: (payload: {
      category_id: string
      name: string
      price: number
      stock: number
      description?: string
    }) =>
      request<Product>('/api/v1/products', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      }),
    updateProduct: (
      productId: string,
      payload: {
        name?: string
        price?: number
        stock?: number
        category_id?: string
        description?: string
      },
    ) =>
      request<Product>(`/api/v1/products/${productId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      }),
    deleteProduct: (productId: string) =>
      request<null>(`/api/v1/products/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }),
    updateOrderStatus: (orderId: string, newStatus: string) =>
      request<{ order_id: string; status: string }>(
        `/api/v1/orders/${orderId}/status?new_status=${newStatus}`,
        { method: 'PATCH', headers: authHeaders(token) },
      ),
    payOrder: (orderId: string, payload: { payment_method: string; amount_tendered: number }) =>
      request<{
        payment_id: string
        order_id: string
        status: string
        grand_total: number
        amount_tendered: number
        change_due: number
        payment_method: string
        paid_at: string
      }>(`/api/v1/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
      }),
    cancelOrder: (orderId: string, reason: string) =>
      request<{ order_id: string; status: string; message: string }>(
        `/api/v1/orders/${orderId}/cancel`,
        {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ cancellation_reason: reason }),
        },
      ),
    moveTable: (orderId: string, newTableNumber: number) =>
      request<{ order_id: string; table_number: number; message: string }>(
        `/api/v1/orders/${orderId}/move-table`,
        {
          method: 'PATCH',
          headers: authHeaders(token),
          body: JSON.stringify({ new_table_number: newTableNumber }),
        },
      ),
    getCurrentShift: () =>
      request<CashierShift | null>('/api/v1/shifts/current', {
        headers: authHeaders(token),
      }),
    openShift: (startingCash: number) =>
      request<CashierShift>('/api/v1/shifts/open', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ starting_cash: startingCash }),
      }),
    closeShift: (actualCash: number, notes?: string) =>
      request<CashierShift>('/api/v1/shifts/close', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ actual_cash: actualCash, notes }),
      }),
    getDailyMetrics: (params?: { start_date?: string; end_date?: string }) => {
      const q = new URLSearchParams()
      if (params?.start_date) q.set('start_date', params.start_date)
      if (params?.end_date) q.set('end_date', params.end_date)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return request<{
        total_sales: number
        completed_orders: number
        cash_total: number
        qris_total: number
        top_products: Array<{ name: string; qty_sold: number; revenue: number }>
        weekly_sales: Array<{ date: string; total: number; orders_count: number }>
        monthly_sales: Array<{ month: string; total: number; orders_count: number }>
      }>(`/api/v1/reports/daily${qs}`, { headers: authHeaders(token) })
    },
    downloadCsv: async () => {
      const res = await fetch(`${API_BASE}/api/v1/reports/export-csv`, {
        headers: authHeaders(token),
      })
      if (!res.ok) throw new Error('Gagal mengunduh berkas CSV.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `laporan_penjualan_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    },
  }),

  // SSE stream URL builder (EventSource handles reconnect automatically)
  sseUrl: (params: { tableId?: string; token?: string; staffToken?: string }) => {
    if (params.tableId && params.token) {
      return `${API_BASE}/api/v1/orders/stream?table_id=${params.tableId}&token=${params.token}`
    }
    if (params.staffToken) {
      return `${API_BASE}/api/v1/orders/stream?staff_token=${params.staffToken}`
    }
    return `${API_BASE}/api/v1/orders/stream`
  },
}

export const authStorage = {
  save: (auth: StaffAuth) => localStorage.setItem('pos_staff', JSON.stringify(auth)),
  load: (): StaffAuth | null => {
    try {
      const raw = localStorage.getItem('pos_staff')
      return raw ? (JSON.parse(raw) as StaffAuth) : null
    } catch {
      return null
    }
  },
  clear: () => localStorage.removeItem('pos_staff'),
}
