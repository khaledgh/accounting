import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Supplier {
  id: string
  name: string
  code: string
}

interface ProductVariant {
  id: string
  sku: string
  name: string
  price: number
  cost_price: number
  stock_quantity: number
  is_active: boolean
}

interface Product {
  id: string
  sku: string
  name: string
  cost_price: number
  tax_rate: number
  variants?: ProductVariant[]
}

interface LineItem {
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total_amount: number
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PurchaseInvoiceFormPage() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [form, setForm] = useState({
    supplier_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  })
  const [lines, setLines] = useState<LineItem[]>([])

  useEffect(() => {
    const fetchRef = async () => {
      try {
        const [supRes, prodRes] = await Promise.all([
          apiClient.get('/ecommerce/suppliers', { params: { page_size: 500 } }),
          apiClient.get('/ecommerce/products', { params: { page_size: 500, is_active: 'true' } }),
        ])
        setSuppliers(supRes.data.data?.data || [])
        setProducts(prodRes.data.data?.data || [])
      } catch { /* ignore */ }
    }
    fetchRef()
  }, [])

  const addLine = () => {
    setLines((prev) => [...prev, {
      product_id: null, variant_id: null, description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_amount: 0, total_amount: 0,
    }])
  }

  const updateLine = (index: number, field: string, value: string | number | null) => {
    setLines((prev) => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'product_id' && value) {
        const prod = products.find((p) => p.id === value)
        if (prod) {
          updated.description = prod.name
          updated.unit_price = prod.cost_price
          updated.tax_rate = prod.tax_rate
          updated.variant_id = null
        }
      }
      if (field === 'variant_id' && value) {
        const prod = products.find((p) => p.id === updated.product_id)
        const variant = prod?.variants?.find((v) => v.id === value)
        if (variant) {
          updated.description = `${prod!.name} — ${variant.name}`
          updated.unit_price = variant.cost_price || prod!.cost_price
        }
      }
      if (field === 'variant_id' && !value) {
        const prod = products.find((p) => p.id === updated.product_id)
        if (prod) {
          updated.description = prod.name
          updated.unit_price = prod.cost_price
        }
      }
      const lineTotal = updated.quantity * updated.unit_price
      updated.tax_amount = lineTotal * updated.tax_rate / 100
      updated.total_amount = lineTotal + updated.tax_amount
      return updated
    }))
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  const taxTotal = lines.reduce((s, l) => s + l.tax_amount, 0)
  const grandTotal = subtotal + taxTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Add at least one line item')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      await apiClient.post('/accounting/purchase-invoices', {
        supplier_id: form.supplier_id || null,
        invoice_date: form.invoice_date,
        due_date: form.due_date || undefined,
        notes: form.notes,
        items: lines.map((item) => ({
          product_id: item.product_id || null,
          variant_id: item.variant_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
      })
      navigate('/accounting/purchase-invoices')
    } catch {
      setError('Failed to create purchase invoice')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounting/purchase-invoices')}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Purchase Invoice</h1>
          <p className="text-muted-foreground">Record a purchase from a supplier</p>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left column — Form */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Select value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <DatePicker value={form.invoice_date} onChange={(v) => setForm((p) => ({ ...p, invoice_date: v }))} placeholder="Invoice date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <DatePicker value={form.due_date} onChange={(v) => setForm((p) => ({ ...p, due_date: v }))} placeholder="Due date" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus size={14} className="mr-1" /> Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No items yet. Click "Add Item" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1 pb-2 border-b">
                      <div>Product</div>
                      <div>Variant</div>
                      <div>Description</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Tax %</div>
                      <div className="text-right">Tax</div>
                      <div className="text-right">Total</div>
                      <div className="w-7"></div>
                    </div>
                    {lines.map((item, idx) => {
                      const selectedProduct = item.product_id ? products.find((p) => p.id === item.product_id) : null
                      const hasVariants = (selectedProduct?.variants?.length || 0) > 0
                      return (
                        <div key={idx} className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center py-2 border-b last:border-0 hover:bg-muted/30 rounded px-1">
                          <div>
                            <Select value={item.product_id || ''} onChange={(e) => updateLine(idx, 'product_id', e.target.value || null)} className="h-9 text-sm">
                              <option value="">Select product</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                            </Select>
                          </div>
                          <div>
                            {hasVariants ? (
                              <Select value={item.variant_id || ''} onChange={(e) => updateLine(idx, 'variant_id', e.target.value || null)} className="h-9 text-sm">
                                <option value="">Base product</option>
                                {selectedProduct!.variants!.filter((v) => v.is_active).map((v) => (
                                  <option key={v.id} value={v.id}>{v.sku} — {v.name}</option>
                                ))}
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">—</span>
                            )}
                          </div>
                          <div>
                            <Input value={item.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} className="h-9 text-sm" placeholder="Description" />
                          </div>
                          <div>
                            <Input type="number" min="1" value={item.quantity} onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 1)} className="h-9 text-sm text-right" />
                          </div>
                          <div>
                            <Input type="number" step="0.01" min="0" value={item.unit_price} onChange={(e) => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="h-9 text-sm text-right" />
                          </div>
                          <div>
                            <Input type="number" step="0.01" min="0" value={item.tax_rate} onChange={(e) => updateLine(idx, 'tax_rate', parseFloat(e.target.value) || 0)} className="h-9 text-sm text-right" />
                          </div>
                          <div className="text-sm font-mono text-right text-muted-foreground">{fmt(item.tax_amount)}</div>
                          <div className="text-sm font-mono text-right font-medium">{fmt(item.total_amount)}</div>
                          <div className="flex justify-center">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)}>
                              <Trash2 size={13} className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">${fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono">${fmt(taxTotal)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t pt-3">
                  <span>Total</span>
                  <span className="font-mono">${fmt(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Items</span>
                  <span>{lines.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  Draft
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The invoice will be saved as a draft. You can confirm it later to update stock and create journal entries.
                </p>
              </CardContent>
            </Card>

            {form.supplier_id && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Supplier</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const s = suppliers.find((s) => s.id === form.supplier_id)
                    return s ? (
                      <div className="text-sm">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-muted-foreground">{s.code}</p>
                      </div>
                    ) : null
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/accounting/purchase-invoices')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
            Save Draft
          </Button>
        </div>
      </form>
    </div>
  )
}
