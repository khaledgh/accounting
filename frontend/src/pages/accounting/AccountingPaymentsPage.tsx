import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ArrowDownToLine, ArrowUpFromLine, Loader2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'

interface BankAccount {
  id: string
  code: string
  name: string
  current_balance: number
}

interface Contact {
  id: string
  name?: string
  first_name?: string
  last_name?: string
  code?: string
}

interface Payment {
  id: string
  bank_account_id: string
  bank_account?: { code: string; name: string }
  contact_type: string
  contact_id: string | null
  contact_name: string
  payment_type: 'receive' | 'make'
  amount: number
  currency_code: string
  payment_date: string
  reference: string
  method: string
  notes: string
  status: string
}

interface Summary {
  total_received: number
  total_made: number
  net: number
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AccountingPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<Summary>({ total_received: 0, total_made: 0, net: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [customers, setCustomers] = useState<Contact[]>([])
  const [suppliers, setSuppliers] = useState<Contact[]>([])
  const [filter, setFilter] = useState<'' | 'receive' | 'make'>('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'receive' | 'make'>('receive')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    bank_account_id: '',
    contact_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    method: 'bank_transfer',
    notes: '',
  })

  const fetchPayments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = { page_size: '100' }
      if (filter) params.payment_type = filter
      const res = await apiClient.get('/accounting/payments', { params })
      setPayments(res.data.data?.data || [])
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [filter])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/payments/summary')
      setSummary(res.data.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchPayments()
    fetchSummary()
  }, [fetchPayments, fetchSummary])

  useEffect(() => {
    const fetchRef = async () => {
      try {
        const [bankRes, custRes, supRes] = await Promise.all([
          apiClient.get('/accounting/bank-accounts'),
          apiClient.get('/ecommerce/customers', { params: { page_size: 500 } }),
          apiClient.get('/ecommerce/suppliers', { params: { page_size: 500 } }),
        ])
        setBankAccounts(bankRes.data.data || [])
        setCustomers(custRes.data.data?.data || [])
        setSuppliers(supRes.data.data?.data || [])
      } catch { /* ignore */ }
    }
    fetchRef()
  }, [])

  const openDialog = (type: 'receive' | 'make') => {
    setDialogType(type)
    setForm({
      bank_account_id: '', contact_id: '', amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      reference: '', method: 'bank_transfer', notes: '',
    })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (form.amount <= 0) { setError('Amount must be greater than 0'); return }
    if (!form.bank_account_id) { setError('Select a bank account'); return }
    setIsSaving(true); setError('')
    try {
      await apiClient.post('/accounting/payments', {
        bank_account_id: form.bank_account_id,
        contact_type: dialogType === 'receive' ? 'customer' : 'supplier',
        contact_id: form.contact_id || undefined,
        payment_type: dialogType,
        amount: form.amount,
        payment_date: form.payment_date,
        reference: form.reference,
        method: form.method,
        notes: form.notes,
      })
      setDialogOpen(false)
      fetchPayments()
      fetchSummary()
    } catch { setError('Failed to record payment') }
    finally { setIsSaving(false) }
  }

  const contacts = dialogType === 'receive' ? customers : suppliers
  const contactLabel = dialogType === 'receive' ? 'Customer' : 'Supplier'

  const bankOptions: ComboboxOption[] = useMemo(() =>
    bankAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, sublabel: `Balance: $${fmt(a.current_balance)}` })),
    [bankAccounts]
  )

  const contactOptions: ComboboxOption[] = useMemo(() =>
    contacts.map((c) => {
      const displayName = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()
      return { value: c.id, label: c.code ? `${c.code} — ${displayName}` : displayName }
    }),
    [contacts]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track received and made payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openDialog('receive')}>
            <ArrowDownToLine size={16} className="mr-2" /> Receive Payment
          </Button>
          <Button variant="outline" onClick={() => openDialog('make')}>
            <ArrowUpFromLine size={16} className="mr-2" /> Make Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            <ArrowDownToLine size={16} className="text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${fmt(summary.total_received)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            <ArrowUpFromLine size={16} className="text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${fmt(summary.total_made)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net</CardTitle>
            {summary.net >= 0 ? <TrendingUp size={16} className="text-green-600" /> : <TrendingDown size={16} className="text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', summary.net >= 0 ? 'text-green-600' : 'text-red-500')}>${fmt(summary.net)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b">
        {([['', 'All'], ['receive', 'Received'], ['make', 'Made']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val as '' | 'receive' | 'make')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              filter === val ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Payment List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : payments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payments found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Bank Account</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 font-medium">Reference</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="py-3">
                        {p.payment_type === 'receive' ? (
                          <Badge className="bg-green-100 text-green-800">Received</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-800">Paid</Badge>
                        )}
                      </td>
                      <td className="py-3">{p.contact_name || '-'}</td>
                      <td className="py-3 text-xs">{p.bank_account ? `${p.bank_account.code} — ${p.bank_account.name}` : '-'}</td>
                      <td className="py-3 capitalize">{p.method.replace('_', ' ')}</td>
                      <td className="py-3">{p.reference || '-'}</td>
                      <td className={cn('py-3 text-right font-mono font-medium', p.payment_type === 'receive' ? 'text-green-600' : 'text-red-500')}>
                        {p.payment_type === 'receive' ? '+' : '-'}${fmt(p.amount)}
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary">{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === 'receive' ? 'Receive Payment' : 'Make Payment'}</DialogTitle>
          </DialogHeader>
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Combobox
                value={form.bank_account_id}
                onChange={(v) => setForm((p) => ({ ...p, bank_account_id: v }))}
                options={bankOptions}
                placeholder="Select bank account"
                searchPlaceholder="Search bank accounts..."
              />
            </div>
            <div className="space-y-2">
              <Label>{contactLabel}</Label>
              <Combobox
                value={form.contact_id}
                onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))}
                options={contactOptions}
                placeholder={`Select ${contactLabel.toLowerCase()} (optional)`}
                searchPlaceholder={`Search ${contactLabel.toLowerCase()}s...`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={form.payment_date} onChange={(v) => setForm((p) => ({ ...p, payment_date: v }))} />
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
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Transaction ID, check #" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
            </div>

            {dialogType === 'receive' && (
              <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-xs text-green-700 dark:text-green-400">
                <DollarSign size={14} className="inline mr-1" />
                This will debit your bank account and credit Accounts Receivable (1200).
              </div>
            )}
            {dialogType === 'make' && (
              <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-400">
                <DollarSign size={14} className="inline mr-1" />
                This will debit Accounts Payable (2100) and credit your bank account.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : dialogType === 'receive' ? <ArrowDownToLine size={16} className="mr-2" /> : <ArrowUpFromLine size={16} className="mr-2" />}
              {dialogType === 'receive' ? 'Receive' : 'Pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
