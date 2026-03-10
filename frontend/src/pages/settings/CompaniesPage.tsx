import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Company {
  id: string
  name: string
  legal_name: string
  tax_id: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  currency_code: string
  is_active: boolean
  created_at: string
}

const columns: ColumnDef<Company, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'legal_name', header: 'Legal Name', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'tax_id', header: 'Tax ID', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'city', header: 'City', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'country', header: 'Country', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'currency_code', header: 'Currency' },
  {
    accessorKey: 'is_active', header: 'Status',
    cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
  },
]

export function CompaniesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', legal_name: '', tax_id: '', email: '', phone: '',
    address: '', city: '', country: '', currency_code: 'USD',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', legal_name: '', tax_id: '', email: '', phone: '', address: '', city: '', country: '', currency_code: 'USD' })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (c: Company) => {
    setEditingId(c.id)
    setForm({
      name: c.name, legal_name: c.legal_name, tax_id: c.tax_id, email: c.email,
      phone: c.phone, address: c.address, city: c.city, country: c.country, currency_code: c.currency_code,
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
        await apiClient.put(`/companies/${editingId}`, form)
      } else {
        await apiClient.post('/companies', form)
      }
      setDialogOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError(editingId ? 'Failed to update company' : 'Failed to create company')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (c: Company) => {
    if (!confirm(`Delete company "${c.name}"?`)) return
    try {
      await apiClient.delete(`/companies/${c.id}`)
      setRefreshKey((k) => k + 1)
    } catch { alert('Failed to delete company') }
  }

  const actionColumns: ColumnDef<Company, unknown>[] = [
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
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Companies</h1>
            <p className="text-muted-foreground">Manage companies and their branches</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Add Company</Button>
      </div>

      <DataTable<Company> columns={actionColumns} fetchUrl="/companies" searchPlaceholder="Search companies..." refreshKey={refreshKey} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Company' : 'Create Company'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input name="name" value={form.name} onChange={handleChange} required /></div>
              <div className="space-y-2"><Label>Legal Name</Label><Input name="legal_name" value={form.legal_name} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" value={form.email} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input name="phone" value={form.phone} onChange={handleChange} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tax ID</Label><Input name="tax_id" value={form.tax_id} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Currency</Label><Input name="currency_code" value={form.currency_code} onChange={handleChange} placeholder="USD" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>City</Label><Input name="city" value={form.city} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Country</Label><Input name="country" value={form.country} onChange={handleChange} /></div>
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
