import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, BookOpen } from 'lucide-react'
import apiClient from '@/api/client'

interface LedgerEntry {
  date: string
  journal_number: string
  description: string
  debit_amount: number
  credit_amount: number
  running_balance: number
}

interface Account {
  id: string
  code: string
  name: string
}

export function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAccounts = useCallback(async (search = '') => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500, is_active: 'true', search } })
      setAccounts(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleAccountSearch = useCallback((q: string) => {
    fetchAccounts(q)
  }, [fetchAccounts])

  const accountOptions: ComboboxOption[] = useMemo(() =>
    accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [accounts]
  )

  const fetchLedger = useCallback(async () => {
    if (!selectedAccount) return
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/reports/general-ledger', { params: { account_id: selectedAccount } })
      setEntries(res.data.data?.entries || [])
    } catch {
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedAccount])

  useEffect(() => { if (selectedAccount) fetchLedger() }, [selectedAccount, fetchLedger])

  const selectedAcc = accounts.find((a) => a.id === selectedAccount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">General Ledger</h1>
            <p className="text-muted-foreground">View transaction history for each account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Combobox
            value={selectedAccount}
            onChange={setSelectedAccount}
            options={accountOptions}
            onSearch={handleAccountSearch}
            placeholder="Select an account..."
            searchPlaceholder="Search accounts..."
            className="w-80"
          />
          <Button variant="outline" onClick={fetchLedger} disabled={!selectedAccount}>Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {selectedAcc ? `${selectedAcc.code} — ${selectedAcc.name}` : 'Select an account to view ledger'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedAccount ? (
            <div className="py-12 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>Choose an account from the dropdown above to view its ledger.</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Journal #</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No entries for this account</td></tr>
                ) : (
                  entries.map((entry, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 text-xs">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 font-mono text-xs">{entry.journal_number}</td>
                      <td className="px-4 py-2">{entry.description}</td>
                      <td className="px-4 py-2 text-right font-mono">{entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : ''}</td>
                      <td className="px-4 py-2 text-right font-mono">{entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : ''}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium">{entry.running_balance.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
