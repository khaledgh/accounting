import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { Heart, ShoppingBag, Trash2, ShoppingCart, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import type { FavoriteItem } from '@/types'

export default function FavoritesPage() {
  const { isAuthenticated } = useAuthStore()
  const { addItem } = useCartStore()
  const { toggleFavorite, fetchFavoriteIds } = useFavoritesStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return }
    apiClient.get('/store/favorites')
      .then(r => setItems(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAuthenticated, navigate])

  const handleRemove = async (item: FavoriteItem) => {
    try {
      await toggleFavorite(item.product_id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Removed from favorites')
    } catch {
      toast.error('Failed to remove')
    }
  }

  const handleAddToCart = async (item: FavoriteItem) => {
    try {
      await addItem(item.product_id, 1)
      toast.success(`${item.product_name} added to cart`)
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Helmet><title>My Favorites — Bazarkon</title></Helmet>

      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Favorites</h1>
        {items.length > 0 && (
          <span className="text-sm text-gray-400 ml-1">({items.length})</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 mx-auto text-gray-200 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No favorites yet</h2>
          <p className="text-gray-400 mb-6">Items you favorite will appear here</p>
          <Link to="/products"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition">
            <ShoppingBag className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition"
            >
              <Link to={`/products/${item.product_slug || item.product_id}`}
                className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                {item.product_image ? (
                  <img src={getImageUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.product_slug || item.product_id}`}
                  className="font-semibold text-sm hover:text-blue-600 transition line-clamp-1">
                  {item.product_name}
                </Link>
                <p className="text-base font-bold text-gray-900 mt-1">
                  {formatCurrency(item.product_price)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleAddToCart(item)}
                  className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition"
                  title="Add to cart">
                  <ShoppingCart className="w-4 h-4" />
                </button>
                <button onClick={() => handleRemove(item)}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                  title="Remove from favorites">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
