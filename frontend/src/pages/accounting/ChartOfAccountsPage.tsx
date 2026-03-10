import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FolderTree, Loader2, Sparkles } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  parent_id: string | null
  code: string
  name: string
  account_type: string
  description: string
  currency_code: string
  is_active: boolean
  is_system: boolean
  is_control_account: boolean
  control_type: string
  level: number
  full_path: string
  normal_balance: string
  opening_balance: number
  current_balance: number
  children?: Account[]
}

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
]

const typeColors: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-800',
  liability: 'bg-red-100 text-red-800',
  equity: 'bg-purple-100 text-purple-800',
  revenue: 'bg-green-100 text-green-800',
  expense: 'bg-orange-100 text-orange-800',
}

function AccountTreeItem({
  account,
  onEdit,
  onDelete,
  depth = 0,
}: {
  account: Account
  onEdit: (a: Account) => void
  onDelete: (a: Account) => void
  depth?: number
}) {
  const [isOpen, setIsOpen] = useState(depth < 1)
  const hasChildren = account.children && account.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors group',
          depth === 0 && 'bg-muted/30 font-semibold'
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-5 w-5 items-center justify-center"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        <span className="min-w-[60px] font-mono text-sm text-muted-foreground">{account.code}</span>
        <span className="flex-1 text-sm">{account.name}</span>

        <span className={cn('rounded-full px-2 py-0.5 text-xs', typeColors[account.account_type] || 'bg-gray-100')}>
          {account.account_type}
        </span>

        {account.is_control_account && (
          <Badge variant="outline" className="text-xs">
            {account.control_type}
          </Badge>
        )}

        <span className="min-w-[100px] text-right font-mono text-sm">
          {account.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(account)}>
            <Pencil size={12} />
          </Button>
          {!account.is_system && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(account)}>
              <Trash2 size={12} className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div>
          {account.children!.map((child) => (
            <AccountTreeItem key={child.id} account={child} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [flatAccounts, setFlatAccounts] = useState<Account[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    parent_id: '',
    code: '',
    name: '',
    account_type: 'asset',
    description: '',
    currency_code: 'USD',
    is_control_account: false,
    control_type: '',
    normal_balance: 'debit',
    opening_balance: 0,
  })

  const fetchTree = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/accounts/tree')
      setAccounts(res.data.data || [])
    } catch {
      console.error('Failed to fetch accounts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchFlat = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500, is_active: 'true' } })
      setFlatAccounts(res.data.data?.data || [])
    } catch {
      console.error('Failed to fetch flat accounts')
    }
  }, [])

  useEffect(() => {
    fetchTree()
    fetchFlat()
  }, [fetchTree, fetchFlat])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value
    setForm((prev) => ({ ...prev, [target.name]: value }))
  }

  const openCreate = (parentId?: string) => {
    setEditingId(null)
    setForm({
      parent_id: parentId || '',
      code: '',
      name: '',
      account_type: 'asset',
      description: '',
      currency_code: 'USD',
      is_control_account: false,
      control_type: '',
      normal_balance: 'debit',
      opening_balance: 0,
    })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditingId(account.id)
    setForm({
      parent_id: account.parent_id || '',
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      description: account.description,
      currency_code: account.currency_code,
      is_control_account: account.is_control_account,
      control_type: account.control_type,
      normal_balance: account.normal_balance,
      opening_balance: account.opening_balance,
    })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id || null,
        opening_balance: Number(form.opening_balance),
      }
      if (editingId) {
        await apiClient.put(`/accounting/accounts/${editingId}`, {
          name: form.name,
          description: form.description,
          currency_code: form.currency_code,
          is_control_account: form.is_control_account,
          control_type: form.control_type,
          opening_balance: Number(form.opening_balance),
        })
      } else {
        await apiClient.post('/accounting/accounts', payload)
      }
      setDialogOpen(false)
      fetchTree()
      fetchFlat()
    } catch {
      setError('Failed to save account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete account ${account.code} - ${account.name}?`)) return
    try {
      await apiClient.delete(`/accounting/accounts/${account.id}`)
      fetchTree()
      fetchFlat()
    } catch {
      alert('Failed to delete account. It may have children or journal entries.')
    }
  }

  const handleSeed = async () => {
    if (!confirm('Seed default chart of accounts? This only works if no accounts exist yet.')) return
    try {
      await apiClient.post('/accounting/accounts/seed')
      fetchTree()
      fetchFlat()
    } catch {
      alert('Failed to seed accounts. Chart of accounts may already have entries.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Hierarchical account structure for your company</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSeed}>
            <Sparkles size={16} className="mr-2" /> Seed Defaults
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus size={16} className="mr-2" /> Add Account
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderTree size={16} />
            <span className="flex-1">Account Tree</span>
            <span className="min-w-[100px] text-right">Balance</span>
            <span className="w-[60px]" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No accounts yet. Click "Seed Defaults" to create a standard chart of accounts.</p>
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((acc) => (
                <AccountTreeItem key={acc.id} account={acc} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Account' : 'Create Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            {!editingId && (
              <div className="space-y-2">
                <Label htmlFor="parent_id">Parent Account</Label>
                <Select id="parent_id" name="parent_id" value={form.parent_id} onChange={handleChange}>
                  <option value="">None (Root Level)</option>
                  {flatAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" value={form.code} onChange={handleChange} required disabled={!!editingId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_type">Type</Label>
                <Select id="account_type" name="account_type" value={form.account_type} onChange={handleChange} disabled={!!editingId}>
                  {accountTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" value={form.description} onChange={handleChange} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency_code">Currency</Label>
                <Input id="currency_code" name="currency_code" value={form.currency_code} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening_balance">Opening Balance</Label>
                <Input id="opening_balance" name="opening_balance" type="number" step="0.01" value={form.opening_balance} onChange={handleChange} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_control_account" name="is_control_account" checked={form.is_control_account} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                <Label htmlFor="is_control_account">Control Account</Label>
              </div>
              {form.is_control_account && (
                <div className="flex-1 space-y-1">
                  <Select name="control_type" value={form.control_type} onChange={handleChange}>
                    <option value="">Select type</option>
                    <option value="receivable">Accounts Receivable</option>
                    <option value="payable">Accounts Payable</option>
                    <option value="inventory">Inventory</option>
                    <option value="bank">Bank</option>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
