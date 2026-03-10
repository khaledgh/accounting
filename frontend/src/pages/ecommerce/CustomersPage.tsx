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

interface Customer {
  id: string
  code: string
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  city: string
  country: string
  balance: number
  is_active: boolean
}

const columns: ColumnDef<Customer, unknown>[] = [
  { accessorKey: 'code', header: 'Code' },
  {
    accessorKey: 'first_name', header: 'Name',
    cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
  },
  { accessorKey: 'company_name', header: 'Company', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone', cell: ({ getValue }) => getValue() || '-' },
  { accessorKey: 'city', header: 'City', cell: ({ getValue }) => getValue() || '-' },
  {
    accessorKey: 'balance', header: 'Balance',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'is_active', header: 'Status',
    cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
  },
]

export function CustomersPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_name: '', email: '', phone: '',
    address: '', city: '', country: '', notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ first_name: '', last_name: '', company_name: '', email: '', phone: '', address: '', city: '', country: '', notes: '' })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      first_name: c.first_name, last_name: c.last_name, company_name: c.company_name,
      email: c.email, phone: c.phone, address: '', city: c.city, country: c.country, notes: '',
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
        await apiClient.put(`/ecommerce/customers/${editingId}`, form)
      } else {
        await apiClient.post('/ecommerce/customers', form)
      }
      setDialogOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError(editingId ? 'Failed to update customer' : 'Failed to create customer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.first_name} ${c.last_name}"?`)) return
    try {
      await apiClient.delete(`/ecommerce/customers/${c.id}`)
      setRefreshKey((k) => k + 1)
    } catch { alert('Failed to delete customer') }
  }

  const actionColumns: ColumnDef<Customer, unknown>[] = [
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
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage customer profiles</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Add Customer</Button>
      </div>

      <DataTable<Customer> columns={actionColumns} fetchUrl="/ecommerce/customers" searchPlaceholder="Search customers..." refreshKey={refreshKey} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Customer' : 'Create Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name</Label><Input name="first_name" value={form.first_name} onChange={handleChange} required /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input name="last_name" value={form.last_name} onChange={handleChange} required /></div>
            </div>
            <div className="space-y-2"><Label>Company Name</Label><Input name="company_name" value={form.company_name} onChange={handleChange} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" value={form.email} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input name="phone" value={form.phone} onChange={handleChange} /></div>
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
