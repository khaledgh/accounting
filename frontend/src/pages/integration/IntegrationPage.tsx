import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Link2, ScrollText, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface AccountMapping {
  id: string
  event_type: string
  debit_account_id: string
  credit_account_id: string
  description: string
  is_active: boolean
}

interface Account {
  id: string
  code: string
  name: string
}

interface IntegrationLog {
  id: string
  event_type: string
  source_id: string
  source_type: string
  journal_id: string | null
  status: string
  error_msg: string
  created_at: string
}

const eventTypes = [
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.confirmed', label: 'Order Confirmed' },
  { value: 'order.shipped', label: 'Order Shipped' },
  { value: 'order.delivered', label: 'Order Delivered' },
  { value: 'order.cancelled', label: 'Order Cancelled' },
  { value: 'payment.received', label: 'Payment Received' },
  { value: 'payment.refunded', label: 'Payment Refunded' },
  { value: 'invoice.issued', label: 'Invoice Issued' },
]

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  failed: 'destructive',
  skipped: 'outline',
  pending: 'secondary',
}

export function IntegrationPage() {
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [logs, setLogs] = useState<IntegrationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    event_type: '',
    debit_account_id: '',
    credit_account_id: '',
    description: '',
  })

  const fetchMappings = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/integration/mappings')
      setMappings(res.data.data || [])
    } catch { /* ignore */ } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/accounts', { params: { page_size: 500, is_active: 'true' } })
      setAccounts(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiClient.get('/integration/logs', { params: { page_size: 50 } })
      setLogs(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchMappings()
    fetchAccounts()
  }, [fetchMappings, fetchAccounts])

  const getAccountLabel = (id: string) => {
    const acc = accounts.find((a) => a.id === id)
    return acc ? `${acc.code} - ${acc.name}` : id.slice(0, 8) + '...'
  }

  const getEventLabel = (val: string) => eventTypes.find((e) => e.value === val)?.label || val

  const openCreate = () => {
    setEditingId(null)
    setForm({ event_type: '', debit_account_id: '', credit_account_id: '', description: '' })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (m: AccountMapping) => {
    setEditingId(m.id)
    setForm({
      event_type: m.event_type,
      debit_account_id: m.debit_account_id,
      credit_account_id: m.credit_account_id,
      description: m.description,
    })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      if (editingId) {
        await apiClient.put(`/integration/mappings/${editingId}`, {
          debit_account_id: form.debit_account_id,
          credit_account_id: form.credit_account_id,
          description: form.description,
        })
      } else {
        await apiClient.post('/integration/mappings', form)
      }
      setDialogOpen(false)
      fetchMappings()
    } catch {
      setError(editingId ? 'Failed to update mapping' : 'Failed to create mapping')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (m: AccountMapping) => {
    if (!confirm(`Delete mapping for "${getEventLabel(m.event_type)}"?`)) return
    try {
      await apiClient.delete(`/integration/mappings/${m.id}`)
      fetchMappings()
    } catch { alert('Failed to delete mapping') }
  }

  const openLogs = () => {
    fetchLogs()
    setLogsOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integration</h1>
          <p className="text-muted-foreground">Map eCommerce events to accounting journal entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openLogs}>
            <ScrollText size={16} className="mr-2" /> View Logs
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-2" /> Add Mapping
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 size={16} />
            Account Mappings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No mappings configured. Add mappings to auto-create journal entries from eCommerce events.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Event</th>
                  <th className="px-4 py-3 text-left font-medium">Debit Account</th>
                  <th className="px-4 py-3 text-left font-medium">Credit Account</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{getEventLabel(m.event_type)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{getAccountLabel(m.debit_account_id)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{getAccountLabel(m.credit_account_id)}</td>
                    <td className="px-4 py-3">{m.description || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.is_active ? 'default' : 'secondary'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m)}>
                          <Trash2 size={12} className="text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Mapping' : 'Create Mapping'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={form.event_type} onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))} disabled={!!editingId}>
                <option value="">Select event...</option>
                {eventTypes.map((et) => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Debit Account</Label>
              <Select value={form.debit_account_id} onChange={(e) => setForm((p) => ({ ...p, debit_account_id: e.target.value }))}>
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Credit Account</Label>
              <Select value={form.credit_account_id} onChange={(e) => setForm((p) => ({ ...p, credit_account_id: e.target.value }))}>
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description for the auto-generated journal" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Integration Logs</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No integration logs yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Event</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{getEventLabel(l.event_type)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.source_type}/{l.source_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusColors[l.status] || 'secondary'} className="text-xs">{l.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{l.error_msg || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
