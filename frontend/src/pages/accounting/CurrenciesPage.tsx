import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Globe, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  is_active: boolean
}

interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  effective_date: string
}

export function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rateDialogOpen, setRateDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '', symbol: '' })
  const [rateForm, setRateForm] = useState({ from_currency: '', to_currency: '', rate: 1, effective_date: new Date().toISOString().split('T')[0] })

  const fetchCurrencies = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/accounting/currencies', { params: { page_size: 100 } })
      setCurrencies(res.data.data?.data || res.data.data || [])
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [])

  const fetchRates = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/exchange-rates', { params: { page_size: 50 } })
      setRates(res.data.data?.data || res.data.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchCurrencies(); fetchRates() }, [fetchCurrencies, fetchRates])

  const openCreateCurrency = () => {
    setEditingId(null)
    setForm({ code: '', name: '', symbol: '' })
    setError('')
    setDialogOpen(true)
  }

  const openEditCurrency = (c: Currency) => {
    setEditingId(c.id)
    setForm({ code: c.code, name: c.name, symbol: c.symbol })
    setError('')
    setDialogOpen(true)
  }

  const handleCurrencySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      if (editingId) {
        await apiClient.put(`/accounting/currencies/${editingId}`, form)
      } else {
        await apiClient.post('/accounting/currencies', form)
      }
      setDialogOpen(false)
      fetchCurrencies()
    } catch { setError('Failed to save currency') } finally { setIsSubmitting(false) }
  }

  const handleDeleteCurrency = async (c: Currency) => {
    if (!confirm(`Delete currency "${c.code}"?`)) return
    try { await apiClient.delete(`/accounting/currencies/${c.id}`); fetchCurrencies() }
    catch { alert('Failed to delete currency') }
  }

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/accounting/exchange-rates', { ...rateForm, rate: Number(rateForm.rate) })
      setRateDialogOpen(false)
      fetchRates()
    } catch { setError('Failed to save exchange rate') } finally { setIsSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Currencies</h1>
            <p className="text-muted-foreground">Manage currencies and exchange rates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setRateForm({ from_currency: '', to_currency: '', rate: 1, effective_date: new Date().toISOString().split('T')[0] }); setError(''); setRateDialogOpen(true) }}>
            Add Rate
          </Button>
          <Button onClick={openCreateCurrency}><Plus size={16} className="mr-2" /> Add Currency</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">Currencies</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : currencies.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No currencies configured</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Symbol</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono font-bold">{c.code}</td>
                      <td className="px-4 py-2">{c.name}</td>
                      <td className="px-4 py-2">{c.symbol}</td>
                      <td className="px-4 py-2"><Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCurrency(c)}><Pencil size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCurrency(c)}><Trash2 size={12} className="text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">Exchange Rates</CardTitle></CardHeader>
          <CardContent className="p-0">
            {rates.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No exchange rates</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left">From</th>
                    <th className="px-4 py-2 text-left">To</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono">{r.from_currency}</td>
                      <td className="px-4 py-2 font-mono">{r.to_currency}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.rate.toFixed(4)}</td>
                      <td className="px-4 py-2 text-xs">{new Date(r.effective_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Currency' : 'Add Currency'}</DialogTitle></DialogHeader>
          <form onSubmit={handleCurrencySubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} maxLength={3} required disabled={!!editingId} /></div>
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Symbol</Label><Input value={form.symbol} onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))} required /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Exchange Rate</DialogTitle></DialogHeader>
          <form onSubmit={handleRateSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>From Currency</Label>
                <Select value={rateForm.from_currency} onChange={(e) => setRateForm((p) => ({ ...p, from_currency: e.target.value }))} required>
                  <option value="">Select currency</option>
                  {currencies.filter((c) => c.is_active).map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2"><Label>To Currency</Label>
                <Select value={rateForm.to_currency} onChange={(e) => setRateForm((p) => ({ ...p, to_currency: e.target.value }))} required>
                  <option value="">Select currency</option>
                  {currencies.filter((c) => c.is_active && c.code !== rateForm.from_currency).map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Rate</Label><Input type="number" step="0.0001" min="0.0001" value={rateForm.rate} onChange={(e) => setRateForm((p) => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} required /></div>
              <div className="space-y-2"><Label>Effective Date</Label><Input type="date" value={rateForm.effective_date} onChange={(e) => setRateForm((p) => ({ ...p, effective_date: e.target.value }))} required /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Rate'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
