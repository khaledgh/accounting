import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Lock } from 'lucide-react'
import apiClient from '@/api/client'

interface FiscalPeriod {
  id: string
  name: string
  number: number
  start_date: string
  end_date: string
  is_closed: boolean
}

interface FinancialYear {
  id: string
  name: string
  code: string
  start_date: string
  end_date: string
  is_closed: boolean
  is_active: boolean
  periods?: FiscalPeriod[]
}

const columns: ColumnDef<FinancialYear, unknown>[] = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'start_date',
    header: 'Start Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: 'end_date',
    header: 'End Date',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.is_closed) return <Badge variant="secondary">Closed</Badge>
      if (row.original.is_active) return <Badge variant="default">Active</Badge>
      return <Badge variant="outline">Inactive</Badge>
    },
  },
  {
    accessorKey: 'periods',
    header: 'Periods',
    enableSorting: false,
    cell: ({ row }) => row.original.periods?.length || 0,
  },
]

export function FinancialYearsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<FinancialYear | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const openCreate = () => {
    setForm({ name: '', code: '', start_date: '', end_date: '' })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/accounting/financial-years', form)
      setDialogOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      setError('Failed to create financial year')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRowClick = async (fy: FinancialYear) => {
    try {
      const res = await apiClient.get(`/accounting/financial-years/${fy.id}`)
      setSelectedYear(res.data.data)
      setDetailOpen(true)
    } catch {
      alert('Failed to load financial year details')
    }
  }

  const handleClose = async () => {
    if (!selectedYear) return
    if (!confirm(`Close financial year "${selectedYear.name}"? This cannot be undone.`)) return
    try {
      await apiClient.post(`/accounting/financial-years/${selectedYear.id}/close`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to close financial year')
    }
  }

  const handleDelete = async () => {
    if (!selectedYear) return
    if (!confirm(`Delete financial year "${selectedYear.name}"?`)) return
    try {
      await apiClient.delete(`/accounting/financial-years/${selectedYear.id}`)
      setDetailOpen(false)
      setRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to delete financial year. It may have journal entries.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Years</h1>
          <p className="text-muted-foreground">Manage fiscal years and periods</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" /> New Financial Year
        </Button>
      </div>

      <DataTable<FinancialYear>
        columns={columns}
        fetchUrl="/accounting/financial-years"
        searchPlaceholder="Search financial years..."
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
      />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Financial Year</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="FY 2025" value={form.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="FY2025" value={form.code} onChange={handleChange} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" name="start_date" type="date" value={form.start_date} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" name="end_date" type="date" value={form.end_date} onChange={handleChange} required />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Monthly fiscal periods will be auto-generated.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedYear?.name}</DialogTitle>
          </DialogHeader>
          {selectedYear && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <p className="font-medium">{selectedYear.code}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Start:</span>
                  <p className="font-medium">{new Date(selectedYear.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>
                  <p className="font-medium">{new Date(selectedYear.end_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Fiscal Periods</h4>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Period</th>
                        <th className="px-3 py-2 text-left">Start</th>
                        <th className="px-3 py-2 text-left">End</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedYear.periods?.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-3 py-2">{p.number}</td>
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2">{new Date(p.start_date).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{new Date(p.end_date).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <Badge variant={p.is_closed ? 'secondary' : 'default'} className="text-xs">
                              {p.is_closed ? 'Closed' : 'Open'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter>
                {!selectedYear.is_closed && (
                  <>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    <Button variant="outline" onClick={handleClose}>
                      <Lock size={14} className="mr-2" /> Close Year
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
