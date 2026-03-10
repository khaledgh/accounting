import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, FileText, BarChart3, Loader2,
  Landmark, Banknote, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Receipt, ShoppingCart,
} from 'lucide-react'
import apiClient from '@/api/client'

interface Journal {
  id: string
  number: string
  date: string
  description: string
  total_debit: number
  status: string
}

interface MonthlyPoint {
  month: string
  revenue: number
  expenses: number
}

interface DashboardData {
  total_revenue: number
  total_expenses: number
  net_profit: number
  cash_balance: number
  recent_journals: Journal[]
  monthly_data: MonthlyPoint[]
}

interface BankAccount {
  id: string
  code: string
  name: string
  current_balance: number
  currency_code: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export function AccountingDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, bankRes] = await Promise.all([
        apiClient.get('/dashboard/accounting'),
        apiClient.get('/accounting/bank-accounts'),
      ])
      setData(dashRes.data.data)
      setBankAccounts(bankRes.data.data || [])
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  const d = data || { total_revenue: 0, total_expenses: 0, net_profit: 0, cash_balance: 0, recent_journals: [], monthly_data: [] }
  const maxBar = Math.max(...(d.monthly_data || []).map((m) => Math.max(m.revenue, m.expenses)), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounting Dashboard</h1>
          <p className="text-muted-foreground">Financial overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/accounting/journals')}>
            <FileText size={14} className="mr-1" /> New Journal
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/accounting/reports/trial-balance')}>
            <BarChart3 size={14} className="mr-1" /> Reports
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(d.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">Current financial year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(d.total_expenses)}</div>
            <p className="text-xs text-muted-foreground">Current financial year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.net_profit)}</div>
            <p className="text-xs text-muted-foreground">Current financial year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(d.cash_balance)}</div>
            <p className="text-xs text-muted-foreground">As of today</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Receive Payment', icon: <ArrowDownToLine size={18} />, href: '/accounting/payments', color: 'text-green-600' },
          { label: 'Make Payment', icon: <ArrowUpFromLine size={18} />, href: '/accounting/payments', color: 'text-orange-600' },
          { label: 'Bank Transfer', icon: <ArrowRightLeft size={18} />, href: '/accounting/bank-accounts', color: 'text-blue-600' },
          { label: 'New Expense', icon: <Receipt size={18} />, href: '/accounting/expenses', color: 'text-red-600' },
          { label: 'Purchase Invoice', icon: <ShoppingCart size={18} />, href: '/accounting/purchase-invoices/new', color: 'text-purple-600' },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.href)}
            className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
          >
            <div className={action.color}>{action.icon}</div>
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Bank Accounts + Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Bank Account Balances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Bank & Cash</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/accounting/bank-accounts')}>View All</Button>
          </CardHeader>
          <CardContent>
            {bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {bankAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate('/accounting/bank-accounts')}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        {acc.code === '1110' ? <Banknote size={15} className="text-green-600" /> : <Landmark size={15} className="text-blue-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{acc.name}</p>
                        <p className="text-[10px] text-muted-foreground">{acc.code}</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold">{formatCurrency(acc.current_balance)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bank accounts set up.</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Expenses Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Expenses (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {d.monthly_data && d.monthly_data.length > 0 ? (
              <div className="space-y-3">
                {d.monthly_data.map((m) => (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium w-8">{m.month}</span>
                      <span className="text-muted-foreground">{formatCurrency(m.revenue)} / {formatCurrency(m.expenses)}</span>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div className="bg-green-500 rounded-sm h-full transition-all" style={{ width: `${(m.revenue / maxBar) * 100}%` }} />
                      <div className="bg-red-400 rounded-sm h-full transition-all" style={{ width: `${(m.expenses / maxBar) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" /> Revenue</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" /> Expenses</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Journals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Journal Entries</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/accounting/journals')}>View All</Button>
        </CardHeader>
        <CardContent>
          {d.recent_journals && d.recent_journals.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {d.recent_journals.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{j.number}</span>
                      <Badge variant={j.status === 'posted' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{j.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{j.description}</p>
                  </div>
                  <span className="font-mono text-xs font-medium ml-4">{formatCurrency(j.total_debit)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No journal entries yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
