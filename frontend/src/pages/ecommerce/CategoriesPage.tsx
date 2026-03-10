import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FolderOpen, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  parent_id: string | null
  name: string
  slug: string
  description: string
  sort_order: number
  is_active: boolean
  children?: Category[]
}

function CategoryTreeItem({
  category, onEdit, onDelete, depth = 0,
}: {
  category: Category; onEdit: (c: Category) => void; onDelete: (c: Category) => void; depth?: number
}) {
  const [isOpen, setIsOpen] = useState(depth < 2)
  const hasChildren = category.children && category.children.length > 0

  return (
    <div>
      <div
        className={cn('flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors group', depth === 0 && 'bg-muted/30 font-semibold')}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button onClick={() => setIsOpen(!isOpen)} className="flex h-5 w-5 items-center justify-center" disabled={!hasChildren}>
          {hasChildren ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
        </button>
        <FolderOpen size={14} className="text-muted-foreground" />
        <span className="flex-1 text-sm">{category.name}</span>
        <span className="text-xs text-muted-foreground font-mono">{category.slug}</span>
        <Badge variant={category.is_active ? 'default' : 'secondary'} className="text-xs">
          {category.is_active ? 'Active' : 'Inactive'}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(category)}><Pencil size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(category)}><Trash2 size={12} className="text-destructive" /></Button>
        </div>
      </div>
      {isOpen && hasChildren && (
        <div>
          {category.children!.map((child) => (
            <CategoryTreeItem key={child.id} category={child} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ parent_id: '', name: '', slug: '', description: '', sort_order: 0 })

  const fetchTree = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/ecommerce/categories/tree')
      setCategories(res.data.data || [])
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }, [])

  const fetchFlat = useCallback(async () => {
    try {
      const res = await apiClient.get('/ecommerce/categories', { params: { page_size: 500 } })
      setFlatCategories(res.data.data?.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchTree(); fetchFlat() }, [fetchTree, fetchFlat])

  const openCreate = () => {
    setEditingId(null)
    setForm({ parent_id: '', name: '', slug: '', description: '', sort_order: 0 })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (c: Category) => {
    setEditingId(c.id)
    setForm({ parent_id: c.parent_id || '', name: c.name, slug: c.slug, description: c.description, sort_order: c.sort_order })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const payload = { ...form, parent_id: form.parent_id || null, sort_order: Number(form.sort_order) }
      if (editingId) {
        await apiClient.put(`/ecommerce/categories/${editingId}`, { name: form.name, slug: form.slug, description: form.description, sort_order: Number(form.sort_order) })
      } else {
        await apiClient.post('/ecommerce/categories', payload)
      }
      setDialogOpen(false)
      fetchTree(); fetchFlat()
    } catch { setError('Failed to save category') } finally { setIsSubmitting(false) }
  }

  const handleDelete = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return
    try { await apiClient.delete(`/ecommerce/categories/${c.id}`); fetchTree(); fetchFlat() }
    catch { alert('Failed to delete category. It may have children.') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Organize products into categories</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Add Category</Button>
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen size={16} />
            <span className="flex-1">Category Tree</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><p>No categories yet.</p></div>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => <CategoryTreeItem key={cat.id} category={cat} onEdit={openEdit} onDelete={handleDelete} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Category' : 'Create Category'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {!editingId && (
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select value={form.parent_id} onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}>
                  <option value="">None (Root)</option>
                  {flatCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input name="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Slug</Label><Input name="slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="auto-generated" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Sort Order</Label><Input name="sort_order" type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
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
