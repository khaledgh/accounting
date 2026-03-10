import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface TrialBalanceRow {
  account_id: string
  code: string
  name: string
  account_type: string
  debit_balance: number
  credit_balance: number
}

interface FinancialYear {
  id: string
  name: string
}

export function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([])
  const [selectedFY, setSelectedFY] = useState('')

  const fetchFinancialYears = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/financial-years', { params: { page_size: 50 } })
      const years = res.data.data?.data || []
      setFinancialYears(years)
      if (years.length > 0) setSelectedFY(years[0].id)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchFinancialYears() }, [fetchFinancialYears])

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedFY) params.financial_year_id = selectedFY
      const res = await apiClient.get('/accounting/reports/trial-balance', { params })
      setRows(res.data.data?.rows || [])
      setTotalDebit(res.data.data?.total_debit || 0)
      setTotalCredit(res.data.data?.total_credit || 0)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedFY])

  useEffect(() => { if (selectedFY) fetchReport() }, [selectedFY, fetchReport])

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string> = { format }
      if (selectedFY) params.financial_year_id = selectedFY
      const res = await apiClient.get('/accounting/reports/trial-balance', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `trial-balance.${format === 'excel' ? 'xlsx' : 'pdf'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch { alert('Export failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Summary of all account balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)} className="w-48">
            <option value="">All periods</option>
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.name}</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileSpreadsheet size={16} className="mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <Download size={16} className="mr-1" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Trial Balance Report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Account Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No data for selected period</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.account_id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono">{row.code}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 capitalize">{row.account_type}</td>
                      <td className="px-4 py-2 text-right font-mono">{row.debit_balance > 0 ? row.debit_balance.toFixed(2) : ''}</td>
                      <td className="px-4 py-2 text-right font-mono">{row.credit_balance > 0 ? row.credit_balance.toFixed(2) : ''}</td>
                    </tr>
                  ))
                )}
                {rows.length > 0 && (
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={3} className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{totalCredit.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
