import { useState, useEffect, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Send, RotateCcw, Trash2, Eye } from 'lucide-react'
import apiClient from '@/api/client'

interface JournalEntry {
  id: string
  account_id: string
  account?: { code: string; name: string }
  description: string
  debit_amount: number
  credit_amount: number
  line_number: number
}

interface Journal {
  id: string
  number: string
  date: string
  reference: string
  description: string
  status: string
  total_debit: number
  total_credit: number
  currency_code: string
  entries?: JournalEntry[]
  created_at: string
}

interface Account {
  id: string
  code: string
  name: string
  account_type: string
}

interface FinancialYear {
  id: string
  name: string
  code: string
  is_closed: boolean
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  draft: 'secondary',
  posted: 'default',
  reversed: 'destructive',
}

const columns: ColumnDef<Journal, unknown>[] = [
  { accessorKey: 'number', header: 'Number' },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  { accessorKey: 'reference', header: 'Reference', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'description', header: 'Description' },
  {
    accessorKey: 'total_debit',
    header: 'Debit',
    cell: ({ getValue }) => (getValue() as number).toLocaleString('en-US', { minimumFractionDigits: 2 }),
  },
  {
    accessorKey: 'total_credit',
    header: 'Credit',
    cell: ({ getValue }) => (getValue() as number).toLocaleString('en-US', { minimumFractionDigits: 2 }),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue() as string
      return <Badge variant={statusColors[status] || 'secondary'}>{status}</Badge>
    },
  },
]

interface EntryLine {
  account_id: string
  description: string
  debit_amount: string
  credit_amount: string
}

export function JournalEntriesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    financial_year_id: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
  })

  const [lines, setLines] = useState<EntryLine[]>([
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
  ])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500, is_active: 'true' } })
      setAccounts(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  const fetchFinancialYears = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/financial-years', { params: { page_size: 50 } })
      const years = (res.data.data?.data || []).filter((y: FinancialYear) => !y.is_closed)
      setFinancialYears(years)
      if (years.length > 0) {
        setForm((prev) => prev.financial_year_id ? prev : { ...prev, financial_year_id: years[0].id })
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAccounts()
    fetchFinancialYears()
  }, [fetchAccounts, fetchFinancialYears])

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const addLine = () => {
    setLines((prev) => [...prev, { account_id: '', description: '', debit_amount: '', credit_amount: '' }])
  }

  const removeLine = (index: number) => {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLine = (index: number, field: keyof EntryLine, value: string) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.financial_year_id) {
      setError('Please select a financial year')
      return
    }
    if (!isBalanced) {
      setError('Journal must be balanced (total debit = total credit)')
      return
    }

    const entries = lines
      .filter((l) => l.account_id && (parseFloat(l.debit_amount) || parseFloat(l.credit_amount)))
      .map((l) => ({
        account_id: l.account_id,
        description: l.description,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
      }))

    if (entries.length < 2) {
      setError('At least 2 valid entry lines are required')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.post('/accounting/journals', { ...form, entries })
      setCreateOpen(false)
      setRefreshKey((k) => k + 1)
      setLines([
        { account_id: '', description: '', debit_amount: '', credit_amount: '' },
        { account_id: '', description: '', debit_amount: '', credit_amount: '' },
      ])
    } catch {
      setError('Failed to create journal entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRowClick = async (journal: Journal) => {
    try {
      const res = await apiClient.get(`/accounting/journals/${journal.id}`)
      setSelectedJournal(res.data.data)
      setDetailOpen(true)
    } catch {
      alert('Failed to load journal details')
    }
  }

  const handlePost = async () => {
    if (!selectedJournal) return
    if (!confirm('Post this journal? Account balances will be updated.')) return
    try {
      await apiClient.post(`/accounting/journals/${selectedJournal.id}/post`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to post journal')
    }
  }

  const handleReverse = async () => {
    if (!selectedJournal) return
    if (!confirm('Reverse this journal? A reversal journal will be created.')) return
    try {
      await apiClient.post(`/accounting/journals/${selectedJournal.id}/reverse`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to reverse journal')
    }
  }

  const handleDelete = async () => {
    if (!selectedJournal) return
    if (!confirm('Delete this draft journal?')) return
    try {
      await apiClient.delete(`/accounting/journals/${selectedJournal.id}`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to delete journal')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Create and manage double-entry journal entries</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" /> New Journal Entry
        </Button>
      </div>

      <DataTable<Journal>
        columns={columns}
        fetchUrl="/accounting/journals"
        searchPlaceholder="Search journals..."
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Financial Year</Label>
                <Select value={form.financial_year_id} onChange={(e) => setForm((p) => ({ ...p, financial_year_id: e.target.value }))}>
                  <option value="">Select...</option>
                  {financialYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>{fy.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Entry Lines</h4>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus size={14} className="mr-1" /> Add Line
                </Button>
              </div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right w-32">Debit</th>
                      <th className="px-3 py-2 text-right w-32">Credit</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1">
                          <Select value={line.account_id} onChange={(e) => updateLine(i, 'account_id', e.target.value)} className="text-xs h-8">
                            <option value="">Select account...</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.01" min="0" value={line.debit_amount} onChange={(e) => updateLine(i, 'debit_amount', e.target.value)} className="h-8 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.01" min="0" value={line.credit_amount} onChange={(e) => updateLine(i, 'credit_amount', e.target.value)} className="h-8 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                            <Trash2 size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right">{totalDebit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{totalCredit.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              {!isBalanced && totalDebit + totalCredit > 0 && (
                <p className="text-xs text-destructive mt-1">
                  Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)} — Journal must be balanced
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isBalanced}>
                {isSubmitting ? 'Saving...' : 'Create Journal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Journal {selectedJournal?.number}
              {selectedJournal && (
                <Badge variant={statusColors[selectedJournal.status] || 'secondary'} className="ml-2">
                  {selectedJournal.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedJournal && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Date:</span><p className="font-medium">{new Date(selectedJournal.date).toLocaleDateString()}</p></div>
                <div><span className="text-muted-foreground">Reference:</span><p className="font-medium">{selectedJournal.reference || '-'}</p></div>
                <div><span className="text-muted-foreground">Currency:</span><p className="font-medium">{selectedJournal.currency_code}</p></div>
                <div><span className="text-muted-foreground">Description:</span><p className="font-medium">{selectedJournal.description || '-'}</p></div>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJournal.entries?.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{entry.line_number}</td>
                        <td className="px-3 py-2 font-medium">{entry.account?.code} - {entry.account?.name}</td>
                        <td className="px-3 py-2">{entry.description || '-'}</td>
                        <td className="px-3 py-2 text-right font-mono">{entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : ''}</td>
                        <td className="px-3 py-2 text-right font-mono">{entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : ''}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td colSpan={3} className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right font-mono">{selectedJournal.total_debit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{selectedJournal.total_credit.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <DialogFooter>
                {selectedJournal.status === 'draft' && (
                  <>
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      <Trash2 size={14} className="mr-1" /> Delete
                    </Button>
                    <Button size="sm" onClick={handlePost}>
                      <Send size={14} className="mr-1" /> Post Journal
                    </Button>
                  </>
                )}
                {selectedJournal.status === 'posted' && (
                  <Button variant="outline" size="sm" onClick={handleReverse}>
                    <RotateCcw size={14} className="mr-1" /> Reverse
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
