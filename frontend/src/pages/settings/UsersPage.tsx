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
import type { User } from '@/types'

const columns: ColumnDef<User, unknown>[] = [
  {
    accessorKey: 'first_name',
    header: 'Name',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.first_name} {row.original.last_name}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ getValue }) => getValue() || '-',
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ getValue }) => (
      <Badge variant={getValue() ? 'default' : 'secondary'}>
        {getValue() ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'branch',
    header: 'Branch',
    enableSorting: false,
    cell: ({ row }) => row.original.branch?.name || 'All',
  },
  {
    accessorKey: 'user_roles',
    header: 'Role',
    enableSorting: false,
    cell: ({ row }) => {
      const roles = row.original.user_roles
      if (!roles || roles.length === 0) return '-'
      return roles.map((ur) => ur.role?.name).join(', ')
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
]

export function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    is_active: true,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', is_active: true })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingId(user.id)
    setForm({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      is_active: user.is_active,
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
        await apiClient.put(`/users/${editingId}`, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          is_active: form.is_active,
        })
      } else {
        await apiClient.post('/users', form)
      }
      setDialogOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError(editingId ? 'Failed to update user' : 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user ${user.first_name} ${user.last_name}?`)) return
    try {
      await apiClient.delete(`/users/${user.id}`)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to delete user')
    }
  }

  const actionColumns: ColumnDef<User, unknown>[] = [
    ...columns,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(row.original) }}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(row.original) }}>
            <Trash2 size={14} className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" /> Add User
        </Button>
      </div>

      <DataTable<User>
        columns={actionColumns}
        fetchUrl="/users"
        searchPlaceholder="Search users..."
        refreshKey={refreshKey}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
            </div>
            {!editingId && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" name="is_active" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded border-input" />
              <Label htmlFor="is_active">Active</Label>
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
