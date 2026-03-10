import { useState, useEffect, useCallback } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  fetchUrl: string
  title?: string
  searchPlaceholder?: string
  exportEnabled?: boolean
  onRowClick?: (row: TData) => void
  extraFilters?: Record<string, string>
  refreshKey?: number
}

export function DataTable<TData>({
  columns,
  fetchUrl,
  title,
  searchPlaceholder = 'Search...',
  exportEnabled = true,
  onRowClick,
  extraFilters,
  refreshKey,
}: DataTableProps<TData>) {
  const [data, setData] = useState<TData[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        search,
      }

      if (sorting.length > 0) {
        params.sort_by = sorting[0].id
        params.sort_order = sorting[0].desc ? 'desc' : 'asc'
      }

      if (extraFilters) {
        Object.entries(extraFilters).forEach(([key, value]) => {
          if (value) params[key] = value
        })
      }

      const response = await apiClient.get<{ data: PaginatedResponse<TData> }>(fetchUrl, { params })
      const result = response.data.data
      setData(result.data || [])
      setTotal(result.total)
      setTotalPages(result.total_pages)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchUrl, page, pageSize, search, sorting, extraFilters])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const handleSearch = () => {
    setPage(1)
    setSearch(searchInput)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string | number> = { search, format }
      if (sorting.length > 0) {
        params.sort_by = sorting[0].id
        params.sort_order = sorting[0].desc ? 'desc' : 'asc'
      }
      if (extraFilters) {
        Object.entries(extraFilters).forEach(([key, value]) => {
          if (value) params[key] = value
        })
      }

      const response = await apiClient.get(`${fetchUrl}/export`, {
        params,
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `export.${format === 'excel' ? 'xlsx' : 'pdf'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const getSortIcon = (columnId: string) => {
    const sort = sorting.find((s) => s.id === columnId)
    if (!sort) return <ArrowUpDown size={14} className="text-muted-foreground/50" />
    return sort.desc ? <ArrowDown size={14} /> : <ArrowUp size={14} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:min-w-[300px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Search
          </Button>
          {exportEnabled && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} title="Export to Excel">
                <FileSpreadsheet size={16} className="mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} title="Export to PDF">
                <Download size={16} className="mr-1" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && getSortIcon(header.id)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} results
            </>
          ) : (
            'No results'
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="w-20"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page <= 1}>
              <ChevronsLeft size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft size={16} />
            </Button>
            <span className="px-2 text-sm">
              Page {page} of {totalPages || 1}
            </span>
            <Button variant="outline" size="icon" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              <ChevronRight size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
              <ChevronsRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
