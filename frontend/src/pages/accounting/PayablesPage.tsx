import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import apiClient from '@/api/client'

interface SupplierPayable {
  supplier_id: string
  supplier_name: string
  total_amount: number
  paid_amount: number
  outstanding: number
  current: number
  days_30: number
  days_60: number
  days_90_plus: number
  invoice_count: number
}

interface PayableSummary {
  total_payable: number
  total_overdue: number
  total_current: number
  suppliers: SupplierPayable[]
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PayablesPage() {
  const [data, setData] = useState<PayableSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/accounting/payables')
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
        <h1 className="text-2xl font-bold">Accounts Payable</h1>
        <p className="text-muted-foreground">Outstanding balances to suppliers</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable</CardTitle>
            <DollarSign size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${fmt(data?.total_payable || 0)}</div>
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

      {/* Supplier Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.suppliers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No outstanding payables. Purchase invoices will appear here once created.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Supplier</th>
                    <th className="pb-2 font-medium text-right">Bills</th>
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
                  {data.suppliers.map((s) => (
                    <tr key={s.supplier_id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 font-medium">{s.supplier_name}</td>
                      <td className="py-3 text-right">
                        <Badge variant="secondary">{s.invoice_count}</Badge>
                      </td>
                      <td className="py-3 text-right font-mono">${fmt(s.total_amount)}</td>
                      <td className="py-3 text-right font-mono text-muted-foreground">${fmt(s.paid_amount)}</td>
                      <td className="py-3 text-right font-mono font-medium">${fmt(s.outstanding)}</td>
                      <td className="py-3 text-right font-mono text-green-600">{s.current > 0 ? `$${fmt(s.current)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-yellow-600">{s.days_30 > 0 ? `$${fmt(s.days_30)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-orange-600">{s.days_60 > 0 ? `$${fmt(s.days_60)}` : '-'}</td>
                      <td className="py-3 text-right font-mono text-destructive">{s.days_90_plus > 0 ? `$${fmt(s.days_90_plus)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
