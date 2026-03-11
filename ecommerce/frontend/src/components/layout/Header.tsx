import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Heart, User, Search, Menu, X, LogOut, Loader2, ShoppingBag } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import AuthModals from '@/components/auth/AuthModals'
import apiClient from '@/api/client'
import type { Product } from '@/types'
import { formatCurrency, getImageUrl } from '@/lib/utils'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isAuthenticated, customer, logout } = useAuthStore()
  const { totalItems } = useCartStore()
  const { favoriteIds } = useFavoritesStore()
  const favoriteCount = favoriteIds.size
  const navigate = useNavigate()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchQuery.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await apiClient.get('/store/search', { params: { q: searchQuery.trim(), page_size: '6' } })
        const items = r.data.data?.items || r.data.data || []
        setSuggestions(items)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
      setSearchLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
      setShowSuggestions(false)
      setMobileOpen(false)
    }
  }

  const handleSuggestionClick = (product: Product) => {
    const identifier = product.slug || product.id
    navigate(`/products/${identifier}`)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="text-xl font-bold tracking-tight text-gray-900">
              Bazarkon
            </Link>

            {/* Search with autocomplete */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full" ref={searchRef}>
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {searchLoading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-200 focus:bg-white transition placeholder:text-gray-400"
                />

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-200/50 overflow-hidden z-50">
                    {suggestions.map(p => (
                      <button key={p.id} type="button" onClick={() => handleSuggestionClick(p)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 transition text-left">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          {p.image_url ? (
                            <img src={getImageUrl(p.image_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(p.price)}</p>
                        </div>
                      </button>
                    ))}
                    <button type="submit"
                      className="w-full px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 border-t border-gray-100 transition">
                      View all results for "{searchQuery}"
                    </button>
                  </div>
                )}
                {showSuggestions && searchQuery.trim().length >= 2 && suggestions.length === 0 && !searchLoading && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-200/50 p-4 z-50 text-center">
                    <p className="text-sm text-gray-400">No products found</p>
                  </div>
                )}
              </div>
            </form>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/products" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">
                Products
              </Link>

              {isAuthenticated && (
                <Link to="/favorites" className="relative p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">
                  <Heart className="w-5 h-5" />
                  {favoriteCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                      {favoriteCount > 99 ? '99+' : favoriteCount}
                    </span>
                  )}
                </Link>
              )}

              <Link to="/cart" className="relative p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>

              {isAuthenticated ? (
                <div className="flex items-center gap-1 ml-1">
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">
                    <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                      {customer?.first_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="max-w-[80px] truncate">{customer?.first_name || 'Account'}</span>
                  </Link>
                  <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 transition" title="Sign out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAuthMode('login')}
                  className="ml-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition shadow-sm">
                  Sign In
                </button>
              )}
            </nav>

            {/* Mobile toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <Link to="/cart" className="relative p-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {totalItems}
                  </span>
                )}
              </Link>
              <button className="p-2" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden pb-4 space-y-2 border-t border-gray-100 pt-3">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm" />
                </div>
              </form>
              <Link to="/products" className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50" onClick={() => setMobileOpen(false)}>Products</Link>
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <button onClick={() => { logout(); setMobileOpen(false) }} className="block w-full text-left px-3 py-2.5 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50">
                    Sign Out
                  </button>
                </>
              ) : (
                <button onClick={() => { setAuthMode('login'); setMobileOpen(false) }}
                  className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-gray-900 rounded-xl hover:bg-gray-50">
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <AuthModals mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />
    </>
  )
}
