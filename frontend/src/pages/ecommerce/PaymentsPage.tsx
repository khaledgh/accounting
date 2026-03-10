import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, RotateCcw } from 'lucide-react'
import apiClient from '@/api/client'

interface Payment {
  id: string
  payment_number: string
  payment_date: string
  amount: number
  currency_code: string
  method: string
  reference: string
  notes: string
  status: string
  order?: { order_number: string }
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  refunded: 'destructive',
  pending: 'secondary',
}

const columns: ColumnDef<Payment, unknown>[] = [
  { accessorKey: 'payment_number', header: 'Payment #' },
  {
    accessorKey: 'payment_date', header: 'Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: 'order', header: 'Order', enableSorting: false,
    cell: ({ row }) => row.original.order?.order_number || '-',
  },
  {
    accessorKey: 'amount', header: 'Amount',
    cell: ({ row }) => {
      const amt = row.original.amount
      const cls = amt < 0 ? 'text-destructive' : ''
      return <span className={`font-mono ${cls}`}>{row.original.currency_code} {amt.toFixed(2)}</span>
    },
  },
  { accessorKey: 'method', header: 'Method', cell: ({ getValue }) => <span className="capitalize">{getValue() as string}</span> },
  { accessorKey: 'reference', header: 'Reference', cell: ({ getValue }) => getValue() || '-' },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={statusColors[s] || 'secondary'}>{s}</Badge>
    },
  },
]

export function PaymentsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    amount: 0, method: 'bank_transfer', reference: '', notes: '', payment_date: new Date().toISOString().split('T')[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/ecommerce/payments', {
        ...form,
        amount: Number(form.amount),
      })
      setCreateOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError('Failed to create payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefund = async (payment: Payment) => {
    if (!confirm(`Refund payment ${payment.payment_number} ($${payment.amount.toFixed(2)})?`)) return
    try {
      await apiClient.post(`/ecommerce/payments/${payment.id}/refund`)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to refund payment')
    }
  }

  const actionColumns: ColumnDef<Payment, unknown>[] = [
    ...columns,
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => {
        if (row.original.status === 'completed' && row.original.amount > 0) {
          return (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRefund(row.original) }}>
              <RotateCcw size={12} />
            </Button>
          )
        }
        return null
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track and manage payments</p>
        </div>
        <Button onClick={() => { setForm({ amount: 0, method: 'bank_transfer', reference: '', notes: '', payment_date: new Date().toISOString().split('T')[0] }); setError(''); setCreateOpen(true) }}>
          <Plus size={16} className="mr-2" /> Record Payment
        </Button>
      </div>

      <DataTable<Payment>
        columns={actionColumns}
        fetchUrl="/ecommerce/payments"
        searchPlaceholder="Search payments..."
        refreshKey={refreshKey}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="check">Check</option>
                  <option value="paypal">PayPal</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Transaction ID, check #, etc." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Record Payment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
