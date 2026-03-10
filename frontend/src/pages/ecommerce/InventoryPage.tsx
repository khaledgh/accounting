import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Package, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  price: number
  stock_quantity: number
  low_stock_alert: number
  is_active: boolean
  track_stock: boolean
  category?: { name: string }
}

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'name', header: 'Product Name' },
  {
    accessorKey: 'category', header: 'Category', enableSorting: false,
    cell: ({ row }) => row.original.category?.name || '-',
  },
  {
    accessorKey: 'price', header: 'Price',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'stock_quantity', header: 'Stock',
    cell: ({ row }) => {
      if (!row.original.track_stock) return <span className="text-muted-foreground">N/A</span>
      const qty = row.original.stock_quantity
      const low = row.original.low_stock_alert
      if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>
      if (qty <= low) return <Badge variant="outline" className="text-orange-600 border-orange-300">{qty} (Low)</Badge>
      return <span className="font-medium text-green-700">{qty}</span>
    },
  },
  {
    accessorKey: 'low_stock_alert', header: 'Alert Level',
    cell: ({ row }) => row.original.track_stock ? row.original.low_stock_alert : '-',
  },
  {
    id: 'stock_status', header: 'Status', enableSorting: false,
    cell: ({ row }) => {
      if (!row.original.track_stock) return <Badge variant="secondary">Untracked</Badge>
      const qty = row.original.stock_quantity
      const low = row.original.low_stock_alert
      if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>
      if (qty <= low) return <Badge variant="outline" className="text-orange-600 border-orange-300">Low Stock</Badge>
      return <Badge variant="default">In Stock</Badge>
    },
  },
  {
    accessorKey: 'is_active', header: 'Active',
    cell: ({ getValue }) => getValue() ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-muted-foreground" />,
  },
]

export function InventoryPage() {
  const [refreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">Monitor stock levels across all products</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Package className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Stock Overview</p>
              <p className="text-lg font-bold">Products with stock tracking</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              <p className="text-lg font-bold">Check items below threshold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-lg font-bold">Items needing reorder</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable<Product>
        columns={columns}
        fetchUrl="/ecommerce/products"
        searchPlaceholder="Search inventory..."
        refreshKey={refreshKey}
      />
    </div>
  )
}
