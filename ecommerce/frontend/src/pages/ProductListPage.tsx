import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, ChevronLeft, ChevronRight, SlidersHorizontal, X, Tag } from 'lucide-react'
import apiClient from '@/api/client'
import type { Product, Category, PaginatedResponse, PriceRange } from '@/types'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import ProductCard from '@/components/product/ProductCard'

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')

  const page = Number(searchParams.get('page') || '1')
  const categoryId = searchParams.get('category_id') || ''
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'desc'
  const search = searchParams.get('search') || ''
  const onSale = searchParams.get('on_sale') === 'true'
  const minPriceParam = searchParams.get('min_price') || ''
  const maxPriceParam = searchParams.get('max_price') || ''

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/store/categories').then(r => (r.data.data || []) as Category[]),
  })

  const { data: priceRange } = useQuery({
    queryKey: ['price-range'],
    queryFn: () => apiClient.get('/store/price-range').then(r => r.data.data as PriceRange),
  })

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', page, categoryId, sort, order, search, onSale, minPriceParam, maxPriceParam],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), page_size: '12', sort, order }
      if (categoryId) params.category_id = categoryId
      if (search) params.search = search
      if (onSale) params.on_sale = 'true'
      if (minPriceParam) params.min_price = minPriceParam
      if (maxPriceParam) params.max_price = maxPriceParam
      return apiClient.get('/store/products', { params }).then(r => r.data.data as PaginatedResponse<Product>)
    },
  })

  const products = productsData?.items || []
  const total = productsData?.total || 0
  const totalPages = productsData?.total_pages || 0

  useEffect(() => {
    setPriceMin(minPriceParam)
    setPriceMax(maxPriceParam)
  }, [minPriceParam, maxPriceParam])

  const updateParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams)
    if (value) p.set(key, value)
    else p.delete(key)
    if (key !== 'page') p.set('page', '1')
    setSearchParams(p)
  }

  const updateMultipleParams = (updates: Record<string, string>) => {
    const p = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    p.set('page', '1')
    setSearchParams(p)
  }

  const applyPriceFilter = () => {
    updateMultipleParams({ min_price: priceMin, max_price: priceMax })
  }

  const clearAllFilters = () => {
    setSearchParams({})
    setPriceMin('')
    setPriceMax('')
  }

  const activeCat = categories.find(c => c.id === categoryId) || categories.flatMap(c => c.children || []).find(c => c.id === categoryId)
  const hasActiveFilters = !!categoryId || onSale || !!minPriceParam || !!maxPriceParam || !!search

  const SidebarContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Categories</h3>
        <div className="space-y-0.5">
          <button onClick={() => { updateParam('category_id', ''); setMobileFiltersOpen(false) }}
            className={`text-sm w-full text-left px-3 py-2 rounded-xl transition ${!categoryId ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            All Products
          </button>
          {categories.map(cat => (
            <div key={cat.id}>
              <button onClick={() => { updateParam('category_id', cat.id); setMobileFiltersOpen(false) }}
                className={`text-sm w-full text-left px-3 py-2 rounded-xl transition flex items-center gap-2.5 ${categoryId === cat.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                {cat.image_url && (
                  <img src={getImageUrl(cat.image_url)} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                )}
                <span className="truncate">{cat.name}</span>
                {cat.children && cat.children.length > 0 && (
                  <span className="ml-auto text-[10px] opacity-50">{cat.children.length}</span>
                )}
              </button>
              {cat.children && cat.children.length > 0 && (categoryId === cat.id || cat.children.some(s => s.id === categoryId)) && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {cat.children.map(sub => (
                    <button key={sub.id} onClick={() => { updateParam('category_id', sub.id); setMobileFiltersOpen(false) }}
                      className={`text-xs w-full text-left px-3 py-1.5 rounded-lg transition ${categoryId === sub.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Price Range</h3>
        {priceRange && (
          <p className="text-[11px] text-gray-400 mb-2">
            {formatCurrency(priceRange.min_price)} — {formatCurrency(priceRange.max_price)}
          </p>
        )}
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300" />
          <span className="text-gray-300">—</span>
          <input type="number" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300" />
        </div>
        <button onClick={applyPriceFilter}
          className="w-full mt-2 bg-gray-100 text-gray-700 text-xs font-medium py-2 rounded-xl hover:bg-gray-200 transition">
          Apply Price
        </button>
      </div>

      {/* On Sale Toggle */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Deals</h3>
        <button onClick={() => { updateParam('on_sale', onSale ? '' : 'true'); setMobileFiltersOpen(false) }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${onSale ? 'bg-red-50 text-red-700 font-medium border border-red-200/60' : 'text-gray-600 hover:bg-gray-50 border border-gray-100'}`}>
          <Tag className="w-4 h-4" />
          On Sale Only
          {onSale && (
            <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Sort */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Sort By</h3>
        <select value={`${sort}-${order}`}
          onChange={e => {
            const [s, o] = e.target.value.split('-')
            updateMultipleParams({ sort: s, order: o })
            setMobileFiltersOpen(false)
          }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white">
          <option value="created_at-desc">Newest</option>
          <option value="created_at-asc">Oldest</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="name-asc">Name: A → Z</option>
          <option value="name-desc">Name: Z → A</option>
        </select>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button onClick={() => { clearAllFilters(); setMobileFiltersOpen(false) }}
          className="w-full text-xs font-medium text-red-500 hover:text-red-600 py-2 transition">
          Clear All Filters
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{activeCat ? `${activeCat.name} — Bazarkon` : search ? `Search: ${search} — Bazarkon` : 'All Products — Bazarkon'}</title>
        <meta name="description" content={activeCat ? `Browse ${activeCat.name} products at Bazarkon.` : 'Browse our full catalog.'} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {search ? `Results for "${search}"` : activeCat ? activeCat.name : 'All Products'}
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-1">{total} product{total !== 1 ? 's' : ''}</p>
          )}
        </motion.div>

        {/* Active filters pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-5">
            {activeCat && (
              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                {activeCat.name}
                <button onClick={() => updateParam('category_id', '')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {onSale && (
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                On Sale
                <button onClick={() => updateParam('on_sale', '')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {(minPriceParam || maxPriceParam) && (
              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                {minPriceParam ? formatCurrency(Number(minPriceParam)) : '$0'} — {maxPriceParam ? formatCurrency(Number(maxPriceParam)) : '∞'}
                <button onClick={() => { updateMultipleParams({ min_price: '', max_price: '' }); setPriceMin(''); setPriceMax('') }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                "{search}"
                <button onClick={() => updateParam('search', '')}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}

        {/* Mobile filter toggle */}
        <button onClick={() => setMobileFiltersOpen(true)}
          className="md:hidden flex items-center gap-2 mb-5 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700">
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {hasActiveFilters && <span className="w-2 h-2 bg-gray-900 rounded-full" />}
        </button>

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-60 shrink-0">
            <div className="sticky top-24">
              <SidebarContent />
            </div>
          </aside>

          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {mobileFiltersOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 md:hidden" onClick={() => setMobileFiltersOpen(false)} />
                <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white z-50 p-6 overflow-y-auto md:hidden shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-lg">Filters</h2>
                    <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <SidebarContent />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-gray-100 rounded-2xl mb-3" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/3 mb-2" />
                    <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-2" />
                    <div className="h-4 bg-gray-100 rounded-full w-1/4" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                <p className="font-medium text-gray-500">No products found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters}
                    className="mt-4 text-sm font-medium text-gray-900 hover:underline">Clear all filters</button>
                )}
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-10">
                    <button onClick={() => updateParam('page', String(page - 1))} disabled={page <= 1}
                      className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) pageNum = i + 1
                        else if (page <= 3) pageNum = i + 1
                        else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                        else pageNum = page - 2 + i
                        return (
                          <button key={pageNum} onClick={() => updateParam('page', String(pageNum))}
                            className={`w-9 h-9 rounded-xl text-sm font-medium transition ${pageNum === page ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => updateParam('page', String(page + 1))} disabled={page >= totalPages}
                      className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
