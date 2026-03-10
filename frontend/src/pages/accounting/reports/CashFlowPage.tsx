import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import apiClient from '@/api/client'

interface CashFlowSection {
  title: string
  items: { description: string; amount: number }[]
  total: number
}

export function CashFlowPage() {
  const [operating, setOperating] = useState<CashFlowSection | null>(null)
  const [investing, setInvesting] = useState<CashFlowSection | null>(null)
  const [financing, setFinancing] = useState<CashFlowSection | null>(null)
  const [netChange, setNetChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/reports/cash-flow')
      const data = res.data.data
      setOperating(data?.operating || null)
      setInvesting(data?.investing || null)
      setFinancing(data?.financing || null)
      setNetChange(data?.net_change || 0)
    } catch {
      // API may not be implemented yet — show empty state
      setOperating({ title: 'Operating Activities', items: [], total: 0 })
      setInvesting({ title: 'Investing Activities', items: [], total: 0 })
      setFinancing({ title: 'Financing Activities', items: [], total: 0 })
      setNetChange(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  const renderSection = (section: CashFlowSection | null, icon: React.ReactNode) => {
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
            <tbody>
              {section.items.length === 0 ? (
                <tr><td className="px-4 py-4 text-center text-muted-foreground">No data available</td></tr>
              ) : (
                section.items.map((item, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2">{item.description}</td>
                    <td className={`px-4 py-2 text-right font-mono ${item.amount < 0 ? 'text-destructive' : ''}`}>
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-muted/50 font-bold">
                <td className="px-4 py-2">Net {section.title}</td>
                <td className={`px-4 py-2 text-right font-mono ${section.total < 0 ? 'text-destructive' : ''}`}>
                  {section.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
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
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cash Flow Statement</h1>
            <p className="text-muted-foreground">Operating, investing, and financing activities</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchReport}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection(operating, <ArrowDownRight size={18} className="text-blue-600" />)}
          {renderSection(investing, <ArrowUpRight size={18} className="text-purple-600" />)}
          {renderSection(financing, <Wallet size={18} className="text-green-600" />)}

          <Card className={netChange >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Net Change in Cash</span>
                <span className={`font-mono ${netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {netChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
