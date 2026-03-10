import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Loader2, Eye, CheckCircle, DollarSign } from 'lucide-react'
import apiClient from '@/api/client'

interface InvoiceItem {
  id?: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  line_number?: number
}

interface PurchaseInvoice {
  id: string
  invoice_number: string
  supplier_id: string | null
  invoice_date: string
  due_date: string
  status: string
  subtotal: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  notes: string
  items: InvoiceItem[]
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PurchaseInvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [detailItem, setDetailItem] = useState<PurchaseInvoice | null>(null)

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/purchase-invoices', { params: { page_size: 100 } })
      setInvoices(res.data.data?.data || [])
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleConfirm = async (inv: PurchaseInvoice) => {
    if (!confirm(`Confirm ${inv.invoice_number}? This will update stock and create journal entries.`)) return
    try {
      await apiClient.put(`/accounting/purchase-invoices/${inv.id}/confirm`)
      fetchInvoices()
      if (detailItem?.id === inv.id) {
        const res = await apiClient.get(`/accounting/purchase-invoices/${inv.id}`)
        setDetailItem(res.data.data)
      }
    } catch { alert('Failed to confirm') }
  }

  const handlePay = async (inv: PurchaseInvoice) => {
    const remaining = inv.total_amount - inv.paid_amount
    if (remaining <= 0) { alert('Already fully paid'); return }
    if (!confirm(`Record payment of $${fmt(remaining)} for ${inv.invoice_number}?`)) return
    try {
      await apiClient.put(`/accounting/purchase-invoices/${inv.id}/pay`, { amount: remaining })
      fetchInvoices()
      if (detailItem?.id === inv.id) {
        const res = await apiClient.get(`/accounting/purchase-invoices/${inv.id}`)
        setDetailItem(res.data.data)
      }
    } catch { alert('Failed to record payment') }
  }

  const handleDelete = async (inv: PurchaseInvoice) => {
    if (!confirm(`Delete draft invoice ${inv.invoice_number}?`)) return
    try {
      await apiClient.delete(`/accounting/purchase-invoices/${inv.id}`)
      fetchInvoices()
      if (detailItem?.id === inv.id) setDetailItem(null)
    } catch { alert('Failed to delete') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Invoices</h1>
          <p className="text-muted-foreground">Manage supplier invoices and stock replenishment</p>
        </div>
        <Button onClick={() => navigate('/accounting/purchase-invoices/new')}>
          <Plus size={16} className="mr-2" /> New Purchase Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Purchase Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No purchase invoices yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Invoice #</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Due</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Paid</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 font-medium">{inv.invoice_number}</td>
                      <td className="py-3">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td className="py-3">{new Date(inv.due_date).toLocaleDateString()}</td>
                      <td className="py-3">
                        <Badge className={statusColors[inv.status] || ''}>{inv.status}</Badge>
                      </td>
                      <td className="py-3 text-right font-mono">${fmt(inv.total_amount)}</td>
                      <td className="py-3 text-right font-mono">${fmt(inv.paid_amount)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailItem(inv)}>
                            <Eye size={14} />
                          </Button>
                          {inv.status === 'draft' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleConfirm(inv)}>
                                <CheckCircle size={14} className="text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(inv)}>
                                <Trash2 size={14} className="text-destructive" />
                              </Button>
                            </>
                          )}
                          {inv.status === 'confirmed' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePay(inv)}>
                              <DollarSign size={14} className="text-green-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Invoice {detailItem?.invoice_number}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[detailItem.status] || ''}>{detailItem.status}</Badge></div>
                <div><span className="text-muted-foreground">Date:</span> {new Date(detailItem.invoice_date).toLocaleDateString()}</div>
                <div><span className="text-muted-foreground">Due:</span> {new Date(detailItem.due_date).toLocaleDateString()}</div>
              </div>
              {detailItem.notes && <p className="text-sm text-muted-foreground">{detailItem.notes}</p>}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Tax</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItem.items?.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{item.line_number || i + 1}</td>
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right font-mono">${fmt(item.unit_price)}</td>
                      <td className="py-2 text-right font-mono">${fmt(item.tax_amount)}</td>
                      <td className="py-2 text-right font-mono font-medium">${fmt(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-medium">
                    <td colSpan={5} className="pt-2 text-right">Total:</td>
                    <td className="pt-2 text-right font-mono">${fmt(detailItem.total_amount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="text-right text-muted-foreground">Paid:</td>
                    <td className="text-right font-mono text-green-600">${fmt(detailItem.paid_amount)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex justify-end gap-2">
                {detailItem.status === 'draft' && (
                  <Button size="sm" onClick={() => handleConfirm(detailItem)}>
                    <CheckCircle size={14} className="mr-1" /> Confirm
                  </Button>
                )}
                {detailItem.status === 'confirmed' && detailItem.paid_amount < detailItem.total_amount && (
                  <Button size="sm" variant="outline" onClick={() => handlePay(detailItem)}>
                    <DollarSign size={14} className="mr-1" /> Record Payment
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
