import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import apiClient from '@/api/client'

interface ProfitLossRow {
  code: string
  name: string
  balance: number
}

interface ProfitLossSection {
  title: string
  accounts: ProfitLossRow[]
  total: number
}

export function ProfitLossPage() {
  const [revenue, setRevenue] = useState<ProfitLossSection | null>(null)
  const [expenses, setExpenses] = useState<ProfitLossSection | null>(null)
  const [netProfit, setNetProfit] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/reports/profit-loss')
      const data = res.data.data
      setRevenue(data?.revenue || null)
      setExpenses(data?.expenses || null)
      setNetProfit(data?.net_profit || 0)
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  const renderSection = (section: ProfitLossSection | null, icon: React.ReactNode) => {
    if (!section) return null
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {section.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Account</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(!section.accounts || section.accounts.length === 0) ? (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">No data</td></tr>
              ) : (
                section.accounts.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{row.code}</td>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
              <tr className="bg-muted/50 font-bold">
                <td colSpan={2} className="px-4 py-2">Total {section.title}</td>
                <td className="px-4 py-2 text-right font-mono">{(section.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profit & Loss</h1>
          <p className="text-muted-foreground">Income statement showing revenue, expenses, and net profit</p>
        </div>
        <Button variant="outline" onClick={fetchReport}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection(revenue, <TrendingUp size={18} className="text-green-600" />)}
          {renderSection(expenses, <TrendingDown size={18} className="text-red-600" />)}

          <Card className={netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                <span className={`font-mono ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
