import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Product {
  id: string
  sku: string
  name: string
  price: number
  cost_price: number
  stock_quantity: number
  low_stock_alert: number
  is_active: boolean
  track_stock: boolean
  category?: { id: string; name: string }
  created_at: string
}

interface Category {
  id: string
  name: string
}

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'category',
    header: 'Category',
    enableSorting: false,
    cell: ({ row }) => row.original.category?.name || '-',
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'cost_price',
    header: 'Cost',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'stock_quantity',
    header: 'Stock',
    cell: ({ row }) => {
      const qty = row.original.stock_quantity
      const low = row.original.low_stock_alert
      if (!row.original.track_stock) return <span className="text-muted-foreground">N/A</span>
      return (
        <span className={qty <= low ? 'text-destructive font-medium' : ''}>
          {qty}
        </span>
      )
    },
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
]

export function ProductsPage() {
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/ecommerce/categories', { params: { page_size: 500 } })
        setCategories(res.data.data?.data || [])
      } catch { /* ignore */ }
    }
    fetchCategories()
  }, [])

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete product "${product.name}"?`)) return
    try {
      await apiClient.delete(`/ecommerce/products/${product.id}`)
      setRefreshKey((k) => k + 1)
    } catch { alert('Failed to delete product') }
  }

  const actionColumns: ColumnDef<Product, unknown>[] = [
    ...columns,
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/ecommerce/products/${row.original.id}/edit`) }}>
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
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setRefreshKey((k) => k + 1) }} className="w-48">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button onClick={() => navigate('/ecommerce/products/new')}><Plus size={16} className="mr-2" /> Add Product</Button>
        </div>
      </div>

      <DataTable<Product>
        columns={actionColumns}
        fetchUrl="/ecommerce/products"
        searchPlaceholder="Search products..."
        refreshKey={refreshKey}
        extraFilters={categoryFilter ? { category_id: categoryFilter } : undefined}
      />
    </div>
  )
}
