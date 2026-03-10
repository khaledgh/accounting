import { useState, useEffect, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import apiClient from '@/api/client'

interface Account {
  id: string
  code: string
  name: string
  account_type: string
}

interface Journal {
  id: string
  number: string
  date: string
  description: string
  reference: string
  total_debit: number
  status: string
}

const columns: ColumnDef<Journal, unknown>[] = [
  { accessorKey: 'number', header: 'Number' },
  {
    accessorKey: 'date', header: 'Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  { accessorKey: 'reference', header: 'Reference' },
  { accessorKey: 'description', header: 'Description' },
  {
    accessorKey: 'total_debit', header: 'Amount',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant={s === 'posted' ? 'default' : 'secondary'}>{s}</Badge>
    },
  },
]

export function ExpensesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [cashAccounts, setCashAccounts] = useState<Account[]>([])

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    expense_account_id: '',
    cash_account_id: '',
    amount: 0,
    description: '',
    reference: '',
  })

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500 } })
      const all: Account[] = res.data.data?.data || []
      setExpenseAccounts(all.filter((a) => a.account_type === 'expense'))
      setCashAccounts(all.filter((a) => a.code.startsWith('11') || a.code === '1100'))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.expense_account_id || !form.cash_account_id) {
      setError('Please select both expense and cash accounts')
      return
    }
    setIsSubmitting(true)
    try {
      await apiClient.post('/accounting/journals', {
        date: form.date,
        description: form.description,
        reference: form.reference || 'EXP',
        entries: [
          { account_id: form.expense_account_id, debit_amount: Number(form.amount), credit_amount: 0, description: form.description },
          { account_id: form.cash_account_id, debit_amount: 0, credit_amount: Number(form.amount), description: form.description },
        ],
      })
      setCreateOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError('Failed to create expense entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track business expenses via journal entries</p>
        </div>
        <Button onClick={() => {
          setForm({ date: new Date().toISOString().split('T')[0], expense_account_id: '', cash_account_id: '', amount: 0, description: '', reference: '' })
          setError('')
          setCreateOpen(true)
        }}>
          <Plus size={16} className="mr-2" /> Record Expense
        </Button>
      </div>

      <DataTable<Journal>
        columns={columns}
        fetchUrl="/accounting/journals"
        searchPlaceholder="Search expenses..."
        refreshKey={refreshKey}
        extraFilters={{ reference: 'EXP' }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expense Account</Label>
                <Select value={form.expense_account_id} onChange={(e) => setForm((p) => ({ ...p, expense_account_id: e.target.value }))} required>
                  <option value="">Select account...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid From</Label>
                <Select value={form.cash_account_id} onChange={(e) => setForm((p) => ({ ...p, cash_account_id: e.target.value }))} required>
                  <option value="">Select account...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Office supplies" required />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="e.g. Receipt #123" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Record Expense'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
