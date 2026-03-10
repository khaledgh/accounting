import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, FileText, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Template {
  id: string
  name: string
  logo_url: string
  header_text: string
  footer_text: string
  payment_terms: string
  notes_template: string
  show_tax_breakdown: boolean
  currency_format: string
  is_default: boolean
}

const emptyForm = {
  name: '',
  logo_url: '',
  header_text: '',
  footer_text: '',
  payment_terms: 'Net 30',
  notes_template: '',
  show_tax_breakdown: true,
  currency_format: '$',
  is_default: false,
}

export function InvoiceTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiClient.get('/settings/invoice-templates')
      setTemplates(res.data.data || [])
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      logo_url: t.logo_url || '',
      header_text: t.header_text || '',
      footer_text: t.footer_text || '',
      payment_terms: t.payment_terms || '',
      notes_template: t.notes_template || '',
      show_tax_breakdown: t.show_tax_breakdown,
      currency_format: t.currency_format || '$',
      is_default: t.is_default,
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
        await apiClient.put(`/settings/invoice-templates/${editingId}`, form)
      } else {
        await apiClient.post('/settings/invoice-templates', form)
      }
      setDialogOpen(false)
      fetchTemplates()
    } catch {
      setError('Failed to save template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try {
      await apiClient.delete(`/settings/invoice-templates/${t.id}`)
      fetchTemplates()
    } catch { alert('Failed to delete template') }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type } = target
    const checked = target.checked
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Templates</h1>
          <p className="text-muted-foreground">Create and manage templates for your invoices</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText size={48} className="text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first invoice template to get started</p>
            <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {t.name}
                    {t.is_default && <Badge variant="default" className="text-[10px] px-1.5 py-0">Default</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil size={12} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t)}>
                      <Trash2 size={12} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {t.header_text && <p className="truncate"><span className="font-medium text-foreground">Header:</span> {t.header_text}</p>}
                {t.payment_terms && <p><span className="font-medium text-foreground">Terms:</span> {t.payment_terms}</p>}
                {t.footer_text && <p className="truncate"><span className="font-medium text-foreground">Footer:</span> {t.footer_text}</p>}
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span>Currency: {t.currency_format}</span>
                  <span>Tax: {t.show_tax_breakdown ? 'Detailed' : 'Summary'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 max-h-[65vh] overflow-y-auto pr-1">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Standard Invoice" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency_format">Currency Symbol</Label>
                <Input id="currency_format" name="currency_format" value={form.currency_format} onChange={handleChange} placeholder="$" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" name="logo_url" value={form.logo_url} onChange={handleChange} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="header_text">Header Text</Label>
              <textarea id="header_text" name="header_text" value={form.header_text} onChange={handleChange} rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Company name, address, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input id="payment_terms" name="payment_terms" value={form.payment_terms} onChange={handleChange} placeholder="e.g. Net 30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes_template">Notes Template</Label>
              <textarea id="notes_template" name="notes_template" value={form.notes_template} onChange={handleChange} rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Thank you for your business!" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <textarea id="footer_text" name="footer_text" value={form.footer_text} onChange={handleChange} rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Footer content..." />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="show_tax_breakdown" checked={form.show_tax_breakdown} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                <span className="text-sm">Show Tax Breakdown</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_default" checked={form.is_default} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                <span className="text-sm">Set as Default</span>
              </label>
            </div>

            {(form.header_text || form.name) && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <p className="text-xs text-muted-foreground">Preview</p>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {form.logo_url && <div className="h-8 w-24 bg-muted rounded flex items-center justify-center text-muted-foreground">Logo</div>}
                  {form.header_text && <p className="font-medium">{form.header_text}</p>}
                  <div className="border-t pt-2">
                    <p className="font-bold">INVOICE</p>
                    <p className="text-muted-foreground">Invoice #: INV-000000</p>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><span>{form.currency_format}100.00</span></div>
                    {form.show_tax_breakdown && <div className="flex justify-between"><span>Tax (8.25%)</span><span>{form.currency_format}8.25</span></div>}
                    <div className="flex justify-between font-bold"><span>Total</span><span>{form.currency_format}108.25</span></div>
                  </div>
                  {form.payment_terms && <p className="border-t pt-2"><span className="font-medium">Terms:</span> {form.payment_terms}</p>}
                  {form.notes_template && <p className="italic">{form.notes_template}</p>}
                  {form.footer_text && <p className="border-t pt-2 text-muted-foreground">{form.footer_text}</p>}
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
