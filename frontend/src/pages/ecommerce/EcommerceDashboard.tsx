import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Package, Users, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Order {
  id: string
  order_number: string
  order_date: string
  status: string
  total_amount: number
  currency_code: string
  customer?: { first_name: string; last_name: string }
}

interface LowStockProduct {
  id: string
  sku: string
  name: string
  stock_quantity: number
  low_stock_alert: number
  category?: { name: string }
}

interface StatusCount {
  status: string
  count: number
}

interface MonthlyPoint {
  month: string
  revenue: number
}

interface DashboardData {
  total_orders: number
  total_products: number
  total_customers: number
  month_revenue: number
  recent_orders: Order[]
  low_stock_items: LowStockProduct[]
  orders_by_status: StatusCount[]
  monthly_revenue: MonthlyPoint[]
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline', confirmed: 'secondary', processing: 'secondary',
  shipped: 'default', delivered: 'default', cancelled: 'destructive',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export function EcommerceDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get('/dashboard/ecommerce')
      setData(res.data.data)
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  const d = data || { total_orders: 0, total_products: 0, total_customers: 0, month_revenue: 0, recent_orders: [], low_stock_items: [], orders_by_status: [], monthly_revenue: [] }
  const maxRev = Math.max(...(d.monthly_revenue || []).map((m) => m.revenue), 1)
  const totalStatusOrders = (d.orders_by_status || []).reduce((a, b) => a + b.count, 0) || 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">eCommerce Dashboard</h1>
          <p className="text-muted-foreground">Sales overview and store metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/ecommerce/orders')}>
          <ShoppingCart size={14} className="mr-1" /> View Orders
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/ecommerce/orders')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.total_orders}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/ecommerce/products')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.total_products}</div>
            <p className="text-xs text-muted-foreground">In catalog</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/ecommerce/customers')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.total_customers}</div>
            <p className="text-xs text-muted-foreground">Active customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(d.month_revenue)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {d.monthly_revenue && d.monthly_revenue.length > 0 ? (
              <div className="flex items-end gap-2 h-40">
                {d.monthly_revenue.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground">{m.revenue > 0 ? formatCurrency(m.revenue) : ''}</span>
                    <div className="w-full bg-primary/80 rounded-t-sm transition-all" style={{ height: `${Math.max((m.revenue / maxRev) * 120, 4)}px` }} />
                    <span className="text-xs font-medium">{m.month}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No revenue data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {d.orders_by_status && d.orders_by_status.length > 0 ? (
              <div className="space-y-3">
                {d.orders_by_status.map((s) => (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant={statusColors[s.status] || 'secondary'} className="text-xs">{s.status}</Badge>
                      <span className="font-medium">{s.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(s.count / totalStatusOrders) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/ecommerce/orders')}>View All</Button>
          </CardHeader>
          <CardContent>
            {d.recent_orders && d.recent_orders.length > 0 ? (
              <div className="space-y-2">
                {d.recent_orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{o.order_number}</span>
                        <Badge variant={statusColors[o.status] || 'secondary'} className="text-[10px] px-1.5 py-0">{o.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : '-'} &middot; {new Date(o.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-medium">{formatCurrency(o.total_amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500" /> Low Stock Alerts</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/ecommerce/inventory')}>View All</Button>
          </CardHeader>
          <CardContent>
            {d.low_stock_items && d.low_stock_items.length > 0 ? (
              <div className="space-y-2">
                {d.low_stock_items.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku} {p.category ? `· ${p.category.name}` : ''}</p>
                    </div>
                    <Badge variant={p.stock_quantity <= 0 ? 'destructive' : 'outline'} className={p.stock_quantity > 0 ? 'text-orange-600 border-orange-300' : ''}>
                      {p.stock_quantity <= 0 ? 'Out' : `${p.stock_quantity} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All stock levels are healthy.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
