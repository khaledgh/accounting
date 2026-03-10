import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import apiClient from '@/api/client'

interface CustomerReceivable {
  customer_id: string
  customer_name: string
  company_name: string
  total_amount: number
  paid_amount: number
  outstanding: number
  current: number
  days_30: number
  days_60: number
  days_90_plus: number
  invoice_count: number
}

interface ReceivableSummary {
  total_outstanding: number
  total_overdue: number
  total_current: number
  customers: CustomerReceivable[]
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ReceivablesPage() {
  const [data, setData] = useState<ReceivableSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/accounting/receivables')
        setData(res.data.data)
      } catch { /* ignore */ }
      finally { setIsLoading(false) }
    }
    fetch()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounts Receivable</h1>
        <p className="text-muted-foreground">Outstanding balances from customers</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
            <DollarSign size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${fmt(data?.total_outstanding || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertTriangle size={16} className="text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${fmt(data?.total_overdue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
            <Clock size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${fmt(data?.total_current || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.customers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No outstanding receivables</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium text-right">Invoices</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Paid</th>
                    <th className="pb-2 font-medium text-right">Outstanding</th>
                    <th className="pb-2 font-medium text-right">Current</th>
                    <th className="pb-2 font-medium text-right">1-30d</th>
                    <th className="pb-2 font-medium text-right">31-60d</th>
                    <th className="pb-2 font-medium text-right">90d+</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.customer_id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3">
                        <div className="font-medium">{c.customer_name}</div>
                        {c.company_name && <div className="text-xs text-muted-foreground">{c.company_name}</div>}
                      </td>
                      <td className="py-3 text-right">
                        <Badge variant="secondary">{c.invoice_count}</Badge>
                      </td>
                      <td className="py-3 text-right font-mono">${fmt(c.total_amount)}</td>
                      <td className="py-3 text-right font-mono text-muted-foreground">${fmt(c.paid_amount)}</td>
                      <td className="py-3 text-right font-mono font-medium">${fmt(c.outstanding)}</td>
                      <td className="py-3 text-right font-mono text-green-600">{c.current > 0 ? `$${fmt(c.current)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-yellow-600">{c.days_30 > 0 ? `$${fmt(c.days_30)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-orange-600">{c.days_60 > 0 ? `$${fmt(c.days_60)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-destructive">{c.days_90_plus > 0 ? `$${fmt(c.days_90_plus)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-medium">
                    <td className="pt-3">Total</td>
                    <td className="pt-3 text-right">{data.customers.reduce((s, c) => s + c.invoice_count, 0)}</td>
                    <td className="pt-3 text-right font-mono">${fmt(data.customers.reduce((s, c) => s + c.total_amount, 0))}</td>
                    <td className="pt-3 text-right font-mono">${fmt(data.customers.reduce((s, c) => s + c.paid_amount, 0))}</td>
                    <td className="pt-3 text-right font-mono">${fmt(data.total_outstanding)}</td>
                    <td className="pt-3 text-right font-mono text-green-600">${fmt(data.total_current)}</td>
                    <td className="pt-3 text-right font-mono text-yellow-600">${fmt(data.customers.reduce((s, c) => s + c.days_30, 0))}</td>
                    <td className="pt-3 text-right font-mono text-orange-600">${fmt(data.customers.reduce((s, c) => s + c.days_60, 0))}</td>
                    <td className="pt-3 text-right font-mono text-destructive">${fmt(data.customers.reduce((s, c) => s + c.days_90_plus, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
