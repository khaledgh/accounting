import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface BalanceSheetRow {
  code: string
  name: string
  balance: number
}

interface BalanceSheetSection {
  title: string
  accounts: BalanceSheetRow[]
  total: number
}

export function BalanceSheetPage() {
  const [assets, setAssets] = useState<BalanceSheetSection | null>(null)
  const [liabilities, setLiabilities] = useState<BalanceSheetSection | null>(null)
  const [equity, setEquity] = useState<BalanceSheetSection | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/reports/balance-sheet')
      const data = res.data.data
      setAssets(data?.assets || null)
      setLiabilities(data?.liabilities || null)
      setEquity(data?.equity || null)
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  const renderSection = (section: BalanceSheetSection | null) => {
    if (!section) return null
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{section.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Account</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
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
          <h1 className="text-2xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Assets, liabilities, and equity overview</p>
        </div>
        <Button variant="outline" onClick={fetchReport}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection(assets)}
          {renderSection(liabilities)}
          {renderSection(equity)}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Liabilities + Equity</span>
                <span className="font-mono">
                  {((liabilities?.total || 0) + (equity?.total || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
