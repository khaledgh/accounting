import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { MediaPicker } from '@/components/shared/MediaPicker'
import apiClient from '@/api/client'
import { getMediaUrl } from '@/lib/media'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  cost_price: z.number().min(0, 'Cost price must be 0 or greater'),
  compare_price: z.number().min(0, 'Compare price must be 0 or greater'),
  tax_rate: z.number().min(0).max(100, 'Tax rate must be 0-100'),
  stock_quantity: z.number().int().min(0, 'Stock must be 0 or greater'),
  low_stock_alert: z.number().int().min(0, 'Alert threshold must be 0 or greater'),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Variant {
  id?: string
  sku: string
  name: string
  price: number
  cost_price: number
  stock_quantity: number
  image_url: string
  is_active: boolean
}

interface Category {
  id: string
  name: string
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const slugManuallyEdited = useRef(false)

  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    short_desc: '',
    category_id: '',
    price: 0,
    cost_price: 0,
    compare_price: 0,
    tax_rate: 0,
    currency_code: 'USD',
    weight: 0,
    unit: 'pc',
    barcode: '',
    image_url: '',
    slug: '',
    meta_title: '',
    meta_description: '',
    is_digital: false,
    track_stock: true,
    stock_quantity: 0,
    low_stock_alert: 5,
    is_active: true,
  })

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get('/ecommerce/categories', { params: { page_size: 500 } })
      setCategories(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  const fetchProduct = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const res = await apiClient.get(`/ecommerce/products/${id}`)
      const p = res.data.data
      setForm({
        sku: p.sku || '',
        name: p.name || '',
        description: p.description || '',
        short_desc: p.short_desc || '',
        category_id: p.category_id || '',
        price: p.price || 0,
        cost_price: p.cost_price || 0,
        compare_price: p.compare_price || 0,
        tax_rate: p.tax_rate || 0,
        currency_code: p.currency_code || 'USD',
        weight: p.weight || 0,
        unit: p.unit || 'pc',
        barcode: p.barcode || '',
        image_url: p.image_url || '',
        slug: p.slug || '',
        meta_title: p.meta_title || '',
        meta_description: p.meta_description || '',
        is_digital: p.is_digital || false,
        track_stock: p.track_stock ?? true,
        stock_quantity: p.stock_quantity || 0,
        low_stock_alert: p.low_stock_alert || 5,
        is_active: p.is_active ?? true,
      })
      if (p.slug) slugManuallyEdited.current = true
      if (p.variants?.length) {
        setVariants(p.variants.map((v: Variant & { id: string }) => ({
          id: v.id, sku: v.sku, name: v.name, price: v.price,
          cost_price: v.cost_price, stock_quantity: v.stock_quantity,
          image_url: v.image_url || '', is_active: v.is_active ?? true,
        })))
      }
    } catch {
      setError('Failed to load product')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCategories()
    fetchProduct()
  }, [fetchCategories, fetchProduct])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type } = target
    const checked = target.checked
    const newValue = type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value
    setForm((prev) => {
      const next = { ...prev, [name]: newValue }
      // Auto-generate slug from name
      if (name === 'name' && !slugManuallyEdited.current) {
        next.slug = slugify(value)
      }
      return next
    })
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n })
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    slugManuallyEdited.current = e.target.value !== ''
    setForm((prev) => ({ ...prev, slug: e.target.value }))
  }

  const addVariant = () => {
    setVariants((prev) => [...prev, { sku: '', name: '', price: 0, cost_price: 0, stock_quantity: 0, image_url: '', is_active: true }])
  }

  const updateVariant = (index: number, field: keyof Variant, value: string | number | boolean) => {
    setVariants((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Zod validation
    const result = productSchema.safeParse(form)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString()
        if (key) errors[key] = issue.message
      })
      setFieldErrors(errors)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
      }
      let productId = id
      if (isEdit) {
        await apiClient.put(`/ecommerce/products/${id}`, payload)
      } else {
        const res = await apiClient.post('/ecommerce/products', payload)
        productId = res.data.data?.id
      }

      // Save variants
      if (productId && variants.length > 0) {
        for (const v of variants) {
          if (v.id) {
            await apiClient.put(`/ecommerce/products/${productId}/variants/${v.id}`, v)
          } else {
            await apiClient.post(`/ecommerce/products/${productId}/variants`, v)
          }
        }
      }

      navigate('/ecommerce/products')
    } catch {
      setError(isEdit ? 'Failed to update product' : 'Failed to create product')
    } finally {
      setIsSaving(false)
    }
  }

  const FieldError = ({ field }: { field: string }) => {
    if (!fieldErrors[field]) return null
    return <p className="text-xs text-destructive mt-1">{fieldErrors[field]}</p>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ecommerce/products')}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Product' : 'New Product'}</h1>
          <p className="text-muted-foreground">{isEdit ? 'Update product details' : 'Add a new product to your catalog'}</p>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left column — Main info */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" name="sku" value={form.sku} onChange={handleChange} disabled={isEdit} placeholder="e.g. PRD-001" className={fieldErrors.sku ? 'border-destructive' : ''} />
                    <FieldError field="sku" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Wireless Keyboard" className={fieldErrors.name ? 'border-destructive' : ''} />
                    <FieldError field="name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="short_desc">Short Description</Label>
                  <Input id="short_desc" name="short_desc" value={form.short_desc} onChange={handleChange} placeholder="Brief product summary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Full Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={5}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Detailed product description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category_id">Category</Label>
                    <Select name="category_id" value={form.category_id} onChange={handleChange}>
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Product Image</Label>
                    <MediaPicker value={form.image_url} onChange={(url) => setForm((prev) => ({ ...prev, image_url: url }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price *</Label>
                    <Input id="price" name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} className={fieldErrors.price ? 'border-destructive' : ''} />
                    <FieldError field="price" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_price">Cost Price</Label>
                    <Input id="cost_price" name="cost_price" type="number" step="0.01" min="0" value={form.cost_price} onChange={handleChange} className={fieldErrors.cost_price ? 'border-destructive' : ''} />
                    <FieldError field="cost_price" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compare_price">Compare Price</Label>
                    <Input id="compare_price" name="compare_price" type="number" step="0.01" min="0" value={form.compare_price} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax Rate %</Label>
                    <Input id="tax_rate" name="tax_rate" type="number" step="0.01" min="0" value={form.tax_rate} onChange={handleChange} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="track_stock" checked={form.track_stock} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                    <span className="text-sm font-medium">Track Stock</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="is_digital" checked={form.is_digital} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                    <span className="text-sm font-medium">Digital Product</span>
                  </label>
                </div>
                {form.track_stock && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock_quantity">Stock Quantity</Label>
                      <Input id="stock_quantity" name="stock_quantity" type="number" min="0" value={form.stock_quantity} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="low_stock_alert">Low Stock Alert</Label>
                      <Input id="low_stock_alert" name="low_stock_alert" type="number" min="0" value={form.low_stock_alert} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input id="barcode" name="barcode" value={form.barcode} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input id="weight" name="weight" type="number" step="0.01" min="0" value={form.weight} onChange={handleChange} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input id="slug" name="slug" value={form.slug} onChange={handleSlugChange} placeholder="product-url-handle" />
                  <p className="text-xs text-muted-foreground">Auto-generated from name. Edit to override.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input id="meta_title" name="meta_title" value={form.meta_title} onChange={handleChange} placeholder="Page title for search engines" maxLength={200} />
                  <p className="text-xs text-muted-foreground">{form.meta_title.length}/200 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <textarea
                    id="meta_description"
                    name="meta_description"
                    value={form.meta_description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={500}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Brief description for search engine results..."
                  />
                  <p className="text-xs text-muted-foreground">{form.meta_description.length}/500 characters</p>
                </div>
                {(form.meta_title || form.slug) && (
                  <div className="rounded-md border p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Search Engine Preview</p>
                    <p className="text-blue-700 text-sm font-medium truncate">{form.meta_title || form.name}</p>
                    <p className="text-green-700 text-xs">{`https://yourstore.com/products/${form.slug || form.sku?.toLowerCase()}`}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.meta_description || form.short_desc || 'No description'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Variants */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Variants</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                    <Plus size={14} className="mr-1" /> Add Variant
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {variants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No variants. Add variants for different sizes, colors, etc.</p>
                ) : (
                  <div className="space-y-3">
                    {variants.map((v, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-md border bg-muted/20">
                        <MediaPicker value={v.image_url} onChange={(url) => updateVariant(idx, 'image_url', url)} label="Img" />
                        <div className="flex-1 grid grid-cols-5 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input value={v.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)} placeholder="VAR-SKU" className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input value={v.name} onChange={(e) => updateVariant(idx, 'name', e.target.value)} placeholder="e.g. Red / Large" className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Price</Label>
                            <Input type="number" step="0.01" min="0" value={v.price} onChange={(e) => updateVariant(idx, 'price', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cost</Label>
                            <Input type="number" step="0.01" min="0" value={v.cost_price} onChange={(e) => updateVariant(idx, 'cost_price', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Stock</Label>
                            <Input type="number" min="0" value={v.stock_quantity} onChange={(e) => updateVariant(idx, 'stock_quantity', parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 mt-5" onClick={() => removeVariant(idx)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — Status & quick info */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded border-input" />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="currency_code">Currency</Label>
                  <Select name="currency_code" value={form.currency_code} onChange={handleChange}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select name="unit" value={form.unit} onChange={handleChange}>
                    <option value="pc">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="g">Gram</option>
                    <option value="l">Liter</option>
                    <option value="m">Meter</option>
                    <option value="box">Box</option>
                    <option value="set">Set</option>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {form.image_url && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Image Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={getMediaUrl(form.image_url)}
                    alt={form.name}
                    className="w-full h-48 object-contain rounded-md border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-mono font-medium">${form.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-mono">${form.cost_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-mono font-medium text-green-600">
                    {form.price > 0 ? `${(((form.price - form.cost_price) / form.price) * 100).toFixed(1)}%` : '-'}
                  </span>
                </div>
                {form.track_stock && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock</span>
                    <span className={`font-mono ${form.stock_quantity <= form.low_stock_alert ? 'text-destructive font-medium' : ''}`}>
                      {form.stock_quantity}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/ecommerce/products')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
            {isEdit ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
