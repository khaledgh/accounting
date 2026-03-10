import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Supplier {
  id: string
  code: string
  name: string
  contact_name: string
  email: string
  phone: string
  city: string
  country: string
  payment_terms: string
  balance: number
  is_active: boolean
}

const columns: ColumnDef<Supplier, unknown>[] = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'contact_name', header: 'Contact', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'city', header: 'City', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'payment_terms', header: 'Terms', cell: ({ getValue }) => getValue() || '-' },
  {
    accessorKey: 'balance', header: 'Balance',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'is_active', header: 'Status',
    cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
  },
]

export function SuppliersPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '',
    city: '', country: '', website: '', payment_terms: '', notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', contact_name: '', email: '', phone: '', address: '', city: '', country: '', website: '', payment_terms: '', notes: '' })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditingId(s.id)
    setForm({
      name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone,
      address: '', city: s.city, country: s.country, website: '', payment_terms: s.payment_terms, notes: '',
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
        await apiClient.put(`/ecommerce/suppliers/${editingId}`, form)
      } else {
        await apiClient.post('/ecommerce/suppliers', form)
      }
      setDialogOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError(editingId ? 'Failed to update supplier' : 'Failed to create supplier')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return
    try {
      await apiClient.delete(`/ecommerce/suppliers/${s.id}`)
      setRefreshKey((k) => k + 1)
    } catch { alert('Failed to delete supplier') }
  }

  const actionColumns: ColumnDef<Supplier, unknown>[] = [
    ...columns,
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(row.original) }}><Pencil size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(row.original) }}><Trash2 size={14} className="text-destructive" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">Manage supplier profiles</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Add Supplier</Button>
      </div>

      <DataTable<Supplier> columns={actionColumns} fetchUrl="/ecommerce/suppliers" searchPlaceholder="Search suppliers..." refreshKey={refreshKey} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Supplier' : 'Create Supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input name="name" value={form.name} onChange={handleChange} required /></div>
              <div className="space-y-2"><Label>Contact Name</Label><Input name="contact_name" value={form.contact_name} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" value={form.email} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input name="phone" value={form.phone} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>City</Label><Input name="city" value={form.city} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Country</Label><Input name="country" value={form.country} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Website</Label><Input name="website" value={form.website} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Payment Terms</Label><Input name="payment_terms" value={form.payment_terms} onChange={handleChange} placeholder="e.g. Net 30" /></div>
            </div>
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
