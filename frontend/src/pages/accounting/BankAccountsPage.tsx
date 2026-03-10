import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Landmark, Banknote, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Loader2, ChevronLeft } from 'lucide-react'
import apiClient from '@/api/client'

interface BankAccount {
  id: string
  code: string
  name: string
  current_balance: number
  currency_code: string
  is_active: boolean
}

interface Transaction {
  id: string
  date: string
  number: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface ChartAccount {
  id: string
  code: string
  name: string
  account_type: string
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getAccountIcon(code: string) {
  if (code === '1110') return <Banknote size={20} className="text-green-600" />
  return <Landmark size={20} className="text-blue-600" />
}

export function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [allAccounts, setAllAccounts] = useState<ChartAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(false)

  const [transferOpen, setTransferOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [txForm, setTxForm] = useState({
    from_account_id: '',
    to_account_id: '',
    account_id: '',
    counter_account_id: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  })

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/bank-accounts')
      setAccounts(res.data.data || [])
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [])

  const fetchAllAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500 } })
      setAllAccounts(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAccounts()
    fetchAllAccounts()
  }, [fetchAccounts, fetchAllAccounts])

  const fetchTransactions = useCallback(async (accountId: string) => {
    setTxLoading(true)
    try {
      const res = await apiClient.get(`/accounting/bank-accounts/${accountId}/transactions`, { params: { page_size: 50 } })
      setTransactions(res.data.data?.data || [])
    } catch { /* ignore */ }
    finally { setTxLoading(false) }
  }, [])

  const selectAccount = (acc: BankAccount) => {
    setSelectedAccount(acc)
    fetchTransactions(acc.id)
  }

  const resetForm = () => {
    setTxForm({
      from_account_id: '', to_account_id: '', account_id: '', counter_account_id: '',
      amount: 0, date: new Date().toISOString().split('T')[0], reference: '', notes: '',
    })
    setError('')
  }

  const handleTransfer = async () => {
    if (txForm.amount <= 0) { setError('Amount must be greater than 0'); return }
    setIsSaving(true); setError('')
    try {
      await apiClient.post('/accounting/bank-accounts/transfer', {
        from_account_id: txForm.from_account_id,
        to_account_id: txForm.to_account_id,
        amount: txForm.amount,
        date: txForm.date,
        reference: txForm.reference,
        notes: txForm.notes,
      })
      setTransferOpen(false)
      fetchAccounts()
      if (selectedAccount) fetchTransactions(selectedAccount.id)
    } catch { setError('Failed to process transfer') }
    finally { setIsSaving(false) }
  }

  const handleDepositOrWithdraw = async (type: 'deposit' | 'withdrawal') => {
    if (txForm.amount <= 0) { setError('Amount must be greater than 0'); return }
    setIsSaving(true); setError('')
    try {
      await apiClient.post(`/accounting/bank-accounts/${type}`, {
        account_id: txForm.account_id,
        counter_account_id: txForm.counter_account_id,
        amount: txForm.amount,
        date: txForm.date,
        reference: txForm.reference,
        notes: txForm.notes,
      })
      if (type === 'deposit') setDepositOpen(false)
      else setWithdrawOpen(false)
      fetchAccounts()
      if (selectedAccount) fetchTransactions(selectedAccount.id)
    } catch { setError(`Failed to process ${type}`) }
    finally { setIsSaving(false) }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0)

  const bankOptions: ComboboxOption[] = useMemo(() =>
    accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, sublabel: `Balance: $${fmt(a.current_balance)}` })),
    [accounts]
  )

  const bankOptionsExcluding = (excludeId: string) =>
    bankOptions.filter((o) => o.value !== excludeId)

  const counterOptions: ComboboxOption[] = useMemo(() =>
    allAccounts.filter((a) => !a.code.startsWith('11')).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [allAccounts]
  )

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {selectedAccount ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedAccount(null)}>
                <ChevronLeft size={18} />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedAccount.name}</h1>
                <p className="text-muted-foreground">Account {selectedAccount.code} · Balance: ${fmt(selectedAccount.current_balance)}</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold">Banking</h1>
              <p className="text-muted-foreground">Manage bank and cash accounts</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { resetForm(); setTransferOpen(true) }}>
            <ArrowRightLeft size={14} className="mr-1" /> Transfer
          </Button>
          <Button variant="outline" size="sm" onClick={() => { resetForm(); setDepositOpen(true) }}>
            <ArrowDownToLine size={14} className="mr-1" /> Deposit
          </Button>
          <Button variant="outline" size="sm" onClick={() => { resetForm(); setWithdrawOpen(true) }}>
            <ArrowUpFromLine size={14} className="mr-1" /> Withdraw
          </Button>
        </div>
      </div>

      {!selectedAccount ? (
        <>
          {/* Total Balance Card */}
          <Card className="bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Total Cash & Bank Balance</p>
              <p className="text-3xl font-bold">${fmt(totalBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          {/* Account Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <Card
                key={acc.id}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/40"
                onClick={() => selectAccount(acc)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        {getAccountIcon(acc.code)}
                      </div>
                      <div>
                        <p className="font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.code}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold">${fmt(acc.current_balance)}</p>
                    <p className="text-xs text-muted-foreground">{acc.currency_code}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {accounts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No bank or cash accounts found. Create accounts under code 11xx in Chart of Accounts.
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Transaction List */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : transactions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No transactions found for this account</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Journal #</th>
                      <th className="pb-2 font-medium">Reference</th>
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Debit</th>
                      <th className="pb-2 font-medium text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="py-3 font-mono text-xs">{tx.number}</td>
                        <td className="py-3">{tx.reference || '-'}</td>
                        <td className="py-3 max-w-[300px] truncate">{tx.description}</td>
                        <td className="py-3 text-right font-mono">{tx.debit > 0 ? <span className="text-green-600">${fmt(tx.debit)}</span> : '-'}</td>
                        <td className="py-3 text-right font-mono">{tx.credit > 0 ? <span className="text-red-500">${fmt(tx.credit)}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Between Accounts</DialogTitle></DialogHeader>
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Combobox
                value={txForm.from_account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, from_account_id: v }))}
                options={bankOptions}
                placeholder="Select source"
                searchPlaceholder="Search accounts..."
              />
            </div>
            <div className="space-y-2">
              <Label>To Account</Label>
              <Combobox
                value={txForm.to_account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, to_account_id: v }))}
                options={bankOptionsExcluding(txForm.from_account_id)}
                placeholder="Select destination"
                searchPlaceholder="Search accounts..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={txForm.date} onChange={(v) => setTxForm((p) => ({ ...p, date: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={txForm.reference} onChange={(e) => setTxForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={txForm.notes} onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowRightLeft size={16} className="mr-2" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Deposit</DialogTitle></DialogHeader>
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Deposit To</Label>
              <Combobox
                value={txForm.account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, account_id: v }))}
                options={bankOptions}
                placeholder="Select bank account"
                searchPlaceholder="Search bank accounts..."
              />
            </div>
            <div className="space-y-2">
              <Label>Source (Credit Account)</Label>
              <Combobox
                value={txForm.counter_account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, counter_account_id: v }))}
                options={counterOptions}
                placeholder="Select account"
                searchPlaceholder="Search accounts..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={txForm.date} onChange={(v) => setTxForm((p) => ({ ...p, date: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={txForm.reference} onChange={(e) => setTxForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={txForm.notes} onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={() => handleDepositOrWithdraw('deposit')} disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowDownToLine size={16} className="mr-2" />}
              Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Withdrawal</DialogTitle></DialogHeader>
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Withdraw From</Label>
              <Combobox
                value={txForm.account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, account_id: v }))}
                options={bankOptions}
                placeholder="Select bank account"
                searchPlaceholder="Search bank accounts..."
              />
            </div>
            <div className="space-y-2">
              <Label>Destination (Debit Account)</Label>
              <Combobox
                value={txForm.counter_account_id}
                onChange={(v) => setTxForm((p) => ({ ...p, counter_account_id: v }))}
                options={counterOptions}
                placeholder="Select account"
                searchPlaceholder="Search accounts..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={txForm.date} onChange={(v) => setTxForm((p) => ({ ...p, date: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={txForm.reference} onChange={(e) => setTxForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={txForm.notes} onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={() => handleDepositOrWithdraw('withdrawal')} disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowUpFromLine size={16} className="mr-2" />}
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
