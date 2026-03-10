import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import apiClient from '@/api/client'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  line_number: number
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  status: string
  subtotal: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  currency_code: string
  notes: string
  customer?: { first_name: string; last_name: string; code: string }
  items?: InvoiceItem[]
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'outline',
  partial: 'outline',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'destructive',
}

const columns: ColumnDef<Invoice, unknown>[] = [
  { accessorKey: 'invoice_number', header: 'Invoice #' },
  {
    accessorKey: 'invoice_date', header: 'Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: 'due_date', header: 'Due Date',
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
    accessorKey: 'paid_amount', header: 'Paid',
    cell: ({ row }) => row.original.paid_amount.toFixed(2),
  },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={statusColors[s] || 'secondary'}>{s}</Badge>
    },
  },
]

export function InvoicesPage() {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRowClick = async (invoice: Invoice) => {
    try {
      const res = await apiClient.get(`/ecommerce/invoices/${invoice.id}`)
      setSelectedInvoice(res.data.data)
      setDetailOpen(true)
    } catch {
      alert('Failed to load invoice details')
    }
  }

  const handleStatusUpdate = async (status: string) => {
    if (!selectedInvoice) return
    try {
      await apiClient.put(`/ecommerce/invoices/${selectedInvoice.id}/status`, { status })
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to update invoice status')
    }
  }

  const handleDelete = async () => {
    if (!selectedInvoice) return
    if (!confirm('Delete this draft invoice?')) return
    try {
      await apiClient.delete(`/ecommerce/invoices/${selectedInvoice.id}`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to delete invoice')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Manage customer invoices</p>
      </div>

      <DataTable<Invoice>
        columns={columns}
        fetchUrl="/ecommerce/invoices"
        searchPlaceholder="Search invoices..."
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Invoice {selectedInvoice?.invoice_number}
              {selectedInvoice && (
                <Badge variant={statusColors[selectedInvoice.status] || 'secondary'} className="ml-2">
                  {selectedInvoice.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Due:</span>
                  <p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  <p className="font-medium">
                    {selectedInvoice.customer ? `${selectedInvoice.customer.first_name} ${selectedInvoice.customer.last_name}` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency:</span>
                  <p className="font-medium">{selectedInvoice.currency_code}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Tax</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{item.line_number}</td>
                        <td className="px-3 py-2">{item.description}</td>
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
                <div className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-mono">{selectedInvoice.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span className="font-mono">{selectedInvoice.tax_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span className="font-mono">{selectedInvoice.currency_code} {selectedInvoice.total_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-mono">{selectedInvoice.paid_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-primary"><span>Balance:</span><span className="font-mono">{(selectedInvoice.total_amount - selectedInvoice.paid_amount).toFixed(2)}</span></div>
                </div>
              </div>

              <DialogFooter>
                {selectedInvoice.status === 'draft' && (
                  <>
                    <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
                    <Button size="sm" onClick={() => handleStatusUpdate('sent')}>Mark as Sent</Button>
                  </>
                )}
                {selectedInvoice.status === 'sent' && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusUpdate('cancelled')}>Cancel Invoice</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
