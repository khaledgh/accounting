import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import apiClient from '@/api/client'

interface OrderItem {
  id: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  tax_amount: number
  discount: number
  total_amount: number
  line_number: number
  product?: { name: string }
}

interface Payment {
  id: string
  payment_number: string
  payment_date: string
  amount: number
  method: string
  status: string
}

interface Order {
  id: string
  order_number: string
  order_date: string
  status: string
  payment_status: string
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  currency_code: string
  customer?: { first_name: string; last_name: string; code: string }
  items?: OrderItem[]
  payments?: Payment[]
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  confirmed: 'secondary',
  processing: 'secondary',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'destructive',
}

const paymentStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  unpaid: 'destructive',
  partial: 'outline',
  paid: 'default',
  refunded: 'secondary',
}

const columns: ColumnDef<Order, unknown>[] = [
  { accessorKey: 'order_number', header: 'Order #' },
  {
    accessorKey: 'order_date', header: 'Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: 'customer', header: 'Customer', enableSorting: false,
    cell: ({ row }) => {
      const c = row.original.customer
      return c ? `${c.first_name} ${c.last_name}` : '-'
    },
  },
  {
    accessorKey: 'total_amount', header: 'Total',
    cell: ({ row }) => `${row.original.currency_code} ${row.original.total_amount.toFixed(2)}`,
  },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={statusColors[s] || 'secondary'}>{s}</Badge>
    },
  },
  {
    accessorKey: 'payment_status', header: 'Payment',
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={paymentStatusColors[s] || 'secondary'}>{s}</Badge>
    },
  },
]

export function OrdersPage() {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRowClick = async (order: Order) => {
    try {
      const res = await apiClient.get(`/ecommerce/orders/${order.id}`)
      setSelectedOrder(res.data.data)
      setDetailOpen(true)
    } catch {
      alert('Failed to load order details')
    }
  }

  const handleStatusUpdate = async (status: string) => {
    if (!selectedOrder) return
    if (!confirm(`Update order status to "${status}"?`)) return
    try {
      await apiClient.put(`/ecommerce/orders/${selectedOrder.id}/status`, { status })
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to update order status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage customer orders</p>
        </div>
      </div>

      <DataTable<Order>
        columns={columns}
        fetchUrl="/ecommerce/orders"
        searchPlaceholder="Search orders..."
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Order {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">{new Date(selectedOrder.order_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  <p className="font-medium">
                    {selectedOrder.customer ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name}` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p><Badge variant={statusColors[selectedOrder.status] || 'secondary'}>{selectedOrder.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment:</span>
                  <p><Badge variant={paymentStatusColors[selectedOrder.payment_status] || 'secondary'}>{selectedOrder.payment_status}</Badge></p>
                </div>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Tax</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{item.line_number}</td>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{item.unit_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{item.tax_amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{item.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-mono">{selectedOrder.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span className="font-mono">{selectedOrder.tax_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Shipping:</span><span className="font-mono">{selectedOrder.shipping_amount.toFixed(2)}</span></div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount:</span><span className="font-mono text-destructive">-{selectedOrder.discount_amount.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span className="font-mono">{selectedOrder.currency_code} {selectedOrder.total_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-mono">{selectedOrder.paid_amount.toFixed(2)}</span></div>
                </div>
              </div>

              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Payments</h4>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left">Number</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Method</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.payments.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{p.payment_number}</td>
                            <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 capitalize">{p.method}</td>
                            <td className="px-3 py-2 text-right font-mono">{p.amount.toFixed(2)}</td>
                            <td className="px-3 py-2"><Badge variant="default" className="text-xs">{p.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                {selectedOrder.status === 'pending' && (
                  <>
                    <Button variant="destructive" size="sm" onClick={() => handleStatusUpdate('cancelled')}>Cancel Order</Button>
                    <Button size="sm" onClick={() => handleStatusUpdate('confirmed')}>Confirm</Button>
                  </>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('processing')}>Start Processing</Button>
                )}
                {selectedOrder.status === 'processing' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('shipped')}>Mark Shipped</Button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('delivered')}>Mark Delivered</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
